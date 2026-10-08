import type { Mastery } from "@/lib/srs";

// Sequential single-hue ramp (chart blue), light → strong, for an ordinal scale.
export const MASTERY_STEP: Record<Mastery, { label: string; className: string }> = {
  new: { label: "Not started", className: "bg-muted border border-border" },
  learning: { label: "Learning", className: "bg-[color-mix(in_oklab,var(--info)_35%,transparent)]" },
  familiar: { label: "Familiar", className: "bg-[color-mix(in_oklab,var(--info)_65%,transparent)]" },
  mastered: { label: "Mastered", className: "bg-[var(--info)]" },
};
