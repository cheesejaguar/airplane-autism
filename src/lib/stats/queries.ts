import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardState, review, trainingSession } from "@/db/schema";
import { families, getFamily, label, ROLE_LABELS, CATEGORY_LABELS } from "@/lib/catalog";
import type { Role } from "@/lib/catalog/schema";
import { masteryOf, type Mastery } from "@/lib/srs";

export type Breakdown = { key: string; label: string; seen: number; correct: number; accuracy: number };

export type StatsData = {
  totals: {
    questions: number;
    firstTry: number;
    accuracy: number;
    avgLatencyMs: number;
    sessions: number;
    learned: number;
    mastered: number;
    due: number;
    streak: number;
    bestStreak: number;
    activeDays: number;
  };
  rank: { name: string; next: string | null; progress: number; requirement: string };
  daily: { date: string; questions: number; accuracy: number | null; latency: number | null }[];
  byAngle: Breakdown[];
  byCategory: Breakdown[];
  byRole: Breakdown[];
  byExposure: Breakdown[];
  confusions: { targetId: string; target: string; chosenId: string; chosen: string; count: number }[];
  mastery: { id: string; label: string; category: string; mastery: Mastery; accuracy: number | null; seen: number }[];
  weakest: { id: string; label: string; accuracy: number; seen: number }[];
  sessions: { id: string; startedAt: string; questions: number; firstTry: number }[];
};

const ANGLE_LABEL: Record<string, string> = {
  front: "Head-on",
  "front-quarter": "Front ¾",
  side: "Profile",
  "rear-quarter": "Rear ¾",
  rear: "Rear",
  top: "Top",
  belly: "Belly",
};
const EXPOSURE_LABEL: Record<string, string> = { unlimited: "Unlimited", "3s": "3 s", "1s": "1 s", "0.5s": "0.5 s" };

const RANKS = [
  { name: "Recruit", need: { learned: 0, mastered: 0, accuracy: 0 } },
  { name: "Spotter", need: { learned: 10, mastered: 0, accuracy: 0.5 } },
  { name: "Observer", need: { learned: 30, mastered: 5, accuracy: 0.6 } },
  { name: "Analyst", need: { learned: 60, mastered: 25, accuracy: 0.75 } },
  { name: "Expert", need: { learned: 100, mastered: 60, accuracy: 0.85 } },
] as const;

function rankFor(learned: number, mastered: number, accuracy: number) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (learned >= r.need.learned && mastered >= r.need.mastered && accuracy >= r.need.accuracy) idx = i;
  });
  const next = RANKS[idx + 1];
  if (!next) return { name: RANKS[idx].name, next: null, progress: 1, requirement: "Top rank reached" };
  const parts = [
    next.need.learned ? Math.min(1, learned / next.need.learned) : 1,
    next.need.mastered ? Math.min(1, mastered / next.need.mastered) : 1,
    next.need.accuracy ? Math.min(1, accuracy / next.need.accuracy) : 1,
  ];
  return {
    name: RANKS[idx].name,
    next: next.name,
    progress: parts.reduce((a, b) => a + b, 0) / parts.length,
    requirement: `${next.need.learned} aircraft learned · ${next.need.mastered} mastered · ${Math.round(next.need.accuracy * 100)}% first-look accuracy`,
  };
}

const pct = (c: number, s: number) => (s ? c / s : 0);

