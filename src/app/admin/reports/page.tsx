import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { report } from "@/db/schema";
import { CopyBriefButton, ResolveButtons } from "@/components/reports/admin-controls";
import { isAdmin } from "@/lib/admin";
import { getFamily, getImage, label } from "@/lib/catalog";
import { groupReports } from "@/lib/reports/brief";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports/types";
import { getViewer } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

const STATUSES = ["open", "fixed", "dismissed"] as const;

async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) notFound();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status! : "open";

  const counts = Object.fromEntries(
    (await db.select({ status: report.status, n: sql<number>`count(*)::int` }).from(report).groupBy(report.status)).map((r) => [r.status, r.n]),
  );
  const rows = await db.select().from(report).where(eq(report.status, status)).orderBy(desc(report.createdAt)).limit(500);
  const groups = groupReports(rows);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex gap-1" aria-label="Report status">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/reports?status=${s}`}
              className={cn("rounded-md border px-3 py-1.5 text-sm capitalize", s === status ? "border-primary text-foreground" : "text-muted-foreground")}
            >
              {s} <span className="font-mono text-xs opacity-70">{counts[s] ?? 0}</span>
            </Link>
          ))}
        </nav>
        {status === "open" && groups.length > 0 && <CopyBriefButton />}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Or run <code className="rounded bg-muted px-1">/fix-reports</code> in Claude Code inside the Tally repo — it exports these straight from the
        database.
      </p>

      {!groups.length && <p className="mt-10 text-center text-muted-foreground">No {status} reports.</p>}
      <ul className="mt-6 space-y-4">
        {groups.map((g) => {
          const f = getFamily(g.familyId);
          const img = g.imageId ? getImage(g.imageId) : undefined;
          return (
            <li key={g.key} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row">
              {img ? (
                <a href={img.src} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.srcSmall} alt="" className="h-28 w-44 rounded-md object-cover" />
                </a>
              ) : (
                <div className="chart-grid grid h-28 w-44 shrink-0 place-items-center rounded-md bg-muted text-xs text-muted-foreground">
                  {g.imageId ? "Photo removed" : "Aircraft data"}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <p>
                  <Link href={`/study/${g.familyId}`} className="type-condensed text-lg hover:text-primary">
                    {f ? label(f) : g.familyId}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {g.imageId ?? "family"} · {img?.angle ?? ""} · {g.reports.length} report{g.reports.length === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="flex flex-wrap gap-1.5">
                  {Object.entries(g.reasons).map(([r, n]) => (
                    <span key={r} className="rounded border px-1.5 py-0.5 text-xs">
                      {REPORT_REASONS[r as ReportReason]?.label ?? r} ×{n}
                    </span>
                  ))}
                  {Object.entries(g.suggestions).map(([id, n]) => (
                    <span key={id} className="rounded border border-[var(--caution)]/60 px-1.5 py-0.5 text-xs">
                      Actually {getFamily(id) ? label(getFamily(id)!) : id}? ×{n}
                    </span>
                  ))}
                </p>
                {g.reports
                  .filter((r) => r.note)
                  .map((r) => (
                    <p key={r.id} className="text-muted-foreground">
                      “{r.note}”
                    </p>
                  ))}
                {img && (
                  <p className="text-xs text-muted-foreground">
                    <a href={img.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      Commons source
                    </a>{" "}
                    · {img.author}
                  </p>
                )}
                {g.reports[0].resolution && <p className="text-xs">Resolution: {g.reports[0].resolution}</p>}
                <div className="pt-1">
                  <ResolveButtons ids={g.reports.map((r) => r.id)} status={status} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Admin</p>
      <h1 className="type-display mt-2 text-4xl">Reports</h1>
      <div className="mt-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <Reports searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
