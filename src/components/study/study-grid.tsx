"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS_CLIENT } from "@/lib/catalog/labels";
import type { FamilyLite } from "@/lib/catalog/lite";
import type { Category } from "@/lib/catalog/schema";
import type { Mastery } from "@/lib/srs";
import { MASTERY_STEP } from "@/lib/progress/mastery-style";
import { cn } from "@/lib/utils";

const MASTERY_STYLE = MASTERY_STEP;

export function StudyGrid({ families, mastery }: { families: FamilyLite[]; mastery: Record<string, Mastery> }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [sector, setSector] = useState<"all" | "military" | "civil">("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return families.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (sector !== "all" && !(f.sector === sector || f.sector === "both")) return false;
      if (q && !`${f.name} ${f.label} ${f.manufacturer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [families, query, cat, sector]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or maker" className="pl-9" aria-label="Search aircraft" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...Object.keys(CATEGORY_LABELS_CLIENT)] as (Category | "all")[]).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={cn("rounded-md border px-2.5 py-1.5 text-sm", cat === c ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {c === "all" ? "All types" : CATEGORY_LABELS_CLIENT[c]}
            </button>
          ))}
          <span className="mx-1 hidden w-px bg-border sm:block" />
          {(["all", "military", "civil"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSector(s)} aria-pressed={sector === s} className={cn("rounded-md border px-2.5 py-1.5 text-sm capitalize", sector === s ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "Civil & military" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>{shown.length} aircraft</span>
        {(Object.keys(MASTERY_STYLE) as Mastery[]).map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", MASTERY_STYLE[m].className)} /> {MASTERY_STYLE[m].label}
          </span>
        ))}
      </div>

      <motion.ul layout className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence initial={false}>
          {shown.map((f) => {
            const m = mastery[f.id] ?? "new";
            return (
              <motion.li key={f.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}>
                <Link href={`/study/${f.id}`} className="group block overflow-hidden rounded-lg border bg-card transition-colors hover:border-[var(--info)]">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#08101a]">
                    {f.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.thumb} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="chart-grid size-full" />
                    )}
                    <span className={cn("absolute right-2 top-2 size-2.5 rounded-full ring-2 ring-[#08101a]", MASTERY_STYLE[m].className)} title={MASTERY_STYLE[m].label} />
                  </div>
                  <div className="p-3">
                    <p className="type-condensed truncate text-[1.05rem] leading-tight">{f.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{f.name !== f.label ? f.name : f.manufacturer}</p>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      {!shown.length && <p className="mt-10 text-center text-muted-foreground">No aircraft match. Clear the search or pick another type.</p>}
    </div>
  );
}
