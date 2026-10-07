import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cardState } from "@/db/schema";
import { masteryOf, type Mastery } from "@/lib/srs";

export async function masteryMap(userId: string): Promise<Record<string, Mastery>> {
  const rows = await db.select().from(cardState).where(eq(cardState.userId, userId));
  const now = new Date();
  return Object.fromEntries(rows.map((r) => [r.familyId, masteryOf(r, now)]));
}
