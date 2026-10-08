/**
 * Photo corrections (used when fixing user reports). Edits data/images.json AND records the
 * change in data/image-overrides.json so future pipeline runs keep it.
 *   pnpm images block <imageId...> --reason "shows a C182, not a C172" [--reports id1,id2]
 *   pnpm images retag <imageId> <angle>
 *   pnpm images move <imageId> <toFamilyId> [--reason "…"]
 *   pnpm images show <imageId>
 * After blocking, refill a family's photos from cached verdicts (no AI cost):
 *   pnpm pipeline:classify --only <familyId> && pnpm pipeline:upload --only <familyId>
 */
import path from "node:path";
import { ANGLES, type AircraftImage } from "../src/lib/catalog/schema";
import { DATA, FAMILIES_DIR, OVERRIDES_FILE, imageIdFor, loadImageOverrides, readJson, writeJson } from "./pipeline/lib";
import fs from "node:fs";

const IMAGES_FILE = path.join(DATA, "images.json");
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : undefined);
const positional = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));

const images = readJson<AircraftImage[]>(IMAGES_FILE);
const overrides = loadImageOverrides();
const now = new Date().toISOString();
const find = (id: string) => {
  const img = images.find((i) => i.id === id);
  if (!img) throw new Error(`image ${id} not found in data/images.json`);
  return img;
};
const save = (list: AircraftImage[]) => {
  writeJson(IMAGES_FILE, list.sort((a, b) => a.familyId.localeCompare(b.familyId) || a.id.localeCompare(b.id)));
  writeJson(OVERRIDES_FILE, overrides);
};
const left = (list: AircraftImage[], familyId: string) => list.filter((i) => i.familyId === familyId).length;

if (cmd === "block") {
  const reason = flag("reason");
  if (!positional.length || !reason) throw new Error('usage: pnpm images block <imageId...> --reason "…"');
  const reportIds = flag("reports")?.split(",").filter(Boolean);
  let list = images;
  for (const id of positional) {
    const img = find(id);
    overrides.blocked[id] = { familyId: img.familyId, reason, reportIds, at: now };
    overrides.extra = (overrides.extra ?? []).filter((x) => x.id !== id);
    list = list.filter((i) => i.id !== id);
    const n = left(list, img.familyId);
    console.log(`blocked ${id} (${img.familyId}); ${n} photos left${n < 2 ? " — family is now study-only; refill with pipeline:classify/upload --only " + img.familyId : ""}`);
  }
  save(list);
} else if (cmd === "retag") {
  const [id, angle] = positional;
  if (!id || !ANGLES.includes(angle as (typeof ANGLES)[number])) throw new Error(`usage: pnpm images retag <imageId> <${ANGLES.join("|")}>`);
  const img = find(id);
  overrides.angles[id] = angle;
  img.angle = angle as AircraftImage["angle"];
  save(images);
  console.log(`retagged ${id} as ${angle}`);
} else if (cmd === "move") {
  const [id, to] = positional;
  if (!id || !to || !fs.existsSync(path.join(FAMILIES_DIR, `${to}.json`))) throw new Error("usage: pnpm images move <imageId> <existing toFamilyId>");
  const img = find(id);
  const moved: AircraftImage = { ...img, id: imageIdFor(to, `File:${img.title}`), familyId: to };
  overrides.blocked[id] = { familyId: img.familyId, reason: flag("reason") ?? `moved to ${to}`, at: now };
  overrides.extra = [...(overrides.extra ?? []).filter((x) => x.id !== moved.id && x.id !== id), moved];
  save([...images.filter((i) => i.id !== id), moved]);
  console.log(`moved ${id} (${img.familyId}) → ${moved.id} (${to}); ${img.familyId} has ${left(images, img.familyId) - 1} photos left`);
} else if (cmd === "show") {
  console.log(JSON.stringify(find(positional[0]), null, 2));
} else {
  console.log("usage: pnpm images block|retag|move|show …");
  process.exitCode = 1;
}
