import type { Metadata } from "next";
import Link from "next/link";
import { families, familyImages, label } from "@/lib/catalog";

export const metadata: Metadata = { title: "Photo credits" };

export default function CreditsPage() {
  const withImages = families.filter((f) => familyImages(f.id).length);
  const total = withImages.reduce((n, f) => n + familyImages(f.id).length, 0);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Attribution</p>
      <h1 className="type-display mt-2 text-4xl sm:text-5xl">Photo credits</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        All {total} training photos come from Wikimedia Commons and are used under the license shown with each one —
        public domain (mostly US government work), CC0, CC BY or CC BY-SA. Photos are resized for the web; no other
        changes are made. Follow a link to see the original file and its full license terms.
      </p>
      <div className="mt-10 space-y-8">
        {withImages.map((f) => (
          <section key={f.id}>
            <h2 className="type-condensed text-lg">
              <Link href={`/study/${f.id}`} className="hover:text-primary">
                {label(f)}
              </Link>
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {familyImages(f.id).map((img) => (
                <li key={img.id} className="text-muted-foreground">
                  <a href={img.sourceUrl} target="_blank" rel="noreferrer" className="text-foreground underline-offset-2 hover:underline">
                    {img.title}
                  </a>{" "}
                  — {img.author} ·{" "}
                  {img.licenseUrl ? (
                    <a href={img.licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                      {img.license}
                    </a>
                  ) : (
                    img.license
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
