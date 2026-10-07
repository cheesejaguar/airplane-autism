"use client";

import { motion } from "motion/react";
import type { Family } from "@/lib/catalog/schema";
import { cn } from "@/lib/utils";

const KEYS = [
  { key: "wings", letter: "W", label: "Wings" },
  { key: "engines", letter: "E", label: "Engines" },
  { key: "fuselage", letter: "F", label: "Fuselage" },
  { key: "tail", letter: "T", label: "Tail" },
] as const;

export function WeftStrip({
  weft,
  compact = false,
  className,
}: {
  weft: Family["weft"];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4", className)}>
      {KEYS.map(({ key, letter, label }, i) => (
        <motion.div
          key={key}
          className="bg-card p-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 * i, duration: 0.3 }}
        >
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="type-display text-xl text-primary">{letter}</span>
            <span className="type-readout text-muted-foreground">{label}</span>
          </div>
          <ul className={cn("space-y-1 text-sm leading-snug", compact && "text-[0.8125rem]")}>
            {(compact ? weft[key].slice(0, 2) : weft[key]).map((item) => (
              <li key={item} className="text-card-foreground/90">
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
