import type { Metadata } from "next";
import { DeckBuilder } from "@/components/train/deck-builder";
import { familiesLite, manufacturers } from "@/lib/catalog";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Deck setup</p>
      <h1 className="type-display mt-2 text-4xl sm:text-5xl">Build your drill</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Pick what you want to recognise and how hard the conditions should be. Tally schedules each aircraft with spaced
        repetition, so the types you miss come back sooner.
      </p>
      <div className="mt-8">
        <DeckBuilder families={[...familiesLite]} manufacturers={[...manufacturers]} />
      </div>
    </div>
  );
}
