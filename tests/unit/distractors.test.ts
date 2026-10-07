import { describe, expect, it } from "vitest";
import { pickDistractors } from "@/lib/quiz/distractors";
import { createRng } from "@/lib/random";
import { fam } from "./fixtures";

const target = fam("f-16", {
  confusedWith: [
    { id: "f-35", howToTell: "twin tails vs single" },
    { id: "fa-18", howToTell: "two engines vs one" },
    { id: "f-22", howToTell: "much bigger" },
  ],
});
const helos = ["uh-60", "ah-64", "ch-47"].map((id) => fam(id, { category: "rotorcraft", roles: ["utility"] }));
const jets = ["f-35", "fa-18", "f-22", "f-15", "a-10"].map((id) => fam(id, { roles: id === "a-10" ? ["attack"] : ["fighter"] }));
const airliner = fam("b737", { category: "fixed-wing", roles: ["narrowbody"], sector: "civil" });
const all = [target, ...jets, ...helos, airliner];

describe("pickDistractors", () => {
  it("returns the requested count with no duplicates and never the target", () => {
    for (let seed = 0; seed < 50; seed++) {
      const out = pickDistractors({ target, pool: all, all, count: 5, rng: createRng(seed) });
      expect(out).toHaveLength(5);
      expect(new Set(out.map((f) => f.id)).size).toBe(5);
      expect(out.some((f) => f.id === target.id)).toBe(false);
    }
  });

  it("includes exactly two curated look-alikes when available", () => {
    for (let seed = 0; seed < 30; seed++) {
      const out = pickDistractors({ target, pool: all, all, count: 3, rng: createRng(seed) });
      const curated = out.filter((f) => ["f-35", "fa-18", "f-22"].includes(f.id));
      expect(curated.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes the user's most frequent personal confusion", () => {
    const out = pickDistractors({ target, pool: all, all, count: 3, personalConfusions: ["a-10"], rng: createRng(1) });
    expect(out.map((f) => f.id)).toContain("a-10");
  });

  it("prefers same category and role before widening", () => {
    const t = fam("solo", { confusedWith: [] });
    const out = pickDistractors({ target: t, pool: all, all, count: 3, rng: createRng(7) });
    for (const f of out) expect(f.category).toBe("fixed-wing");
    expect(out.every((f) => f.roles.includes("fighter"))).toBe(true);
  });

  it("widens to the full catalog when the deck pool is tiny", () => {
    const out = pickDistractors({ target, pool: [target], all, count: 5, rng: createRng(3) });
    expect(out).toHaveLength(5);
  });

  it("skips options whose label collides with the target label", () => {
    const twin = fam("f-16-dup", { shortName: "F-16" });
    const out = pickDistractors({ target, pool: [target, twin, ...jets], all: [target, twin, ...jets], count: 4, rng: createRng(2) });
    expect(out.map((f) => f.id)).not.toContain("f-16-dup");
  });
});
