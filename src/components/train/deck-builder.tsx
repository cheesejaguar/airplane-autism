"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Check, ChevronsUpDown, Crosshair, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePreset, getDefaultDeck, listPresets, savePreset, saveDefaultDeck, type PresetDTO } from "@/app/train/deck-actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ensureSession } from "@/lib/auth-client";
import { CATEGORY_LABELS_CLIENT, roleLabel } from "@/lib/catalog/labels";
import { matchesDeck, type FamilyLite } from "@/lib/catalog/lite";
import type { Branch, Category, Role } from "@/lib/catalog/schema";
import { CONDITIONS, DEFAULT_DECK, EXPOSURES, VIEWS, type DeckConfig } from "@/lib/deck/config";
import { trainHref } from "@/lib/deck/url";
import { cn } from "@/lib/utils";

const QUICK_DECKS: { name: string; blurb: string; config: Partial<DeckConfig> }[] = [
  { name: "Full catalog", blurb: "Everything flying in the US", config: {} },
  { name: "US military", blurb: "All services, all types", config: { sectors: ["military"] } },
  { name: "Fighters & attack", blurb: "Fast jets and strike aircraft", config: { sectors: ["military"], roles: ["fighter", "attack"] } },
  { name: "Heavies & support", blurb: "Bombers, tankers, airlift, ISR", config: { sectors: ["military"], roles: ["bomber", "tanker", "transport", "aew", "isr", "maritime-patrol", "electronic-warfare"] } },
  { name: "Rotorcraft", blurb: "Helicopters and tiltrotors", config: { categories: ["rotorcraft", "tiltrotor"] } },
  { name: "Airliners", blurb: "Narrowbody, widebody, regional", config: { roles: ["narrowbody", "widebody", "regional"] } },
  { name: "Business aviation", blurb: "Bizjets and turboprops", config: { roles: ["business-jet", "turboprop"] } },
  { name: "General aviation", blurb: "Piston singles and twins", config: { roles: ["piston-single", "piston-twin"] } },
  { name: "Warbirds", blurb: "Vintage military in private hands", config: { roles: ["warbird"] } },
];

const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: "Combat", roles: ["fighter", "attack", "bomber", "electronic-warfare"] },
  { label: "Support", roles: ["tanker", "transport", "heavy-lift", "aew", "isr", "maritime-patrol", "special-ops", "search-rescue", "trainer"] },
  { label: "Commercial", roles: ["narrowbody", "widebody", "regional", "cargo"] },
  { label: "Business & GA", roles: ["business-jet", "turboprop", "piston-single", "piston-twin", "utility", "light", "ems", "vip"] },
  { label: "Specialty", roles: ["agricultural", "aerobatic", "seaplane", "warbird"] },
];

