# Harness — 007 Family End-to-End Pass

Phase 1. What a journey may rely on: the state a run begins in, the fixtures it is handed, the
helpers it may call, and the rules it must follow. This is the contract between the suite's plumbing
and its journeys — the equivalent of a data model for a feature that adds no data.

---

## 1. The state a run begins in

The setup project (`e2e/setup/prepare.setup.ts`) runs before every other project and leaves the
world in exactly this state. Nothing else may assume more than this.

| | |
|---|---|
| **Database** | Reset, then seeded with `--local` fixtures |
| **Household** | "Our Family", timezone America/Chicago, week starts Sunday, 12-hour clock |
| **Account** | `dev@family.local`, signed in; the session saved to `e2e/.auth/household.json` |
| **PINs** | Ana `1234` (parent) and Cleo `2468` (member), set through Settings — the seed never sets any |
| **Punched in** | Nobody. Every journey that writes punches in first |
| **Server** | The development server on `127.0.0.1:3000`, with every `/family` route already compiled |

### The seeded data a journey may name

Stable across every run, because the seed is deterministic.

**Profiles** — Alex (parent), Sam (parent), Kit (member), Ana (parent), Ben (parent), Cleo (member).
**Labels** — Holidays, Bin day.
**Mealtimes** — Breakfast, Lunch, Dinner, Snack, in that order.
**Recipes** — Pancakes (Breakfast), Sandwiches (Lunch, no text), 🍝 Spaghetti (Dinner), Garlic bread
(Dinner), 🍕 Pizza (Dinner), Banana bread (Snack), and Old stew (Dinner, removed from the library but
still planned).
**Lists** — Grocery List and To-Do List (the household defaults), Packing List, and Party (Parents
only). The Grocery List holds 🥚 Eggs, 🥛 Milk, 🍞 Bread, Bagels (section Bakery) and Yoghurt
(section Dairy, already checked).
**Rewards** — Bake cookies (20 ★, Cleo, renewing), Movie night (15 ★, Cleo and Ben), Ice cream
(25 ★, everyone).
**Tasks** — fourteen named fixtures anchored to the day the seed ran, including Feed the cat, Sort
the recycling, Water the plants (carried forward from yesterday), Make bed, Practice piano (skipped
today), Brush teeth (twice a day) and Homework (weekdays only), plus a shelf of anytime tasks that
brings Cleo's column to twenty occurrences.
**Meals** — this week's seven, including a Wednesday dinner with a note, and a Friday 🍕 Pizza that
repeats weekly with one occurrence skipped and one moved.

### Two kinds of fixture date, and what follows

The task, list and meal fixtures are **anchored to the day the seed runs**, so they are always "this
week" and a journey reads today from the application. The calendar's fixtures sit in a **frozen
week** — the render matrix Phase 2's quickstart walks by hand — which drifts further from today as
real time passes.

So: **the calendar journeys create the events they need**, in the current week, and delete them
afterwards. They never page to the frozen week and never pin the clock days away from real time (see
§5). The frozen week stays what it was seeded for.

---

## 2. The fixtures a journey is handed

`e2e/fixtures.ts` exports an extended `test`. A journey imports that, never `@playwright/test`
directly, so every journey gets the same guarantees.

| Fixture | What it gives |
|---|---|
| `page` | Playwright's page, already carrying the signed-in session and pointed at the base URL |
| `punchedIn` | A page with a Profile punched in. Takes the Profile's name; defaults to Ana. Punches out at the end so the next journey starts from nobody |
| `asMember` | The same, punched in as Cleo — for the journeys that must see what a member sees |
| `signedOut` | A fresh context with no session, for the door's journeys |
| `secondBrowser` | A second, independent context signed in to the same household, for the live-update journeys. Closed automatically |
| `unique` | A name unique to this journey and stable across runs — `unique("Toast")` → `"Toast (door.spec:12)"`. Every row a journey creates carries one |
| `household` | The household's timezone, week start and today, read once from the application rather than computed |
| `axe` | The accessibility run for the current page, with its serious-and-critical assertion |
| `probeLiveUpdates` | Answers whether this environment can deliver live updates at all, for the skip in FR-725 |

---

## 3. The helpers, and what each is allowed to know

| Helper | Knows about | Must not |
|---|---|---|
| `helpers/stack.ts` | Whether the local stack is up; how to reset and seed it | Reach any address but the local stack's |
| `helpers/auth.ts` | The sign-in form, and where the session is saved | Write a session by hand — it signs in through the form |
| `helpers/punch.ts` | The "who's here?" sheet, the PIN pad, punching out | Set a PIN in the database — it uses Settings |
| `helpers/a11y.ts` | The accessibility engine and the impact bands that fail | Decide which pages to scan — the journey does |
| `helpers/realtime.ts` | How to ask the database whether any live subscription exists | Assert anything — it answers a question |
| `helpers/names.ts` | How a unique name is built | Anything else |

---

## 4. The rules every journey follows

1. **Find things by role and accessible name.** If a control cannot be found that way, that is a
   defect in the application, and the fix is to name it (FR-709, FR-727).
2. **Punch in before writing.** A write with nobody punched in opens the sheet — which is a journey
   of its own, not an accident in someone else's.
3. **Own your data.** Assert on seeded data you do not change, or create your own with `unique` and
   remove it at the end.
4. **Reload before believing a write.** Every writing journey re-asserts after a reload, so a write
   that never reached the database cannot pass (FR-721).
5. **Never sleep.** Wait for the thing you expect, with a bounded timeout and a message naming it.
6. **Say why you skip.** A skip carries the reason, and the reason is printed in the report.
7. **Tag what the layout changes.** A journey that must also run at the phone and the tablet carries
   `@responsive`; everything else runs at the wall only.

---

## 5. Time

Journeys read "today" from the application — the shell's clock, the week's label, the day headers —
because the fixtures they use are anchored to it.

A journey that must assert on a specific date pins the browser clock **by hours, not days**. The
signed-in token is minted by a server running on the real clock: a browser pinned days away believes
its token has expired and asks for a new one in a loop. The one journey that needs a rollover — the
Meals tab's "the week stays put at midnight" — pins forward across the household's midnight and no
further.

---

## 6. What the suite may not do

- Reach the hosted project. No address, key or flag in the suite points anywhere but the local stack,
  and the run record's review says so (SC-711).
- Write to the database directly. The one database access is a read: the live-update probe.
- Change what the application does. Where a journey proves a defect, the fix is an application change
  with its own unit test, listed in the run record (FR-727).
- Assert on styling, or on a marker added only for testing where an accessible name exists.
