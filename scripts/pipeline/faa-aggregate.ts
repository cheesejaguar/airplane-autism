/**
 * Phase 2 — FAA registry ingest.
 *   pnpm pipeline:faa            (downloads ReleasableAircraft.zip if missing, then aggregates)
 *
 * Counts *valid* US registrations (STATUS CODE "V") per ACFTREF make/model code, restricted to:
 *   - TYPE AIRCRAFT 4/5 (fixed-wing single/multi engine) and 6 (rotorcraft)
 *   - certificated aircraft: airworthiness class 1 (standard), 2 (limited), 3 (restricted),
 *     6 (multiple), 7 (primary), plus experimental exhibition/racing/crew-training (43/44/45),
 *     which is where most privately flown warbirds live.
 *   - EXCLUDES experimental amateur-built (42), kit (47/48), R&D/market-survey (41/46),
 *     special light-sport (9x), gliders, balloons, airships, weight-shift and powered parachutes.
 * Registration counts are a stand-in for "flying" — the FAA does not record airworthiness status.
 *
 * Output: data/faa/model-counts.json (codes with ≥ 3 registrations, sorted by count).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { CACHE, DATA, USER_AGENT, writeJson } from "./lib";

const FAA_DIR = path.join(CACHE, "..", "faa");
const ZIP_URL = "https://registry.faa.gov/database/ReleasableAircraft.zip";

const TYPE_AIRCRAFT: Record<string, string> = { "4": "fixed-wing-single", "5": "fixed-wing-multi", "6": "rotorcraft" };
const TYPE_ENGINE: Record<string, string> = {
  "0": "none",
  "1": "reciprocating",
  "2": "turboprop",
  "3": "turboshaft",
  "4": "turbojet",
  "5": "turbofan",
  "6": "ramjet",
  "7": "2-cycle",
  "8": "4-cycle",
  "9": "unknown",
  "10": "electric",
  "11": "rotary",
};

export type ModelCount = {
  code: string;
  mfr: string;
  model: string;
  typeAircraft: string;
  typeEngine: string;
  engines: number;
  seats: number;
  count: number;
  /** breakdown by airworthiness certificate class prefix, e.g. { "1": 812, "43": 4 } */
  certs: Record<string, number>;
};

function certClass(cert: string): string | null {
  const c = cert.trim();
  if (!c) return null;
  const cls = c[0];
  if (["1", "2", "3", "6", "7"].includes(cls)) return cls;
  if (cls === "4" && ["3", "4", "5"].includes(c[1] ?? "")) return c.slice(0, 2);
  return null;
}

async function ensureDownloaded() {
  const master = path.join(FAA_DIR, "MASTER.txt");
  if (fs.existsSync(master)) return;
  fs.mkdirSync(FAA_DIR, { recursive: true });
  console.log("Downloading FAA registry…");
  const res = await fetch(ZIP_URL, { headers: { "User-Agent": `Mozilla/5.0 ${USER_AGENT}` } });
  if (!res.ok) throw new Error(`FAA download failed: ${res.status}`);
  const zip = path.join(FAA_DIR, "ReleasableAircraft.zip");
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", zip, "-d", FAA_DIR]);
}

function readLines(file: string) {
  return createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
}

async function main() {
  await ensureDownloaded();

  // ACFTREF: CODE,MFR,MODEL,TYPE-ACFT,TYPE-ENG,AC-CAT,BUILD-CERT-IND,NO-ENG,NO-SEATS,...
  const ref = new Map<string, Omit<ModelCount, "count" | "certs">>();
  let first = true;
  for await (const line of readLines(path.join(FAA_DIR, "ACFTREF.txt"))) {
    if (first) {
      first = false;
      continue;
    }
    const f = line.split(",");
    if (f.length < 9) continue;
    ref.set(f[0].trim(), {
      code: f[0].trim(),
      mfr: f[1].trim(),
      model: f[2].trim(),
      typeAircraft: TYPE_AIRCRAFT[f[3].trim()] ?? f[3].trim(),
      typeEngine: TYPE_ENGINE[f[4].trim()] ?? f[4].trim(),
      engines: Number(f[7]) || 0,
      seats: Number(f[8]) || 0,
    });
  }

  // MASTER: index columns by header name (the file carries a BOM and trailing commas).
  const counts = new Map<string, ModelCount>();
  let header: string[] | null = null;
  let col: Record<string, number> = {};
  let total = 0;
  for await (const line of readLines(path.join(FAA_DIR, "MASTER.txt"))) {
    const f = line.split(",");
    if (!header) {
      header = f.map((h) => h.replace(/^﻿/, "").trim());
      col = Object.fromEntries(header.map((h, i) => [h, i]));
      continue;
    }
    if (f[col["STATUS CODE"]]?.trim() !== "V") continue;
    if (!TYPE_AIRCRAFT[f[col["TYPE AIRCRAFT"]]?.trim()]) continue;
    const cls = certClass(f[col["CERTIFICATION"]] ?? "");
    if (!cls) continue;
    const code = f[col["MFR MDL CODE"]].trim();
    const r = ref.get(code);
    if (!r) continue;
    const entry = counts.get(code) ?? { ...r, count: 0, certs: {} };
    entry.count++;
    entry.certs[cls] = (entry.certs[cls] ?? 0) + 1;
    counts.set(code, entry);
    total++;
  }

  const rows = [...counts.values()].filter((r) => r.count >= 3).sort((a, b) => b.count - a.count);
  writeJson(path.join(DATA, "faa", "model-counts.json"), {
    source: ZIP_URL,
    generatedAt: new Date().toISOString(),
    totalRegistrations: total,
    rows,
  });
  console.log(`${total} qualifying registrations across ${counts.size} model codes; ${rows.length} codes with ≥3 written`);
}

main();