const BRANCH_SHORT: Record<Branch, string> = { usaf: "USAF", usn: "Navy", usmc: "USMC", army: "Army", uscg: "Coast Guard" };

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary/12 text-foreground" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {active && <Check className="size-3.5 text-primary" />}
      {children}
      {count !== undefined && <span className="type-readout text-[0.625rem] opacity-60">{count}</span>}
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("relative rounded-md px-3 py-1.5 text-sm", value === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {value === o.value && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-md border bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="type-condensed text-base">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function DeckBuilder({ families, manufacturers }: { families: FamilyLite[]; manufacturers: string[] }) {
  const router = useRouter();
  const [deck, setDeck] = useState<DeckConfig>(DEFAULT_DECK);
  const [presets, setPresets] = useState<PresetDTO[]>([]);
  const [presetName, setPresetName] = useState("");
  const [starting, startTransition] = useTransition();

  useEffect(() => {
    getDefaultDeck().then((d) => d && setDeck({ ...d, familyIds: [] })).catch(() => {});
    listPresets().then(setPresets).catch(() => {});
  }, []);

  const set = <K extends keyof DeckConfig>(k: K, v: DeckConfig[K]) => setDeck((d) => ({ ...d, [k]: v, familyIds: [] }));

  const matching = useMemo(() => families.filter((f) => matchesDeck(f, deck)), [families, deck]);
  const viewAngles = VIEWS[deck.view].angles as readonly string[];
  const playable = matching.filter((f) => f.angles.some((a) => viewAngles.includes(a)));
  const countFor = (patch: Partial<DeckConfig>) => families.filter((f) => matchesDeck(f, { ...DEFAULT_DECK, ...patch })).length;

  const start = () =>
    startTransition(async () => {
      await ensureSession();
      saveDefaultDeck(deck).catch(() => {});
      router.push(trainHref(deck));
    });

  const isQuick = (c: Partial<DeckConfig>) =>
    (["categories", "sectors", "roles", "branches", "manufacturers"] as const).every(
      (k) => JSON.stringify([...(c[k] ?? [])].sort()) === JSON.stringify([...deck[k]].sort()),
    );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Quick decks */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_DECKS.map((q) => {
            const active = isQuick(q.config);
            return (
              <button
                key={q.name}
                type="button"
                onClick={() => setDeck((d) => ({ ...d, categories: [], sectors: [], roles: [], branches: [], manufacturers: [], familyIds: [], ...q.config }))}
                className={cn(
                  "group rounded-lg border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--info)]",
                  active && "border-primary ring-1 ring-primary",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="type-condensed text-[0.95rem] leading-tight">{q.name}</span>
                  <span className="type-readout text-muted-foreground">{countFor(q.config)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{q.blurb}</p>
              </button>
            );
          })}
        </div>

        {presets.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((p) => (
              <span key={p.id} className="inline-flex items-center rounded-md border bg-card">
                <button type="button" className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm" onClick={() => setDeck(p.config)}>
                  <Bookmark className="size-3.5 text-primary" /> {p.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete preset ${p.name}`}
                  className="border-l px-2 py-1.5 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await deletePreset(p.id);
                    setPresets((ps) => ps.filter((x) => x.id !== p.id));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-xl border bg-card/60 p-4 sm:p-6">
          <Section title="Aircraft type">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_LABELS_CLIENT) as Category[]).map((c) => (
                <Chip key={c} active={deck.categories.includes(c)} onClick={() => set("categories", toggle(deck.categories, c))} count={countFor({ categories: [c] })}>
                  {CATEGORY_LABELS_CLIENT[c]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Civil or military" hint="Types flown by both match either">
            <div className="flex flex-wrap gap-2">
              {(["military", "civil"] as const).map((s) => (
                <Chip key={s} active={deck.sectors.includes(s)} onClick={() => set("sectors", toggle(deck.sectors, s))} count={countFor({ sectors: [s] })}>
                  {s === "military" ? "Military" : "Civil"}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Role" hint="None selected = all roles">
            <div className="space-y-3">
              {ROLE_GROUPS.map((g) => (
                <div key={g.label} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <span className="type-readout w-28 shrink-0 pt-2 text-muted-foreground">{g.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {g.roles
                      .filter((r) => families.some((f) => f.roles.includes(r)))
                      .map((r) => (
                        <Chip key={r} active={deck.roles.includes(r)} onClick={() => set("roles", toggle(deck.roles, r))}>
                          {roleLabel(r)}
                        </Chip>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Service branch" hint="US military operators">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BRANCH_SHORT) as Branch[]).map((b) => (
                <Chip key={b} active={deck.branches.includes(b)} onClick={() => set("branches", toggle(deck.branches, b))} count={countFor({ branches: [b] })}>
                  {BRANCH_SHORT[b]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Manufacturer">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between sm:w-80">
                  <span className="truncate">{deck.manufacturers.length ? deck.manufacturers.join(", ") : "Any manufacturer"}</span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search manufacturers…" />
                  <CommandList>
                    <CommandEmpty>No manufacturer found.</CommandEmpty>
                    <CommandGroup>
                      {manufacturers.map((m) => (
                        <CommandItem key={m} value={m} onSelect={() => set("manufacturers", toggle(deck.manufacturers, m))}>
                          <Check className={cn("size-4", deck.manufacturers.includes(m) ? "opacity-100" : "opacity-0")} />
                          {m}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Section>

          <Section title="Difficulty" hint={`${deck.difficulty[0]} – ${deck.difficulty[1]} of 5`}>
            <Slider
              min={1}
              max={5}
              step={1}
              value={deck.difficulty}
              onValueChange={(v) => set("difficulty", [v[0], v[1]] as [number, number])}
              className="max-w-sm"
              aria-label="Difficulty range"
            />
            <div className="mt-2 flex max-w-sm justify-between text-xs text-muted-foreground">
              <span>Unmistakable</span>
              <span>Expert</span>
            </div>
          </Section>
        </div>

        <div className="mt-6 rounded-xl border bg-card/60 p-4 sm:p-6">
          <Section title="Viewing angle" hint="Train the hard views on purpose">
            <Segmented label="view" value={deck.view} onChange={(v) => set("view", v)} options={Object.entries(VIEWS).map(([value, v]) => ({ value: value as DeckConfig["view"], label: v.label }))} />
          </Section>
          <Section title="Exposure" hint="How long the photo stays up">
            <Segmented label="exposure" value={deck.exposure} onChange={(v) => set("exposure", v)} options={Object.entries(EXPOSURES).map(([value, v]) => ({ value: value as DeckConfig["exposure"], label: v.label }))} />
          </Section>
          <Section title="Conditions">
            <Segmented label="conditions" value={deck.conditions} onChange={(v) => set("conditions", v)} options={Object.entries(CONDITIONS).map(([value, v]) => ({ value: value as DeckConfig["conditions"], label: v.label }))} />
            <p className="mt-2 text-xs text-muted-foreground">{CONDITIONS[deck.conditions].description}</p>
          </Section>
          <Section title="Answer choices">
            <Segmented label="choices" value={String(deck.choices) as "4" | "6"} onChange={(v) => set("choices", Number(v) as 4 | 6)} options={[{ value: "4", label: "4 choices" }, { value: "6", label: "6 choices" }]} />
          </Section>
          <Section title="Session length">
            <Segmented label="length" value={String(deck.sessionLength)} onChange={(v) => set("sessionLength", Number(v))} options={["10", "20", "30", "50"].map((v) => ({ value: v, label: `${v} cards` }))} />
          </Section>
          <Section title="New aircraft per session" hint={deck.newPerSession === 0 ? "Review only" : `Up to ${deck.newPerSession}`}>
            <Slider min={0} max={20} step={1} value={[deck.newPerSession]} onValueChange={(v) => set("newPerSession", v[0])} className="max-w-sm" aria-label="New aircraft per session" />
          </Section>
        </div>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border bg-card p-5">
          <p className="type-readout text-muted-foreground">Deck</p>
          <div className="mt-1 flex items-baseline gap-2">
            <motion.span key={playable.length} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="type-display text-5xl">
              {playable.length}
            </motion.span>
            <span className="text-sm text-muted-foreground">aircraft ready</span>
          </div>
          {matching.length !== playable.length && (
            <p className="mt-1 text-xs text-muted-foreground">{matching.length - playable.length} more match but have no photos for this view yet.</p>
          )}
          <div className="mt-4 flex max-h-44 flex-wrap gap-1.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {playable.slice(0, 28).map((f) => (
                <motion.span key={f.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                  {f.label}
                </motion.span>
              ))}
            </AnimatePresence>
            {playable.length > 28 && <span className="px-1 py-0.5 text-xs text-muted-foreground">+{playable.length - 28} more</span>}
          </div>
          <Button size="lg" className="mt-5 w-full" disabled={!playable.length || starting} onClick={start}>
            <Crosshair /> {starting ? "Starting…" : "Start drill"}
          </Button>
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await ensureSession();
              const p = await savePreset(presetName, deck);
              if (p) {
                setPresets((ps) => [p, ...ps]);
                setPresetName("");
                toast.success(`Saved deck "${p.name}"`);
              }
            }}
          >
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Name this deck" aria-label="Deck name" maxLength={60} />
            <Button type="submit" variant="outline" disabled={!presetName.trim()}>
              Save deck
            </Button>
          </form>
        </div>
      </aside>
    </div>
  );
}
