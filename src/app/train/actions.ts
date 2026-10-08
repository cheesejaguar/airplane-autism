"use server";

import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardState, review, trainingSession } from "@/db/schema";
import { families, familyImagesForAngles, getFamily, getImage, label, quizPool } from "@/lib/catalog";
import type { Angle, Family } from "@/lib/catalog/schema";
import { EXPOSURES, VIEWS, parseDeckConfig, type DeckConfig } from "@/lib/deck/config";
import { pickDistractors } from "@/lib/quiz/distractors";
import { ratingFor } from "@/lib/quiz/grading";
import { pickImage, type AngleStat } from "@/lib/quiz/images";
import { buildQueue } from "@/lib/quiz/queue";
import { openQuestion, sealQuestion } from "@/lib/quiz/token";
import type { AnswerResult, ClientQuestion, FamilyReveal, PickedSummary, SessionStart, SessionSummary } from "@/lib/quiz/types";
import { createRng, shuffle, type Rng } from "@/lib/random";
import { getViewer } from "@/lib/session";
import { schedule, type CardRow } from "@/lib/srs";

type Ctx = {
  userId: string;
  sessionId: string;
  config: DeckConfig;
  pool: Family[];
  confusions: Map<string, string[]>;
  angleStats: Map<string, Map<Angle, AngleStat>>;
  recent: Set<string>;
  seen: Set<string>;
  rng: Rng;
};

const id = () => crypto.randomUUID();

function makeQuestion(ctx: Ctx, familyId: string): ClientQuestion | null {
  const target = getFamily(familyId);
  if (!target) return null;
  const candidates = familyImagesForAngles(familyId, VIEWS[ctx.config.view].angles);
  const image = pickImage(candidates, { angleStats: ctx.angleStats.get(familyId), recent: ctx.recent, rng: ctx.rng });
  if (!image) return null;
  ctx.recent.add(image.id);

  const distractors = pickDistractors({
    target,
    pool: ctx.pool,
    all: families,
    count: ctx.config.choices - 1,
    personalConfusions: ctx.confusions.get(familyId),
    rng: ctx.rng,
  });
  const options = shuffle([target, ...distractors], ctx.rng);
  const token = sealQuestion({
    v: 1,
    qid: id(),
    uid: ctx.userId,
    sid: ctx.sessionId,
    fid: target.id,
    iid: image.id,
    angle: image.angle,
    opts: options.map((o) => o.id),
    exposure: ctx.config.exposure,
    conditions: ctx.config.conditions,
    iat: Date.now(),
  });
  return {
    token,
    image: { src: image.src, srcSmall: image.srcSmall, width: image.width, height: image.height },
    options: options.map((o) => ({ id: o.id, label: label(o) })),
    exposureMs: EXPOSURES[ctx.config.exposure].ms,
    conditions: ctx.config.conditions,
    isNew: !ctx.seen.has(familyId),
  };
}

async function loadLearnerSignals(userId: string, familyIds: string[]) {
  const confusions = new Map<string, string[]>();
  const angleStats = new Map<string, Map<Angle, AngleStat>>();
  if (!familyIds.length) return { confusions, angleStats, recent: new Set<string>() };

  const confusionRows = await db
    .select({ familyId: review.familyId, chosen: review.chosenFamilyId, n: sql<number>`count(*)::int` })
    .from(review)
    .where(and(eq(review.userId, userId), eq(review.correct, false), inArray(review.familyId, familyIds)))
    .groupBy(review.familyId, review.chosenFamilyId)
    .orderBy(desc(sql`count(*)`));
  for (const r of confusionRows) confusions.set(r.familyId, [...(confusions.get(r.familyId) ?? []), r.chosen]);

  const angleRows = await db
    .select({
      familyId: review.familyId,
      angle: review.angle,
      seen: sql<number>`count(*)::int`,
      correct: sql<number>`sum(case when ${review.correct} then 1 else 0 end)::int`,
    })
    .from(review)
    .where(and(eq(review.userId, userId), eq(review.attemptNo, 1), inArray(review.familyId, familyIds)))
    .groupBy(review.familyId, review.angle);
  for (const r of angleRows) {
    const m = angleStats.get(r.familyId) ?? new Map<Angle, AngleStat>();
    m.set(r.angle as Angle, { seen: r.seen, correct: r.correct });
    angleStats.set(r.familyId, m);
  }

  const recentRows = await db
    .select({ imageId: review.imageId })
    .from(review)
    .where(eq(review.userId, userId))
    .orderBy(desc(review.createdAt))
    .limit(150);
  return { confusions, angleStats, recent: new Set(recentRows.map((r) => r.imageId)) };
}

