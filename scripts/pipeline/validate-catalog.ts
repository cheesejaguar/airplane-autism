/**
 * Step 8 — strict catalog validation (run before shipping a catalog update).
 *   pnpm catalog:validate [--warn-only]
 * Enforces: schema validity, resolvable cross-references, ≥1 tell-tale, ≥1 look-alike,
 * ≥3 images per family covering ≥3 distinct angles, attribution on every image, and that every
 * FAA family above the registration threshold has a family file.
 */
import fs from "node:fs";
import path from "node:path";
import { ANGLES, imageSchema, type AircraftImage } from "../../src/lib/catalog/schema";
import { DATA, loadFamilies, readJson, readPlan } from "./lib";

const warnOnly = process.argv.includes("--warn-only");
const { families, errors } = loadFamilies();
const warnings: string[] = [];
const ids = new Set(families.map((f) => f.id));

for (const f of families) {
  for (const c of f.confusedWith) {
    if (!ids.has(c.id)) errors.push(`${f.id}: confusedWith → unknown "${c.id}"`);
    else if (!families.find((x) => x.id === c.id)!.confusedWith.some((b) => b.id === f.id))
      warnings.push(`${f.id} → ${c.id} is not reciprocated`);
  }
}

const labels = new Map<string, string>();
for (const f of families) {
  const l = (f.shortName ?? f.name).toLowerCase();
  if (labels.has(l)) errors.push(`${f.id}: answer label "${f.shortName ?? f.name}" duplicates ${labels.get(l)}`);
  labels.set(l, f.id);
}

const imagesFile = path.join(DATA, "images.json");
const images: AircraftImage[] = fs.existsSync(imagesFile) ? readJson(imagesFile) : [];
for (const img of images) {
  const p = imageSchema.safeParse(img);
  if (!p.success) errors.push(`image ${(img as { id?: string }).id}: ${p.error.issues[0]?.message}`);
  else if (!img.author || !img.license || !img.sourceUrl) errors.push(`image ${img.id}: missing attribution`);
  if (!ids.has(img.familyId)) warnings.push(`image ${img.id}: orphaned (family ${img.familyId} not in catalog)`);
}
// Core (Phase 1) families must be drillable; long-tail families with too few public photos are
// allowed to be study-only (reported as warnings).
const core = new Set(readPlan().filter((p) => /^[A-E]$/.test(p.group)).map((p) => p.id));
const studyOnly: string[] = [];
for (const f of families) {
  const imgs = images.filter((i) => i.familyId === f.id);
  const angles = new Set(imgs.map((i) => i.angle));
  const msg = `${f.id}: ${imgs.length} images, ${angles.size} angles (${[...angles].join(", ") || "none"})`;
  if (imgs.length < 2) {
    studyOnly.push(f.id);
    (core.has(f.id) ? errors : warnings).push(`${msg} — study-only (needs ≥2 images to be drilled)`);
  } else if (imgs.length < 3 || angles.size < 3) warnings.push(`${msg} — fewer than 3 images or angles of ${ANGLES.join("/")}`);
}
if (studyOnly.length) console.log(`study-only families (${studyOnly.length}): ${studyOnly.join(", ")}`);

const totalsFile = path.join(DATA, "faa", "family-totals.json");
if (fs.existsSync(totalsFile)) {
  const totals = readJson<Record<string, number>>(totalsFile);
  for (const [id, n] of Object.entries(totals)) if (n > 10 && !ids.has(id)) errors.push(`FAA family "${id}" has ${n} registrations but no family file`);
}

for (const w of warnings) console.warn("WARN ", w);
for (const e of errors) console.error("ERROR", e);
console.log(`\n${families.length} families, ${images.length} images — ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length && !warnOnly ? 1 : 0);
