/**
 * Step 7 — download selected photos, render 1600w + 800w WebP with sharp, upload to Vercel Blob,
 * and (re)write data/images.json.
 *   pnpm pipeline:upload [--only f-16]
 * Upload results are cached in .cache/pipeline/uploaded.json so reruns skip finished images.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { imageSchema, type AircraftImage } from "../../src/lib/catalog/schema";
import { CACHE, DATA, USER_AGENT, loadFamilies, readJson, writeJson } from "./lib";
import type { Candidate } from "./harvest";
import type { Verdict } from "./classify";

type Selected = { candidate: Candidate; verdict: Verdict };
type Uploaded = { src: string; srcSmall: string; width: number; height: number };

const IMAGES_FILE = path.join(DATA, "images.json");
const UPLOADED_FILE = path.join(CACHE, "uploaded.json");

function imageId(familyId: string, title: string) {
  return `${familyId}-${crypto.createHash("sha1").update(title).digest("hex").slice(0, 10)}`;
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${res.status} downloading ${url}`);
  }
}

function sourceUrlFor(c: Candidate) {
  // Commons thumbnail URLs look like …/thumb/a/ab/Name.jpg/960px-Name.jpg — ask for a larger step.
  return c.width > 1920 && c.thumb.includes("/960px-") ? c.thumb.replace("/960px-", "/1920px-") : c.original;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN missing — run `vercel env pull .env.local`");
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : undefined;
  const { families } = loadFamilies();
  const uploaded: Record<string, Uploaded> = fs.existsSync(UPLOADED_FILE) ? readJson(UPLOADED_FILE) : {};
  const existing: AircraftImage[] = fs.existsSync(IMAGES_FILE) ? readJson(IMAGES_FILE) : [];
  const limit = pLimit(4);
  const targets = families.filter((f) => !only || only.includes(f.id));
  const targetIds = new Set(targets.map((f) => f.id));
  const fresh: AircraftImage[] = [];

  for (const f of targets) {
    const selFile = path.join(CACHE, "selected", `${f.id}.json`);
    if (!fs.existsSync(selFile)) continue;
    const selected = readJson<Selected[]>(selFile);
    const results = await Promise.all(
      selected.map(({ candidate: c, verdict: v }) =>
        limit(async (): Promise<AircraftImage | null> => {
          const id = imageId(f.id, c.title);
          try {
            if (!uploaded[id]) {
              const buf = await download(sourceUrlFor(c));
              const large = sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 });
              const largeBuf = await large.toBuffer({ resolveWithObject: true });
              const smallBuf = await sharp(buf).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
              const opts = { access: "public" as const, addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp", cacheControlMaxAge: 60 * 60 * 24 * 365 };
              // Opaque pathnames: the URL must not reveal the answer to a quiz-taker.
              const key = crypto.createHash("sha256").update(`tally:${id}`).digest("hex").slice(0, 20);
              const [big, small] = await Promise.all([
                put(`img/${key}-1600.webp`, largeBuf.data, opts),
                put(`img/${key}-800.webp`, smallBuf, opts),
              ]);
              uploaded[id] = { src: big.url, srcSmall: small.url, width: largeBuf.info.width, height: largeBuf.info.height };
            }
            const u = uploaded[id];
            return imageSchema.parse({
              id,
              familyId: f.id,
              src: u.src,
              srcSmall: u.srcSmall,
              width: u.width,
              height: u.height,
              angle: v.angle,
              inFlight: v.inFlight,
              quality: v.quality,
              author: c.author,
              license: c.license,
              licenseUrl: c.licenseUrl,
              sourceUrl: c.sourceUrl,
              title: c.title.replace(/^File:/, "").replace(/\.jpe?g$/i, ""),
            });
          } catch (e) {
            console.error(`${id}: ${(e as Error).message}`);
            return null;
          }
        }),
      ),
    );
    const ok = results.filter((r): r is AircraftImage => !!r);
    fresh.push(...ok);
    writeJson(UPLOADED_FILE, uploaded);
    console.log(`${f.id}: ${ok.length} images`);
  }

  const merged = [...existing.filter((img) => !targetIds.has(img.familyId)), ...fresh].sort(
    (a, b) => a.familyId.localeCompare(b.familyId) || a.id.localeCompare(b.id),
  );
  writeJson(IMAGES_FILE, merged);
  console.log(`images.json: ${merged.length} images across ${new Set(merged.map((m) => m.familyId)).size} families`);
}

main();
