# Quickstart: The Meals Tab Navigates Like the Calendar

**Phase 1** · branch `013-meals-navigation` · 2026-09-10

How to run it, how to verify each guarantee, and what to do when one fails.

---

## Running it

```sh
supabase start                        # this repo's stack is on 553xx, not the CLI defaults
supabase db reset
npm run family:seed -- --local
npm run dev:local                     # sign in with family-dev-password (dev@family.local)
```

PINs are never seeded. Set Ana `1234` and Cleo `2468` in Settings after every reset — the punch-in
journeys need them and this phase writes nothing without one.

**For anything about widths, use a production build.** `next dev` measures the same but paints
differently, and every number in this phase's spec was taken on `next build` + `next start`. The
scratch script used during 012 and this phase's research does both against the local stack.

---

## Verifying each guarantee

### SC-1301 — every day in a fortnight is reachable by the arrows alone, at 390px

Open the Meals tab at 390px. Note the days shown. Tap **Next** repeatedly, writing down the days each
time, until you have passed fourteen days. Then tap **Previous** the same number of times.

**Pass**: every date in the fortnight appears, none appears twice in a single direction, and you end on
the window you started from. **You should never need to swipe.**

**When it fails**: if days are skipped, the step and the drawn count disagree — the arrow is moving by
something other than `columns`. If days repeat, the step is smaller than the window.

### SC-1302 — the wall tablet still draws seven and moves seven

At 1280px: seven day columns, and **Next** advances seven days.

**When it fails**: check the measurement, not the navigation. If `perRow` reports fewer than seven at
1280px the column token or the probe is wrong, and the arrows are only reporting it.

### SC-1303 — five forward, five back, nothing lost

Start on today. Five taps forward, five back. You are where you began, and every day in between was on
screen at some point.

This is the abutment invariant end to end, and it is the one a careless step breaks silently.

### SC-1304 — today is the first column, at 390, 768, 1024 and 1280px

Open the tab fresh at each width. Today is the first column every time.

**Note what changed**: before this phase the grid opened on the household's first day of the week, and
`6a4ba13` patched it to open on the *page containing* today. Neither applies now — the window begins
on today by construction (Clarifications, 2026-09-10).

### SC-1305 — Cumulative Layout Shift stays 0

Measure on a production build at each of the four widths, the way this phase's research did.

**Pass**: 0 at every width.

**When it fails**: the implementation has started mounting a different number of columns when the
measurement lands, instead of feeding a window whose length already equals `perRow`. Research R1302
explains why Meals was CLS 0 to begin with — the visible slice was a transform — and the plan's Phase 1
note names this as the one place to get it wrong. **Do not reach for a device-width cookie.** Meals does
not need one; that was measured, not assumed.

### SC-1306 — the arrows say how far they go

At 390px they read "Previous 3 days" / "Next 3 days" (or whatever count is drawn). At 1280px, "Previous
week" / "Next week". The distance stated is the distance travelled.

### SC-1307 — Tasks, Lists and Rewards are untouched

Run their journeys. Nothing about them changes.

**Why this has its own criterion**: `useColumnPage` steps one column per swipe *by design* for Profile
columns, pinned by FR-396, and three boards depend on it. This phase removes a parameter from it
(`openOn`) and stops using it from Meals. **This is the point at which the phase could quietly break
three other tabs**, and no Meals journey would notice.

### FR-1308 — the midnight rule

**Not provable in a browser**, and for the reason 009 established: the e2e clock helper refuses jumps
over three hours because the session token is minted on the real clock.

Asserted in the unit suite instead: the anchor is *initialised* from today and then held, so advancing
the clock past midnight moves today's marker to the next column and leaves the window where it was.
"Today" re-anchors on demand.

The overnight watch — leaving the grid open on the wall tablet across midnight — is the operator's, as
it was for 009's countdown roll.

---

## The gates

Four before every commit, and the browser pass before the merge:

```sh
npm run fallow:audit     # zero NEW findings vs the baselines
npm test                 # Vitest, all green
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run test:e2e         # the phase gate — read the report, not just the exit code
```

**No suppressions.** If a gate fails, the code changes. In particular: removing `openOn` will make
fallow notice anything left dangling, and that is the gate doing its job, not an obstacle.

**Do not edit `app/**` or `lib/**` while `npm run test:e2e` is running.** Its web server is `next dev`
with hot reload, and a run was invalidated that way during 012.

---

## What the suite will tell you about itself

Two things learned the hard way in 012, worth knowing before you read a failure list:

- **A failing journey can be contagious.** It never reaches its own cleanup, so its rows outlive it and
  the next journey inherits them. If several journeys fail on one project, look at the *first* one in
  file order and re-run the rest without it before believing the others are broken.
- **`await locator.count()` does not retry.** Counting straight after a reload races the data arriving.
  Wait for the first thing, then count.
