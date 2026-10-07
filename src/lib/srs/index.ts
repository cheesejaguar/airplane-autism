import { createEmptyCard, fsrs, State, type Card, type Grade } from "ts-fsrs";
import type { RatingValue } from "@/lib/quiz/grading";

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true, maximum_interval: 365 });

/** Shape of a card_state row (camelCase, as returned by Drizzle). */
export type CardRow = {
  familyId: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
};

export function toCard(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ?? undefined,
  };
}

export function fromCard(familyId: string, card: Card): CardRow {
  return {
    familyId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

export function schedule(familyId: string, row: CardRow | null, rating: RatingValue, now: Date): CardRow {
  const card = row ? toCard(row) : createEmptyCard(now);
  const { card: next } = scheduler.next(card, now, rating as Grade);
  return fromCard(familyId, next);
}

export function retrievability(row: CardRow, now: Date): number {
  if (row.state === State.New) return 0;
  return scheduler.get_retrievability(toCard(row), now, false);
}

/** Mastery buckets used across stats and the study grid. */
export type Mastery = "new" | "learning" | "familiar" | "mastered";

export function masteryOf(row: CardRow | undefined, now: Date): Mastery {
  if (!row || row.reps === 0) return "new";
  if (row.state === State.Learning || row.state === State.Relearning || row.stability < 3) return "learning";
  if (row.stability >= 21 && retrievability(row, now) >= 0.85) return "mastered";
  return "familiar";
}

export { State };
