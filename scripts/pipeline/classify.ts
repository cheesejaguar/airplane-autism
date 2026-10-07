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
import { generateText, Output } from "ai";
import { z } from "zod";
import { ANGLES, type Family } from "../../src/lib/catalog/schema";
import { CACHE, USER_AGENT, loadFamilies, readJson, writeJson } from "./lib";
import type { Candidate } from "./harvest";

const FAST_MODEL = "anthropic/claude-haiku-4.5";
const STRONG_MODEL = "anthropic/claude-sonnet-5.5";
const PER_FAMILY = 8;

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
  const concurrency = args.includes("--concurrency") ? Number(args[args.indexOf("--concurrency") + 1]) : 10;
  const { families } = loadFamilies();
  const names = new Map(families.map((f) => [f.id, f.name]));
  const limit = pLimit(concurrency);
  let calls = 0;

  const familyLimit = pLimit(5);
  await Promise.all(families.filter((x) => !only || only.includes(x.id)).map((f) => familyLimit(async () => {
    const harvestFile = path.join(CACHE, "harvest", `${f.id}.json`);
    if (!fs.existsSync(harvestFile)) {
      console.warn(`${f.id}: no harvest — run pipeline:harvest first`);
      return;
    }
    const candidates = readJson<Candidate[]>(harvestFile);
    const cacheFile = path.join(CACHE, "classify", `${f.id}.json`);
    const cache: Record<string, Verdict | { error: string }> = fs.existsSync(cacheFile) ? readJson(cacheFile) : {};

    await Promise.all(
      candidates.map((c) =>
        limit(async () => {
          if (cache[c.title] && !("error" in cache[c.title])) return;
          try {
            const bytes = await download(c.thumb);
            let v = await classify(FAST_MODEL, f, names, bytes);
            calls++;
            // Borderline type match → second opinion from the stronger model.
            if (v.matchesType && v.confidence < 0.75) {
              v = await classify(STRONG_MODEL, f, names, bytes);
              calls++;
            }
            cache[c.title] = v;
          } catch (e) {
            cache[c.title] = { error: (e as Error).message };
          }
        }),
      ),
    );
    writeJson(cacheFile, cache);

    const usable = candidates
      .map((c) => ({ candidate: c, verdict: cache[c.title] }))
      .filter((x): x is { candidate: Candidate; verdict: Verdict } => !!x.verdict && !("error" in x.verdict))
      .filter((x) => isUsable(x.verdict));
    const selected = selectDiverse(usable, PER_FAMILY);
    writeJson(path.join(CACHE, "selected", `${f.id}.json`), selected);
    const angles = new Set(selected.map((s) => s.verdict.angle));
    const flag = selected.length < 3 || angles.size < 3 ? "  ⚠ needs more images" : "";
    console.log(`${f.id}: ${usable.length}/${candidates.length} usable → ${selected.length} selected, ${angles.size} angles${flag}`);
  })));
  console.log(`model calls this run: ${calls}`);
}

main();
