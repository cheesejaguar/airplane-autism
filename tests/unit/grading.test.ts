import { describe, expect, it } from "vitest";
import { RATING, fastThresholdMs, ratingFor } from "@/lib/quiz/grading";

describe("ratingFor", () => {
  const base = { correct: true, attempts: 1, hintUsed: false, latencyMs: 1000, exposure: "unlimited" as const };
  it("fast first-try correct is Easy", () => expect(ratingFor(base)).toBe(RATING.Easy));
  it("slow first-try correct is Good", () => expect(ratingFor({ ...base, latencyMs: 9000 })).toBe(RATING.Good));
  it("correct after a miss is Hard", () => expect(ratingFor({ ...base, attempts: 2 })).toBe(RATING.Hard));
  it("hint used caps at Hard", () => expect(ratingFor({ ...base, hintUsed: true })).toBe(RATING.Hard));
  it("revealed is Again", () => expect(ratingFor({ ...base, correct: false, attempts: 2 })).toBe(RATING.Again));
  it("timed exposures extend the fast threshold", () => {
    expect(fastThresholdMs("1s")).toBe(3000);
    expect(ratingFor({ ...base, exposure: "3s", latencyMs: 4500 })).toBe(RATING.Easy);
  });
});
