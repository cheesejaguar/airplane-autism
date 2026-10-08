/**
 * Compiles data/families/*.json + data/images.json into src/generated/catalog.json for the app.
 * Runs automatically before `dev` and `build`. Invalid families are reported and skipped.
 *   pnpm catalog:build [--strict]
 */
import fs from "node:fs";
import path from "node:path";
import { imageSchema, type AircraftImage } from "../src/lib/catalog/schema";
import { DATA, ROOT, loadFamilies, readJson, writeJson } from "./pipeline/lib";

const strict = process.argv.includes("--strict");
const { families, errors } = loadFamilies();
const ids = new Set(families.map((f) => f.id));

const rawImages = fs.existsSync(path.join(DATA, "images.json")) ? readJson<unknown[]>(path.join(DATA, "images.json")) : [];
const images: AircraftImage[] = [];
for (const raw of rawImages) {
  const p = imageSchema.safeParse(raw);
  if (!p.success) errors.push(`image: ${p.error.issues[0]?.message}`);
  else if (ids.has(p.data.familyId)) images.push(p.data);
}

// Drop dangling confusedWith references (e.g. a planned family that was skipped).
const warnings: string[] = [];
for (const f of families) {
  const before = f.confusedWith.length;
  f.confusedWith = f.confusedWith.filter((c) => ids.has(c.id));
  if (f.confusedWith.length < before) warnings.push(`${f.id}: dropped ${before - f.confusedWith.length} dangling confusedWith`);
}

const withImages = new Set(images.map((i) => i.familyId));
const noImages = families.filter((f) => !withImages.has(f.id)).map((f) => f.id);
if (noImages.length) warnings.push(`${noImages.length} families have no images yet (study-only): ${noImages.slice(0, 12).join(", ")}${noImages.length > 12 ? "…" : ""}`);

families.sort((a, b) => a.name.localeCompare(b.name));
writeJson(path.join(ROOT, "src/generated/catalog.json"), { builtAt: new Date().toISOString(), families, images });
// Tiny client-safe index (id / label / name) for pickers such as the report dialog.
writeJson(
  path.join(ROOT, "src/generated/family-index.json"),
  families.map((f) => ({ id: f.id, label: f.shortName ?? f.name, name: f.name })),
);

for (const w of warnings) console.warn("catalog WARN ", w);
for (const e of errors) console.error("catalog ERROR", e);
console.log(`catalog: ${families.length} families, ${images.length} images`);
if (strict && (errors.length || noImages.length)) process.exit(1);
