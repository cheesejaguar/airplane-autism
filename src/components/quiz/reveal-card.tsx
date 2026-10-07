"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Scale } from "lucide-react";
import { CATEGORY_LABELS_CLIENT, roleLabel } from "@/lib/catalog/labels";
import type { FamilyReveal, PickedSummary } from "@/lib/quiz/types";
import { WeftStrip } from "./weft-strip";
import { cn } from "@/lib/utils";

/** Types the name in, letter by letter, like a stencilled registration. */
function TypedName({ text }: { text: string }) {
  return (
    <span aria-label={text} className="inline-block">
      {[...text].map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          aria-hidden
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: "0.35em", filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.018 * i, duration: 0.22 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

export function RevealCard({
  reveal,
  outcome,
  picked,
  showWeft,
  actions,
}: {
  reveal: FamilyReveal;
  outcome: "first" | "second" | "missed";
  picked?: PickedSummary;
  showWeft: boolean;
  actions?: React.ReactNode;
}) {
  const tone = outcome === "missed" ? "var(--caution)" : "var(--go)";
  const verdict = { first: "Tally — confirmed", second: "Confirmed on second look", missed: "Missed — study the differences" }[outcome];
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="space-y-4"
      aria-live="polite"
    >
      <div>
        <p className="type-readout" style={{ color: tone }}>
          {verdict}
        </p>
        <h2 className="type-display mt-1 text-[clamp(1.6rem,4.5vw,2.6rem)]">
          <TypedName text={reveal.label} />
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {reveal.name !== reveal.label && <span className="text-foreground">{reveal.name} · </span>}
          {reveal.manufacturer} · {CATEGORY_LABELS_CLIENT[reveal.category]} · {reveal.roles.slice(0, 3).map(roleLabel).join(", ")}
        </p>
      </div>

      <ul className="space-y-1.5">
        {reveal.tellTales.map((t, i) => (
          <motion.li
            key={t}
            className="flex gap-2.5 text-[0.95rem]"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.08 }}
          >
            <span className="type-readout mt-1 shrink-0" style={{ color: tone }}>
              Cue {i + 1}
            </span>
            <span>{t}</span>
          </motion.li>
        ))}
      </ul>

      {picked && (
        <div className="rounded-lg border border-dashed border-[var(--caution)]/60 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Scale className="size-4 text-[var(--caution)]" /> You said {picked.label}
          </p>
          {picked.howToTell && <p className="mt-1.5 text-muted-foreground">{picked.howToTell}</p>}
          <Link
            href={`/compare/${reveal.id}/${picked.id}`}
            className="mt-2 inline-flex items-center gap-1 text-[var(--info)] underline-offset-4 hover:underline"
          >
            Compare side by side <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}

      {actions}

      {showWeft && <WeftStrip weft={reveal.weft} compact className="lg:grid-cols-2" />}

      <p className={cn("text-xs text-muted-foreground")}>
        Photo:{" "}
        <a href={reveal.credit.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          {reveal.credit.author}
        </a>{" "}
        · {reveal.credit.license} · Wikimedia Commons
      </p>
    </motion.section>
  );
}
