"use client";

import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChoiceStatus = "idle" | "eliminated" | "correct" | "answer" | "wrong-final";

export function ChoiceGrid({
  options,
  statuses,
  disabled,
  onChoose,
}: {
  options: { id: string; label: string }[];
  statuses: Record<string, ChoiceStatus>;
  disabled: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Choose the aircraft"
      className={cn("grid gap-2 sm:gap-3", options.length > 4 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2")}
    >
      {options.map((o, i) => {
        const s = statuses[o.id] ?? "idle";
        const isDisabled = disabled || s !== "idle";
        return (
          <motion.button
            key={o.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onChoose(o.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: s === "eliminated" ? 0.45 : 1, y: 0, scale: s === "correct" ? [1, 1.04, 1] : 1 }}
            transition={{ delay: 0.04 * i, duration: 0.25 }}
            whileTap={isDisabled ? undefined : { scale: 0.97 }}
            className={cn(
              "group relative flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors sm:min-h-16 sm:px-4",
              !isDisabled && "hover:border-[var(--info)] hover:bg-accent",
              s === "correct" && "border-[var(--go)] bg-[color-mix(in_oklab,var(--go)_14%,var(--card))]",
              s === "answer" && "border-[var(--go)] border-dashed",
              (s === "eliminated" || s === "wrong-final") && "border-[var(--caution)]/60",
            )}
            aria-keyshortcuts={String(i + 1)}
          >
            <span
              className={cn(
                "type-readout grid size-6 shrink-0 place-items-center rounded border text-muted-foreground",
                s === "correct" && "border-[var(--go)] bg-[var(--go)] text-[#0b1420]",
              )}
            >
              {s === "correct" ? <Check className="size-3.5" /> : s === "eliminated" || s === "wrong-final" ? <X className="size-3.5 text-[var(--caution)]" /> : i + 1}
            </span>
            <span
              className={cn(
                "type-condensed text-[1.05rem] leading-tight sm:text-lg",
                (s === "eliminated" || s === "wrong-final") && "line-through decoration-[var(--caution)] decoration-2",
              )}
            >
              {o.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