export async function getStats(userId: string, tz: string): Promise<StatsData> {
  const first = and(eq(review.userId, userId), eq(review.attemptNo, 1));
  const firstOk = sql<number>`sum(case when ${review.correct} and not ${review.hintShown} then 1 else 0 end)::int`;
  const n = sql<number>`count(*)::int`;
  const day = sql<string>`to_char((${review.createdAt} at time zone ${tz})::date, 'YYYY-MM-DD')`;

  const [totalsRow] = await db
    .select({ questions: n, firstTry: firstOk, avgLatency: sql<number>`coalesce(avg(${review.latencyMs}), 0)::int` })
    .from(review)
    .where(first);

  const [byFamily, byAngle, byExposure, dailyRows, confusionRows, cards, sessionRows, sessionCount] = await Promise.all([
    db.select({ familyId: review.familyId, seen: n, correct: firstOk }).from(review).where(first).groupBy(review.familyId),
    db.select({ key: review.angle, seen: n, correct: firstOk }).from(review).where(first).groupBy(review.angle),
    db.select({ key: review.exposure, seen: n, correct: firstOk }).from(review).where(first).groupBy(review.exposure),
    db
      .select({ date: day, questions: n, correct: firstOk, latency: sql<number>`avg(${review.latencyMs})::int` })
      .from(review)
      .where(first)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ familyId: review.familyId, chosen: review.chosenFamilyId, count: n })
      .from(review)
      .where(and(eq(review.userId, userId), eq(review.correct, false)))
      .groupBy(review.familyId, review.chosenFamilyId)
      .orderBy(desc(n))
      .limit(8),
    db.select().from(cardState).where(eq(cardState.userId, userId)),
    db
      .select({
        id: trainingSession.id,
        startedAt: trainingSession.startedAt,
        questions: sql<number>`count(${review.id}) filter (where ${review.attemptNo} = 1)::int`,
        firstTry: sql<number>`count(${review.id}) filter (where ${review.attemptNo} = 1 and ${review.correct} and not ${review.hintShown})::int`,
      })
      .from(trainingSession)
      .leftJoin(review, eq(review.sessionId, trainingSession.id))
      .where(eq(trainingSession.userId, userId))
      .groupBy(trainingSession.id, trainingSession.startedAt)
      .orderBy(desc(trainingSession.startedAt))
      .limit(12),
    db.select({ n }).from(trainingSession).where(eq(trainingSession.userId, userId)),
  ]);

  // Streaks from active days (in the viewer's timezone).
  const activeDays = dailyRows.map((d) => d.date);
  const daySet = new Set(activeDays);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const shift = (d: string, k: number) => {
    const t = new Date(`${d}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() + k);
    return t.toISOString().slice(0, 10);
  };
  let streak = 0;
  for (let d = daySet.has(today) ? today : shift(today, -1); daySet.has(d); d = shift(d, -1)) streak++;
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of activeDays) {
    run = prev && shift(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  // Last 30 days, zero-filled.
  const dailyMap = new Map(dailyRows.map((d) => [d.date, d]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = shift(today, i - 29);
    const r = dailyMap.get(date);
    return { date, questions: r?.questions ?? 0, accuracy: r ? pct(r.correct, r.questions) : null, latency: r?.latency ?? null };
  });

  const now = new Date();
  const cardMap = new Map(cards.map((c) => [c.familyId, c]));
  const masteryCounts = cards.map((c) => masteryOf(c, now));
  const learned = cards.filter((c) => c.reps > 0).length;
  const mastered = masteryCounts.filter((m) => m === "mastered").length;
  const due = cards.filter((c) => c.reps > 0 && c.due <= now).length;
  const accuracy = pct(totalsRow?.firstTry ?? 0, totalsRow?.questions ?? 0);

  // Category / role breakdowns are joined against the catalog in app code.
  const catAgg = new Map<string, { seen: number; correct: number }>();
  const roleAgg = new Map<string, { seen: number; correct: number }>();
  const famStats = new Map(byFamily.map((r) => [r.familyId, r]));
  for (const r of byFamily) {
    const f = getFamily(r.familyId);
    if (!f) continue;
    const c = catAgg.get(f.category) ?? { seen: 0, correct: 0 };
    catAgg.set(f.category, { seen: c.seen + r.seen, correct: c.correct + r.correct });
    for (const role of f.roles) {
      const x = roleAgg.get(role) ?? { seen: 0, correct: 0 };
      roleAgg.set(role, { seen: x.seen + r.seen, correct: x.correct + r.correct });
    }
  }
  const toBreakdown = (m: Map<string, { seen: number; correct: number }>, labeler: (k: string) => string): Breakdown[] =>
    [...m.entries()]
      .map(([key, v]) => ({ key, label: labeler(key), seen: v.seen, correct: v.correct, accuracy: pct(v.correct, v.seen) }))
      .sort((a, b) => b.seen - a.seen);

  const angleOrder = Object.keys(ANGLE_LABEL);
  const exposureOrder = Object.keys(EXPOSURE_LABEL);

  return {
    totals: {
      questions: totalsRow?.questions ?? 0,
      firstTry: totalsRow?.firstTry ?? 0,
      accuracy,
      avgLatencyMs: totalsRow?.avgLatency ?? 0,
      sessions: sessionCount[0]?.n ?? 0,
      learned,
      mastered,
      due,
      streak,
      bestStreak: best,
      activeDays: activeDays.length,
    },
    rank: rankFor(learned, mastered, accuracy),
    daily,
    byAngle: byAngle
      .map((r) => ({ key: r.key, label: ANGLE_LABEL[r.key] ?? r.key, seen: r.seen, correct: r.correct, accuracy: pct(r.correct, r.seen) }))
      .sort((a, b) => angleOrder.indexOf(a.key) - angleOrder.indexOf(b.key)),
    byExposure: byExposure
      .map((r) => ({ key: r.key, label: EXPOSURE_LABEL[r.key] ?? r.key, seen: r.seen, correct: r.correct, accuracy: pct(r.correct, r.seen) }))
      .sort((a, b) => exposureOrder.indexOf(a.key) - exposureOrder.indexOf(b.key)),
    byCategory: toBreakdown(catAgg, (k) => CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS] ?? k),
    byRole: toBreakdown(roleAgg, (k) => ROLE_LABELS[k as Role] ?? k).slice(0, 10),
    confusions: confusionRows
      .map((r) => ({ targetId: r.familyId, chosenId: r.chosen, target: label(getFamily(r.familyId) ?? { name: r.familyId }), chosen: label(getFamily(r.chosen) ?? { name: r.chosen }), count: r.count })),
    mastery: families.map((f) => {
      const s = famStats.get(f.id);
      return { id: f.id, label: label(f), category: f.category, mastery: masteryOf(cardMap.get(f.id), now), accuracy: s ? pct(s.correct, s.seen) : null, seen: s?.seen ?? 0 };
    }),
    weakest: byFamily
      .filter((r) => r.seen >= 2)
      .map((r) => ({ id: r.familyId, label: label(getFamily(r.familyId) ?? { name: r.familyId }), accuracy: pct(r.correct, r.seen), seen: r.seen }))
      .sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen)
      .slice(0, 6),
    sessions: sessionRows.filter((s) => s.questions > 0).map((s) => ({ id: s.id, startedAt: s.startedAt.toISOString(), questions: s.questions, firstTry: s.firstTry })),
  };
}
