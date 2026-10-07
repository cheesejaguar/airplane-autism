import type { Metadata } from "next";
import { Suspense } from "react";
import { DrillSessionRoute } from "@/components/quiz/drill-session";

export const metadata: Metadata = { title: "Drill" };

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="grid flex-1 place-items-center">
          <p className="type-readout animate-pulse text-muted-foreground">Preparing your deck…</p>
        </div>
      }
    >
      <DrillSessionRoute />
    </Suspense>
  );
}
