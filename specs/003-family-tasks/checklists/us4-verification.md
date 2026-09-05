# US4 verification walk (T077) — the surfaces around the board, by hand

**Feature**: [spec.md](../spec.md) · **Tasks**: T077 · **Created**: 2026-09-04

The fourteen acceptance scenarios of User Story 4, plus SC-315 and SC-316 at all four viewports and
the press-and-hold reorder feel. Almost every number below is already proved in the automated tiers
and each row says where; what only a hand can prove is that the **board** shows it — that a filter
moves cards and not counters, that the phone lands on one full-width column with Up for Grabs first,
that a swipe reveals exactly one more profile, and that a press-and-hold picks a column up rather
than paging the board out from under it.

**Status: not yet walked.** T066–T076 have landed and are green in both tiers (whole projects
**1969 unit / 290 policies**). Nothing below is ticked until it has actually been done on a screen.

## Setup

```
supabase start                       # this repo is on 553xx, not the CLI defaults
supabase db reset
npm run family:seed -- --local       # the fixtures anchor to the day this runs
npm run dev:local                    # sign in with password `family-dev-password`
```

A **fresh** seed: scenario 9 counts the seventeen seeded Task Box templates and scenario 12 deletes
one, so a box that has already been walked through no longer holds them. Household timezone must
read `America/Chicago`.

Two profiles do the work: **Ana** (parent) and **Cleo** (member). Scenario 4 needs a second device —
a phone or a second browser profile — signed in to the same household, because the per-device filter
store is the thing under test.

---

## The fourteen scenarios

| # | Scenario | What to do | What must happen |
|---|---|---|---|
| [ ] 1 | US4-1 Completed hidden | Filter sheet → **Completed tasks** off | Completed cards leave **every** column; every ring and every `n/m` is **unchanged**. The counters describe the day, not the view (FR-384, SC-310) |
| [ ] 2 | US4-2 Late hidden | **Late chores** off | Carried-forward cards leave; a chore due **today** stays. "Water the plants" (late) goes, "Feed the cat" (today) stays |
| [ ] 3 | US4-3 Up for Grabs hidden | **Up for Grabs** off | The left-most column disappears; every profile column is unchanged, counters included. Then a phone: with it hidden the first page is the first **Profile** |
| [ ] 4 | US4-4 Per-device profile | Hide **Ben** on the phone | Ben's column goes on **that** phone; the tablet still shows it; showing him again brings it back unchanged. Nothing about Ben's tasks changed anywhere (FR-383, and never FR-313) |
| [ ] 5 | US4-5 Skip leaves the total | Skip one of Ben's outstanding occurrences | His header goes from three-of-ten to **three of nine** — a skipped occurrence leaves the denominator (FR-360) |
| [ ] 6 | US4-6 Streak badge | Read "Brush teeth" on the seeded board | A lightning-bolt badge beside the **name** reads **11** (FR-372) |
| [ ] 7 | US4-7 A skip protects it | Skip that routine for a day, then advance the clock a day | The badge still reads **11** — held, not advanced (FR-373) |
| [ ] 8 | US4-8 / **SC-312** An unresolved day breaks it | Leave the routine unresolved for a whole day, then advance | The badge has **reset** — nobody writes anything on the day a streak breaks, and the stored `streak_through` is what notices |
| [ ] 9 | US4-9 / **SC-318** The Task Box | Add Task → Task Box | Exactly **seventeen** templates, split into a **Chores** and a **Routines** section, with **its own** search box that filters them by title (and does not touch the board's) |
| [ ] 10 | US4-10 A template pre-fills | Tap the routine template **Homework** | The **ordinary create form** opens carrying its title, emoji and type; assignment and scheduling are **empty and still required**. It is not a separate action (FR-378) |
| [ ] 11 | US4-11 / **SC-319** Template edit | Edit a template | Exactly **three** fields — title, emoji, type. **No star value** is shown or asked for anywhere |
| [ ] 12 | US4-12 Template delete | Delete a template | A warning says it cannot be undone; afterwards the tasks already created from it are **untouched** on the board |
| [ ] 13 | US4-13 / **SC-320** Search | Type `trash`, then `bin`, then clear | `trash` leaves only **Take out trash**; `bin` leaves only **Sort the recycling**; every ring and count is unmoved throughout; clearing restores every card |
| [ ] 14 | US4-14 The phone | 390×844 | **One** profile column fills the width, **Up for Grabs first**; a swipe left reveals exactly one more profile and a swipe right comes back; the ends do not wrap; nothing is smaller than 44×44 |

---

## SC-315 and SC-316 — the four viewports

Load the tab at each width and read the same board. The fit is decided by **measuring**
(`boardLayoutOf` against the live `--fam-task-col-w`), never by a breakpoint, so the numbers below
are the expected consequence and not a switch to be found in the code.

| [ ] Viewport | What the layout must do | Also check |
|---|---|---|
| [ ] 1920×1080 (wall tablet) | **Four** columns in one row, stretched to share the width | No pager chrome at all; no `role="group"` named *Profile columns* in the accessibility tree |
| [ ] 1180×820 (iPad landscape) | **Four** columns in one row | Same |
| [ ] 820×1180 (iPad portrait) | **Three** across, the remainder **wrapped** onto a second row of equal height | Each column still scrolls **its own** body; the board itself does not scroll |
| [ ] 390×844 (phone) | **One** full-width column, paged | The `Showing …` live region names the column on screen |

- [ ] **SC-315 nothing unreachable**: at **each** of the four, reach the twentieth occurrence in
      Cleo's column by scrolling **that column** (the seeded skip hides one, so switch **Skipped** on
      to reach the last). The page never scrolls sideways at any width.
