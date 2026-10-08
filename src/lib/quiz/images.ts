import type { AircraftImage, Angle } from "@/lib/catalog/schema";
import { shuffle, type Rng } from "@/lib/random";

export type AngleStat = { seen: number; correct: number };

/**
 * Picks the photo for a question: prefers angles the user is weakest on (or has never seen
 * for this family), avoids recently shown images, and favours higher-quality shots.
 */
export function pickImage(
  candidates: readonly AircraftImage[],
  opts: { angleStats?: ReadonlyMap<Angle, AngleStat>; recent?: ReadonlySet<string>; rng: Rng },
): AircraftImage | undefined {
  if (!candidates.length) return undefined;
  const { angleStats = new Map(), recent = new Set(), rng } = opts;
  const fresh = candidates.filter((c) => !recent.has(c.id));
  const pool = fresh.length ? fresh : candidates;

  const weakness = (angle: Angle) => {
    const s = angleStats.get(angle);
    if (!s || s.seen === 0) return 1; // unseen angle: high priority
    // Laplace-smoothed error rate
    return 1 - (s.correct + 1) / (s.seen + 2);
  };

  const scored = shuffle(pool, rng).map((img) => ({
    img,
    score: weakness(img.angle) * 2 + img.quality * 0.15 + rng() * 0.6,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].img;
}
