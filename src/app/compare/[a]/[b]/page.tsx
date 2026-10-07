import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crosshair } from "lucide-react";
import { CompareView } from "@/components/study/compare-view";
import { Button } from "@/components/ui/button";
import { families, familyImages, getFamily, label } from "@/lib/catalog";
import { WEFT_KEYS } from "@/lib/catalog/schema";
import { trainHref } from "@/lib/deck/url";

type Params = { a: string; b: string };

export function generateStaticParams(): Params[] {
  const seen = new Set<string>();
  const out: Params[] = [];
  for (const f of families)
    for (const c of f.confusedWith) {
      const key = `${f.id}|${c.id}`;
      if (!seen.has(key) && getFamily(c.id)) {
        seen.add(key);
        out.push({ a: f.id, b: c.id });
      }
    }
  return out.length ? out : [{ a: families[0]?.id ?? "x", b: families[0]?.id ?? "x" }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { a, b } = await params;
  const fa = getFamily(a);
  const fb = getFamily(b);
  return fa && fb ? { title: `${label(fa)} vs ${label(fb)}` } : {};
}

const WEFT_LABEL = { wings: "Wings", engines: "Engines", fuselage: "Fuselage", tail: "Tail" } as const;

export default async function ComparePage({ params }: { params: Promise<Params> }) {
  const { a, b } = await params;
  const fa = getFamily(a);
  const fb = getFamily(b);
  if (!fa || !fb || fa.id === fb.id) notFound();
  const aTell = fa.confusedWith.find((c) => c.id === fb.id)?.howToTell;
  const bTell = fb.confusedWith.find((c) => c.id === fa.id)?.howToTell;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Head to head</p>
      <h1 className="type-display mt-2 flex flex-wrap items-baseline gap-x-4 text-[clamp(1.8rem,5vw,3.2rem)]">
        <Link href={`/study/${fa.id}`} className="hover:text-primary">
          {label(fa)}
        </Link>
        <span className="type-readout text-base text-muted-foreground">vs</span>
        <Link href={`/study/${fb.id}`} className="hover:text-primary">
          {label(fb)}
        </Link>
      </h1>

      {(aTell || bTell) && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {[aTell, bTell].filter(Boolean).map((t) => (
            <p key={t} className="rounded-lg border-l-2 border-primary bg-card p-4 text-[0.95rem]">
              {t}
            </p>
          ))}
        </div>
      )}

      <div className="mt-8">
        <CompareView a={fa} b={fb} imagesA={familyImages(fa.id)} imagesB={familyImages(fb.id)} />
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">WEFT comparison</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="type-readout w-24 p-3 text-muted-foreground">
                WEFT
              </th>
              <th scope="col" className="type-condensed p-3 text-base">
                {label(fa)}
              </th>
              <th scope="col" className="type-condensed p-3 text-base">
                {label(fb)}
              </th>
            </tr>
          </thead>
          <tbody>
            {WEFT_KEYS.map((k) => (
              <tr key={k} className="border-t align-top">
                <th scope="row" className="p-3">
                  <span className="type-display text-xl text-primary">{k[0].toUpperCase()}</span>
                  <span className="type-readout ml-2 text-muted-foreground">{WEFT_LABEL[k]}</span>
                </th>
                {[fa, fb].map((f) => (
                  <td key={f.id} className="p-3">
                    <ul className="space-y-1">
                      {f.weft[k].map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t align-top">
              <th scope="row" className="type-readout p-3 text-muted-foreground">
                Cues
              </th>
              {[fa, fb].map((f) => (
                <td key={f.id} className="p-3">
                  <ul className="space-y-1">
                    {f.tellTales.map((x) => (
                      <li key={x} className="font-medium">
                        {x}
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <Button asChild size="lg" className="mt-8">
        <Link href={trainHref({ familyIds: [fa.id, fb.id], sessionLength: 10, newPerSession: 10, choices: 4 })}>
          <Crosshair /> Drill this pair
        </Link>
      </Button>
    </div>
  );
}
