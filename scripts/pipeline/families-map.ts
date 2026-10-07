/**
 * Phase 2 — map FAA make/model codes to visual families.
 *   pnpm pipeline:map [--force]
 *
 * 1. Groups data/faa/model-counts.json rows by normalised manufacturer.
 * 2. Asks Claude (via AI Gateway) to assign each code to an existing family id, a proposed new
 *    visual family, or "exclude" (not a distinct recognisable type / not in scope).
 * 3. Consolidates proposed new families across batches (merging duplicates).
 * 4. Writes data/faa/family-map.json  { code → familyId | null }
 *    and data/faa/new-families.json   (proposed families with total count > 10, for authoring).
 * Results per batch are cached in .cache/pipeline/map/ so reruns are cheap and reviewable.
 */
import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CACHE, DATA, loadFamilies, readJson, readPlan, writeJson } from "./lib";
import type { ModelCount } from "./faa-aggregate";

const MODEL = "anthropic/claude-sonnet-5.5";
const THRESHOLD = 10; // a family needs MORE than this many registrations

const ALIASES: [RegExp, string][] = [
  [/^(TEXTRON AVIATION|CESSNA)/, "CESSNA-TEXTRON"],
  [/^(BEECH|RAYTHEON|HAWKER BEECHCRAFT|BEECHCRAFT)/, "CESSNA-TEXTRON"],
  [/^(EUROCOPTER|AIRBUS HELICOPTERS|AEROSPATIALE|SUD AVIATION|MBB|MESSERSCHMITT|AIRBUS)/, "AIRBUS"],
  [/^(BELL|TEXTRON CANADA)/, "BELL"],
  [/^(HUGHES|MD HELICOPTERS|MCDONNELL DOUGLAS HELI)/, "MD-HUGHES"],
  [/^(SCHWEIZER|SIKORSKY)/, "SIKORSKY-SCHWEIZER"],
  [/^(AGUSTA|LEONARDO|AGUSTAWESTLAND)/, "LEONARDO"],
  [/^(NORTH AMERICAN|NORTH AMER|ROCKWELL|NAVION|RYAN)/, "NORTH-AMERICAN-ROCKWELL"],
  [/^(GRUMMAN|AMERICAN AVIATION|GULFSTREAM AMERICAN|AMERICAN GENERAL|TIGER AIRCRAFT)/, "GRUMMAN-AMERICAN"],
  [/^(GULFSTREAM|GRUMMAN AMERICAN)/, "GULFSTREAM"],
  [/^(BOMBARDIER|CANADAIR|LEARJET|GATES LEARJET|DE HAVILLAND|VIKING AIR)/, "BOMBARDIER-DEHAVILLAND"],
  [/^(MOONEY)/, "MOONEY"],
  [/^(CHAMPION|AMERICAN CHAMPION|BELLANCA|AERONCA)/, "CHAMPION-BELLANCA-AERONCA"],
  [/^(SOCATA|DAHER|AEROSPATIALE)/, "DAHER-SOCATA"],
  [/^(MAULE)/, "MAULE"],
  [/^(DIAMOND)/, "DIAMOND"],
  [/^(EMBRAER)/, "EMBRAER"],
  [/^(BOEING|MCDONNELL DOUGLAS|DOUGLAS)/, "BOEING-DOUGLAS"],
];

function mfrKey(mfr: string): string {
  const m = mfr.toUpperCase().replace(/\s+/g, " ").trim();
  for (const [re, key] of ALIASES) if (re.test(m)) return key;
  return m.split(" ").slice(0, 2).join(" ");
}

const assignmentSchema = z.object({
  assignments: z.array(
    z.object({
      code: z.string(),
      decision: z.enum(["existing", "new", "exclude"]),
      familyId: z
        .string()
        .nullable()
        .describe("Existing family id when decision=existing; proposed kebab-case id when decision=new; null for exclude."),
      newFamilyName: z.string().nullable().describe("Display name for a proposed new family, e.g. 'Cessna 177 Cardinal'."),
      reason: z.string().nullable().describe("Short reason when decision=exclude."),
    }),
  ),
});

