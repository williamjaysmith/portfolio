# Data Model: The Meals Tab Navigates Like the Calendar

**Phase 1** · branch `013-meals-navigation` · 2026-09-10

**No stored data changes.** No migration, no column, no new read, no new cookie. `039` remains the
latest migration. What this document describes is the one piece of *client state* the phase replaces,
because that replacement is the phase.

---

## The window

One value, held on the client, from which everything the grid draws is derived.

| Field | Type | Meaning |
|---|---|---|
| `anchorDate` | `YYYY-MM-DD`, household-local | the first day on screen |
| `columns` | integer ≥ 1 | how many consecutive days are on screen |

Everything else is derived:

- **the days drawn** — `columns` consecutive dates from `anchorDate`
- **a step** — `anchorDate ± columns` days, which is what makes consecutive windows abut (FR-1303)
- **the label** — the range those days span (FR-1307)
- **whether "Today" is offered** — whether `anchorDate` is today (Assumption 5)

`columns` comes from measurement (`useBoardGeometry`, `--fam-meal-cell-w`). `anchorDate` comes from
navigation, initialised to today.

### What it replaces

Two independent pieces of state, which is the defect rather than an implementation detail:

| Today | Held by | Paged by |
|---|---|---|
| an anchor, from which seven dates are derived at the household's week start | `useMealWeek` | `shiftWeek`, ±7 days, via the labelled arrows |
| which slice of those seven is visible | `useColumnPage` | one column per swipe, unlabelled |

The two can disagree, and on a narrow screen they do: the arrows move seven days while two are shown.
Collapsing them is what removes the second gesture. See research R1304 for why making them agree does
not work — a page-sized step from Thursday in a Sunday week runs past Saturday, and rolling the anchor
while resetting the slice skips a day.

---

## Invariants

Each is a requirement with a test behind it, not a note.

1. **Abutment** (FR-1303). Stepping forward then back returns the same window. No day appears in two
   consecutive windows travelling one way; no day is skipped between them.
2. **Continuity** (FR-1304). There is no week boundary. The anchor is a date, and a step is arithmetic
   on that date — nothing resets, nothing wraps.
3. **Today on open** (FR-1305). `anchorDate` is initialised to today at every width.
4. **The clock moves, the window does not** (FR-1308, 006's rule). Today's marker is derived from the
   household clock on every render. `anchorDate` is **initialised** from today and then held. At
   midnight the marker moves to the next column; the window stays. "Today" re-anchors on demand.
5. **`columns` ≥ 1** (edge case). A very narrow screen or a large text rung may fit one day. The window
   is then one day and a step is one day. It must not collapse to zero and it must not stall.
6. **No layout shift** (FR-1310). The rendered structure must not change when the measurement lands.
   CLS is 0 today and that is the bar — see the plan's Phase 1 note on why a careless implementation
   breaks this.

---

## What the household's week still decides

`startWeekOn` stops deciding the Meals grid's first day (R1305) and keeps everything else:

- the anchored week the Tasks board reads resolutions by (003 R314)
- the star week beside it (004 R407)
- `weekStartOf` wherever else a week is presented

**The risk to test is not that it becomes dead configuration.** It is that removing its influence here
disturbs those — which is why SC-1307 asserts no Tasks, Lists or Rewards journey changes behaviour.

---

## Retired

| Symbol | Where | Why |
|---|---|---|
| `weekDatesOf` | `lib/family/meals/week.ts` | the window is no longer a household week |
| `shiftWeek` | `lib/family/meals/week.ts` | the step is `columns` days, not seven |
| `useMealWeek` | `meals/components/` | replaced by `useMealWindow` |
| `openOn` | `components/ColumnPager.tsx` | added 2026-09-10 (`6a4ba13`) so the grid opened on today's column. A window anchored on today makes it unreachable. **Removed, not left** — an unused parameter on a hook three other boards depend on is exactly the kind of thing that survives for years |

`weekLabelOf`, `dayWordsOf` and `dayHeaderOf` stay. `weekLabelOf` already renders a day *range* rather
than a week's name, so it needs a truer name and no change in behaviour.
