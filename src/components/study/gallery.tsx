"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag } from "lucide-react";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import type { AircraftImage } from "@/lib/catalog/schema";
import { cn } from "@/lib/utils";

export const ANGLE_LABEL: Record<string, string> = {
  front: "Head-on",
  "front-quarter": "Front ¾",
  side: "Profile",
  "rear-quarter": "Rear ¾",
  rear: "Rear",
  top: "Top",
  belly: "Belly",
};

export function Gallery({ images, name, familyId, priority = false }: { images: AircraftImage[]; name: string; familyId: string; priority?: boolean }) {
  const [i, setI] = useState(0);
  const img = images[i];
  if (!img) {
    return (
      <div className="chart-grid grid aspect-[16/10] place-items-center rounded-xl border bg-card text-sm text-muted-foreground">
        No freely licensed photos of this type yet, so it isn’t in drills. Use the WEFT notes below.
      </div>
    );
  }
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-[#08101a]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={img.id}
            src={img.src}
            srcSet={`${img.srcSmall} 800w, ${img.src} 1600w`}
            sizes="(max-width: 1024px) 100vw, 760px"
            alt={`${name} — ${ANGLE_LABEL[img.angle]} view`}
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 size-full object-cover"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        </AnimatePresence>
        <span className="type-readout absolute left-3 top-3 z-10 rounded bg-[#08101a]/70 px-1.5 py-0.5 text-[#e6ecf1]">{ANGLE_LABEL[img.angle]}</span>
        <div className="absolute right-2 top-2 z-10">
          <ReportDialog
            target={{ familyId, imageId: img.id, source: "study" }}
            subject={`this ${ANGLE_LABEL[img.angle].toLowerCase()} photo of the ${name}`}
            trigger={
              <Button size="sm" variant="ghost" className="h-7 bg-[#08101a]/70 px-2 text-xs text-[#e6ecf1] hover:bg-[#08101a]/90 hover:text-white" aria-label="Report this photo">
                <Flag className="size-3.5" /> Report
              </Button>
            }
          />
        </div>
        <a
          href={img.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 z-10 max-w-[70%] truncate rounded bg-[#08101a]/70 px-1.5 py-0.5 text-[0.7rem] text-[#e6ecf1]/80 hover:text-white"
        >
          {img.author} · {img.license}
        </a>
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
          {images.map((im, idx) => (
            <button
              key={im.id}
              role="tab"
              aria-selected={idx === i}
              aria-label={`${ANGLE_LABEL[im.angle]} photo`}
              onClick={() => setI(idx)}
              className={cn(
                "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-all sm:h-16 sm:w-24",
                idx === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.srcSmall} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
