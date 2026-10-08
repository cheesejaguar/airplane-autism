import { cn } from "@/lib/utils";

/** Reticle mark: a spotter's scope ring with range ticks and a centred pip. */
export function ReticleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-6", className)} fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
      <path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <circle cx="16" cy="16" r="2.25" fill="var(--primary)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ReticleMark className="text-foreground" />
      <span className="type-display text-[1.35rem] tracking-[0.04em]">Tally</span>
    </span>
  );
}