const mergeSchema = z.object({
  merges: z.array(z.object({ from: z.string(), into: z.string() })).describe("Proposed ids that duplicate another proposed or existing id."),
});

type Assignment = z.infer<typeof assignmentSchema>["assignments"][number];

const RULES = `Rules for grouping:
- A "visual family" is a set of variants a trained spotter cannot reliably tell apart from a photo. Merge sub-variants (Cessna 172/172M/172S → one family; PA-28-140/161/181 → one family; Bonanza A36/F33 together but V35 V-tail separate).
- Split when there is a glanceable difference (V-tail vs straight tail, tailwheel vs tricycle when it defines the type, single vs twin, high vs low wing, T-tail vs conventional, clearly different size class).
- Use an EXISTING family id whenever the code belongs to it — check variants listed for each family.
- Propose NEW families for real, recognisable production types not in the list. Reuse the same proposed id for every code of that type. Ids are short kebab-case like "c177", "pa-22", "beech-95", "bell-222", "aero-commander-500".
- decision="exclude" for: one-off or unidentifiable entries, prototype/test codes, gliders/balloons/gyros mislabeled, kit-built designs, and anything that is clearly a duplicate administrative code with no aircraft identity.
- Every input code must appear exactly once in the output.`;

async function main() {
  const force = process.argv.includes("--force");
  const { rows } = readJson<{ rows: ModelCount[] }>(path.join(DATA, "faa", "model-counts.json"));
  const { families } = loadFamilies();
  // Planned families count as existing even before their files are authored.
  const authored = new Set(families.map((f) => f.id));
  const familyList = [
    ...families.map((f) => `${f.id}: ${f.name}${f.variants.length ? ` [${f.variants.slice(0, 6).join("; ")}]` : ""} (${f.category})`),
    ...readPlan()
      .filter((p) => !authored.has(p.id))
      .map((p) => `${p.id}: ${p.name}`),
  ].join("\n");

  const groups = new Map<string, ModelCount[]>();
  for (const r of rows) groups.set(mfrKey(r.mfr), [...(groups.get(mfrKey(r.mfr)) ?? []), r]);

  // Split very large manufacturer groups into batches of ≤150 rows, keeping model order.
  const batches: { key: string; rows: ModelCount[] }[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.model.localeCompare(b.model));
    for (let i = 0; i < sorted.length; i += 150) batches.push({ key: `${key}#${i / 150}`, rows: sorted.slice(i, i + 150) });
  }
  console.log(`${rows.length} codes in ${batches.length} batches`);

  const cacheDir = path.join(CACHE, "map");
  const limit = pLimit(16);
  const all: (Assignment & { count: number; mfr: string; model: string; typeAircraft: string })[] = [];

  await Promise.all(
    batches.map((b) =>
      limit(async () => {
        const file = path.join(cacheDir, `${b.key.replace(/[^a-z0-9#-]+/gi, "_")}.json`);
        let result: Assignment[];
        if (!force && fs.existsSync(file)) result = readJson(file);
        else {
          const lines = b.rows.map((r) => `${r.code} | ${r.mfr} | ${r.model} | ${r.typeAircraft} | ${r.engines} eng ${r.typeEngine} | ${r.seats} seats | ${r.count} reg`).join("\n");
          const { output } = await generateText({
            model: MODEL,
            output: Output.object({ schema: assignmentSchema }),
            prompt: `You map FAA aircraft registry make/model codes to visual aircraft families for a US aircraft-recognition trainer.\n\n${RULES}\n\nEXISTING FAMILIES (id: name [variants] (category)):\n${familyList}\n\nFAA CODES (code | manufacturer | model | type | engines | seats | registrations):\n${lines}`,
          });
          result = output.assignments;
          writeJson(file, result);
          console.log(`${b.key}: ${result.length}/${b.rows.length} assigned`);
        }
        const byCode = new Map(b.rows.map((r) => [r.code, r]));
        for (const a of result) {
          const r = byCode.get(a.code);
          if (r) all.push({ ...a, count: r.count, mfr: r.mfr, model: r.model, typeAircraft: r.typeAircraft });
        }
      }),
    ),
  );

  // Consolidate duplicate proposals across batches.
  const proposed = new Map<string, { name: string; count: number; samples: string[] }>();
  for (const a of all.filter((x) => x.decision === "new" && x.familyId)) {
    const p = proposed.get(a.familyId!) ?? { name: a.newFamilyName ?? a.familyId!, count: 0, samples: [] };
    p.count += a.count;
    if (p.samples.length < 4) p.samples.push(`${a.mfr} ${a.model}`);
    proposed.set(a.familyId!, p);
  }
  const mergeFile = path.join(cacheDir, "_merges.json");
  let merges: { from: string; into: string }[] = [];
  if (!force && fs.existsSync(mergeFile)) merges = readJson(mergeFile);
  else if (proposed.size) {
    const list = [...proposed.entries()].map(([id, p]) => `${id}: ${p.name} — e.g. ${p.samples.join("; ")} (${p.count} reg)`).join("\n");
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: mergeSchema }),
      prompt: `These are proposed new aircraft visual families from separate batches. Identify duplicates (same visual family under different ids) and proposals that duplicate an EXISTING family. Return merges from→into. Only merge true duplicates.\n\n${RULES}\n\nEXISTING FAMILIES:\n${familyList}\n\nPROPOSED:\n${list}`,
    });
    merges = output.merges;
    writeJson(mergeFile, merges);
  }
  const resolve = (id: string) => {
    let cur = id;
    for (let i = 0; i < 5; i++) {
      const m = merges.find((x) => x.from === cur);
      if (!m) break;
      cur = m.into;
    }
    return cur;
  };

  const existingIds = new Set([...families.map((f) => f.id), ...readPlan().map((p) => p.id)]);
  const familyMap: Record<string, string | null> = {};
  const totals = new Map<string, number>();
  const newFamilies = new Map<string, { id: string; name: string; count: number; codes: string[]; examples: string[]; typeAircraft: string }>();
  for (const a of all) {
    const id = a.decision === "exclude" || !a.familyId ? null : resolve(a.familyId);
    familyMap[a.code] = id;
    if (!id) continue;
    totals.set(id, (totals.get(id) ?? 0) + a.count);
    if (!existingIds.has(id)) {
      const nf = newFamilies.get(id) ?? { id, name: proposed.get(id)?.name ?? a.newFamilyName ?? id, count: 0, codes: [], examples: [], typeAircraft: a.typeAircraft };
      nf.count += a.count;
      nf.codes.push(a.code);
      if (nf.examples.length < 6) nf.examples.push(`${a.mfr} ${a.model} (${a.count})`);
      newFamilies.set(id, nf);
    }
  }

  writeJson(path.join(DATA, "faa", "family-map.json"), familyMap);
  const qualifying = [...newFamilies.values()].filter((f) => f.count > THRESHOLD).sort((a, b) => b.count - a.count);
  writeJson(path.join(DATA, "faa", "new-families.json"), qualifying);
  writeJson(
    path.join(DATA, "faa", "family-totals.json"),
    Object.fromEntries([...totals.entries()].sort((a, b) => b[1] - a[1])),
  );
  const excluded = all.filter((a) => a.decision === "exclude").reduce((n, a) => n + a.count, 0);
  console.log(
    `mapped ${all.length} codes; ${existingIds.size} existing families; ${qualifying.length} new families above ${THRESHOLD}; ${newFamilies.size - qualifying.length} below; ${excluded} registrations excluded`,
  );
}

main();
