"use client";

import { motion } from "motion/react";
import { Eye, Lightbulb } from "lucide-react";
import type { PickedSummary } from "@/lib/quiz/types";

export function HintPanel({ lookFor, picked }: { lookFor: string; picked?: PickedSummary }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      className="overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-lg border border-[var(--caution)]/50 bg-[color-mix(in_oklab,var(--caution)_9%,var(--card))] p-3 sm:p-4">
        <div className="flex gap-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--caution)]" />
          <div className="space-y-2 text-sm">
            <p>
              <span className="type-readout mr-2 text-[var(--caution)]">Look for</span>
              <span className="font-medium">{lookFor}</span>
            </p>
            {picked && (
              <p className="text-muted-foreground">
                <Eye className="mr-1.5 inline size-3.5 align-[-2px]" />
                Not the <span className="font-semibold text-foreground">{picked.label}</span>
                {picked.tellTales.length > 0 && <> — that one shows: {picked.tellTales.join("; ").replace(/\.$/, "")}.</>}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
