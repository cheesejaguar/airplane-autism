/**
 * Step 5 — harvest candidate photos from Wikimedia Commons.
 *   pnpm pipeline:harvest [--only f-16,b-52] [--force]
 * Crawls each family's commonsCategories (depth ≤ 2), filters by mime/size/license/keywords,
 * and writes .cache/pipeline/harvest/<familyId>.json with up to MAX_CANDIDATES candidates.
 */
import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { CACHE, fetchJson, loadFamilies, writeJson } from "./lib";

const API = "https://commons.wikimedia.org/w/api.php";
const MAX_CANDIDATES = 28;
const MAX_SUBCATS_PER_LEVEL = 25;
const MAX_CATEGORIES_VISITED = 45;
const MAX_TITLES = 600;
const MIN_WIDTH = 1200;

const BAD_CATEGORY =
  /interior|cockpit|cabin|engines?\b|\bmodels\b|scale model|drawing|diagram|crash|accident|wreck|patch|insignia|logo|video|manufactur|production|construction|assembly|simulator|maintenance|\bseats?\b|galley|instrument|livery details|nose art|details|parts|mockup|replica|toy|museum|memorial|gate guard|on display|static display|wheel|landing gear|propeller|weapon|bomb|missile|ordnance|people|crew|pilot|ceremon|stamp|\bart\b|paintings|in art|postcard|scale/i;
const BAD_TITLE =
  /cockpit|interior|cabin|panel|\bseats?\b|engine|nacelle|propeller|wheel|\bgear\b|\btire|\btyre|wreck|crash|museum|\bmodels?\b(?! ?\d)|\btoy|diagram|drawing|patch|logo|crew|pilot|inside|galley|lavatory|instrument|detail|close-?up|stamp|replica/i;
const LICENSE_OK = /^(cc[ -]?by(-sa)?([ -][\d.]+)?|cc0|public domain|pd\b|pd-)/i;

type CmResponse = {
  continue?: { cmcontinue: string };
  query: { categorymembers: { title: string; ns: number }[] };
};

type ImageInfo = {
  url: string;
  thumburl?: string;
  width: number;
  height: number;
  mime: string;
  descriptionurl: string;
  extmetadata?: Record<string, { value: string } | undefined>;
};

type IiResponse = {
  continue?: Record<string, string>;
  query?: { pages: Record<string, { title: string; missing?: string; imageinfo?: ImageInfo[] }> };
};

export type Candidate = {
  title: string;
  thumb: string; // ~960px thumbnail for classification
  original: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  fromInFlightCategory: boolean;
};

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function categoryMembers(category: string, type: "file" | "subcat"): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmtype: type,
      cmlimit: "500",
    });
    if (cont) params.set("cmcontinue", cont);
    const data = await fetchJson<CmResponse>(`${API}?${params}`);
    titles.push(...data.query.categorymembers.map((m) => m.title));
    cont = data.continue?.cmcontinue;
  } while (cont && titles.length < 2000);
  return titles;
}

/** Deterministic shuffle so reruns pick the same candidates. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function collectTitles(roots: string[]): Promise<Map<string, boolean>> {
  // title -> came from an "in flight" category
  const files = new Map<string, boolean>();
  const seen = new Set<string>();
  let frontier = roots.map((c) => ({ cat: c, depth: 0 }));
  while (frontier.length && files.size < MAX_TITLES) {
    const next: typeof frontier = [];
    for (const { cat, depth } of frontier) {
      if (seen.has(cat)) continue;
      if (seen.size >= MAX_CATEGORIES_VISITED || files.size >= MAX_TITLES) break;
      seen.add(cat);
      const inFlight = /in flight|flying|airborne/i.test(cat);
      for (const t of await categoryMembers(cat, "file")) {
        if (!files.has(t) || inFlight) files.set(t, files.get(t) || inFlight);
      }
      if (depth < 2) {
        const subs = (await categoryMembers(cat, "subcat"))
          .map((s) => s.replace(/^Category:/, ""))
          .filter((s) => !BAD_CATEGORY.test(s));
        // Prefer in-flight subcats, then a seeded sample of the rest.
        const ranked = [
          ...subs.filter((s) => /in flight/i.test(s)),
          ...seededShuffle(subs.filter((s) => !/in flight/i.test(s)), cat),
        ].slice(0, MAX_SUBCATS_PER_LEVEL);
        next.push(...ranked.map((s) => ({ cat: s, depth: depth + 1 })));
      }
    }
    frontier = next;
  }
  return files;
}

async function imageInfo(titles: string[]): Promise<Map<string, ImageInfo>> {
  const out = new Map<string, ImageInfo>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "960",
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit|UsageTerms",
      titles: batch.join("|"),
    });
    const data = await fetchJson<IiResponse>(`${API}?${params}`);
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (info) out.set(page.title, info);
    }
  }
  return out;
}

async function harvestFamily(id: string, categories: string[]): Promise<Candidate[]> {
  const titleMap = await collectTitles(categories);
  const titles = [...titleMap.keys()].filter((t) => /\.jpe?g$/i.test(t) && !BAD_TITLE.test(t));
  const sampled = [
    ...seededShuffle(titles.filter((t) => titleMap.get(t)), id),
    ...seededShuffle(titles.filter((t) => !titleMap.get(t)), id),
  ].slice(0, MAX_TITLES);
  const infos = await imageInfo(sampled);

  const ok: Candidate[] = [];
  for (const title of sampled) {
    const info = infos.get(title);
    if (!info || info.mime !== "image/jpeg" || info.width < MIN_WIDTH || !info.thumburl) continue;
    if (info.width / info.height > 2.6 || info.width / info.height < 0.9) continue; // panoramas/portrait
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    if (!LICENSE_OK.test(license)) continue;
    const author = stripHtml(meta.Artist?.value ?? "") || stripHtml(meta.Credit?.value ?? "") || "Unknown";
    ok.push({
      title,
      thumb: info.thumburl,
      original: info.url,
      width: info.width,
      height: info.height,
      author: author.slice(0, 200),
      license,
      licenseUrl: meta.LicenseUrl?.value || undefined,
      sourceUrl: info.descriptionurl,
      fromInFlightCategory: titleMap.get(title) ?? false,
    });
  }
  // In-flight shots first, then the rest; cap.
  const inFlight = ok.filter((c) => c.fromInFlightCategory);
  const other = ok.filter((c) => !c.fromInFlightCategory);
  const head = inFlight.slice(0, Math.ceil(MAX_CANDIDATES * 0.6));
  return [...head, ...other, ...inFlight.slice(head.length)].slice(0, MAX_CANDIDATES);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : undefined;
  const force = args.includes("--force");
  const { families, errors } = loadFamilies();
  if (errors.length) console.warn(`Skipping ${errors.length} invalid family files`);
  const outDir = path.join(CACHE, "harvest");
  const targets = families.filter((f) => !only || only.includes(f.id));
  const limit = pLimit(5);
  await Promise.all(
    targets.map((f) =>
      limit(async () => {
        const file = path.join(outDir, `${f.id}.json`);
        if (!force && fs.existsSync(file)) return;
        try {
          const candidates = await harvestFamily(f.id, f.commonsCategories);
          writeJson(file, candidates);
          console.log(`${f.id}: ${candidates.length} candidates`);
        } catch (e) {
          console.error(`${f.id}: harvest failed — ${(e as Error).message}`);
        }
      }),
    ),
  );
}

main();
