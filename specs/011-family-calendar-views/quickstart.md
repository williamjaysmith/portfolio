# Quickstart — 011 The Calendar's Other Views

**Date**: 2026-09-08 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Running it

```sh
supabase start                 # this repo's stack is on 553xx, not the CLI defaults
supabase db reset              # NOTE: this phase adds NO migration
npm run family:seed -- --local
npm run dev:local              # http://localhost:3000/family
```

Sign in with **`family-dev-password`** (`dev@family.local`, the LOCAL stack only). **PINs are never
seeded** — set Ana `1234` and Cleo `2468` in Settings after every reset.

Then: `npm test` · `npm run typecheck` · `npm run lint` · `npm run fallow:audit` ·
`npm run test:e2e` before the merge. `npm run test:policies` should be **unchanged** by this phase —
if it moves, something was exposed that should not have been.

## Verifying each guarantee

| # | Guarantee | How to see it |
|---|---|---|
| SC-1101 | The switcher moves between the three and remembers | Switch to Month, reload — still Month. Open a private window: back to the default |
| SC-1102 | Day view is one day, scrolls, steps by one | Switch to Day on a phone width; step forward; the date moves by one |
| SC-1103 | Month draws every month correctly | Unit tests walk a full year including a leap February and a six-row month; in the browser, page through a year |
| SC-1104 | Overflow shows two and an accurate count | Put four events on one day: the cell shows two and "+2 more"; the control opens all four |
| SC-1105 | A multi-day event spans, once per week row | Make a five-day event crossing a Sunday: two segments, not five chips |
| SC-1106 | Month steps by a calendar month | December → January, and February in a leap year |
| SC-1107 | The preview bar survives every view | With a countdown set, switch all three ways; the bar stays and still vanishes when empty |
| SC-1108 | Every view agrees about a day | Note a day's events in Week; switch to Day and to Month; the same events |
| SC-1109 | The decisions are unit-tested | `npm run test:coverage` then `npm run fallow:audit` — CRAP fails an untested branchy function |
| SC-1110 | Phase 2's criteria still pass | `npm test` — `layout.test.ts`, `week-geometry.test.ts` and `use-week-anchor.test.ts` must pass **untouched** |
| SC-1111 | Narrow widths work | The e2e phone journey, plus the document not scrolling sideways |

## When it fails

**The whole suite fails with `DatabaseSchemaMismatch` or `fetch failed`.** The local stack is
half-down. `supabase stop && supabase start`, then reset and re-seed. It looks like a test failure
and is not.

**A Week-view test goes red.** Stop and read it rather than fixing it. R1115: `layout.test.ts`,
`week-geometry.test.ts` and `use-week-anchor.test.ts` pin shipped behaviour and must pass untouched.
If one needs editing, the change has reached further than it should have.

**Month view draws the wrong number of rows.** The window is whole weeks from the household's own
start-of-week, and six rows when the month needs six. Check `startWeekOn`, not the renderer.

**A spanning bar is missing on the second week row.** Segmentation is per week row (R1109); a span
crossing a row break is two segments, each marked as continuing.

**`fallow:audit` fails on complexity in the month layout.** Split it further by shape — window,
placement, overflow, spans — rather than annotating. The threshold does not move.

## Before the merge

1. All four gates green, plus `test:e2e`. `test:policies` unchanged.
2. **No `supabase db push`** — this phase adds no migration. If you are reaching for one, something
   has gone wrong.
3. The phone pass by hand: all three views at the narrowest iPhone width.
4. Record the run in `checklists/quickstart-run.md`.
