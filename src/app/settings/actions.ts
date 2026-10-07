"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cardState, review, trainingSession } from "@/db/schema";
import { getViewer } from "@/lib/session";

export async function resetProgress(): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  await db.transaction(async (tx) => {
    await tx.delete(review).where(eq(review.userId, viewer.id));
    await tx.delete(cardState).where(eq(cardState.userId, viewer.id));
    await tx.delete(trainingSession).where(eq(trainingSession.userId, viewer.id));
  });
  return true;
}
