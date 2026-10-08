/**
 * Phase 2 — write FAA results back into family files.
 *   pnpm pipeline:apply-faa
 * Sets faaModelCodes on every family from data/faa/family-map.json and, for civil families,
 * replaces usCount with the FAA valid-registration total (the authoritative civil figure).
 * Military / "both" families keep their researched counts unless the FAA total is larger.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, FAMILIES_DIR, readJson, writeJson } from "./lib";

const map = readJson<Record<string, string | null>>(path.join(DATA, "faa", "family-map.json"));
const totals = readJson<Record<string, number>>(path.join(DATA, "faa", "family-totals.json"));
const codesByFamily = new Map<string, string[]>();
for (const [code, id] of Object.entries(map)) if (id) codesByFamily.set(id, [...(codesByFamily.get(id) ?? []), code]);

const asOf = new Date().toISOString().slice(0, 7);
let updated = 0;
for (const file of fs.readdirSync(FAMILIES_DIR).filter((f) => f.endsWith(".json"))) {
  const full = path.join(FAMILIES_DIR, file);
  const fam = readJson<Record<string, unknown> & { id: string; sector: string; usCount: { value: number; source: string; asOf: string } }>(full);
  const codes = (codesByFamily.get(fam.id) ?? []).sort();
  const total = totals[fam.id] ?? 0;
  fam.faaModelCodes = codes;
  if (total > 10 && (fam.sector === "civil" || total > fam.usCount.value)) {
    fam.usCount = { value: total, source: "FAA Releasable Aircraft Database — valid registrations", asOf };
  }
  writeJson(full, fam);
  updated++;
}
console.log(`updated ${updated} family files`);
