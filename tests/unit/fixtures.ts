import type { AircraftImage, Family } from "@/lib/catalog/schema";

export function fam(id: string, over: Partial<Family> = {}): Family {
  return {
    id,
    name: id.toUpperCase(),
    shortName: id.toUpperCase(),
    aka: [],
    manufacturer: "Acme",
    sector: "military",
    category: "fixed-wing",
    roles: ["fighter"],
    branches: ["usaf"],
    firstFlight: 1980,
    engines: { count: 1, type: "turbofan" },
    variants: [],
    summary: "A test aircraft used in unit tests only.",
    weft: { wings: ["w"], engines: ["e"], fuselage: ["f"], tail: ["t"] },
    tellTales: ["cue one", "cue two"],
    confusedWith: [],
    difficulty: 2,
    commonsCategories: ["x"],
    usCount: { value: 100, source: "test", asOf: "2025" },
    faaModelCodes: [],
    ...over,
  };
}

export function img(id: string, familyId: string, over: Partial<AircraftImage> = {}): AircraftImage {
  return {
    id,
    familyId,
    src: `https://example.com/${id}.webp`,
    srcSmall: `https://example.com/${id}-s.webp`,
    width: 1600,
    height: 1000,
    angle: "side",
    inFlight: true,
    quality: 4,
    author: "a",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:x.jpg",
    title: id,
    ...over,
  };
}
