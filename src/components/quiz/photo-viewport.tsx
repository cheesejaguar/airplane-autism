"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Conditions } from "@/lib/deck/config";
import { cn } from "@/lib/utils";

export type ViewportState = "live" | "locked" | "missed";

type Props = {
  src: string;
  srcSmall: string;
  width: number;
  height: number;
  conditions: Conditions;
  exposureMs: number | null;
  state: ViewportState;
  /** Called once the photo is decoded and on screen (start the response timer here). */
  onShown?: () => void;
  /** Reveal the full photo regardless of exposure (after answering) */
  revealed?: boolean;
  readouts?: { left?: React.ReactNode; right?: React.ReactNode };
  footer?: React.ReactNode;
  shakeKey?: number;
  className?: string;
  alt?: string;
  /** Keep the photo hidden and the clock stopped until released (e.g. a "flash it" button) */
  hold?: boolean;
  overlay?: React.ReactNode;
};

const BRACKET_COLOR: Record<ViewportState, string> = {
  live: "var(--foreground)",
  locked: "var(--go)",
  missed: "var(--caution)",
};

function Bracket({ corner, state }: { corner: "tl" | "tr" | "bl" | "br"; state: ViewportState }) {
  const rot = { tl: 0, tr: 90, br: 180, bl: 270 }[corner];
  const pos = {
    tl: "left-3 top-3",
    tr: "right-3 top-3",
    bl: "bottom-3 left-3",
    br: "bottom-3 right-3",
  }[corner];
  const inset = state === "live" ? 0 : 14;
  const dx = corner.endsWith("l") ? inset : -inset;
  const dy = corner.startsWith("t") ? inset : -inset;
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("pointer-events-none absolute size-7 sm:size-9", pos)}
      animate={{ x: dx, y: dy, opacity: state === "live" ? 0.75 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      style={{ rotate: rot }}
    >
      <path d="M2 14V2h12" fill="none" stroke={BRACKET_COLOR[state]} strokeWidth="2.5" strokeLinecap="square" />
    </motion.svg>
  );
}

/** Edge tick ruler like a binocular reticle scale. */
function TickRuler({ side }: { side: "top" | "left" }) {
  const horizontal = side === "top";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute opacity-40",
        horizontal ? "inset-x-14 top-0 h-2.5" : "inset-y-14 left-0 w-2.5",
      )}
      style={{
        backgroundImage: horizontal
          ? "repeating-linear-gradient(90deg, var(--foreground) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, var(--foreground) 0 1px, transparent 1px 60px)"
          : "repeating-linear-gradient(180deg, var(--foreground) 0 1px, transparent 1px 12px), repeating-linear-gradient(180deg, var(--foreground) 0 1px, transparent 1px 60px)",
        backgroundSize: horizontal ? "100% 50%, 100% 100%" : "50% 100%, 100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

const CONDITION_FILTER: Record<Conditions, string> = {
  clear: "none",
  haze: "contrast(0.5) brightness(1.18) saturate(0.35) blur(0.8px)",
  distant: "contrast(0.9) saturate(0.8)",
};

export function PhotoViewport({
  src,
  srcSmall,
  width,
  height,
  conditions,
  exposureMs,
  state,
  onShown,
  revealed = false,
  readouts,
  footer,
  shakeKey = 0,
  className,
  alt = "Aircraft to identify",
  hold = false,
  overlay,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [progress, setProgress] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const shownRef = useRef(false);

  // Reset per photo
  useEffect(() => {
    setLoaded(false);
    setExpired(false);
    setProgress(1);
    shownRef.current = false;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  useEffect(() => {
    if (!loaded || hold || shownRef.current) return;
    shownRef.current = true;
    onShown?.();
    if (!exposureMs) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = 1 - (performance.now() - start) / exposureMs;
      setProgress(Math.max(0, p));
      if (p <= 0) setExpired(true);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, hold, exposureMs, onShown]);

  const hidden = (expired || hold) && !revealed;
  const distant = conditions === "distant" && !revealed;

  return (
    <motion.div
      key={shakeKey}
      animate={shakeKey ? { x: [0, -10, 9, -6, 4, 0] } : undefined}
      transition={{ duration: 0.42 }}
      className={cn(
        "chart-grid relative isolate overflow-hidden rounded-xl border border-border bg-[#08101a] text-[#e6ecf1]",
        className,
      )}
      style={{ aspectRatio: "16 / 10" }}
    >
      {/* Photo */}
      <motion.div
        className="absolute inset-0 grid place-items-center"
        animate={{ scale: distant ? 0.34 : 1, opacity: hidden ? 0 : 1 }}
        transition={{ duration: hidden ? 0.12 : 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized Blob renditions; no optimizer needed */}
        <img
          ref={imgRef}
          key={src}
          src={src}
          srcSet={`${srcSmall} 800w, ${src} 1600w`}
          sizes="(max-width: 768px) 100vw, 900px"
          width={width}
          height={height}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn(
            "size-full select-none object-cover transition-[filter,opacity] duration-500",
            loaded ? "opacity-100" : "opacity-0",
            distant && "rounded-md object-contain",
          )}
          style={{ filter: revealed ? "none" : CONDITION_FILTER[conditions] }}
        />
      </motion.div>

      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgb(8 16 26 / 0.55) 100%)" }}
      />

      {/* Acquisition sweep on each new photo */}
      <AnimatePresence>
        {loaded && (
          <motion.div
            key={`scan-${src}`}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "100%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgb(79 176 214 / 0.0) 70%, rgb(79 176 214 / 0.35) 98%, rgb(79 176 214 / 0.9) 100%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Exposure ended */}
      <AnimatePresence>
        {hidden && !hold && (
          <motion.div
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <p className="type-readout text-[#8ea3b6]">Contact lost</p>
              <p className="mt-1 text-sm text-[#e6ecf1]/80">Exposure ended — call it from memory.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loaded && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="type-readout animate-pulse text-[#8ea3b6]">Acquiring…</p>
        </div>
      )}

      <TickRuler side="top" />
      <TickRuler side="left" />
      <Bracket corner="tl" state={state} />
      <Bracket corner="tr" state={state} />
      <Bracket corner="bl" state={state} />
      <Bracket corner="br" state={state} />

      {/* Centre pip */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ opacity: state === "live" && !hidden ? 0.5 : 0, scale: state === "live" ? 1 : 2.4 }}
      >
        <svg viewBox="0 0 40 40" className="size-8">
          <path d="M20 4v10M20 26v10M4 20h10M26 20h10" stroke="#e6ecf1" strokeWidth="1.5" />
        </svg>
      </motion.div>

      {/* Readouts */}
      {(readouts?.left || readouts?.right) && (
        <div className="type-readout pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-3 px-12 pt-4 text-[#e6ecf1]/85 sm:px-14">
          <span className="rounded bg-[#08101a]/60 px-1.5 py-0.5 backdrop-blur-sm">{readouts.left}</span>
          <span className="rounded bg-[#08101a]/60 px-1.5 py-0.5 backdrop-blur-sm">{readouts.right}</span>
        </div>
      )}

      {/* Exposure meter */}
      {exposureMs && !revealed && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div className="h-full bg-[var(--info)] transition-none" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {footer && <div className="absolute inset-x-0 bottom-0">{footer}</div>}
      {overlay && <div className="absolute inset-0 grid place-items-center">{overlay}</div>}
    </motion.div>
  );
}
