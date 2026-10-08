# Plan: "Tally" — Aircraft Recognition Trainer

## Context

The repo is empty (only a LICENSE). The user wants a modern, responsive, heavily animated web app for learning to identify aircraft at a glance. It should teach the way military and intel recognition training does, using smart flashcards marked with each aircraft's distinguishing features. Questions are multiple choice: a right answer moves you on, a wrong answer gives a hint. It needs user accounts with stats, full learning progress, success rates, and configurable decks (fixed-wing vs rotorcraft, civil vs military, and so on).

**Decisions confirmed with the user:**
- **Imagery:** real photos only (Wikimedia Commons, with attribution).
- **Stack:** Next.js + Postgres on Vercel.
- **Catalog:** every US civil and military aircraft type with more than 10 flying in the US. Civil scope covers certificated airplanes and helicopters plus warbirds/vintage. Kit-builts, gliders, balloons and airships are out.
- **Grouping:** visual families. Variants that can't be told apart at a glance are merged; visibly different ones are split.
- **Curation:** an AI vision pass through Vercel AI Gateway rejects bad photos and tags each image's view angle.

**Phasing (recommended, can be overridden):** the catalog is really a separate data-pipeline project with a long, messy tail of several hundred families. To show a polished, working app early and keep the data-quality risk separate:
- **Phase 1** ships the full app on a hand-curated core of about 100–120 families: all US military types plus the major airliners, business jets, GA aircraft, helicopters and warbirds.
- **Phase 2** brings in the long tail derived from the FAA registry, through the same pipeline and schema.

Both phases are part of this plan. The end state is the full catalog.

App name: **Tally**, from the pilot call "tally-ho" (visual contact). Easy to rename.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript, pnpm |
| UI | Tailwind v4, shadcn/ui primitives, `motion` (Framer Motion) for animation, lucide icons |
| Auth | **Better Auth**: email/password, optional GitHub/Google, and the **`anonymous` plugin**, so guests play right away and `onLinkAccount` moves their history into the new account |
| DB | Neon Postgres (Vercel Marketplace) + Drizzle ORM / drizzle-kit migrations |
| Images | Curated photos resized with `sharp` and stored in **Vercel Blob**, served through `next/image`. Wikimedia is never hotlinked at quiz time. |
| Spaced repetition | `ts-fsrs` (FSRS scheduler) |
| Charts | shadcn charts (Recharts) |
| Pipeline AI | AI SDK `generateObject` through AI Gateway: Claude Haiku 4.5 for the first pass, Sonnet 5.5 for low-confidence re-checks |
| Tests | Vitest (unit), Playwright (e2e) |

**Design direction:** a tactical "recognition-manual meets modern HUD" look. Dark-first, with a light theme too. Photos sit in reticle-framed viewports, and data labels use monospace type. Accents are amber/phosphor, used sparingly. Key motion:
- 3D card flip on reveal
- shared-layout transitions between cards
- scan-line and reticle sweep when a card appears
- a satisfying "lock-on" burst on a correct answer
- animated progress rings and streak counters

All motion respects `prefers-reduced-motion`. During implementation I'll use the frontend-design skill to finalize type and color.

---

## Pedagogy (core design)

**WEFT feature schema.** WEFT (Wings, Engines, Fuselage, Tail) is the standard recognition method. Every family stores:
- its features grouped under the four WEFT headings
- 2–3 **tell-tales**: the fastest single cues
- `confusedWith: [{ id, howToTell }]`, explaining how to tell it apart from look-alikes

The cards are "marked" with these features: WEFT chips and callouts on the reveal/hint card, grouped W/E/F/T with icons. AI-placed bounding boxes on photos are out of scope for v1.

**Question flow (Drill):**
1. A photo appears with N choices (4 by default; 6 configurable).
2. **Correct:** lock-on animation, a short tell-tale recap, then the next card.
3. **Wrong:** the chosen option is struck out and a **progressive hint** appears.
   - The first hint is the best WEFT tell-tale for the target, without naming it.
   - If the user's pick is in `confusedWith`, the hint also shows the contrast line, e.g. "The type you picked has twin tails; look again at the tail."
   - The user retries.
