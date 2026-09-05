# US2 verification walk (T058) — the write surface, by hand

**Feature**: [spec.md](../spec.md) · **Task**: T058 · **Created**: 2026-09-04

The sixteen acceptance scenarios of User Story 2, plus SC-302's stopwatch and SC-319's absence
check. Every box is a thing done at a real device against the local stack — the unit and policies
tiers already prove the arithmetic, and what only a hand can prove is that the FORM offers what the
spec says, in the order it says, and that the words on screen are the right ones.

**Status: not yet walked.** T050–T057 have landed and are green in both automated tiers
(`task-actions.test.ts` 31, `task-modes.test.ts` 15, `TaskForm.test.tsx` 22,
`DeleteScopeDialog.test.tsx` 10, `TasksBoard.test.tsx` 32). This walk is the part that needs a
running app and a person; nothing below is ticked until it has actually been done.

## Setup

```
supabase start                       # this repo is on 553xx, not the CLI defaults
supabase db reset
npm run family:seed -- --local
npm run dev:local                    # sign in with password `family-dev-password`
```

Household timezone must read `America/Chicago` (US2-16 depends on it). Punch in as **Ana**
(parent). Cleo is the member the refusals are attempted as.

## The sixteen scenarios

| # | Scenario | What to do | What must happen |
|---|---|---|---|
| [ ] 1 | US2-1 Timed chore | Add Task → title "Take out trash", assign **Ben**, Due date a Tuesday, Due time `18:00`, Save | The card lands in Ben's column on that date with `18:00` on it; the stored row's `created_by` is Ana's profile id (check `family.tasks`) |
| [ ] 2 | US2-2 All-day chore | Same, with the Due **time** left empty | Saved as an all-day chore: no clock on the card, completable at any point that day |
| [ ] 3 | US2-3 Anytime chore | Same, with **neither** date nor time | Present on the board every day until completed, and **never** marked Late |
| [ ] 4 | US2-4 Empty title | Type a description and an emoji, leave the title blank, Save | Refused **against the title**; the description and emoji are still in the boxes; nothing stored |
| [ ] 5 | US2-5 Nobody assigned | Title only, no profile, Up for Grabs **off**, Save | Refused against the assignment: "Assign this to at least one Profile, or mark it Up for Grabs." |
| [ ] 6 | US2-6 Profiles only | Open the assignment picker | Profiles are listed; the Label **"Bin day" is absent**; a Profile with *Show on Tasks tab* off is absent too |
| [ ] 7 | US2-7 The routine form | Switch the type toggle to **Routine** | Due date and Due time are **gone**; a repeat (every N days, or weekly on chosen weekdays) and Morning / Afternoon / Evening appear; saving with no slot chosen is refused |
| [ ] 8 | US2-8 Conversion | Edit an existing chore, switch it to Routine, choose "every 2 days" and Morning, Save | It saves **with no weekdays** — weekdays belong to the *weekly* repeat, not to every routine. Switch it back: the chore fields are demanded and the slots are cleared |
| [ ] 9 | US2-9 Every 2 weeks | Scheduled Date, every **2 weeks**, Tuesday, starting **2026-09-08** | Occurrences on **8 and 22 September and 6 October**; page to **15 September** — nothing there |
| [ ] 10 | US2-10 Repeats until | Add "Repeats until 2026-12-15" to that chore | Nothing appears after 15 December, in **either** repeat mode |
| [ ] 11 | US2-11 Completed Date | "Clean the bathroom", Completed Date, After → Custom, 2 weeks | Exactly **one** occurrence — the first — and none anywhere later, however far the board is paged |
| [ ] 12 | US2-12 The successor | Complete it on **2026-09-10** | Exactly one new occurrence, due **2026-09-24**; it did not exist before the tick |
| [ ] 13 | US2-13 Two slots | Routine "Brush teeth", every day, **Morning and Evening** | Exactly **two** occurrences that day, one per section, **separately** completable |
| [ ] 14 | US2-14 Save to task box | Create a task with "Save to task box" ticked | A template with that title, emoji and type is listed in the Task Box (T072's sheet; until it lands, read `family.task_box_items`) |
| [ ] 15 | US2-15 Member refused | Punch in as **Cleo**; try create, edit and delete | Each is refused. Then repeat **off-interface** — call the action directly, or replay the request — and confirm the refusal holds and nothing is written |
| [ ] 16 | US2-16 The DST pair | A daily chore due **02:30**, read the board on **2026-03-08**; a chore due **01:30**, read **2026-11-01** | Each appears **exactly once** on its day — the 02:30 one at the first valid time after the 02:00 → 03:00 jump, the 01:30 one once across the repeated hour |

## Beside the sixteen

- [ ] **SC-302, with a stopwatch**: from first touch, create a repeating chore, assign it to **two**
      people, choose a repeat mode and save — **under 45 seconds**, punch-in included. Run it three
      times and record the slowest.
- [ ] **SC-319, the absence check**: no star value, point total or reward field anywhere on the
      create form, the edit form, the details sheet or the scope dialog — on either task type.
      (`TaskForm.test.tsx` asserts this at the unit tier; confirm it by eye as well.)
- [ ] **FR-347's asymmetry, by eye**: delete a repeating **chore** → three scopes; delete a
      **routine** → two, with "Use Skip to remove a single day of a routine."; delete a **one-off**
      → straight to the confirmation, no scope question at all.
- [ ] **FR-362's copy**: on a Completed Date chore, the scope dialog's "This one" says the next one
      is still scheduled after the usual delay — the opposite of the reading a parent assumes.
- [ ] **FR-393**: delete a task on a second device with the edit form open on the first, then save.
      The form **closes** and says "That task is no longer here."; nothing is recreated.

## Notes

Record here what the walk found, with the date and the device. Anything that fails becomes a
finding, not a tick.
