---
name: fix-reports
description: Triage and fix user reports of mislabeled aircraft photos or inaccurate aircraft data in the Tally catalog. Use when asked to "fix reports", "process reports", "go through the reported aircraft", or when given a Tally reports brief (pasted markdown from /admin/reports).
---

# Fix Tally user reports

Users flag problems from the drill answer card and from study pages. Each report has a reason:

| Reason | Usual fix |
|---|---|
| `wrong-aircraft` — the photo isn't the labelled type | **move** the photo to the right family if it's in the catalog, else **block** it |
| `bad-photo` — cockpit, model, tiny, obstructed, several types | **block** |
| `wrong-angle` — view tag is wrong | **retag** |
| `wrong-info` — a WEFT feature, cue or look-alike tip is inaccurate | edit `data/families/<id>.json` |
| `other` | read the note and decide |

Reports are claims, not facts. **Verify every one before changing anything.** Never edit data just because a report says so.

## 1. Get the reports

- If the user pasted a brief (markdown starting `# Tally — open aircraft reports`), use it.
- Otherwise export from the database (needs `.env.local`; run `vercel env pull .env.local --yes` if `DATABASE_URL` is missing):

```bash
pnpm reports export            # → .cache/reports/open-reports.md
```

Then read `.cache/reports/open-reports.md`. Items are grouped by photo, most-reported first. Each item lists:
- the photo URL and its Commons source
- the current family and angle tags
- reporters' reasons, suggested correct types and notes
- the report ids

## 2. Verify each item

- **Photo reports:** download the photo URL and look at it (Read the image file), or open the Commons source page. Compare against the family's WEFT features in `data/families/<id>.json`, and against the suggested family's features if one was given.
  - Decide: is it the labelled type? Is it usable for recognition (whole aircraft, reasonably sharp, one dominant type)? What is the true view angle (`front`, `front-quarter`, `side`, `rear-quarter`, `rear`, `top`, `belly`)?
- **Text reports:** check the claim against reliable references (Wikipedia, manufacturer or service pages, clear photos). Keep the house style:
  - WEFT items are short, visually observable phrases.
  - `tellTales` must never name the aircraft.
  - `howToTell` is one sentence written from the file's own aircraft's point of view.

## 3. Apply fixes

```bash
pnpm images block <imageId...> --reason "shows a C182, not a C172" --reports <id1>,<id2>
pnpm images retag <imageId> front-quarter
pnpm images move <imageId> <correctFamilyId> --reason "reported as C182; confirmed by cowling + 3-blade prop"
```

- These scripts edit `data/images.json` and record the change in `data/image-overrides.json`, so later pipeline runs won't undo it.
- If blocking leaves a family with fewer than 3 photos, refill it from the cached vision verdicts. This normally costs nothing and needs `BLOB_READ_WRITE_TOKEN`:

```bash
pnpm pipeline:classify --only <familyId> && pnpm pipeline:upload --only <familyId>
```

- For text fixes, edit `data/families/<id>.json` directly. If you change a `confusedWith` entry, keep the link meaningful in both directions.

## 4. Validate

```bash
pnpm pipeline:families        # schema + cross-references for every family file
pnpm catalog:validate         # photos, labels, FAA coverage
pnpm test
```

Expect 0 errors. Warnings about photo counts or angles are acceptable but worth mentioning.

## 5. Resolve the reports

```bash
pnpm reports resolve <id...> --status fixed --note "blocked photo; replaced from cached candidates"
pnpm reports resolve <id...> --status dismissed --note "verified: photo is a C172 (strut, 2-blade prop)"
```

- Dismiss reports you verified as wrong, with a short reason.
- Leave a report `open` if you can't verify it, and tell the user why.

## 6. Ship

- Commit the data changes on a branch, e.g. `fix/reports-YYYY-MM-DD`. The message should list what was blocked, moved, retagged and edited.
- Offer to open a PR. The catalog is compiled at build time, so fixes go live with the next deploy.
- Summarize for the user: counts fixed and dismissed, any families that became study-only, and anything still open.