export async function startSession(configInput: unknown): Promise<SessionStart> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "no-session" };
  const config = parseDeckConfig(configInput);
  const pool = quizPool(config);
  if (!pool.length) return { ok: false, error: "empty-deck" };

  const rows = await db
    .select()
    .from(cardState)
    .where(and(eq(cardState.userId, viewer.id), inArray(cardState.familyId, pool.map((f) => f.id))));
  const cards = new Map<string, CardRow>(rows.map((r) => [r.familyId, r]));
  const rng = createRng();
  const queue = buildQueue({ pool, cards, size: config.sessionLength, newLimit: config.newPerSession, now: new Date(), rng, cycle: config.familyIds.length > 0 });

  const sessionId = id();
  await db.insert(trainingSession).values({ id: sessionId, userId: viewer.id, deckConfig: config, targetCount: queue.length });

  const signals = await loadLearnerSignals(viewer.id, queue);
  const ctx: Ctx = {
    userId: viewer.id,
    sessionId,
    config,
    pool,
    ...signals,
    seen: new Set(rows.filter((r) => r.reps > 0).map((r) => r.familyId)),
    rng,
  };
  const questions = queue.map((fid) => makeQuestion(ctx, fid)).filter((q): q is ClientQuestion => !!q);
  return { ok: true, sessionId, questions, poolSize: pool.length };
}

function revealFor(familyId: string, imageId: string): FamilyReveal {
  const f = getFamily(familyId)!;
  const img = getImage(imageId);
  return {
    id: f.id,
    name: f.name,
    label: label(f),
    manufacturer: f.manufacturer,
    summary: f.summary,
    category: f.category,
    sector: f.sector,
    roles: f.roles,
    weft: f.weft,
    tellTales: f.tellTales,
    angle: img?.angle ?? "side",
    credit: {
      author: img?.author ?? "Unknown",
      license: img?.license ?? "",
      licenseUrl: img?.licenseUrl,
      sourceUrl: img?.sourceUrl ?? "",
      title: img?.title ?? "",
    },
  };
}

/**
 * Summary of the type the user picked. `howToTell` sentences usually name both aircraft, so they
 * are only included once the answer has been revealed — never in a retry hint.
 */
function pickedSummary(pickedId: string, targetId: string, revealed: boolean): PickedSummary {
  const p = getFamily(pickedId)!;
  const target = getFamily(targetId)!;
  const howToTell = revealed
    ? (target.confusedWith.find((c) => c.id === pickedId)?.howToTell ?? p.confusedWith.find((c) => c.id === targetId)?.howToTell)
    : undefined;
  return { id: p.id, name: p.name, label: label(p), tellTales: p.tellTales.slice(0, 2), howToTell };
}

export async function getHint(token: string): Promise<{ lookFor: string } | null> {
  const viewer = await getViewer();
  const q = openQuestion(token);
  if (!viewer || !q || q.uid !== viewer.id) return null;
  const f = getFamily(q.fid);
  return f ? { lookFor: f.tellTales[0] } : null;
}

