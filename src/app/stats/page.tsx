import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { ArrowRight, Flame, Scale, Target } from "lucide-react";
import { AccuracyTrend, ActivityChart } from "@/components/stats/charts";
import { BreakdownBars } from "@/components/stats/breakdown-bars";
import { MasteryMap } from "@/components/stats/mastery-map";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trainHref } from "@/lib/deck/url";
import { getViewer } from "@/lib/session";
import { getStats } from "@/lib/stats/queries";

export const metadata: Metadata = { title: "Stats" };

function Panel({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 sm:p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="type-condensed text-lg">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card p-4">
      <p className="type-readout text-muted-foreground">{label}</p>
      <p className="type-display mt-1.5 text-3xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

async function Dashboard() {
  const viewer = await getViewer();
  const tzCookie = (await cookies()).get("tz")?.value;
  let tz = "UTC";
  try {
    if (tzCookie) {
      new Intl.DateTimeFormat("en", { timeZone: decodeURIComponent(tzCookie) });
      tz = decodeURIComponent(tzCookie);
    }
  } catch {}

  if (!viewer) return <EmptyState signedOut />;
  const s = await getStats(viewer.id, tz);
  if (!s.totals.questions) return <EmptyState />;

  return (
    <div className="space-y-6">
      {viewer.isGuest && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/50 bg-primary/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">You&apos;re training as a guest. Create an account to keep these stats on any device.</p>
          <Button asChild size="sm">
            <Link href="/sign-up">Save my progress</Link>
          </Button>
        </div>
      )}

      {/* Rank */}
      <section className="chart-grid relative overflow-hidden rounded-xl border bg-card p-5 sm:p-7">
        <p className="type-readout text-muted-foreground">Current rank</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h2 className="type-display text-5xl sm:text-6xl">{s.rank.name}</h2>
          <div className="flex gap-6 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Flame className="size-4 text-primary" /> <strong>{s.totals.streak}</strong> day streak
            </span>
            <span className="text-muted-foreground">Best {s.totals.bestStreak}</span>
          </div>
        </div>
        {s.rank.next && (
          <div className="mt-5 max-w-xl">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Next: {s.rank.next}</span>
              <span>{Math.round(s.rank.progress * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${s.rank.progress * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{s.rank.requirement}</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="First-look accuracy" value={`${Math.round(s.totals.accuracy * 100)}%`} sub={`${s.totals.firstTry} of ${s.totals.questions}`} />
        <Tile label="Aircraft learned" value={s.totals.learned} />
        <Tile label="Mastered" value={s.totals.mastered} />
        <Tile label="Due for review" value={s.totals.due} />
        <Tile label="Avg. response" value={<>{(s.totals.avgLatencyMs / 1000).toFixed(1)}<span className="ml-0.5 text-xl normal-case">s</span></>} />
        <Tile label="Sessions" value={s.totals.sessions} sub={`${s.totals.activeDays} active day${s.totals.activeDays === 1 ? "" : "s"}`} />
      </div>

      {s.totals.due > 0 && (
        <Button asChild size="lg">
          <Link href={trainHref({ newPerSession: 0, sessionLength: Math.min(50, Math.max(10, s.totals.due)) })}>
            <Target /> Review {s.totals.due} due aircraft
          </Link>
        </Button>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Activity" hint="Aircraft answered per day · last 30 days">
          <ActivityChart data={s.daily} />
        </Panel>
        <Panel title="Accuracy trend" hint="First-look accuracy per day">
          <AccuracyTrend data={s.daily} />
        </Panel>
      </div>

      <Panel title="Fleet mastery" hint="Every aircraft in the catalog">
        <MasteryMap cells={s.mastery} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="By viewing angle">
          <BreakdownBars rows={s.byAngle} />
        </Panel>
        <Panel title="By aircraft type">
          <BreakdownBars rows={s.byCategory} />
        </Panel>
        <Panel title="By exposure time">
          <BreakdownBars rows={s.byExposure} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Most confused pairs" hint="What you said vs what it was">
          {s.confusions.length ? (
            <ul className="divide-y">
              {s.confusions.map((c) => (
                <li key={`${c.targetId}-${c.chosenId}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <strong>{c.target}</strong>
                    <span className="text-muted-foreground"> mistaken for </span>
                    <strong>{c.chosen}</strong>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">×{c.count}</span>
                  </span>
                  <Link href={`/compare/${c.targetId}/${c.chosenId}`} className="inline-flex shrink-0 items-center gap-1 text-[var(--info)] hover:underline">
                    <Scale className="size-3.5" /> Compare
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No mix-ups yet. Keep it that way.</p>
          )}
        </Panel>
        <Panel title="By role">
          <BreakdownBars rows={s.byRole} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Weakest aircraft" hint="Seen at least twice">
          {s.weakest.length ? (
            <>
              <ul className="space-y-2">
                {s.weakest.map((w) => (
                  <li key={w.id} className="flex items-center justify-between text-sm">
                    <Link href={`/study/${w.id}`} className="hover:text-primary">
                      {w.label}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {Math.round(w.accuracy * 100)}% · {w.seen}
                    </span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-4">
                <Link href={trainHref({ familyIds: s.weakest.map((w) => w.id), sessionLength: 12, newPerSession: 20 })}>
                  Drill these <ArrowRight />
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Answer a few more aircraft to find your weak spots.</p>
          )}
        </Panel>
        <Panel title="Recent sessions">
          <ul className="divide-y text-sm">
            {s.sessions.map((x) => (
              <li key={x.id} className="flex justify-between py-2">
                <span className="text-muted-foreground">
                  {new Date(x.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz })}
                </span>
                <span className="font-mono text-xs">
                  {x.firstTry}/{x.questions} first look
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function EmptyState({ signedOut = false }: { signedOut?: boolean }) {
  return (
    <div className="chart-grid rounded-xl border bg-card p-8 text-center sm:p-14">
      <p className="type-readout text-muted-foreground">No sorties logged</p>
      <h2 className="type-display mt-2 text-3xl">Your logbook is empty</h2>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        {signedOut
          ? "Start a drill as a guest or sign in. Every answer feeds your accuracy, streaks and mastery map."
          : "Finish a drill and your accuracy, streaks and mastery map show up here."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/train">Start a drill</Link>
        </Button>
        {signedOut && (
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Logbook</p>
      <h1 className="type-display mt-2 text-4xl sm:text-5xl">Your progress</h1>
      <div className="mt-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
    </div>
  );
}
