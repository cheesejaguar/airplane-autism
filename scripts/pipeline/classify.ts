/**
 * Step 6 — classify harvested candidates with Claude vision via AI Gateway, then select
 * the best ~8 per family with maximal angle diversity.
 *   pnpm pipeline:classify [--only f-16] [--concurrency 6]
 * Results are cached per image in .cache/pipeline/classify/<familyId>.json (reruns are free).
 * Selection is written to .cache/pipeline/selected/<familyId>.json.
 */
import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import sharp from "sharp";
import { generateText, Output } from "ai";
import { z } from "zod";
import { ANGLES, type Family } from "../../src/lib/catalog/schema";
import { CACHE, USER_AGENT, imageIdFor, loadFamilies, loadImageOverrides, readJson, writeJson } from "./lib";
import type { Candidate } from "./harvest";

// Calls are spread across three fast vision models so a single provider's rate limit doesn't
// throttle the whole run; low-confidence matches always get a second opinion from the strong model.
// Override with PIPELINE_MODELS=a,b,c. Default: one inexpensive, accurate multi-image model.
const FAST_MODELS = (process.env.PIPELINE_MODELS ?? "google/gemini-2.5-flash").split(",");
const RECHECK = process.env.PIPELINE_RECHECK === "1";
const STRONG_MODEL = "anthropic/claude-sonnet-5.5";
const PER_FAMILY = 8;
const BATCH = 7;
const FIRST_PASS = 14;
const ENOUGH = 6;

const verdictSchema = z.object({
  matchesType: z
    .boolean()
    .describe("True if the main subject is plausibly the named aircraft type (any listed variant)."),
  confidence: z.number().min(0).max(1).describe("Confidence that the main subject is this type."),
  wholeAircraftVisible: z
    .boolean()
    .describe("True if the entire airframe (nose to tail, both wingtips/rotor) is in frame and not heavily occluded."),
  prominence: z
    .enum(["large", "medium", "small"])
    .describe("How much of the frame the main aircraft fills: large >40%, medium 15–40%, small <15%."),
  multipleAircraftConfusing: z
    .boolean()
    .describe("True if other aircraft of a DIFFERENT type are prominent enough to confuse which one is the subject."),
  angle: z
    .enum(ANGLES)
    .describe(
      "Viewing angle of the subject: front (head-on), front-quarter, side (profile), rear-quarter, rear (tail-on), top (planform from above), belly (planform from below).",
    ),
  inFlight: z.boolean(),
  quality: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Photographic quality for identification: sharpness, exposure, clean background. 5 = excellent."),
  hasOverlayText: z.boolean().describe("Visible watermark, caption or overlay text on the photo."),
  rejectReason: z.string().nullable().describe("Short reason if this image should not be used, else null."),
});

export type Verdict = z.infer<typeof verdictSchema> & { model: string };