4. **Second miss:** full reveal with a side-by-side comparison against the type they picked, then continue.

**Grading → FSRS:**

| Outcome | FSRS rating |
|---|---|
| First try and fast | Easy |
| First try | Good |
| Correct after a hint | Hard |
| Revealed | Again |

The latency thresholds scale with the exposure setting.

**Distractor algorithm** (pure function, unit-tested). Draw from the current deck pool first, then widen:
1. Up to 2 from the target's `confusedWith`.
2. Up to 1 from the **user's own confusion history** for this target (the types they've mistaken it for most often).
3. Fill from the same role + category, then the same category, then anything.
4. Never pick duplicates; shuffle; options are always family display names.

**Image choice per question:** prefer angles the user is weak on (accuracy by angle per family), then rotate through angles the user hasn't seen.

**Glance conditions** (deck settings, the tachistoscope technique):
- exposure: unlimited / 3s / 1s / 0.5s (the image hides after the time runs out)
- view filter: any / head-on / side / belly / rear / 3-quarter
- conditions: clear / haze / distant (CSS filter + scaled-down viewport)

---

## Features & routes

| Route | Purpose |
|---|---|
| `/` | Animated landing: hero with a photo parallax and reticle sweep, "Start training" (starts a guest session right away), how-it-works (WEFT), feature tour |
| `/train` | Deck builder: category (fixed-wing / rotorcraft / tiltrotor / UAS), sector (civil / military), roles (fighter, bomber, attack, tanker/transport, ISR/AEW, trainer, airliner, regional, bizjet, turboprop, piston GA, utility/attack helo, warbird…), military branch, manufacturer, view filter, exposure, conditions, choices, new-cards/day. Shows a live count of matching families. Users can save presets. |
| `/train/session` | Drill: due cards plus new cards from the deck, in session batches of ~20, with keyboard shortcuts 1–6. Ends with a session summary screen. |
| `/study` | Catalog browser: filterable grid with search |
| `/study/[familyId]` | Flashcard detail: photo carousel by angle, WEFT breakdown, tell-tales, variants, look-alikes with "how to tell" and links to compare, image attributions |
| `/compare/[a]/[b]` | Head-to-head of a confusion pair: synced photos by angle, WEFT diff table |
| `/stats` | Dashboard: overall and rolling accuracy, streak, cards learned / mastered / due, accuracy by category / role / angle / exposure, mastery heatmap across the catalog, "most confused pairs" (personal confusion matrix with links to compare), response-time trend, recent sessions. Rank ladder: Recruit → Spotter → Observer → Analyst → Expert. |
| `/settings` | Account, linked providers, default deck preferences, theme, reduced motion, reset progress |
| `/sign-in`, `/sign-up` | Better Auth forms. A banner prompts guests to save their progress. |
| `/credits` | Full image attribution and license list (a licensing requirement) |

Server logic lives in Server Actions (`startSession`, `nextQuestion`, `submitAnswer`, `savePreset`). Each question is issued with an HMAC-signed token holding familyId, imageId, options and issuedAt. The server checks it on submit and computes latency itself, so the client can't forge answers or timing.

---

## Data model

### Catalog: static files in the repo, versioned, Zod-validated

**`data/families/<id>.json`**, one file per family:
- `id`, `name`, `aka[]`, `manufacturer`
- `sector: civil|military|both`, `category: fixed-wing|rotorcraft|tiltrotor|uas`
- `roles[]`, `branches[]`, `era`
- `variants[]`, `summary`
- `weft: {wings[], engines[], fuselage[], tail[]}`, `tellTales[]`
- `confusedWith[{id, howToTell}]`
- `faaModelCodes[]` (civil), `inventorySource` (military)
- `commonsCategories[]`, `difficulty: 1-5`

**`data/images.json`** (generated): per image:
- `id`, `familyId`, `blobUrl` (and size variants), `w`, `h`
- `angle: front|front-quarter|side|rear-quarter|rear|top|belly`, `inFlight`, `quality`
- `author`, `license`, `licenseUrl`, `sourceUrl`

**`src/lib/catalog/`** loads both at build time into typed indexes. The DB stores only `familyId` and `imageId` strings; catalog attributes are joined in app code.

