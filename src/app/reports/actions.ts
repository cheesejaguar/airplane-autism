"use server";

import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { report } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { getFamily, getImage } from "@/lib/catalog";
import { openQuestion } from "@/lib/quiz/token";
import { reportsBrief } from "@/lib/reports/brief";
import { REPORT_REASON_KEYS, type ReportReason, type ReportSource, type ReportStatus } from "@/lib/reports/types";
import { getViewer } from "@/lib/session";

const DAILY_LIMIT = 50;

export type SubmitReportInput = {
  /** Drill reports reference the sealed question token (the client never sees the answer's ids) */
  token?: string;
  familyId?: string;
  imageId?: string;
  chosenFamilyId?: string;
  reason: ReportReason;
  suggestedFamilyId?: string;
  note?: string;
  source: ReportSource;
};

export async function submitReport(input: SubmitReportInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in or start a drill to send reports." };
  if (!REPORT_REASON_KEYS.includes(input.reason)) return { ok: false, error: "Pick what's wrong." };

  let familyId = input.familyId;
  let imageId = input.imageId ?? null;
  let chosenFamilyId: string | null = null;
  if (input.token) {
    const q = openQuestion(input.token);
    if (!q || q.uid !== viewer.id) return { ok: false, error: "This question has expired — reload and try again." };
    familyId = q.fid;
    imageId = q.iid;
    if (input.chosenFamilyId && q.opts.includes(input.chosenFamilyId)) chosenFamilyId = input.chosenFamilyId;
  }
  if (!familyId || !getFamily(familyId)) return { ok: false, error: "Unknown aircraft." };
  if (imageId && getImage(imageId)?.familyId !== familyId) return { ok: false, error: "Unknown photo." };

  const suggestedFamilyId = input.suggestedFamilyId && getFamily(input.suggestedFamilyId) ? input.suggestedFamilyId : null;
  const note = input.note?.trim().slice(0, 1000) || null;

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(report)
    .where(and(eq(report.userId, viewer.id), gt(report.createdAt, sql`now() - interval '1 day'`)));
  if (n >= DAILY_LIMIT) return { ok: false, error: "Thanks — you've hit today's report limit. Try again tomorrow." };

  // One open report per user, item and reason: a repeat updates the existing report.
  const [existing] = await db
    .select({ id: report.id })
    .from(report)
    .where(
      and(
        eq(report.userId, viewer.id),
        eq(report.familyId, familyId),
        imageId ? eq(report.imageId, imageId) : isNull(report.imageId),
        eq(report.reason, input.reason),
        eq(report.status, "open"),
      ),
    )
    .limit(1);
  if (existing) {
    await db.update(report).set({ note, suggestedFamilyId, createdAt: new Date() }).where(eq(report.id, existing.id));
  } else {
    await db.insert(report).values({
      id: crypto.randomUUID(),
      userId: viewer.id,
      familyId,
      imageId,
      reason: input.reason,
      suggestedFamilyId,
      chosenFamilyId,
      note,
      source: input.source,
    });
  }
  return { ok: true };
}

async function requireAdmin() {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) throw new Error("Not authorised");
  return viewer!;
}

export async function setReportStatus(ids: string[], status: ReportStatus, resolution?: string): Promise<number> {
  await requireAdmin();
  if (!ids.length) return 0;
  const rows = await db
    .update(report)
    .set({ status, resolution: resolution?.trim() || null, resolvedAt: status === "open" ? null : new Date() })
    .where(inArray(report.id, ids))
    .returning({ id: report.id });
  return rows.length;
}

export async function openReportsBrief(): Promise<string> {
  await requireAdmin();
  const rows = await db.select().from(report).where(eq(report.status, "open")).orderBy(desc(report.createdAt));
  return reportsBrief(rows);
}
