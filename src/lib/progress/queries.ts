import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardState, review } from "@/db/schema";
import { masteryOf, type Mastery } from "@/lib/srs";

export async function masteryMap(userId: string): Promise<Record<string, Mastery>> {
  const rows = await db.select().from(cardState).where(eq(cardState.userId, userId));
  const now = new Date();
  return Object.fromEntries(rows.map((r) => [r.familyId, masteryOf(r, now)]));
}


export type FamilyRecord = {
  mastery: Mastery;
  seen: number;
  firstTry: number;
  due: Date | null;
  confusedWith: { id: string; count: number }[];
};

export async function familyRecord(userId: string, familyId: string): Promise<FamilyRecord> {
  const [card] = await db.select().from(cardState).where(and(eq(cardState.userId, userId), eq(cardState.familyId, familyId)));
  const [agg] = await db
    .select({
      seen: sql<number>`count(*)::int`,
      firstTry: sql<number>`coalesce(sum(case when ${review.correct} and not ${review.hintShown} then 1 else 0 end), 0)::int`,
    })
    .from(review)
    .where(and(eq(review.userId, userId), eq(review.familyId, familyId), eq(review.attemptNo, 1)));
  const confusions = await db
    .select({ id: review.chosenFamilyId, count: sql<number>`count(*)::int` })
    .from(review)
    .where(and(eq(review.userId, userId), eq(review.familyId, familyId), eq(review.correct, false)))
    .groupBy(review.chosenFamilyId)
    .orderBy(desc(sql`count(*)`))
    .limit(3);
  return {
    mastery: masteryOf(card, new Date()),
    seen: agg?.seen ?? 0,
    firstTry: agg?.firstTry ?? 0,
    due: card && card.reps > 0 ? card.due : null,
    confusedWith: confusions,
  };
}