- [ ] **SC-316 no overlaps, 44×44**: at each of the four, inspect the completion circle, the four
      header toggles and the Profile-name handle specifically — all three draw smaller than the floor
      and rely on a larger hit area.

---

## The two reorders (T076) — feel, and the two rules that are easy to get wrong

| [ ] Check | What to do | What must happen |
|---|---|---|
| [ ] Columns, by hand | As **Ana**, press and hold **Cleo's name** and drag the column left | It picks up after a beat, follows the finger, and drops in the new place. **One** `family.categories.sort_order` row changes |
| [ ] The reconstruction rule | With a Label in the household and Ben switched **off** the Tasks tab, drag a column | Check `family.categories` ordered by `sort_order`: the Label and Ben are in **exactly** the slots they were in before. Getting this wrong silently reorders or drops Labels (FR-309, contracts §moveRoutine) |
| [ ] One household order | After that drag, open the **calendar** and **Settings** | The profile chip row and the settings list read in the **same** new order. There is one household order, not a per-tab one |
| [ ] Columns, by keyboard | Tab to a Profile's name, press **Enter**, then Left/Right, then **Enter** | Each step is announced; the drop writes once; **Escape** mid-move puts it back and writes nothing |
| [ ] A member may not | As **Cleo**, press and hold a Profile's name | Nothing picks up — the name is not a handle for her at all (FR-389) |
| [ ] Routines, by hand | As **Cleo**, press and hold **"Make bed"** in her own Morning section and drag it below "Brush teeth" | It reorders **within Morning**; **one** `family.task_assignees.sort_order` row changes |
| [ ] Never across a section | Try to drag a Morning routine into Evening | It does not land there. The list a routine is carried in **is** its section, so there is no index in another one to drop at |
| [ ] Never across a column | Try to drag one of Cleo's routines into Ben's column | It does not land there |
| [ ] Chores never | Press and hold any card in the **Chores** section | Nothing picks up. Their order is a fixed rule of the read (FR-311), and the server refuses the move outright even when the call is made by hand |
| [ ] A tap is still a tap | Tap a routine card without holding | The **details sheet** opens — the hold threshold, not the movement, is what separates the two |
| [ ] The pager stands down | On the phone, press and hold a Profile's name and drag sideways | The **column** moves; the board does **not** page |
| [ ] A swipe still pages | On the phone, swipe from anywhere that is not the name | The board pages by one column |

---

## Residuals recorded here rather than fixed

- **Routines have no keyboard reorder.** On a task card **Enter** opens the details view (FR-352),
  which is the card's primary action; arming a reorder from the same key would take it away. The
  columns' handle has no other action and keeps the keyboard path in full (FR-397). If the household
  wants a keyboard routine reorder later it needs a control of its own, not a stolen key.
- **A routine in two sections carries one order.** `task_assignees.sort_order` is per
  (task, assignee), so reordering a routine in Morning also reorders it in Evening — 018's own
  recorded cost (Contradiction 7, Assumption 11), restated here because it is visible by hand.
- **The pager steps one column, not one page.** At `perRow > 1` the windows therefore overlap by
  `perRow − 1`, which is what makes every page full and every swipe reveal exactly one more profile
  (R320: "tasks step one column"). On the phone, where `perRow` is 1, the two readings coincide.

---

## Where each row is already proved

| What | Automated tier |
|---|---|
| The five filters, and that they sit **below** the counter branch | `tasks-visibility.test.ts`, `tasks-filters.test.ts`, `TasksBoard.test.tsx`, `FilterSheet.test.tsx` — unit |
| The search predicate and its counter isolation (SC-320) | `tasks-visibility.test.ts`, `TaskSearch.test.tsx`, `TasksBoard.test.tsx` — unit |
| The streak rule, including the skip and the broken day (SC-312) | `tasks-streaks.test.ts`, `StreakBadge.test.tsx` — unit; `task-resolutions.test.ts` — policies |
| The Task Box's three verbs and their parent-only guard | `task-box.test.ts` — policies; `TaskBoxSheet.test.tsx` — unit |
| The fit rule at all four viewports, the wrap and the phone slice | `tasks-layout.test.ts`, `use-board-geometry.test.ts` — unit |
| The swipe's axis lock, threshold and reduced-motion collapse | `swipe.test.ts` (shared with the calendar), `ColumnPager.test.tsx` — unit |
| The reorder reducer: one row per drop, and the rebalance | `tasks-reorder.test.ts` — unit |
| FR-309's reconstruction rule and the press-and-hold gesture | `useColumnReorder.test.tsx` — unit |
| `moveRoutine`: who, what and where — and that a chore is refused outright | `task-actions.test.ts` — policies |
