/**
 * Appends look-alike back-references proposed by Phase 2 authors to existing family files, so that
 * confusedWith links (and therefore distractors and hints) work in both directions.
 *   pnpm pipeline:reciprocals
 * Input: data/families/_reciprocals/*.json → [{ existingId, newId, howToTell }]
 */
import fs from "node:fs";
import path from "node:path";
import { FAMILIES_DIR, readJson, writeJson } from "./lib";

type Rec = { existingId: string; newId: string; howToTell: string };
const dir = path.join(FAMILIES_DIR, "_reciprocals");
const recs = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => readJson<Rec[]>(path.join(dir, f)))
  : [];

let added = 0;
const skipped: string[] = [];
for (const r of recs) {
  const existingFile = path.join(FAMILIES_DIR, `${r.existingId}.json`);
  if (!fs.existsSync(existingFile) || !fs.existsSync(path.join(FAMILIES_DIR, `${r.newId}.json`))) {
    skipped.push(`${r.existingId}←${r.newId}`);
    continue;
  }
  const fam = readJson<{ confusedWith: { id: string; howToTell: string }[] }>(existingFile);
  if (fam.confusedWith.some((c) => c.id === r.newId) || fam.confusedWith.length >= 6) continue;
  fam.confusedWith.push({ id: r.newId, howToTell: r.howToTell });
  writeJson(existingFile, fam);
  added++;
}
console.log(`added ${added} reciprocal look-alikes; skipped ${skipped.length}${skipped.length ? `: ${skipped.join(", ")}` : ""}`);
