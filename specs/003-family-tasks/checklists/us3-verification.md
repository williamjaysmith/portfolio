# US3 verification walk (T064, T065) — when life intervenes, by hand

**Feature**: [spec.md](../spec.md) · **Tasks**: T064, T065 · **Created**: 2026-09-04

The fourteen acceptance scenarios of User Story 3, plus the carry-forward bound and its one
exemption. The arithmetic is already proved in the automated tiers and the rows below say exactly
where; what only a hand can prove is that the **board** shows it — that a late card names the day it
was due, that Skip is where FR-352 puts it and nowhere else, and that two devices claiming at once
end up agreeing.

**Status: not yet walked.** T059–T063 have landed and are green in both tiers
(`task-resolutions.test.ts` 36, `TasksBoard.test.tsx` 37, `TaskDetails.test.tsx` 23,
`TaskCard.test.tsx` 17, `ClaimDialog.test.tsx` 8, `LateBadge.test.tsx` 6, `useTaskResolve.test.tsx`
12; whole projects 1805 unit / 259 policies). Nothing below is ticked until it has actually been
done on a screen.

## Setup

```
supabase start                       # this repo is on 553xx, not the CLI defaults
supabase db reset
npm run family:seed -- --local       # the fixtures anchor to the day this runs
npm run dev:local                    # sign in with password `family-dev-password`
```

The walk needs a **fresh** seed: US3 is about state, and a board that has already been ticked
through the US1 and US2 walks no longer holds the fixtures these rows name. Household timezone must
read `America/Chicago`.

Two profiles do the work: **Ana** (parent) and **Cleo** (member). Scenarios 11 and 14 need a second
device — a phone or a second browser profile — signed in to the same household.

---

## T064 — the carry-forward bound, and the one thing exempt from it

The bound is `todayEpochDay − scheduledEpochDay < CARRY_FORWARD_DAYS` (28), declared once in
`lib/family/tasks/dates.ts` and applied once, in `carryCandidatesOf`. Three facts, each already
asserted and each visible on the board:

| Fact | Where it is proved | What to see |
|---|---|---|
| [ ] Day **27** carried, day **28** not, day **29** not | `tasks-expand.test.ts` → "an occurrence scheduled %s (%i days back) is carried" (three rows) and `tasks-dates.test.ts` → `withinCarryBound` | — |
| [ ] **"Hoover the stairs"**: the occurrence at `seed − 14` is on today's board, the one at `seed − 28` is not | the fixture is anchored at `seed − 28` with `FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=FR`, so it falls on exactly `seed − 28` and `seed − 14` (confirmed against `family.tasks` on the seeded stack) | Ana's column today shows **one** Hoover card, marked late, dated `seed − 14`. Page back to `seed − 28`: the older one is there, **not** late. Page back to `seed − 14`: it is there too, not late |
| [ ] Neither appears on any day **between** its own and today | `tasks-expand.test.ts` → "shows a carried occurrence on its own day and on today, and NOWHERE between" | Page through three or four intervening days — no Hoover card on any of them |
| [ ] **The exemption**: a Completed Date chore's open occurrence is still on today's board past 28 days | `tasks-expand.test.ts` → "EXEMPTS the Completed Date open occurrence from the bound (FR-343 vs FR-357, R316)" — carried at day 40 while a Scheduled Date chore at day 29 is not | Take "Clean the bathroom" (Completed Date, 2 weeks) and set its one stored resolution's `resolved_on` back **six weeks** in `family.task_resolutions`; reload. Its open occurrence is still on today's board, marked late. Bounding it would leave the cursor on no reachable screen and no next cycle could ever be scheduled |

- [ ] **The reason the exemption exists, stated on screen**: with the row above still in place,
      confirm the card is tappable and completing it schedules the next cycle from **today** plus two
      weeks. That is the failure mode the exemption prevents — a chore destroyed by inattention.

---

## T065 — the fourteen scenarios

