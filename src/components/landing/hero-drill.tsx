"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { PhotoViewport } from "@/components/quiz/photo-viewport";
import { cn } from "@/lib/utils";

export type DemoCard = {
  answerId: string;
  answer: string;
  cue: string;
  image: { src: string; srcSmall: string; width: number; height: number };
  options: { id: string; label: string }[];
};

/** A self-contained one-second glance drill for the landing page. */
export function HeroDrill({ cards }: { cards: DemoCard[] }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, seen: 0 });
  const [armed, setArmed] = useState(false);
  const card = cards[i % cards.length];
  const correct = picked === card?.answerId;

  const choose = useCallback(
    (id: string) => {
      if (picked) return;
      setPicked(id);
      setScore((s) => ({ right: s.right + (id === card.answerId ? 1 : 0), seen: s.seen + 1 }));
    },
    [card, picked],
  );

  useEffect(() => {
    if (!picked) return;
    const t = setTimeout(() => {
      setPicked(null);
      setI((x) => x + 1);
    }, 2600);
    return () => clearTimeout(t);
  }, [picked]);

  if (!card) return null;
  return (
    <div className="relative">
      <PhotoViewport
        key={i}
        src={card.image.src}
        srcSmall={card.image.srcSmall}
        width={card.image.width}
        height={card.image.height}
        conditions="clear"
        exposureMs={1000}
        revealed={!!picked}
        state={picked ? (correct ? "locked" : "missed") : "live"}
        readouts={{ left: `Contact ${String((i % cards.length) + 1).padStart(2, "0")}`, right: "Exposure 1.0 s" }}
        className="shadow-2xl shadow-black/30"
        hold={!armed}
        overlay={
          !armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="group flex flex-col items-center gap-2 rounded-xl px-6 py-4 text-[#e6ecf1] focus-visible:outline-2"
            >
              <span className="type-display text-2xl tracking-wide transition-transform group-hover:scale-105">Flash contact</span>
              <span className="type-readout text-[#8ea3b6]">The photo shows for one second</span>
            </button>
          ) : undefined
        }
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {card.options.map((o, idx) => {
          const isAnswer = picked && o.id === card.answerId;
          const isWrong = picked === o.id && !correct;
          return (
            <motion.button
              key={`${i}-${o.id}`}
              type="button"
              onClick={() => choose(o.id)}
              disabled={!!picked || !armed}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              className={cn(
                "type-condensed rounded-lg border bg-card/90 px-3 py-2.5 text-left text-base backdrop-blur transition-colors",
                !picked && "hover:border-[var(--info)]",
                isAnswer && "border-[var(--go)] text-[var(--go)]",
                isWrong && "border-[var(--caution)] text-muted-foreground line-through",
              )}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex min-h-10 items-start justify-between gap-3 text-sm">
        <AnimatePresence mode="wait">
          {picked ? (
            <motion.p key="cue" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-muted-foreground">
              <span className={cn("font-semibold", correct ? "text-[var(--go)]" : "text-[var(--caution)]")}>{correct ? "Tally. " : `It's the ${card.answer}. `}</span>
              {card.cue}
            </motion.p>
          ) : (
            <motion.p key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground">
              One second on screen. Name it.
            </motion.p>
          )}
        </AnimatePresence>
        <span className="type-readout shrink-0 pt-1 text-muted-foreground">
          {score.right}/{score.seen}
          {score.seen > 0 && (
            <button type="button" aria-label="Reset demo score" className="ml-2 align-[-2px] hover:text-foreground" onClick={() => setScore({ right: 0, seen: 0 })}>
              <RotateCcw className="inline size-3" />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