function prompt(f: Family, names: Map<string, string>) {
  const lookalikes = f.confusedWith.map((c) => names.get(c.id) ?? c.id).join("; ");
  return [
    `You are curating photos for an aircraft-recognition training deck.`,
    `Expected aircraft type: ${f.name}${f.aka.length ? ` (aka ${f.aka.join(", ")})` : ""}.`,
    f.variants.length ? `Variants included: ${f.variants.join("; ")}.` : "",
    `Key recognition features — wings: ${f.weft.wings.join("; ")}. engines: ${f.weft.engines.join("; ")}. fuselage: ${f.weft.fuselage.join("; ")}. tail: ${f.weft.tail.join("; ")}.`,
    `Common look-alikes (NOT this type): ${lookalikes}.`,
    `Assess the photo. Reject (matchesType=false) if the main subject is a different type, a cockpit/interior/detail shot, a model or replica, or if the aircraft is not identifiable.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function download(url: string): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      console.warn(`  download ${res.status}, retry ${attempt + 1}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${res.status} downloading ${url}`);
  }
}

async function classify(model: string, f: Family, names: Map<string, string>, bytes: Uint8Array) {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: verdictSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt(f, names) },
          { type: "file", mediaType: "image/jpeg", data: bytes },
        ],
      },
    ],
  });
  return { ...output, model } satisfies Verdict;
}

type Prepared = { c: Candidate; bytes: Uint8Array };

/** One limiter for all Wikimedia downloads across families — upload.wikimedia.org rate-limits per IP. */
const dl = pLimit(3);

const batchSchema = z.object({
  verdicts: z.array(verdictSchema.extend({ index: z.number().int().describe("0-based index of the photo this verdict is for") })),
});

/** Classifies several photos in one request (the gateway limits requests, not images). */
async function classifyBatch(model: string, f: Family, names: Map<string, string>, images: Uint8Array[]): Promise<(Verdict | null)[]> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: batchSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${prompt(f, names)}\n\nThere are ${images.length} photos, indexed 0 to ${images.length - 1} in the order given. Return exactly one verdict per photo, each with its index.`,
          },
          ...images.map((data) => ({ type: "file" as const, mediaType: "image/jpeg", data })),
        ],
      },
    ],
  });
  return images.map((_, i) => {
    const v = output.verdicts.find((x) => x.index === i);
    if (!v) return null;
    const { index: _index, ...rest } = v;
    return { ...rest, model };
  });
}

export function isUsable(v: Verdict) {
  return (
    v.matchesType &&
    v.confidence >= 0.6 &&
    v.wholeAircraftVisible &&
    v.prominence !== "small" &&
    !v.multipleAircraftConfusing &&
    !v.hasOverlayText &&
    v.quality >= 3
  );
}