### Postgres (Drizzle, `src/db/schema.ts`)
- Better Auth tables: `user` (with `isAnonymous`), `session`, `account`, `verification`
- `card_state`: (userId, familyId) PK + FSRS fields (due, stability, difficulty, reps, lapses, state, lastReview)
- `review`: append-only, one row per attempt: userId, sessionId, familyId, imageId, angle, exposure, conditions, chosenFamilyId, attemptNo, correct, hintShown, latencyMs, rating, createdAt. **All stats are derived from this table.** There are no separate aggregate counters; indexes on (userId, createdAt) and (userId, familyId).
- `training_session`: id, userId, deckConfig jsonb, startedAt, endedAt, counts
- `deck_preset`: id, userId, name, config jsonb
- `user_prefs`: userId PK, defaults jsonb

Guest → account: `anonymous({ onLinkAccount })` reassigns `review`, `card_state`, `training_session` and `deck_preset` rows from the anonymous user id to the new one in a single transaction. Where `card_state` conflicts, the newer `lastReview` wins.

---

## Catalog pipeline (`scripts/pipeline/`, run with `pnpm pipeline:<step>`)

The pipeline is idempotent. Each step caches its results in `.cache/pipeline/` (gitignored); outputs are committed under `data/`.

1. **`faa:fetch`**: download `ReleasableAircraft.zip` from the FAA registry download page and parse `MASTER.txt`, `ACFTREF.txt` and `ENGINE.txt`.

2. **`faa:aggregate`**
   - Join MASTER→ACFTREF on `MFR MDL CODE` and keep valid registrations only (status code).
   - Keep ACFTREF type-aircraft fixed-wing single/multi (4/5) and rotorcraft (6).
   - Exclude experimental amateur-built using the MASTER airworthiness-classification field. I'll check the code encoding against the FAA ARData format PDF before relying on it.
   - Warbirds sit under limited/exhibition categories, so they come from a hand whitelist (`data/faa/warbird-whitelist.json`) rather than a pure filter.
   - Output: `data/faa/model-counts.json`.

3. **`families:map`**: map FAA codes to families using `data/faa/family-map.json`.
   - This is the biggest manual task, because ACFTREF make/model strings are messy (dozens of Cessna/Piper/Beech spellings).
   - The mapping is LLM-drafted, then human-checked.
   - The script reports unmapped codes and any **family with a total count above 10** that has no family file.
   - The threshold applies to the family total, since that is the meaning of "more than 10 of that aircraft".
   - Note: these are registration counts, used as a stand-in for "flying".

4. **Military list**: `data/military/inventory.json`, hand-curated from service fact sheets and published inventories. It covers USAF, ANG/AFRC, USN, USMC, Army and USCG, and lists active counts with sources. Types with more than 10 active get a family; large UAS such as the MQ-9 are included under `category: uas`.

5. **`images:harvest`**: Wikimedia Commons API.
   - Set a descriptive User-Agent and handle rate limits.
   - Crawl each family's `commonsCategories` (depth ≤2).
   - Pre-filter: JPEG, width ≥1200, license in the allowlist (PD, CC0, CC-BY, CC-BY-SA), and drop filename keywords like cockpit, interior, engine, panel, cabin or seat.
   - Cap at about 25 candidates per family, keeping the extmetadata (author, license, URL).

6. **`images:classify`**: Claude Haiku 4.5 vision on the 800px thumbnail, given the family name and its WEFT features.
   - Zod output: `{matchesType, confidence, wholeAircraftVisible, angle, inFlight, quality 1-5, watermark, rejectReason}`.
   - Low-confidence results are re-checked by Sonnet 5.5.
   - Selection: keep about 8 images per family, maximizing angle diversity, with **≥3 distinct angles required**.
   - Cost estimate: Phase 1 about $3–6. The full catalog is about $15–40, which is more than the "few dollars" I quoted earlier, because there are many more families than first assumed.

7. **`images:upload`**: download, use `sharp` to make 1600w and 800w webp versions, upload to Vercel Blob, and write `data/images.json`.

