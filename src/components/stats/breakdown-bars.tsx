"use client";

import { motion } from "motion/react";
import type { Breakdown } from "@/lib/stats/queries";

export function BreakdownBars({ rows, empty = "Not enough answers yet." }: { rows: Breakdown[]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.key} className="grid grid-cols-[7.5rem_1fr_3.25rem] items-center gap-3 text-sm" title={`${r.correct} of ${r.seen} identified on first look`}>
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--info)]"
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(2, r.accuracy * 100)}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums">
            {Math.round(r.accuracy * 100)}%<span className="ml-1 text-muted-foreground">·{r.seen}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
