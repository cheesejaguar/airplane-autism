import Link from "next/link";
import { ArrowRight, Crosshair } from "lucide-react";
import { FleetMarquee } from "@/components/landing/fleet-marquee";
import { HeroDrill, type DemoCard } from "@/components/landing/hero-drill";
import { WeftStrip } from "@/components/quiz/weft-strip";
import { Button } from "@/components/ui/button";
import { families, familyImages, getFamily, heroImage, images, label } from "@/lib/catalog";
import { createRng, shuffle } from "@/lib/random";
import { pickDistractors } from "@/lib/quiz/distractors";

const DEMO_PREFERENCE = ["f-16", "b-52", "uh-60", "b737max", "c172", "p-51", "a-10", "v-22", "b787", "ah-64", "kc-135", "r44"];

function demoCards(): DemoCard[] {
  const rng = createRng(20261006);
  const withImages = families.filter((f) => familyImages(f.id).length);
  const preferred = DEMO_PREFERENCE.map(getFamily).filter((f) => f && familyImages(f.id).length) as typeof withImages;
  const pool = [...preferred, ...withImages.filter((f) => !preferred.includes(f))].slice(0, 8);
  return pool.map((f) => {
    const img = familyImages(f.id).find((i) => i.angle === "side" || i.angle === "front-quarter") ?? familyImages(f.id)[0];
    const options = shuffle([f, ...pickDistractors({ target: f, pool: withImages, all: families, count: 3, rng })], rng);
    return {
      answerId: f.id,
      answer: label(f),
      cue: f.tellTales[0],
      image: { src: img.src, srcSmall: img.srcSmall, width: img.width, height: img.height },
      options: options.map((o) => ({ id: o.id, label: label(o) })),
    };
  });
}

const PRINCIPLES = [
  {
    title: "Every angle, not just the poster shot",
    body: "Photos are tagged head-on, profile, belly, top and rear. Tally shows you the views you get wrong most.",
  },
  {
    title: "Glance conditions",
    body: "Limit exposure to half a second, add haze, or shrink the aircraft to a speck — the way it looks in the real sky.",
  },
  {
    title: "Wrong answers that teach",
    body: "Choices come from each type's real look-alikes and from your own past mix-ups. Miss one and you get the cue that separates them.",
  },
  {
    title: "Spaced repetition",
    body: "An FSRS scheduler brings each aircraft back right before you'd forget it. Types you miss return in the same session.",
  },
];

export default function HomePage() {
  const cards = demoCards();
  const example = getFamily("f-16") ?? families[0];
  const pairs = families.reduce((n, f) => n + f.confusedWith.length, 0);
  const marquee = families
    .map((f) => ({ id: f.id, label: label(f), thumb: heroImage(f.id)?.srcSmall ?? "" }))
    .filter((x) => x.thumb)
    .slice(0, 40);

  return (
    <div>
      {/* Hero */}
      <section className="chart-grid border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:py-20">
          <div>
            <p className="type-readout text-primary">Aircraft recognition trainer</p>
            <h1 className="type-display mt-4 text-[clamp(2.8rem,8vw,5.6rem)]">
              Name it
              <br />
              at a glance.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Tally drills you on the {families.length} military and civil aircraft types flying in the US, using real
              photos from every angle and the WEFT method recognition instructors teach.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/train">
                  <Crosshair /> Start training
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link href="/study">
                  Browse the fleet <ArrowRight />
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">No account needed to start. Sign up later to keep your progress.</p>
          </div>
          {cards.length > 0 && <HeroDrill cards={cards} />}
        </div>
      </section>

      {/* Instrument readout */}
      <section className="border-b">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          {[
            [families.length, "aircraft types"],
            [images.length, "curated photos"],
            [pairs, "look-alike pairs"],
            [7, "viewing angles"],
          ].map(([v, k]) => (
            <div key={k} className="px-4 py-6 text-center">
              <dd className="type-display text-3xl sm:text-4xl">{v}</dd>
              <dt className="type-readout mt-1 text-muted-foreground">{k}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* WEFT */}
      {example && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="type-readout text-muted-foreground">The method</p>
              <h2 className="type-display mt-3 text-4xl sm:text-5xl">Wings. Engines. Fuselage. Tail.</h2>
              <p className="mt-5 text-muted-foreground">
                Spotters don&apos;t memorise pictures. They scan an airframe in a fixed order and look for the few
                features that rule types in or out. Every Tally card is written that way, and the hints you get after a
                miss come straight from it.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Example:{" "}
                <Link href={`/study/${example.id}`} className="text-foreground underline underline-offset-4">
                  {example.name}
                </Link>
              </p>
            </div>
            <WeftStrip weft={example.weft} className="lg:grid-cols-2" />
          </div>
        </section>
      )}

      {/* Principles */}
      <section className="border-y bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-px px-4 py-16 sm:grid-cols-2 sm:py-20">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="py-5 pr-8">
              <h3 className="type-condensed text-xl">{p.title}</h3>
              <p className="mt-2 max-w-md text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fleet */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto mb-8 flex max-w-6xl items-end justify-between gap-4 px-4">
          <div>
            <p className="type-readout text-muted-foreground">The fleet</p>
            <h2 className="type-display mt-3 text-4xl">Fighters to floatplanes</h2>
          </div>
          <Link href="/study" className="hidden text-sm text-[var(--info)] hover:underline sm:inline">
            See all {families.length} →
          </Link>
        </div>
        <FleetMarquee items={marquee} />
      </section>

      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="type-display text-3xl sm:text-4xl">Your first drill takes five minutes.</h2>
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/train">
              <Crosshair /> Start training
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
