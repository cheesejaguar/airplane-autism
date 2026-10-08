import catalogData from "@/generated/catalog.json";
import type { AircraftImage, Angle, Family, Role } from "./schema";
import type { DeckConfig } from "@/lib/deck/config";
import { VIEWS } from "@/lib/deck/config";

type CatalogFile = { builtAt: string; families: Family[]; images: AircraftImage[] };
const data = catalogData as unknown as CatalogFile;

export const families: readonly Family[] = data.families;
export const images: readonly AircraftImage[] = data.images;

const familyById = new Map(families.map((f) => [f.id, f]));
const imagesByFamily = new Map<string, AircraftImage[]>();
for (const img of images) {
  const list = imagesByFamily.get(img.familyId) ?? [];
  list.push(img);
  imagesByFamily.set(img.familyId, list);
}
const imageById = new Map(images.map((i) => [i.id, i]));

export function getFamily(id: string): Family | undefined {
  return familyById.get(id);
}

export function getImage(id: string): AircraftImage | undefined {
  return imageById.get(id);
}

export function familyImages(id: string): AircraftImage[] {
  return imagesByFamily.get(id) ?? [];
}

export function familyImagesForAngles(id: string, angles: readonly Angle[]): AircraftImage[] {
  return familyImages(id).filter((i) => angles.includes(i.angle));
}

/** A family needs at least this many curated photos to appear in drills; fewer = study-only. */
export const MIN_QUIZ_IMAGES = 2;

export function isQuizzable(id: string): boolean {
  return familyImages(id).length >= MIN_QUIZ_IMAGES;
}

export function label(f: Pick<Family, "name" | "shortName">): string {
  return f.shortName ?? f.name;
}

export function heroImage(id: string): AircraftImage | undefined {
  const list = familyImages(id);
  return (
    list.find((i) => i.inFlight && (i.angle === "front-quarter" || i.angle === "side") && i.quality >= 4) ??
    list.find((i) => i.angle === "side") ??
    list[0]
  );
}

export const manufacturers: readonly string[] = [...new Set(families.map((f) => f.manufacturer))].sort();

export const ROLE_LABELS: Record<Role, string> = {
  fighter: "Fighter",
  attack: "Attack",
  bomber: "Bomber",
  "electronic-warfare": "Electronic warfare",
  isr: "ISR / Recon",
  aew: "Airborne early warning",
  "maritime-patrol": "Maritime patrol",
  tanker: "Tanker",
  transport: "Transport",
  "heavy-lift": "Heavy lift",
  trainer: "Trainer",
  "special-ops": "Special ops",
  "search-rescue": "Search & rescue",
  utility: "Utility",
  light: "Light",
  vip: "VIP",
  cargo: "Cargo",
  ems: "EMS",
  narrowbody: "Narrowbody airliner",
  widebody: "Widebody airliner",
  regional: "Regional",
  "business-jet": "Business jet",
  turboprop: "Turboprop",
  "piston-single": "Piston single",
  "piston-twin": "Piston twin",
  agricultural: "Agricultural",
  aerobatic: "Aerobatic",
  seaplane: "Seaplane",
  warbird: "Warbird / vintage",
};

export const CATEGORY_LABELS = {
  "fixed-wing": "Fixed-wing",
  rotorcraft: "Rotorcraft",
  tiltrotor: "Tiltrotor",
  uas: "Drones (UAS)",
} as const;

export const SECTOR_LABELS = { military: "Military", civil: "Civil", both: "Civil & military" } as const;

export const BRANCH_LABELS = {
  usaf: "US Air Force",
  usn: "US Navy",
  usmc: "US Marine Corps",
  army: "US Army",
  uscg: "US Coast Guard",
} as const;

/** Families matching a deck config (ignores image availability). */
export function filterFamilies(config: DeckConfig, source: readonly Family[] = families): Family[] {
  if (config.familyIds.length) return source.filter((f) => config.familyIds.includes(f.id));
  const [minD, maxD] = config.difficulty;
  return source.filter((f) => {
    if (config.categories.length && !config.categories.includes(f.category)) return false;
    if (config.sectors.length && !(f.sector === "both" || config.sectors.includes(f.sector))) return false;
    if (config.roles.length && !f.roles.some((r) => config.roles.includes(r))) return false;
    if (config.branches.length && !f.branches.some((b) => config.branches.includes(b))) return false;
    if (config.manufacturers.length && !config.manufacturers.includes(f.manufacturer)) return false;
    if (f.difficulty < minD || f.difficulty > maxD) return false;
    return true;
  });
}

/** Families in the deck that have at least one image for the selected view. */
export function quizPool(config: DeckConfig): Family[] {
  const angles = VIEWS[config.view].angles;
  return filterFamilies(config).filter((f) => isQuizzable(f.id) && familyImagesForAngles(f.id, angles).length > 0);
}

import type { FamilyLite } from "./lite";

export function toLite(f: Family): FamilyLite {
  const imgs = familyImages(f.id);
  return {
    id: f.id,
    name: f.name,
    label: label(f),
    manufacturer: f.manufacturer,
    sector: f.sector,
    category: f.category,
    roles: f.roles,
    branches: f.branches,
    difficulty: f.difficulty,
    angles: imgs.length >= MIN_QUIZ_IMAGES ? [...new Set(imgs.map((i) => i.angle))] : [],
    thumb: heroImage(f.id)?.srcSmall ?? null,
    quizzable: imgs.length >= MIN_QUIZ_IMAGES,
  };
}

export const familiesLite: readonly FamilyLite[] = families.map(toLite);
