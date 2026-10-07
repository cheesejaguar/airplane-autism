import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardState, deckPreset, review, trainingSession, userPrefs } from "@/db/schema";

/**
 * Moves a guest (anonymous) user's training history to the account they just created or
 * signed into. Card states conflict-resolve to whichever was reviewed most recently.
 * Runs before Better Auth deletes the anonymous user (which would cascade-delete rows).
 */
export async function mergeGuestProgress(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) return;
  await db.transaction(async (tx) => {
    await tx.update(trainingSession).set({ userId: toUserId }).where(eq(trainingSession.userId, fromUserId));
    await tx.update(review).set({ userId: toUserId }).where(eq(review.userId, fromUserId));
    await tx.update(deckPreset).set({ userId: toUserId }).where(eq(deckPreset.userId, fromUserId));

    await tx.execute(sql`
      INSERT INTO card_state (user_id, family_id, due, stability, difficulty, elapsed_days, scheduled_days,
                              learning_steps, reps, lapses, state, last_review)
      SELECT ${toUserId}, family_id, due, stability, difficulty, elapsed_days, scheduled_days,
             learning_steps, reps, lapses, state, last_review
      FROM card_state WHERE user_id = ${fromUserId}
      ON CONFLICT (user_id, family_id) DO UPDATE SET
        due = EXCLUDED.due, stability = EXCLUDED.stability, difficulty = EXCLUDED.difficulty,
        elapsed_days = EXCLUDED.elapsed_days, scheduled_days = EXCLUDED.scheduled_days,
        learning_steps = EXCLUDED.learning_steps, reps = EXCLUDED.reps, lapses = EXCLUDED.lapses,
        state = EXCLUDED.state, last_review = EXCLUDED.last_review
      WHERE card_state.last_review IS NULL
         OR (EXCLUDED.last_review IS NOT NULL AND EXCLUDED.last_review > card_state.last_review)
    `);
    await tx.delete(cardState).where(eq(cardState.userId, fromUserId));

    await tx.execute(sql`
      INSERT INTO user_prefs (user_id, data, updated_at)
      SELECT ${toUserId}, data, updated_at FROM user_prefs WHERE user_id = ${fromUserId}
      ON CONFLICT (user_id) DO NOTHING
    `);
    await tx.delete(userPrefs).where(eq(userPrefs.userId, fromUserId));
  });
}
