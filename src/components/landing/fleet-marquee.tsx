"use client";

import Link from "next/link";

export function FleetMarquee({ items }: { items: { id: string; label: string; thumb: string }[] }) {
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="flex w-max gap-3 [animation:marquee_80s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:[animation:none]">
        {row.map((it, idx) => (
          <Link key={`${it.id}-${idx}`} href={`/study/${it.id}`} className="w-48 shrink-0 overflow-hidden rounded-lg border bg-card" tabIndex={idx >= items.length ? -1 : 0} aria-hidden={idx >= items.length}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.thumb} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
            <p className="type-condensed truncate px-2.5 py-1.5 text-sm">{it.label}</p>
          </Link>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
