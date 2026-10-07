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
import { DATA, loadFamilies, readJson } from "./lib";

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
for (const f of families) {
  const imgs = images.filter((i) => i.familyId === f.id);
  const angles = new Set(imgs.map((i) => i.angle));
  if (imgs.length < 3) errors.push(`${f.id}: only ${imgs.length} images (need ≥3)`);
  else if (angles.size < 3) errors.push(`${f.id}: only ${angles.size} distinct angles (${[...angles].join(", ")}; need ≥3 of ${ANGLES.join("/")})`);
}

const totalsFile = path.join(DATA, "faa", "family-totals.json");
if (fs.existsSync(totalsFile)) {
  const totals = readJson<Record<string, number>>(totalsFile);
  for (const [id, n] of Object.entries(totals)) if (n > 10 && !ids.has(id)) errors.push(`FAA family "${id}" has ${n} registrations but no family file`);
}

for (const w of warnings) console.warn("WARN ", w);
for (const e of errors) console.error("ERROR", e);
console.log(`\n${families.length} families, ${images.length} images — ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length && !warnOnly ? 1 : 0);
