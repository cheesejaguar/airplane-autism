import { z } from "zod";

export const SECTORS = ["military", "civil", "both"] as const;
export const CATEGORIES = ["fixed-wing", "rotorcraft", "tiltrotor", "uas"] as const;

export const ROLES = [
  // military
  "fighter",
  "attack",
  "bomber",
  "electronic-warfare",
  "isr",
  "aew",
  "maritime-patrol",
  "tanker",
  "transport",
  "heavy-lift",
  "trainer",
  "special-ops",
  "search-rescue",
  // shared
  "utility",
  "light",
  "vip",
  "cargo",
  "ems",
  // civil
  "narrowbody",
  "widebody",
  "regional",
  "business-jet",
  "turboprop",
  "piston-single",
  "piston-twin",
  "agricultural",
  "aerobatic",
  "seaplane",
  "warbird",
] as const;

export const BRANCHES = ["usaf", "usn", "usmc", "army", "uscg"] as const;

export const ENGINE_TYPES = [
  "turbofan",
  "turbojet",
  "turboprop",
  "turboshaft",
  "piston",
] as const;

export const ANGLES = [
  "front",
  "front-quarter",
  "side",
  "rear-quarter",
  "rear",
  "top",
  "belly",
] as const;

export const WEFT_KEYS = ["wings", "engines", "fuselage", "tail"] as const;

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case id");

export const familySchema = z.object({
  id: slug,
  /** Full display name, e.g. "F-16 Fighting Falcon" */
  name: z.string().min(2),
  /** Compact label for answer buttons, e.g. "F-16" (defaults to name) */
  shortName: z.string().min(1).optional(),
  aka: z.array(z.string()).default([]),
  manufacturer: z.string().min(2),
  sector: z.enum(SECTORS),
  category: z.enum(CATEGORIES),
  roles: z.array(z.enum(ROLES)).min(1),
  branches: z.array(z.enum(BRANCHES)).default([]),
  firstFlight: z.number().int().min(1903).max(2030),
  engines: z.object({
    count: z.number().int().min(0).max(8),
    type: z.enum(ENGINE_TYPES),
  }),
  variants: z.array(z.string()).default([]),
  /** 1–2 sentence overview */
  summary: z.string().min(20),
  /** WEFT recognition features, short imperative-free phrases */
  weft: z.object({
    wings: z.array(z.string().min(3)).min(1),
    engines: z.array(z.string().min(3)).min(1),
    fuselage: z.array(z.string().min(3)).min(1),
    tail: z.array(z.string().min(3)).min(1),
  }),
  /** 2–3 fastest single cues, ordered best-first. Must not name the aircraft. */
  tellTales: z.array(z.string().min(5)).min(2).max(4),
  confusedWith: z
    .array(
      z.object({
        id: slug,
        /** One sentence: how to tell THIS aircraft apart from the other */
        howToTell: z.string().min(10),
      }),
    )
    .min(1),
  /** 1 = unmistakable, 5 = expert-level */
  difficulty: z.number().int().min(1).max(5),
  /** Wikimedia Commons category titles WITHOUT the "Category:" prefix */
  commonsCategories: z.array(z.string().min(3)).min(1),
  /** Approximate number in US service/registry with provenance */
  usCount: z.object({
    value: z.number().int().min(11),
    source: z.string().min(3),
    asOf: z.string().regex(/^\d{4}(-\d{2})?$/),
  }),
  /** FAA ACFTREF MFR MDL CODEs mapped to this family (filled by pipeline) */
  faaModelCodes: z.array(z.string()).default([]),
});

export type Family = z.infer<typeof familySchema>;
export type Sector = (typeof SECTORS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Role = (typeof ROLES)[number];
export type Branch = (typeof BRANCHES)[number];
export type Angle = (typeof ANGLES)[number];
export type WeftKey = (typeof WEFT_KEYS)[number];

export const LICENSES_ALLOWED = [
  "Public domain",
  "PD",
  "CC0",
  "CC BY",
  "CC BY-SA",
] as const;

export const imageSchema = z.object({
  id: z.string().min(4),
  familyId: slug,
  /** Large (≈1600w) and small (≈800w) renditions */
  src: z.string().url(),
  srcSmall: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  angle: z.enum(ANGLES),
  inFlight: z.boolean(),
  quality: z.number().int().min(1).max(5),
  author: z.string().min(1),
  license: z.string().min(2),
  licenseUrl: z.string().url().optional(),
  sourceUrl: z.string().url(),
  title: z.string(),
});

export type AircraftImage = z.infer<typeof imageSchema>;
