# Tally: aircraft recognition trainer

Tally teaches you to identify US military and civil aircraft at a glance. It shows a real photo and you pick the type from a set of plausible look-alikes:

- **Right answer:** you move on.
- **Wrong answer:** you get a WEFT cue (wings, engines, fuselage, tail) and a second look.
- **Two misses:** the answer is revealed with a side-by-side comparison, and the aircraft comes back later in the same session.

Every answer feeds an FSRS spaced-repetition schedule and a full stats logbook.

## Features

- **Drills:** photo flashcards with exposure limits (0.5–3 s), haze and "distant" conditions, viewing-angle filters, and 4 or 6 choices.
- **Smart distractors:** the wrong options come from each aircraft's curated look-alikes and from your own past mix-ups.
- **Deck builder:** filter by fixed-wing, rotorcraft, tiltrotor or UAS; civil or military; role; service branch; manufacturer; and difficulty. Decks can be saved as presets.
- **Study library:** every type has a photo gallery by angle, a WEFT breakdown, fast cues, its look-alikes, and head-to-head compare pages.
- **Stats:** rank, streaks, accuracy trend, activity, a mastery map, and accuracy by angle, type, role and exposure. It also shows your most-confused pairs and your weakest aircraft.
- **Accounts:** you can play right away as a guest (Better Auth anonymous plugin). Signing up later merges your guest history into the account.

## Stack

Next.js 16 (App Router, Cache Components) · Tailwind v4 + shadcn/ui · Motion · Better Auth · Drizzle + Neon Postgres · Vercel Blob · AI SDK + AI Gateway (catalog pipeline only) · ts-fsrs · Vitest + Playwright.

## Getting started

```bash
pnpm install
vercel link                       # or create the project in the dashboard
vercel env pull .env.local        # DATABASE_URL, BLOB_READ_WRITE_TOKEN, VERCEL_OIDC_TOKEN, secrets
pnpm db:migrate                   # apply Drizzle migrations
pnpm dev
```

Required environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon Postgres (from the Vercel Marketplace) |
| `BETTER_AUTH_SECRET` | Session signing |
| `QUESTION_TOKEN_SECRET` | Encrypts quiz question tokens, so the answer never reaches the client |
| `BLOB_READ_WRITE_TOKEN` | Image uploads (pipeline only) |
| `VERCEL_OIDC_TOKEN` | AI Gateway auth for the pipeline (refresh with `vercel env pull`) |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | Optional social sign-in |

## The catalog

The catalog is static data, versioned in `data/`:

- `data/families/<id>.json`: one file per *visual family* (variants that can't be told apart at a glance). It holds the WEFT features, tell-tale cues, look-alikes and US count. The schema is in `src/lib/catalog/schema.ts`.
- `data/images.json`: curated photos. Each entry has its Blob URL, view angle and full attribution.
- `data/faa/*`: FAA registry aggregates and the code-to-family mapping.

`pnpm dev` and `pnpm build` compile these files into `src/generated/catalog.json`.

### Pipeline

```bash
pnpm pipeline:faa          # download the FAA registry and count valid registrations per make/model
pnpm pipeline:map          # Claude maps FAA codes → visual families (cached per batch; human overrides in data/faa/curation.json)
pnpm pipeline:reciprocals  # merge look-alike back-references from data/families/_reciprocals/
pnpm pipeline:apply-faa    # write FAA codes/counts back into family files
pnpm pipeline:families -- --group A --commons   # validate family JSON (+ Commons categories)
pnpm pipeline:harvest      # candidate photos from Wikimedia Commons (license-filtered)
pnpm pipeline:classify     # batched vision pass (Gemini 2.5 Flash by default; PIPELINE_MODELS to override): reject bad shots, tag angle, pick ~8 diverse photos
pnpm pipeline:upload       # resize to WebP, upload to Vercel Blob, write data/images.json
pnpm catalog:validate      # strict checks before shipping
```

How scope is decided:

- **Civil types:** the FAA count covers valid registrations of standard, limited, restricted, multiple and primary airworthiness classes, plus experimental exhibition/racing (where warbirds sit). Amateur-built kits, light-sport, gliders, balloons and airships are excluded. A family is in scope with more than 10 registrations. Registrations are used as a stand-in for "flying".
- **Military types:** in scope when more than 10 are in active US service, based on service fact sheets and published inventories.

The current catalog has 397 visual families and 2,933 photos. See [doc/catalog-report.md](doc/catalog-report.md) for scope decisions, exclusions and caveats.

## Tests

```bash
pnpm test        # unit: distractors, grading, FSRS, queue, image picker, question tokens
pnpm test:e2e    # Playwright: guest drill → hint → reveal → summary → stats, deck filters, sign-up merge
```

## Photo credits

All photos come from Wikimedia Commons under public-domain, CC0, CC BY or CC BY-SA licenses. Each one is credited in the app and listed on `/credits`.
