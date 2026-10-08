"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type TapeMark = "pending" | "current" | "first" | "second" | "missed";

export function ProgressTape({ marks }: { marks: TapeMark[] }) {
  return (
    <div className="flex h-2 w-full gap-[3px]" role="progressbar" aria-valuemin={0} aria-valuemax={marks.length} aria-valuenow={marks.filter((m) => m !== "pending" && m !== "current").length}>
      {marks.map((m, i) => (
        <motion.span
          key={i}
          layout
          className={cn(
            "h-full flex-1 rounded-[2px]",
            m === "pending" && "bg-muted",
            m === "current" && "bg-foreground/60",
            m === "first" && "bg-[var(--go)]",
            m === "second" && "bg-[var(--info)]",
            m === "missed" && "bg-[var(--caution)]",
          )}
          initial={false}
          animate={m === "current" ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
          transition={m === "current" ? { repeat: Infinity, duration: 1.6 } : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}
