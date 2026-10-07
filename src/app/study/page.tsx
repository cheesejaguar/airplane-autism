import type { Metadata } from "next";
import { Suspense } from "react";
import { StudyGrid } from "@/components/study/study-grid";
import { familiesLite } from "@/lib/catalog";
import { masteryMap } from "@/lib/progress/queries";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Study" };

async function GridWithMastery() {
  const viewer = await getViewer();
  const mastery = viewer ? await masteryMap(viewer.id) : {};
  return <StudyGrid families={[...familiesLite]} mastery={mastery} />;
}

export default function StudyPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Recognition library</p>
      <h1 className="type-display mt-2 text-4xl sm:text-5xl">Study the fleet</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every card lists the aircraft&apos;s WEFT features, its fastest cues, and the types it&apos;s most often mistaken
        for.
      </p>
      <div className="mt-8">
        <Suspense fallback={<StudyGrid families={[...familiesLite]} mastery={{}} />}>
          <GridWithMastery />
        </Suspense>
      </div>
    </div>
  );
}