| # | Scenario | What to do | What must happen |
|---|---|---|---|
| [ ] 1 | US3-1 Late trash | Read the board on the day after "Take out trash" was due (it is anchored `seed − 21`, `18:00`, weekly Friday) | It sits in **Ben's** column with a **Late** pill naming **the date it was due**, not today's; it counts toward today's total (Ben's ring denominator includes it) |
| [ ] 2 | US3-2 / **SC-308** Ticked later | Complete that late chore today | The record says **today** (`family.task_resolutions.resolved_on`), not the Tuesday it was due; today's count includes it; page back to its own day — it shows **completed** there, still late |
| [ ] 3 | US3-3 No smearing | Page across every day between its due date and today | It appears on its own day and on today, and on **no** day in between |
| [ ] 4 | US3-4 Anytime never late | Find "Sort the recycling" (anytime, no date) and leave it | **No** Late pill, ever, however long it sits — it has no deadline to miss. The badge is structurally impossible on it: `LateBadge` renders nothing without a date |
| [ ] 5 | US3-5 / **SC-309** Skip | Punch in as **Ana**, open Cleo's evening "Practice piano", tap **Skip** | The card leaves the column's **count** and its **ring** (the denominator drops by one), and Cleo's streak on that routine is **unbroken** — `streak_count` holds while `streak_through` moves to that day |
| [ ] 6 | US3-6 Unskip | Switch the **Skipped tasks** filter on (T067), find it, tap **Unskip** | It is visible and marked skipped while the filter is on; Unskip returns it to unresolved and puts the count, the ring and the card back exactly as they were |
| [ ] 7 | US3-7 No Skip on a one-off | Open "Water the plants" (one-off, `seed − 2`, 18:00) | **No Skip action** in the sheet. Then off-interface: call `skipTaskOccurrence` with its key directly — refused `VALIDATION`, and the insert trigger refuses the same row too |
| [ ] 8 | US3-8 Skip advances a cycle | Open "Clean the bathroom" (Completed Date, 2 weeks) and Skip its open occurrence | The next occurrence is scheduled for **the skip date + 14 days** — a skip advances the chore rather than ending it |
| [ ] 9 | US3-9 The claim | Punch in as **Cleo**, tap the circle on "Empty the dishwasher" in **Up for Grabs** | It asks **who did this one**, offering **only Cleo**. Choose her, press **Complete**: it leaves Up for Grabs and appears completed in **Cleo's** column, credited to Cleo. Nothing was reassigned — `family.tasks` is untouched and the row's `assignee_id` is still null |
| [ ] 10 | US3-10 Undoing a claim | Mark it incomplete again | It returns to the **Up for Grabs** column belonging to nobody, and can be claimed again by somebody else |
| [ ] 11 | US3-11 / **SC-311** Two devices | Open the same unclaimed occurrence on **two devices**; claim it on both **within the same second** | Exactly **one** row in `family.task_resolutions`; the loser sees a refusal **naming the Profile credited**; both screens show the same result within **5 s**. (The arbitration is the occurrence key's unique index — no lock, no RPC; asserted in `task-resolutions.test.ts` → "exactly one claim is recorded and the loser is told who got there first") |
| [ ] 12 | US3-12 Household-wide skip | Punched in as **Cleo** (a member), Skip an unclaimed Up for Grabs occurrence | Allowed — it belongs to nobody, so it excludes nobody. The stored row credits **nobody** (`category_id` null) and the occurrence is skipped for the whole household |
| [ ] 13 | US3-13 Crediting someone else | Punched in as **Cleo**, open the Up for Grabs claim | Ben is **not offered**. Then off-interface: call `completeTaskOccurrence` with `creditProfileId` = Ben's — refused **`FORBIDDEN`**, nothing written. Punch in as **Ana** (parent) and repeat: allowed |
| [ ] 14 | US3-14 / **SC-314** Midnight rollover | Leave the board open and untouched at **23:59** with a chore due today unresolved | At midnight it is on the **new day's** board marked late, showing the date it was due, with **no reload and no interaction** |

## Beside the fourteen

- [ ] **FR-358's colour, by eye**: the Late pill is ochre and reads as a status, not as
      `--fam-danger`'s "delete this". Check it on a **pale** accent (Sunshine) and a **dark** one
      (Deep River), on both an incomplete card and a completed one — the pill's edge is the card's
      own ink, which is what keeps it perceivable on the dark completed card.
- [ ] **FR-352's action list**: a repeating chore's sheet offers Skip; a routine's offers Skip; a
      one-off's does not; a skipped occurrence offers **Unskip** and no Skip beside it; a completed
      occurrence offers neither.
- [ ] **FR-393 on every US3 verb**: skip, unskip and claim each show a busy state for the round trip
      and paint **only** from the refetch — turn the network off mid-tap and confirm the refusal is
      shown and nothing is queued.
- [ ] **SC-319, the absence check**: no star value anywhere on the claim dialog, the late badge or
      the skipped card.

## Recorded while walking

| # | Date | Who walked it | Result |
|---|---|---|---|
| | | | |
