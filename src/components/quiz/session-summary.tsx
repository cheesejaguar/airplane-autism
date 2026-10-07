"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { animate, motion } from "motion/react";
import { RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionSummary } from "@/lib/quiz/types";
import { trainHref } from "@/lib/deck/url";
import type { DeckConfig } from "@/lib/deck/config";

function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to]);
  return (
    <>
      {v}
      {suffix}
    </>
  );
}

export function SessionSummaryView({ summary, deck }: { summary: SessionSummary; deck: DeckConfig }) {
  const pct = summary.total ? Math.round((summary.firstTry / summary.total) * 100) : 0;
  const ring = 2 * Math.PI * 52;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <p className="type-readout text-muted-foreground">Debrief</p>
      <h1 className="type-display mt-2 text-4xl sm:text-5xl">Session complete</h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="relative mx-auto size-40">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--muted)" strokeWidth="10" />
            <motion.circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--go)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ring}
              initial={{ strokeDashoffset: ring }}
              animate={{ strokeDashoffset: ring * (1 - pct / 100) }}
              transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="type-display text-4xl">
                <Count to={pct} suffix="%" />
              </div>
              <div className="type-readout text-muted-foreground">first look</div>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
          {[
            ["Identified first look", summary.firstTry],
            ["After a hint", summary.afterHint],
            ["Missed", summary.missed.length],
            ["Avg. response", `${(summary.avgLatencyMs / 1000).toFixed(1)} s`],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-card p-4">
              <dt className="type-readout text-muted-foreground">{k}</dt>
              <dd className="type-display mt-1 text-2xl">{typeof v === "number" ? <Count to={v} /> : v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {summary.missed.length > 0 && (
        <div className="mt-10">
          <h2 className="type-condensed text-xl">Needs another look</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {summary.missed.map((m) => (
              <li key={m.id}>
                <Link href={`/study/${m.id}`} className="inline-flex rounded-md border px-3 py-1.5 text-sm hover:border-[var(--info)] hover:bg-accent">
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href={trainHref(deck)}>
            <RotateCcw /> Train again
          </Link>
        </Button>
        {summary.missed.length > 0 && (
          <Button asChild size="lg" variant="outline">
            <Link href={trainHref({ ...deck, familyIds: summary.missed.map((m) => m.id), sessionLength: Math.max(5, summary.missed.length * 2), newPerSession: 50 })}>
              <Target /> Drill the misses
            </Link>
          </Button>
        )}
        <Button asChild size="lg" variant="ghost">
          <Link href="/stats">See your stats</Link>
        </Button>
      </div>
    </div>
  );
}
