"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AircraftImage, Family } from "@/lib/catalog/schema";
import { cn } from "@/lib/utils";
import { ANGLE_LABEL } from "./gallery";

const VIEW_GROUPS: { key: string; label: string; angles: string[] }[] = [
  { key: "side", label: "Profile", angles: ["side"] },
  { key: "front", label: "Head-on", angles: ["front", "front-quarter"] },
  { key: "plan", label: "Top / belly", angles: ["top", "belly"] },
  { key: "rear", label: "Rear", angles: ["rear", "rear-quarter"] },
];

function pickFor(images: AircraftImage[], angles: string[]) {
  return images.filter((i) => angles.includes(i.angle)).sort((a, b) => b.quality - a.quality)[0] ?? images[0];
}

function Pane({ family, img }: { family: Family; img?: AircraftImage }) {
  return (
    <div className="min-w-0">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-[#08101a]">
        <AnimatePresence mode="popLayout" initial={false}>
          {img && (
            <motion.img
              key={img.id}
              src={img.src}
              srcSet={`${img.srcSmall} 800w, ${img.src} 1600w`}
              sizes="(max-width: 768px) 100vw, 560px"
              alt={`${family.name}, ${ANGLE_LABEL[img.angle]} view`}
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        {img && <span className="type-readout absolute left-3 top-3 rounded bg-[#08101a]/70 px-1.5 py-0.5 text-[#e6ecf1]">{ANGLE_LABEL[img.angle]}</span>}
      </div>
    </div>
  );
}

export function CompareView({ a, b, imagesA, imagesB }: { a: Family; b: Family; imagesA: AircraftImage[]; imagesB: AircraftImage[] }) {
  const available = VIEW_GROUPS.filter((g) => imagesA.some((i) => g.angles.includes(i.angle)) || imagesB.some((i) => g.angles.includes(i.angle)));
  const [view, setView] = useState(available[0]?.key ?? "side");
  const angles = VIEW_GROUPS.find((g) => g.key === view)?.angles ?? ["side"];
  return (
    <div>
      <div role="tablist" aria-label="Viewing angle" className="mb-4 inline-flex rounded-lg border bg-muted/40 p-0.5">
        {available.map((g) => (
          <button
            key={g.key}
            role="tab"
            aria-selected={view === g.key}
            onClick={() => setView(g.key)}
            className={cn("relative rounded-md px-3 py-1.5 text-sm", view === g.key ? "text-foreground" : "text-muted-foreground")}
          >
            {view === g.key && <motion.span layoutId="cmp-tab" className="absolute inset-0 rounded-md border bg-card" />}
            <span className="relative">{g.label}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Pane family={a} img={pickFor(imagesA, angles)} />
        <Pane family={b} img={pickFor(imagesB, angles)} />
      </div>
    </div>
  );
}
