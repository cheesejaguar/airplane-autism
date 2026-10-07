import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { mergeGuestProgress } from "@/lib/progress/merge";

const { cardState, review, user } = schema;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  const client = new PGlite();
  const dir = path.resolve(import.meta.dirname, "../../src/db/migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of fs.readFileSync(path.join(dir, f), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
  }
  db = drizzle(client, { schema });
});

const card = (userId: string, familyId: string, lastReview: Date, reps: number) => ({
  userId, familyId, due: new Date(lastReview.getTime() + 86400000), stability: 2, difficulty: 5,
  elapsedDays: 0, scheduledDays: 1, learningSteps: 0, reps, lapses: 0, state: 2, lastReview,
});

describe("mergeGuestProgress", () => {
  it("moves guest history and keeps the most recently reviewed card state", async () => {
    await db.insert(user).values([
      { id: "guest", name: "Guest", email: "g@guest.tally.local", isAnonymous: true },
      { id: "acct", name: "Pilot", email: "p@example.com" },
    ]);
    await db.insert(cardState).values([
      card("guest", "f-16", new Date("2026-10-05"), 3), // newer than account's → wins
      card("guest", "b-52", new Date("2026-09-01"), 1), // older than account's → loses
      card("guest", "c172", new Date("2026-10-01"), 2), // account has none → moves
      card("acct", "f-16", new Date("2026-09-20"), 9),
      card("acct", "b-52", new Date("2026-10-02"), 7),
    ]);
    await db.insert(review).values({
      id: "r1", userId: "guest", questionId: "q1", familyId: "f-16", imageId: "i", angle: "side", exposure: "unlimited",
      conditions: "clear", chosenFamilyId: "f-16", attemptNo: 1, correct: true, latencyMs: 900,
    });

    await mergeGuestProgress("guest", "acct", db as never);

    const cards = await db.select().from(cardState).where(eq(cardState.userId, "acct"));
    const byId = Object.fromEntries(cards.map((c) => [c.familyId, c.reps]));
    expect(byId).toEqual({ "f-16": 3, "b-52": 7, c172: 2 });
    expect(await db.select().from(cardState).where(eq(cardState.userId, "guest"))).toHaveLength(0);
    const reviews = await db.select().from(review);
    expect(reviews.every((r) => r.userId === "acct")).toBe(true);
  });
});
