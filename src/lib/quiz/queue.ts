import type { Family } from "@/lib/catalog/schema";
import { shuffle, type Rng } from "@/lib/random";
import { retrievability, type CardRow } from "@/lib/srs";

/**
 * Builds the ordered list of family ids for a session:
 *   1. due reviews (most overdue first)
 *   2. new families (easiest first, randomised within difficulty), capped by newLimit
 *   3. if still short, "study ahead": seen-but-not-due families with the lowest retrievability
 * Consecutive repeats of the same family are avoided.
 */
export function buildQueue(opts: {
  pool: readonly Family[];
  cards: ReadonlyMap<string, CardRow>;
  size: number;
  newLimit: number;
  now: Date;
  rng: Rng;
}): string[] {
  const { pool, cards, size, newLimit, now, rng } = opts;
  const due: CardRow[] = [];
  const ahead: CardRow[] = [];
  const fresh: Family[] = [];
  for (const f of pool) {
    const c = cards.get(f.id);
    if (!c || c.reps === 0) fresh.push(f);
    else if (c.due <= now) due.push(c);
    else ahead.push(c);
  }

  const out: string[] = [];
  due.sort((a, b) => a.due.getTime() - b.due.getTime());
  for (const c of due) if (out.length < size) out.push(c.familyId);

  const newOrdered = shuffle(fresh, rng).sort((a, b) => a.difficulty - b.difficulty);
  let added = 0;
  for (const f of newOrdered) {
    if (out.length >= size || added >= newLimit) break;
    out.push(f.id);
    added++;
  }

  if (out.length < size) {
    ahead.sort((a, b) => retrievability(a, now) - retrievability(b, now));
    for (const c of ahead) if (out.length < size) out.push(c.familyId);
  }
  // Review-only decks with nothing due fall back to new cards so a session is never empty.
  if (out.length === 0) for (const f of newOrdered) if (out.length < size) out.push(f.id);

  // Interleave new and review so the session doesn't front-load all reviews.
  return shuffle(out, rng);
}
