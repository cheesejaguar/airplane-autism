import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Crosshair, Scale } from "lucide-react";
import { Suspense } from "react";
import { Gallery } from "@/components/study/gallery";
import { FamilyRecordPanel } from "@/components/study/family-record";
import { WeftStrip } from "@/components/quiz/weft-strip";
import { Button } from "@/components/ui/button";
import {
  BRANCH_LABELS,
  CATEGORY_LABELS,
  ROLE_LABELS,
  SECTOR_LABELS,
  families,
  familyImages,
  getFamily,
  heroImage,
  label,
} from "@/lib/catalog";
import { trainHref } from "@/lib/deck/url";

type Params = { familyId: string };

export function generateStaticParams(): Params[] {
  return families.map((f) => ({ familyId: f.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const f = getFamily((await params).familyId);
  if (!f) return {};
  const hero = heroImage(f.id);
  return { title: f.name, description: f.summary, openGraph: hero ? { images: [hero.src] } : undefined };
}

const ANGLE_ORDER = ["side", "front-quarter", "front", "belly", "top", "rear-quarter", "rear"];

export default function FamilyPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-12"><div className="aspect-[16/10] w-full max-w-3xl animate-pulse rounded-xl bg-muted" /></div>}>
      <FamilyContent params={params} />
    </Suspense>
  );
}

async function FamilyContent({ params }: { params: Promise<Params> }) {
  const f = getFamily((await params).familyId);
  if (!f) notFound();
  const imgs = [...familyImages(f.id)].sort((a, b) => ANGLE_ORDER.indexOf(a.angle) - ANGLE_ORDER.indexOf(b.angle) || b.quality - a.quality);
  const lookalikes = f.confusedWith.map((c) => ({ ...c, family: getFamily(c.id) })).filter((c) => c.family);
  const facts: [string, string][] = [
    ["Type", CATEGORY_LABELS[f.category]],
    ["Operators", f.branches.length ? f.branches.map((b) => BRANCH_LABELS[b]).join(", ") : SECTOR_LABELS[f.sector]],
    ["Builder", f.manufacturer],
    ["First flight", String(f.firstFlight)],
    ["Engines", `${f.engines.count} × ${f.engines.type}`],
    ["In US service", `≈ ${f.usCount.value.toLocaleString()}`],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <nav className="type-readout text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/study" className="hover:text-foreground">
          Study
        </Link>{" "}
        / {label(f)}
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Gallery images={imgs} name={f.name} priority />

        <div>
          <div className="flex flex-wrap gap-1.5">
            {f.roles.map((r) => (
              <span key={r} className="type-readout rounded border px-1.5 py-0.5 text-muted-foreground">
                {ROLE_LABELS[r]}
              </span>
            ))}
          </div>
          <h1 className="type-display mt-3 text-[clamp(2rem,5vw,3.4rem)]">{label(f)}</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {f.name}
            {f.aka.length > 0 && <> · “{f.aka.join("”, “")}”</>}
          </p>
          <p className="mt-4 leading-relaxed">{f.summary}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="type-readout text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 capitalize-first">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}>
              <FamilyRecordPanel familyId={f.id} />
            </Suspense>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href={trainHref({ familyIds: [f.id, ...lookalikes.map((l) => l.id)], sessionLength: 10, newPerSession: 20 })}>
                <Crosshair /> Drill this & look-alikes
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="type-condensed text-2xl">Fastest cues</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {f.tellTales.map((t, i) => (
            <li key={t} className="rounded-lg border bg-card p-4">
              <span className="type-readout text-primary">Cue {i + 1}</span>
              <p className="mt-1.5">{t}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="type-condensed text-2xl">WEFT breakdown</h2>
        <p className="mt-1 text-sm text-muted-foreground">Wings, engines, fuselage, tail — the order recognition instructors scan an airframe.</p>
        <WeftStrip weft={f.weft} className="mt-4" />
      </section>

      {lookalikes.length > 0 && (
        <section className="mt-12">
          <h2 className="type-condensed text-2xl">Don&apos;t confuse it with</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {lookalikes.map(({ id, howToTell, family }) => {
              const thumb = heroImage(id);
              return (
                <li key={id} className="flex gap-4 rounded-lg border bg-card p-3">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.srcSmall} alt="" loading="lazy" className="h-20 w-28 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="chart-grid h-20 w-28 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0">
                    <Link href={`/study/${id}`} className="type-condensed text-lg hover:text-primary">
                      {label(family!)}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">{howToTell}</p>
                    <Link href={`/compare/${f.id}/${id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--info)] hover:underline">
                      <Scale className="size-3.5" /> Compare <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {f.variants.length > 0 && (
        <section className="mt-12">
          <h2 className="type-condensed text-2xl">Variants covered</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {f.variants.map((v) => (
              <li key={v} className="rounded-md border px-2.5 py-1 text-sm text-muted-foreground">
                {v}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 text-xs text-muted-foreground">
        US count: {f.usCount.source} ({f.usCount.asOf}). Photos via Wikimedia Commons —{" "}
        <Link href="/credits" className="underline underline-offset-2">
          full credits
        </Link>
        .
      </p>
    </div>
  );
}
