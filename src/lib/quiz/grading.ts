import { EXPOSURES, type Exposure } from "@/lib/deck/config";

/** FSRS ratings (match ts-fsrs Rating enum values). */
export const RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type RatingValue = (typeof RATING)[keyof typeof RATING];

export type QuestionOutcome = {
  /** Answered correctly at some point (false = revealed after 2 misses) */
  correct: boolean;
  /** Number of answer attempts made (1 or 2) */
  attempts: number;
  /** User asked for a hint before answering */
  hintUsed: boolean;
  /** Time from image shown to the final answer */
  latencyMs: number;
  exposure: Exposure;
};

/** Time under which a first-try correct answer counts as "Easy". */
export function fastThresholdMs(exposure: Exposure): number {
  const ms = EXPOSURES[exposure].ms;
  return ms === null ? 3500 : ms + 2000;
}

export function ratingFor(o: QuestionOutcome): RatingValue {
  if (!o.correct) return RATING.Again;
  if (o.attempts > 1 || o.hintUsed) return RATING.Hard;
  return o.latencyMs <= fastThresholdMs(o.exposure) ? RATING.Easy : RATING.Good;
}
