"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/train/session")) return null;
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Photos from Wikimedia Commons contributors, used under their licenses.{" "}
          <Link href="/credits" className="underline underline-offset-4 hover:text-foreground">
            Photo credits
          </Link>
        </p>
        <p className="type-readout">Tally · aircraft recognition trainer</p>
      </div>
    </footer>
  );
}
