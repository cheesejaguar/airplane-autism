"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_LABELS_CLIENT } from "@/lib/catalog/labels";
import type { Category } from "@/lib/catalog/schema";
import type { Mastery } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { MASTERY_STEP } from "@/lib/progress/mastery-style";

export { MASTERY_STEP };

type Cell = { id: string; label: string; category: string; mastery: Mastery; accuracy: number | null; seen: number };

export function MasteryMap({ cells }: { cells: Cell[] }) {
  const groups = (Object.keys(CATEGORY_LABELS_CLIENT) as Category[])
    .map((c) => ({ category: c, cells: cells.filter((x) => x.category === c) }))
    .filter((g) => g.cells.length);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.category}>
          <p className="type-readout mb-1.5 text-muted-foreground">
            {CATEGORY_LABELS_CLIENT[g.category]} · {g.cells.filter((c) => c.mastery === "mastered").length}/{g.cells.length} mastered
          </p>
          <div className="flex flex-wrap gap-[3px]">
            {g.cells.map((c) => (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <Link href={`/study/${c.id}`} aria-label={`${c.label}: ${MASTERY_STEP[c.mastery].label}`} className={cn("size-4 rounded-[3px] transition-transform hover:scale-125 sm:size-[18px]", MASTERY_STEP[c.mastery].className)} />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs opacity-80">
                    {MASTERY_STEP[c.mastery].label}
                    {c.seen > 0 && ` · ${Math.round((c.accuracy ?? 0) * 100)}% over ${c.seen}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
        {(Object.keys(MASTERY_STEP) as Mastery[]).map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[3px]", MASTERY_STEP[m].className)} /> {MASTERY_STEP[m].label}
          </span>
        ))}
      </div>
    </div>
  );
}