/** Round-robin across angles, best quality first, so each family gets diverse views. */
export function selectDiverse<T extends { verdict: Verdict }>(items: T[], n: number): T[] {
  const score = (x: T) => x.verdict.quality + x.verdict.confidence + (x.verdict.prominence === "large" ? 0.5 : 0);
  const byAngle = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => score(b) - score(a))) {
    const list = byAngle.get(it.verdict.angle) ?? [];
    list.push(it);
    byAngle.set(it.verdict.angle, list);
  }
  const out: T[] = [];
  const queues = [...byAngle.values()].sort((a, b) => score(b[0]) - score(a[0]));
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) out.push(next);
      if (out.length >= n) break;
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : undefined;
  const concurrency = args.includes("--concurrency") ? Number(args[args.indexOf("--concurrency") + 1]) : 3;
  const { families } = loadFamilies();
  const overrides = loadImageOverrides();
  const names = new Map(families.map((f) => [f.id, f.name]));
  // One limiter per fast provider plus one for the strong model.
  const limits = [...FAST_MODELS, STRONG_MODEL].map(() => pLimit(concurrency));
  let rr = 0;
  let calls = 0;

  const familyLimit = pLimit(6);
  await Promise.all(families.filter((x) => !only || only.includes(x.id)).map((f) => familyLimit(async () => {
    const harvestFile = path.join(CACHE, "harvest", `${f.id}.json`);
    if (!fs.existsSync(harvestFile)) {
      console.warn(`${f.id}: no harvest — run pipeline:harvest first`);
      return;
    }
    const candidates = readJson<Candidate[]>(harvestFile);
    const cacheFile = path.join(CACHE, "classify", `${f.id}.json`);
    const cache: Record<string, Verdict | { error: string }> = fs.existsSync(cacheFile) ? readJson(cacheFile) : {};

    // Lazy: classify the best-ranked half first; only fall back to the rest if too few are usable.
    const usableSoFar = () => candidates.filter((c) => { const v = cache[c.title]; return v && !("error" in v) && isUsable(v); }).length;
    const pending = candidates.filter((c) => !cache[c.title] || "error" in cache[c.title]);
    const firstPass = candidates.slice(0, FIRST_PASS);
    let todo = pending.filter((c) => firstPass.includes(c));
    if (!todo.length && usableSoFar() < ENOUGH) todo = pending;
    // Fetch the already-rendered 960px Commons thumbnails (other sizes trigger Wikimedia's
    // thumbnail rate limits) and downscale locally — 512px is plenty to judge type and angle.
    const prepared = (
      await Promise.all(
        todo.map((c) =>
          dl(async (): Promise<Prepared | null> => {
            try {
              const raw = await download(c.thumb);
              const bytes = new Uint8Array(await sharp(raw).resize({ width: 384, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
              return { c, bytes };
            } catch (e) {
              cache[c.title] = { error: (e as Error).message };
              return null;
            }
          }),
        ),
      )
    ).filter((x): x is Prepared => !!x);

    const runBatches = async (items: typeof prepared, pickModel: () => { model: string; lane: number }) => {
      const chunks: (typeof prepared)[] = [];
      for (let i = 0; i < items.length; i += BATCH) chunks.push(items.slice(i, i + BATCH));
      await Promise.all(
        chunks.map((chunk) => {
          const { model, lane } = pickModel();
          return limits[lane](async () => {
            try {
              const t = Date.now();
              const verdicts = await classifyBatch(model, f, names, chunk.map((x) => x.bytes));
              calls++;
              if (process.env.PIPELINE_DEBUG) console.log(`  ${f.id} batch ${chunk.length} ${model} ${Date.now() - t}ms`);
              chunk.forEach((x, i) => {
                if (verdicts[i]) cache[x.c.title] = verdicts[i]!;
              });
            } catch (e) {
              for (const x of chunk) cache[x.c.title] = { error: (e as Error).message };
            }
          });
        }),
      );
    };

    await runBatches(prepared, () => {
      const lane = rr++ % FAST_MODELS.length;
      return { model: FAST_MODELS[lane], lane };
    });
    // Borderline type matches get a second opinion from the stronger model.
    const borderline = prepared.filter((x) => {
      const v = cache[x.c.title];
      return v && !("error" in v) && v.matchesType && v.confidence < 0.75;
    });
    if (RECHECK && borderline.length) await runBatches(borderline, () => ({ model: STRONG_MODEL, lane: FAST_MODELS.length }));
    if (usableSoFar() < ENOUGH && todo.length !== pending.length) {
      const rest = pending.filter((c) => !todo.includes(c));
      const more = (await Promise.all(rest.map((c) => dl(async (): Promise<Prepared | null> => {
        try {
          const raw = await download(c.thumb);
          return { c, bytes: new Uint8Array(await sharp(raw).resize({ width: 384, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()) };
        } catch (e) {
          cache[c.title] = { error: (e as Error).message };
          return null;
        }
      })))).filter((x): x is Prepared => !!x);
      await runBatches(more, () => {
        const lane = rr++ % FAST_MODELS.length;
        return { model: FAST_MODELS[lane], lane };
      });
    }
    writeJson(cacheFile, cache);

    const usable = candidates
      .map((c) => ({ candidate: c, verdict: cache[c.title] }))
      .filter((x): x is { candidate: Candidate; verdict: Verdict } => !!x.verdict && !("error" in x.verdict))
      .filter((x) => isUsable(x.verdict))
      // Human corrections from user reports: drop blocked photos, fix angle tags.
      .filter((x) => !overrides.blocked[imageIdFor(f.id, x.candidate.title)])
      .map((x) => {
        const angle = overrides.angles[imageIdFor(f.id, x.candidate.title)];
        return angle ? { ...x, verdict: { ...x.verdict, angle: angle as Verdict["angle"] } } : x;
      });
    const selected = selectDiverse(usable, PER_FAMILY);
    writeJson(path.join(CACHE, "selected", `${f.id}.json`), selected);
    const angles = new Set(selected.map((s) => s.verdict.angle));
    const flag = selected.length < 3 || angles.size < 3 ? "  ⚠ needs more images" : "";
    console.log(`${f.id}: ${usable.length}/${candidates.length} usable → ${selected.length} selected, ${angles.size} angles${flag}`);
  })));
  console.log(`model calls this run: ${calls}`);
}

main();
