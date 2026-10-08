import type { Branch, Category, Role, Sector } from "./schema";

/** Minimal per-family metadata shipped to client components (deck builder, study grid). */
export type FamilyLite = {
  id: string;
  name: string;
  label: string;
  manufacturer: string;
  sector: Sector;
  category: Category;
  roles: Role[];
  branches: Branch[];
  difficulty: number;
  angles: string[];
  thumb: string | null;
  /** Has enough curated photos to appear in drills */
  quizzable: boolean;
};

export function matchesDeck(
  f: FamilyLite,
  c: { categories: string[]; sectors: string[]; roles: string[]; branches: string[]; manufacturers: string[]; familyIds: string[]; difficulty: [number, number] },
): boolean {
  if (c.familyIds.length) return c.familyIds.includes(f.id);
  if (c.categories.length && !c.categories.includes(f.category)) return false;
  if (c.sectors.length && !(f.sector === "both" || c.sectors.includes(f.sector))) return false;
  if (c.roles.length && !f.roles.some((r) => c.roles.includes(r))) return false;
  if (c.branches.length && !f.branches.some((b) => c.branches.includes(b))) return false;
  if (c.manufacturers.length && !c.manufacturers.includes(f.manufacturer)) return false;
  return f.difficulty >= c.difficulty[0] && f.difficulty <= c.difficulty[1];
}
