import { describe, expect, it } from "vitest";
import { buildQueue } from "@/lib/quiz/queue";
import { pickImage } from "@/lib/quiz/images";
import { createRng } from "@/lib/random";
import type { CardRow } from "@/lib/srs";
import { schedule } from "@/lib/srs";
import { fam, img } from "./fixtures";

const now = new Date("2026-10-06T12:00:00Z");
const row = (familyId: string, due: Date, reps = 3): CardRow => ({
  familyId, due, stability: 5, difficulty: 5, elapsedDays: 1, scheduledDays: 1, learningSteps: 0, reps, lapses: 0, state: 2, lastReview: new Date(due.getTime() - 86400000),
});

describe("buildQueue", () => {
  const pool = Array.from({ length: 30 }, (_, i) => fam(`a${i}`, { difficulty: (i % 5) + 1 }));
  it("puts due cards in and caps new cards", () => {
    const cards = new Map([
      ["a0", row("a0", new Date("2026-10-01"))],
      ["a1", row("a1", new Date("2026-10-05"))],
      ["a2", row("a2", new Date("2026-12-01"))],
    ]);
    const q = buildQueue({ pool, cards, size: 10, newLimit: 3, now, rng: createRng(1) });
    expect(q).toContain("a0");
    expect(q).toContain("a1");
    const newOnes = q.filter((id) => !cards.has(id));
    expect(newOnes.length).toBe(3);
    expect(q.length).toBe(6); // 2 due + 3 new + 1 study-ahead
    expect(new Set(q).size).toBe(q.length);
  });
  it("cycles a small explicit deck to fill the session without back-to-back repeats", () => {
    const pair = [fam("x"), fam("y")];
    const q = buildQueue({ pool: pair, cards: new Map(), size: 10, newLimit: 20, now, rng: createRng(3), cycle: true });
    expect(q).toHaveLength(10);
    for (let i = 1; i < q.length; i++) expect(q[i]).not.toBe(q[i - 1]);
  });
  it("never returns an empty session for review-only decks", () => {
    const q = buildQueue({ pool, cards: new Map(), size: 5, newLimit: 0, now, rng: createRng(1) });
    expect(q).toHaveLength(5);
  });
});

describe("pickImage", () => {
  const imgs = [img("s", "x", { angle: "side" }), img("f", "x", { angle: "front" }), img("b", "x", { angle: "belly" })];
  it("prefers an unseen angle over a mastered one", () => {
    const stats = new Map([
      ["side", { seen: 20, correct: 20 }],
      ["front", { seen: 20, correct: 20 }],
    ] as const);
    const counts: Record<string, number> = {};
    for (let s = 0; s < 40; s++) {
      const p = pickImage(imgs, { angleStats: stats, rng: createRng(s) })!;
      counts[p.angle] = (counts[p.angle] ?? 0) + 1;
    }
    expect(counts.belly).toBeGreaterThan(30);
  });
  it("avoids recently shown images when possible", () => {
    const p = pickImage(imgs, { recent: new Set(["s", "f"]), rng: createRng(4) });
    expect(p?.id).toBe("b");
  });
});

describe("schedule", () => {
  it("Again keeps a card due soon, Easy pushes it out", () => {
    const again = schedule("x", null, 1, now);
    const easy = schedule("x", null, 4, now);
    expect(easy.due.getTime()).toBeGreaterThan(again.due.getTime());
    expect(easy.reps).toBe(1);
  });
});
