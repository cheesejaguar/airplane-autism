import type { Family } from "@/lib/catalog/schema";
import { shuffle, type Rng } from "@/lib/random";

export type DistractorInput = {
  target: Family;
  /** Families in the current deck — preferred source of distractors */
  pool: readonly Family[];
  /** Whole catalog — fallback source */
  all: readonly Family[];
  /** Number of wrong options to return */
  count: number;
  /** Family ids this user has mistaken the target for, most frequent first */
  personalConfusions?: readonly string[];
  rng: Rng;
};

/**
 * Chooses plausible wrong answers. Priority:
 *   1. up to 2 from the target's curated look-alikes (confusedWith)
 *   2. up to 1 from the user's own confusion history for this target
 *   3. same category + shared role → same category → anything,
 * each tier drawing from the deck pool before the wider catalog.
 */
export function pickDistractors({ target, pool, all, count, personalConfusions = [], rng }: DistractorInput): Family[] {
  const chosen: Family[] = [];
  const used = new Set<string>([target.id]);
  const usedLabels = new Set<string>([(target.shortName ?? target.name).toLowerCase()]);
  const byId = new Map(all.map((f) => [f.id, f]));
  const poolIds = new Set(pool.map((f) => f.id));

  const take = (f: Family | undefined) => {
    if (!f || used.has(f.id) || chosen.length >= count) return false;
    const lbl = (f.shortName ?? f.name).toLowerCase();
    if (usedLabels.has(lbl)) return false;
    used.add(f.id);
    usedLabels.add(lbl);
    chosen.push(f);
    return true;
  };

  // 1. Curated look-alikes, in-deck first.
  const lookalikes = target.confusedWith.map((c) => byId.get(c.id)).filter((f): f is Family => !!f);
  const orderedLookalikes = [
    ...shuffle(lookalikes.filter((f) => poolIds.has(f.id)), rng),
    ...shuffle(lookalikes.filter((f) => !poolIds.has(f.id)), rng),
  ];
  let curated = 0;
  for (const f of orderedLookalikes) {
    if (curated >= 2) break;
    if (take(f)) curated++;
  }

  // 2. Personal confusion history.
  for (const id of personalConfusions) {
    if (take(byId.get(id))) break;
  }

  // 3. Progressive widening.
  const sharesRole = (f: Family) => f.roles.some((r) => target.roles.includes(r));
  const tiers: ((f: Family) => boolean)[] = [
    (f) => f.category === target.category && sharesRole(f),
    (f) => f.category === target.category,
    () => true,
  ];
  for (const tier of tiers) {
    for (const source of [pool, all]) {
      for (const f of shuffle(source.filter(tier), rng)) {
        if (chosen.length >= count) return chosen;
        take(f);
      }
    }
  }
  return chosen;
}