8. **`catalog:validate`** (also runs in CI and in `pnpm test`):
   - Zod schemas pass.
   - Every `confusedWith` id exists, and links are symmetric or at least warned about.
   - Every family has ≥1 tell-tale, every WEFT group is non-empty, and every family has ≥1 `confusedWith`.
   - Every family has ≥3 angle-tagged images.
   - Every FAA family above the threshold is mapped.
   - Every image has attribution.

**Content authoring:** family JSON (WEFT, tell-tales, confusedWith) is drafted in parallel by subagents split by role group, using Wikipedia/Wikidata as the source, then cross-checked by `catalog:validate` and a second review pass.

---

## Project layout

```
src/app/(marketing)/page.tsx            landing
src/app/train/…, study/…, compare/…, stats/…, settings/…, credits/…, (auth)/…
src/app/api/auth/[...all]/route.ts      Better Auth handler
src/components/ui/                      shadcn primitives
src/components/quiz/                    PhotoViewport (reticle, exposure, conditions), ChoiceGrid, HintPanel, RevealCard, SessionSummary
src/components/study/  stats/  motion/  (shared animation primitives)
src/lib/catalog/                        types, zod schemas, loaders, deck filtering
src/lib/quiz/                           session builder, distractors, image picker, grading, question token
src/lib/srs/                            ts-fsrs wrapper + rating mapping
src/lib/stats/                          SQL queries over `review`
src/lib/auth.ts, auth-client.ts
src/db/schema.ts, index.ts, migrations/
data/families/*.json, data/images.json, data/faa/*, data/military/*
scripts/pipeline/*.ts
tests/unit, tests/e2e
doc/specs/2026-10-06-tally-design.md    design spec (doc/ per user's global CLAUDE.md)
```

---

## Before implementation: things the user must do or approve

These are outward-facing actions, so I'll ask before each one:
1. Create or link a Vercel project (`vercel link`).
2. Add Neon Postgres from the Vercel Marketplace and create a Blob store.
3. Enable AI Gateway. `vercel env pull` provides an OIDC token locally.
4. Set `BETTER_AUTH_SECRET`. GitHub/Google OAuth client IDs are optional; email/password works without them.

---

## Implementation order

0. Write the spec to `doc/specs/…` and commit.
1. **Foundation:** scaffold Next 16 + Tailwind v4 + shadcn, design tokens and theme, Drizzle + Neon schema and migrations, Better Auth with the anonymous plugin, app shell and nav.
2. **Catalog core:** Zod schemas, about 100–120 Phase 1 family files, the military inventory, pipeline steps 5–8 run on the core set.
3. **Quiz engine:** distractors, image picker, FSRS grading, signed question tokens, Server Actions. Built test-first with Vitest.
4. **Train UI:** deck builder, drill session with hints, reveal, exposure and conditions, keyboard shortcuts, session summary, all animations.
5. **Study + Compare** pages.
6. **Stats dashboard**, settings, presets, guest→account linking.
7. **Landing, credits**, responsive and a11y polish, reduced-motion pass.
8. **Phase 2:** FAA fetch/aggregate/map, long-tail family authoring, full image pipeline run, validate.
9. Verification, then a preview deploy to Vercel, with the user's approval.

---

## Verification

- **Unit (Vitest):** distractor selection (confusedWith priority, personal confusion, no duplicates, fallback widening); FSRS rating mapping; deck filters; question-token signing and tamper rejection; FAA parser and aggregator on fixture rows; guest-merge conflict resolution.
- **`pnpm pipeline:catalog:validate`** passes, enforcing all the invariants listed above.
- **E2E (Playwright, against `pnpm dev` with a Neon branch DB):**
  1. Open as a guest and start a drill from the landing page.
  2. Answer wrong: the hint panel shows WEFT tell-tales and the wrong option is disabled.
  3. Answer right: the app advances.
  4. A second miss shows the reveal with a comparison.
  5. Finish the session and check the summary.
  6. Sign up: the stats page shows the guest attempts after linking.
  7. Change the deck to rotorcraft + military only: every question's answer is in that set.
  8. Exposure of 1s hides the image.
- **Manual pass in the browser pane:** visual and animation QA at mobile (375px) and desktop widths in dark and light themes, with reduced-motion on.
- `pnpm build` and `pnpm lint` / `tsc --noEmit` are clean, and a Lighthouse check runs on `/` and `/train/session`.
