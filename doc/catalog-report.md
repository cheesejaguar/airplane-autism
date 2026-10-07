# Tally catalog report (2026-10-06)

## Scope

The brief was "all US civilian and military aircraft currently in flight in the USA in numbers greater than 10." It was applied like this:

- **Military:** included when more than 10 are in active US service, based on service fact sheets and published inventories. Two candidates were skipped:
  - **AV-8B Harrier II:** retired by the USMC in June 2026.
  - **T-7A Red Hawk:** about 6 delivered.
- **Civil:** taken from the FAA Releasable Aircraft Database (downloaded 2026-10-06). It counts valid (`V`) registrations of fixed-wing and rotorcraft aircraft in these airworthiness classes: standard, limited, restricted, multiple, primary, and experimental exhibition/racing/crew-training (where warbirds sit).
  - Excluded: amateur-built, kit, light-sport, gliders, balloons and airships.
  - Make/model codes are grouped into *visual families*, meaning variants a spotter can't tell apart at a glance. A family is in scope with more than 10 registrations.
  - Registrations stand in for "flying". Where a type is clearly not flying (stored fleets, museum warbirds), it was excluded by hand; see below.

## Result

| | Count |
|---|---|
| Visual families | **397** (337 fixed-wing, 57 rotorcraft, 2 UAS, 1 tiltrotor) |
| Sector | 342 civil, 39 military, 16 both |
| Curated photos | **2,933**, from Wikimedia Commons with full attribution |
| Photo angles | side 1,286 · front-quarter 1,046 · rear-quarter 257 · belly 139 · front 103 · top 72 · rear 30 |
| Look-alike links | 1,400+ `confusedWith` pairs, which drive distractors and hints |
| Drillable families | 388 (at least 2 photos) |
| Study-only families | 9: culver-v, dart-g, luscombe-11, micco-mac-145, mooney-m22, pa-36, taylorcraft-f2x, vulcanair-v1, weatherly-620. Too few freely licensed photos exist on Commons. |

The FAA code→family mapping covers 2,595 make/model codes. It was drafted by Claude, then curated by hand in `data/faa/curation.json`: merges, renames, code overrides and exclusions, each with a written reason.

## Exclusions (registered more than 10 times, but not flying in those numbers)

| Family | Reason |
|---|---|
| dc-10 | FedEx retired its MD-10s in 2022–23; the remaining registrations are stored airframes |
| b-17 | About 6 airworthy worldwide |
| mig-15 / mig-17 / mig-21 | About 7 / 2–3 / 3–5 documented flying US examples |
| pv-2, ha-200 | About 3 airworthy worldwide / no confirmed flying US example |
| lockheed-12 | Fewer than 20 airworthy worldwide, several of them in Europe |
| stearman-c3 | About 11 survive worldwide; only a few are airworthy |
| christen-eagle | Kit-built; its FAA code was actually the Christen/Aviat Husky |
| temco-d16 | Twin Navion conversions, not a distinct production type |

## Borderline types kept

These were kept because the airworthy count couldn't be confirmed at 10 or fewer. Review them if you want a stricter cut:

- f8f-bearcat, f-86, hu-16, ts-11-iskra, fwp-149d, sea-fury
- curtiss-wright-junior, stinson-trimotor-sm8, spartan-executive
- dc-6, grumman-mallard, s-55, s-58, ah-1-cobra, mi-8

## Known content caveats

- Hand-written WEFT details for the rarest vintage types were rated difficulty 4–5 where the authors were unsure. The authoring notes call out a few to verify against photos:
  - Air Tractor vs Thrush
  - Praetor vs Challenger 300
  - Duchess vs Seminole
  - Su-26 vs Yak-55
- Commons category quality varies, and a few families have photos from only 2 angles (the validator lists these as warnings).

## Cost

The AI Gateway account showed $98.74 used in total at the end of the run, with a $7.64 balance left. This includes any other usage on the team. Pipeline spending came from three things:

- Mapping FAA codes with Claude Sonnet
- Classifying photos one at a time, until the pipeline switched to batched multi-image requests
- The final pass on Gemini 2.5 Flash, which cost about $3.50

Re-running the image pipeline now costs about $0.005 per family, thanks to batching and caching.
