import { z } from "zod";
import { ANGLES, BRANCHES, CATEGORIES, ROLES, type Angle } from "@/lib/catalog/schema";

export const EXPOSURES = {
  unlimited: { label: "Unlimited", ms: null },
  "3s": { label: "3 s", ms: 3000 },
  "1s": { label: "1 s", ms: 1000 },
  "0.5s": { label: "0.5 s", ms: 500 },
} as const;
export type Exposure = keyof typeof EXPOSURES;

export const CONDITIONS = {
  clear: { label: "Clear", description: "Full-quality photo" },
  haze: { label: "Haze", description: "Low contrast, washed out like distant haze" },
  distant: { label: "Distant", description: "Aircraft shown small, as if far away" },
} as const;
export type Conditions = keyof typeof CONDITIONS;

export const VIEWS = {
  any: { label: "Any angle", angles: [...ANGLES] },
  front: { label: "Head-on", angles: ["front", "front-quarter"] },
  side: { label: "Profile", angles: ["side"] },
  planform: { label: "Planform (top / belly)", angles: ["top", "belly"] },
  rear: { label: "Rear", angles: ["rear", "rear-quarter"] },
} as const satisfies Record<string, { label: string; angles: readonly Angle[] }>;
export type View = keyof typeof VIEWS;

export const deckConfigSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).default([]),
  sectors: z.array(z.enum(["military", "civil"])).default([]),
  roles: z.array(z.enum(ROLES)).default([]),
  branches: z.array(z.enum(BRANCHES)).default([]),
  manufacturers: z.array(z.string()).default([]),
  /** Optional explicit family list (e.g. drilling a confusion pair). Overrides other filters. */
  familyIds: z.array(z.string()).default([]),
  difficulty: z.tuple([z.number().int().min(1).max(5), z.number().int().min(1).max(5)]).default([1, 5]),
  view: z.enum(Object.keys(VIEWS) as [View, ...View[]]).default("any"),
  exposure: z.enum(Object.keys(EXPOSURES) as [Exposure, ...Exposure[]]).default("unlimited"),
  conditions: z.enum(Object.keys(CONDITIONS) as [Conditions, ...Conditions[]]).default("clear"),
  choices: z.union([z.literal(4), z.literal(6)]).default(4),
  sessionLength: z.number().int().min(5).max(100).default(20),
  /** Max never-seen families introduced per session; 0 = review only */
  newPerSession: z.number().int().min(0).max(50).default(8),
});

export type DeckConfig = z.infer<typeof deckConfigSchema>;

export const DEFAULT_DECK: DeckConfig = deckConfigSchema.parse({});

export function parseDeckConfig(input: unknown): DeckConfig {
  const parsed = deckConfigSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_DECK;
}
