import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono, Public_Sans } from "next/font/google";
import { Providers } from "@/components/shell/providers";
import { SiteHeader } from "@/components/shell/site-header";
import { SiteFooter } from "@/components/shell/site-footer";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"] });
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Tally — aircraft recognition trainer", template: "%s · Tally" },
  description:
    "Learn to identify military and civil aircraft at a glance. Photo flashcards, WEFT recognition cues, spaced repetition and detailed progress tracking.",
  applicationName: "Tally",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1420" },
    { media: "(prefers-color-scheme: light)", color: "#f3f6f8" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${publicSans.variable} ${martian.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
