# Quickstart — 009 The Calendar's Preview Bar

**Date**: 2026-09-07 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Running it locally

This repo's Supabase stack is on **553xx**, not the CLI defaults — another project already occupies
543xx.

```sh
supabase start
supabase db reset                      # applies 039_show_countdowns.sql with the rest
npm run family:seed -- --local
npm run dev:local                      # http://localhost:3000/family
```

Sign in with **`family-dev-password`** (account `dev@family.local` — the LOCAL stack only, never the
household's). **PINs are never seeded**: set Ana `1234` and Cleo `2468` in Settings after every
reset, or nothing in this phase that writes can be tested at all.

Then: `npm test` · `npm run typecheck` · `npm run lint` · `npm run fallow:audit` ·
`npm run test:policies` (reads `.env.local`, needs the local stack) · `npm run test:e2e` before the
merge.

## Verifying each guarantee

| # | Guarantee | How to see it |
|---|---|---|
| SC-901 | A countdown shows, and survives a reload | Punch in as a parent, make an event a week out with **Countdown** on, save. The bar appears above the week. Reload — still there |
| SC-902 | The number falls by one at the household's midnight | `npm run test:unit -- days` proves the arithmetic across both DST changes. In the browser, the e2e journey pins the clock across a midnight; a real overnight watch on the wall tablet is the operator's own check (R912) |
| SC-903 | Every active countdown reaches the first position, and can be stopped | Make four countdowns on a phone-width window. Watch the first position change. Filter → **Pause countdowns** stops it |
| SC-904 | Each Show Countdowns value admits the right ones | Settings → Show Countdowns → **1 month prior**. An event 40 days out leaves the bar; drag it to 20 days out and it returns. Repeat for **3 months** at 100 and 80 days |
| SC-905 | The bar's tap opens the full list | Tap the bar with three countdowns set. Every one is listed. Choose one — its event's details open |
| SC-906 | Nothing to show costs no space | Turn Tasks Progress off and un-countdown every event. The day headers sit directly on the grid, at the height they had before this phase |
| SC-907 | The progress matches the board exactly | Filter → **Tasks Progress** on. Note a Profile's numbers, open the Tasks tab, compare the ring's count. Tick a chore and watch both |
| SC-908 | Hiding a Profile removes it within five seconds | Filter → hide a Profile. Their progress goes from the bar and their events go from the grid together |
| SC-909 | Search finds by title, lands on the day, and shows a repeat once | Search part of a weekly event's name — **one** result, not fifty. Choose it: the calendar moves to the day it next falls on and its details open |
| SC-910 | Every decision is unit-tested | `npm run test:coverage` then `npm run fallow:audit` — the gate reads coverage through `.fallowrc.json`, so an untested branchy function fails on CRAP rather than passing quietly |
| SC-911 | An anonymous reader is refused, not emptied | `npm run test:policies` — the new settings column and the search read both answer `42501` |
| SC-912 | Every shipped tab still behaves | `npm test` and `npm run test:e2e`. R915 names the one shipped test that legitimately changes; anything else that goes red is this phase's fault |

## When it fails

**The whole suite fails with `DatabaseSchemaMismatch` or `fetch failed`.** The local stack is
half-down — repeated `db reset` can leave only the database container running. `supabase stop &&
supabase start`, then reset and re-seed. These look exactly like test failures and are not.

**Sign-in refuses the password you know is right.** An old `next dev` is holding port 3000 and is
pointed at the hosted project. Kill it and re-run `npm run dev:local`; `dev:local`'s own
"Unable to acquire lock" earlier in the scrollback is the tell.

**A write is refused with "…could not be saved".** That is FR-288 working. Check the punch-in first —
PINs are gone after every reset.

**The bar is empty when you expect it.** Three things in order: is the event's Countdown switch
actually on; is its date inside the Show Countdowns window; and has its day already passed (FR-905
takes it off the day after, by design).

**`fallow:audit` fails on CRAP for a new function.** Cover it. `.fallowrc.json` reads
`coverage/coverage-final.json`, `coverage/` is gitignored, and `npm run fallow:audit` regenerates it
— run `npm run test:coverage` once if you are invoking `fallow` directly. The threshold does not
move (`.claude/rules/quality-bars.md`).

## Before the merge

1. All four gates green, plus `test:policies` and `test:e2e`.
2. **`supabase db push`** for `039_show_countdowns.sql` — the household's real database, with the
   operator's explicit approval, **before** the merge (R913). The e2e suite must never reach it.
3. The phone-width pass by hand: the bar with three countdowns and three Profiles in it, at the
   smallest iPhone width, spilling nowhere and hiding no navigation.
4. Record the run in `checklists/quickstart-run.md`, including anything that was skipped and why.