export async function submitAnswer(input: {
  token: string;
  chosenId: string;
  attemptNo: number;
  latencyMs: number;
  hintUsed: boolean;
}): Promise<AnswerResult | { status: "error"; message: string }> {
  const viewer = await getViewer();
  const q = openQuestion(input.token);
  if (!viewer || !q || q.uid !== viewer.id) return { status: "error", message: "Invalid question" };
  if (!q.opts.includes(input.chosenId)) return { status: "error", message: "Invalid option" };
  const attemptNo = Math.min(Math.max(1, Math.round(input.attemptNo)), 2);
  const latencyMs = Math.min(Math.max(0, Math.round(input.latencyMs)), 120_000);

  // A second attempt is only allowed after a recorded wrong first attempt.
  if (attemptNo === 2) {
    const [first] = await db
      .select({ correct: review.correct })
      .from(review)
      .where(and(eq(review.questionId, q.qid), eq(review.attemptNo, 1)))
      .limit(1);
    if (!first || first.correct) return { status: "error", message: "Already answered" };
  }

  const correct = input.chosenId === q.fid;
  const final = correct || attemptNo >= 2;
  const rating = final ? ratingFor({ correct, attempts: attemptNo, hintUsed: input.hintUsed, latencyMs, exposure: q.exposure }) : null;

  // The unique (question_id, attempt_no) index makes double submits a no-op.
  const inserted = await db.insert(review).values({
    id: id(),
    userId: viewer.id,
    sessionId: q.sid,
    questionId: q.qid,
    familyId: q.fid,
    imageId: q.iid,
    angle: q.angle,
    exposure: q.exposure,
    conditions: q.conditions,
    chosenFamilyId: input.chosenId,
    attemptNo,
    correct,
    hintShown: input.hintUsed || attemptNo > 1,
    latencyMs,
    rating,
  }).onConflictDoNothing().returning({ id: review.id });
  if (!inserted.length) return { status: "error", message: "Already answered" };

  if (final && rating) {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(cardState)
      .where(and(eq(cardState.userId, viewer.id), eq(cardState.familyId, q.fid)));
    const next = schedule(q.fid, existing ?? null, rating, now);
    const values = { userId: viewer.id, ...next };
    await db
      .insert(cardState)
      .values(values)
      .onConflictDoUpdate({ target: [cardState.userId, cardState.familyId], set: next });
  }

  if (correct) return { status: "correct", attemptNo, rating: rating!, reveal: revealFor(q.fid, q.iid) };
  if (!final) {
    const f = getFamily(q.fid)!;
    return {
      status: "retry",
      eliminated: input.chosenId,
      hint: { lookFor: f.tellTales[input.hintUsed && f.tellTales.length > 1 ? 1 : 0], picked: pickedSummary(input.chosenId, q.fid, false) },
    };
  }

  // Missed twice: reveal, and queue the same aircraft again later in the session with a new photo.
  const [sessionRow] = await db.select().from(trainingSession).where(eq(trainingSession.id, q.sid));
  let requeue: ClientQuestion | null = null;
  if (sessionRow) {
    const config = parseDeckConfig(sessionRow.deckConfig);
    const signals = await loadLearnerSignals(viewer.id, [q.fid]);
    signals.recent.add(q.iid);
    requeue = makeQuestion(
      { userId: viewer.id, sessionId: q.sid, config, pool: quizPool(config), ...signals, seen: new Set([q.fid]), rng: createRng() },
      q.fid,
    );
  }
  return {
    status: "revealed",
    rating: rating!,
    reveal: revealFor(q.fid, q.iid),
    picked: pickedSummary(input.chosenId, q.fid, true),
    requeue,
  };
}

export async function finishSession(sessionId: string): Promise<SessionSummary | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  await db
    .update(trainingSession)
    .set({ endedAt: new Date() })
    .where(and(eq(trainingSession.id, sessionId), eq(trainingSession.userId, viewer.id)));

  const rows = await db
    .select()
    .from(review)
    .where(and(eq(review.sessionId, sessionId), eq(review.userId, viewer.id)));
  const byQuestion = new Map<string, typeof rows>();
  for (const r of rows) byQuestion.set(r.questionId, [...(byQuestion.get(r.questionId) ?? []), r]);

  let firstTry = 0;
  let afterHint = 0;
  const missed = new Map<string, { id: string; name: string; label: string }>();
  let latencySum = 0;
  for (const attempts of byQuestion.values()) {
    const first = attempts.find((a) => a.attemptNo === 1);
    const last = attempts.reduce((a, b) => (b.attemptNo > a.attemptNo ? b : a));
    if (first?.correct && !first.hintShown) firstTry++;
    else if (last.correct) afterHint++;
    else {
      const f = getFamily(last.familyId);
      if (f) missed.set(f.id, { id: f.id, name: f.name, label: label(f) });
    }
    latencySum += last.latencyMs;
  }
  // Aircraft seen for the very first time in this session and answered correctly at the end.
  const [sess] = await db.select({ startedAt: trainingSession.startedAt }).from(trainingSession).where(eq(trainingSession.id, sessionId));
  const sessionFamilies = [...new Set(rows.map((r) => r.familyId))];
  let newLearned = 0;
  if (sess && sessionFamilies.length) {
    const seenBefore = await db
      .selectDistinct({ familyId: review.familyId })
      .from(review)
      .where(and(eq(review.userId, viewer.id), inArray(review.familyId, sessionFamilies), sql`${review.createdAt} < ${sess.startedAt}`));
    const before = new Set(seenBefore.map((r) => r.familyId));
    newLearned = sessionFamilies.filter((fid) => !before.has(fid) && rows.some((r) => r.familyId === fid && r.correct)).length;
  }
  return {
    total: byQuestion.size,
    firstTry,
    afterHint,
    missed: [...missed.values()],
    avgLatencyMs: byQuestion.size ? Math.round(latencySum / byQuestion.size) : 0,
    newLearned,
  };
}
