import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { familySchema, type Family } from "../../src/lib/catalog/schema";

export const ROOT = path.resolve(import.meta.dirname, "../..");
loadEnv({ path: path.join(ROOT, ".env.local"), quiet: true });
export const DATA = path.join(ROOT, "data");
export const FAMILIES_DIR = path.join(DATA, "families");
export const CACHE = path.join(ROOT, ".cache", "pipeline");

export const USER_AGENT =
  "TallyAircraftTrainer/0.1 (https://github.com/cheesejaguar/airplane-autism; aircraft recognition training app) node";

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, data: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export type PlanEntry = { id: string; name: string; group: string };

export function readPlan(): PlanEntry[] {
  return readJson<{ families: PlanEntry[] }>(path.join(DATA, "catalog-plan.json")).families;
}

export function familyFiles(): string[] {
  return fs
    .readdirSync(FAMILIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(FAMILIES_DIR, f));
}

export function loadFamilies(): { families: Family[]; errors: string[] } {
  const families: Family[] = [];
  const errors: string[] = [];
  for (const file of familyFiles()) {
    const raw = readJson<unknown>(file);
    const parsed = familySchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(
        `${path.basename(file)}: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
      continue;
    }
    if (`${parsed.data.id}.json` !== path.basename(file)) {
      errors.push(`${path.basename(file)}: id "${parsed.data.id}" does not match filename`);
    }
    families.push(parsed.data);
  }
  return { families, errors };
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, retries = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
}
