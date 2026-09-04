# Contracts: Server Actions & Database Functions — Tasks

**Feature**: `003-family-tasks` | **Date**: 2026-09-04

What Phase 3 adds to the action surface of Phases 1 and 2
(`specs/001-family-foundation/contracts/server-actions.md` and
`specs/002-family-week-calendar/contracts/server-actions.md` remain in force, unamended except where
this file says so). **Ten new actions** — seven in `lib/family/actions/tasks.ts`, three in
`lib/family/actions/task-box.ts` — **one new guard**, **one amendment to a shipped Phase 1 action**,
**no new database functions on the write path**, and an extended read path. Every action starts with
`"use server"`, returns `Promise<ActionResult<…>>` through `runAction()`, and is validated with
Zod 4 (`lib/family/validation.ts`) before anything reaches the database — the constraints and
triggers of `data-model.md` are the second line, not the first.

**There is no scope on an edit.** FR-331 and Assumption 19 remove per-occurrence overrides
altogether: an edit is an edit of the task, for every assignee, so Phase 2's three-way edit scope,
its `event_exceptions` override payload and its `split_event_series` function have **no analogue
here**. Scopes exist on `deleteTask` only, with the reference's own asymmetry (FR-347).

**There is no resolve RPC.** With the Completed Date cursor derived from the resolution chain rather
than stored (`data-model.md`, "Reconciling the two research lanes"), complete, skip and undo are one
statement each; FR-370's single-claim rule is the occurrence key's unique index and FR-344's refusal
is the chain's foreign key. The half-state that earned Phase 2's split its function does not arise.

---

## Guards: this phase's permissions depend on the record, for the first time

FR-389 splits the verbs, and FR-351 makes one of them record-dependent — the first rule in this app
whose answer is not settled by the actor's role alone (Assumption 3, listed in the spec's own
Dependencies as work rather than inheritance).

| Verb | Guard | Requirement |
|---|---|---|
| `createTask`, `updateTask`, `deleteTask` | `requireParent()` | FR-389, US2-15, SC-304 |
| `createTaskBoxItem`, `updateTaskBoxItem`, `deleteTaskBoxItem` | `requireParent()` | FR-389 ("managing Task Box templates") |
| `completeTaskOccurrence`, `skipTaskOccurrence`, `unresolveTaskOccurrence` | `requireVerifiedActor()` **+ the FR-351 ownership rule** | FR-350, FR-351, FR-388 |
| `moveRoutine` | `requireVerifiedActor()` **+ the FR-351 ownership rule** | FR-310, FR-389 ("reordering routines within one's own column") |
| Column order (FR-309) | *Phase 1's `reorderCategories`, already `requireParent()`* | no new action |
| **Show on Tasks tab** (FR-313) | *Phase 1's `updateCategory`, already `requireParent()`* | no new action |

```ts
const actor = await requireVerifiedActor();   // NOT_AUTHENTICATED | NOT_A_MEMBER | NO_ACTOR
// …then, for a resolution verb only:
if (actor.role !== "parent" && !ownsOccurrence(actor, task, occurrence)) {
  throw new ActionFailure("FORBIDDEN", `That's ${owner.label}'s task — only ${owner.label} or a parent can do it.`);
}
```

**`requireVerifiedActor()` is new, and it is a change to a shipped Phase 1 module.** Today
`requireActor()` trusts the *cookie's* role and `requireParent()` re-reads the profile row before
deciding. FR-351 needs the fresh database role on a path that is **not** parent-only, so the
row-reading half of `requireParent` is extracted: `requireVerifiedActor()` re-reads the actor's
profile (clearing the cookie and throwing `NO_ACTOR` if it has vanished or is not a profile) and
returns the actor carrying the database `role`; `requireParent()` is refactored onto it and throws
`FORBIDDEN` when that role is not `parent`. A parent demoted on another device loses the power
immediately on both paths, which is the shipped guarantee, now extended to the resolution verbs.

**The FR-351 ownership rule**, stated once and implemented once (`ownsOccurrence`, pure, in
`lib/family/permissions.ts`):

- a **parent** may resolve anything and credit a claim to anyone;
- a **member** may resolve an occurrence whose chain owner (`assigneeId`) is their own profile, and
  may claim an unclaimed up-for-grabs occurrence **only crediting themselves** (US3-13);
- a refused tap stores nothing, changes nothing, and returns `FORBIDDEN` with a message naming whose
  task it is and that a parent may do it (FR-351).

`permissions.can()` gains the task operations and, for the first time, a conditional member rule, so
`PermissionContext` gains the target. It is used **for affordance only** — which actions the details
sheet offers — and never as the gate: FR-350 requires the server to enforce, "rather than by hiding
controls", so the completion circle is always rendered and always tappable and the client never
pre-refuses.

**Attribution** (FR-330, FR-354, Assumption 3):

| Column | Value |
|---|---|
| `tasks.created_by` / `updated_by`, `task_box_items.created_by` / `updated_by` | `actor.profileId` — the punch-in, never anything in the payload |
| `task_resolutions.created_by` | `actor.profileId` — *who did it* |
| `task_resolutions.category_id` | the **credited** Profile — the chain's assignee, or the claimed profile for an up-for-grabs occurrence. May differ from `created_by`: "Ana ticked Cleo's homework" is a fact the record keeps |
| `task_resolutions.assignee_id` | the chain **owner** — the assignee, or `null` for an up-for-grabs task's household chain |
| `tasks.updated_by` on a resolution | **untouched.** `updated_at`/`updated_by` keep meaning "a parent changed this task", which is what the delete and edit surfaces read |

Every admin-client write is scoped `.eq('household_id', householdId)` — with the service role there
is no RLS, so that clause is the tenancy check (FR-390). Every successful write re-mints the actor
cookie (`touchActor()`, the Phase 1 idle model), and the client wraps every call in `withActor(...)`,
which is what produces the punch-in **at the moment of the tap** when nobody is punched in (FR-350,
US1-3) and sweeps the query cache on success.

---

## Shared result shape

`ActionResult<T>` and the `ActionError` enum are **unchanged from Phase 1** — no new codes, the same
finding Phase 2 recorded. Phase 3 maps its new situations onto the existing ones (table at the end);
most notably FR-370's lost claim and FR-344's refused undo are both `CONFLICT` with an overridden
`message`, and a device that is offline never reaches an action at all — the client surfaces the
failed call as the `UNAVAILABLE` message and writes nothing (FR-393).

---

## Shared input shapes

```ts
type TimeOfDay = 'morning' | 'afternoon' | 'evening';       // FR-302, FR-335

type TaskScope = 'this' | 'this_and_future' | 'all';        // FR-347 — DELETE ONLY

type TaskRepeatChoice =                                     // FR-334, FR-339–FR-346
  | { kind: 'never' }
  | { kind: 'daily';   interval: number; until?: string | null }
  | { kind: 'weekly';  interval: number; weekdays: Weekday[]; until?: string | null }
  | { kind: 'monthly'; interval: number; until?: string | null }        // chores only (FR-334)
  | { kind: 'after_completion'; amount: number; unit: 'day' | 'week' | 'month';
      until?: string | null };                                          // FR-342 — not a rule

type TaskOccurrenceKey = {
  taskId: string
  assigneeId: string | null      // the CHAIN OWNER; null = an up-for-grabs task's household chain
  occurrenceDate: string | null  // 'YYYY-MM-DD' household-local; null = an Anytime chore (FR-328)
  slot: TimeOfDay | null         // routines only (FR-335)
  cyclePrev?: string | null      // Completed Date only: the resolution id this cycle follows
};
```

**Clients never send an rrule string**, exactly as in Phase 2. The form submits `TaskRepeatChoice`;
`ruleFromTaskChoice` in the tasks action maps it onto the one shared emitter
(`lib/family/recurrence/grammar.ts`), the sole producer of rule text, writing the canonical grammar
— fixed field order `FREQ;INTERVAL;UNTIL;WKST` (weekly only) then `BYDAY`/`BYMONTHDAY`, `UNTIL`
always in the **date** form `YYYYMMDD` for tasks (the occurrence key is a date and the task expander
walks local dates, so the instant form would encode a precision no task read ever uses), and
`WKST` **required** on `FREQ=WEEKLY` with `INTERVAL > 1`, without which a stored rule's week parity
is ambiguous. `{ kind: 'after_completion' }` is not a rule at all: it writes
`renew_after_amount` / `renew_after_unit` / `renew_until` and leaves `rrule` null.

**The calendar's contract does not widen.** `lib/family/types.ts`'s existing `RepeatChoice` and
`validation.ts`'s `repeatChoiceSchema` are left exactly as they are — a `strictObject` with no
`interval` key — so an event client sending `interval: 2` is still refused at the boundary. A test
asserts that non-widening rather than trusting it. `ruleFromChoice` in `actions/events.ts` passes
`interval: 1` explicitly at each of its construction sites, which `tsc` enumerates the moment
`RecurrenceRule.interval` becomes required. The two mapping functions are deliberately **not**
merged: they take different unions, apply different constraints (routines refuse monthly and
`after_completion`; events refuse `interval > 1`; tasks derive `BYMONTHDAY` from `starts_on` where
events derive it from `start_date`), and the shared part — `emitRule` — is already shared.

**Zod rules** (all refusals carry `fieldErrors` against the named field, FR-330's form preserving
the rest of the entry):

| Rule | Refusal |
|---|---|
| `summary` 1–120 trimmed, required (FR-319) | `VALIDATION` on `summary` |
| `description` ≤ 2000; `emoji` ≤ 16 chars, one grapheme cluster | `VALIDATION` on the field |
| `assigneeIds` non-empty **unless** `upForGrabs` (FR-322, US2-5); all in the household; all `is_profile` (FR-323, US2-6); no duplicates | `VALIDATION` / `NOT_FOUND` |
| `upForGrabs` ⇒ `assigneeIds` empty **and** `routine === false` (FR-338, FR-365) | `VALIDATION` |
| `trackHabit` ⇒ `routine === true` (FR-337) | `VALIDATION` |
| routine ⇒ `timesOfDay` non-empty, deduplicated, canonically ordered (FR-333, FR-335, US2-7) | `VALIDATION` on `timesOfDay` |
| routine ⇒ no `dueTime`, a `startsOn`, and `repeat.kind ∈ { daily, weekly }` (FR-333, FR-334, Assumption 26) | `VALIDATION` |
| chore ⇒ `timesOfDay` empty; `dueTime` requires `startsOn` (FR-325); `dueTime` is a wall clock `HH:MM` in the household zone, never an instant (FR-326) | `VALIDATION` |
| `repeat.interval` a whole number **1–99** (FR-345, Assumption 14) | `VALIDATION` |
| `weekly` ⇒ `weekdays` non-empty, no duplicates | `VALIDATION` |
| `monthly` ⇒ BYMONTHDAY is derived from `startsOn`, never sent | (not accepted) |
| any repeat ⇒ `startsOn` present (FR-328: an Anytime chore cannot repeat) | `VALIDATION` |
| `after_completion` ⇒ `amount` 0–99 (`0` **is** "Immediately"), `unit` set, `routine === false`, `startsOn` present (the chain needs a seed) | `VALIDATION` |
| `until` ≥ `startsOn`, compared as household-zone local dates (FR-346) | `VALIDATION` |
| no count-of-occurrences limit is accepted in either mode (FR-346) | (not accepted) |

---

## Tasks

### `createTask(input: TaskInput): ActionResult<Task>`

**Guard**: `requireParent()` (FR-389).

```ts
type TaskInput = {
  summary: string
  description?: string | null
  emoji?: string | null
  routine: boolean                 // FR-317 — the one discriminator
  assigneeIds: string[]            // Profiles only, in that column's routine order; [] iff upForGrabs
  upForGrabs?: boolean             // chores only (FR-365)
  trackHabit?: boolean             // routines only (FR-337)
  startsOn?: string | null         // 'YYYY-MM-DD'; null on an Anytime chore (FR-325/328)
  dueTime?: string | null          // 'HH:MM' household wall clock; chores only (FR-326/327)
  timesOfDay?: TimeOfDay[]         // routines only (FR-335)
  repeat: TaskRepeatChoice
  saveToTaskBox?: boolean          // FR-379
}
```

Writes one `family.tasks` row (the rrule or the `renew_after_*` triple emitted server-side,
`reward_points` untouched at its default null — FR-329, SC-319) and one `family.task_assignees` row
per assignee, `sort_order` from `nextSortOrder` on that Profile's existing routines (Phase 1's
fractional helper, FR-310). `created_by = updated_by = actor.profileId`. When `saveToTaskBox` is
true it also inserts the template — title, emoji and type, nothing else (FR-379, FR-377) — in the
same action; a failure there does not fail the task, and the action returns the task either way.

Returns the created `Task` for the form's benefit; the board itself updates via invalidation.

The four chore sub-types are **not** a field (FR-325): Timed is `startsOn` + `dueTime`, All-day is
`startsOn` alone, Anytime is neither (and, by `task_repeat_needs_an_anchor`, cannot repeat), and
Late is never written at all — it is a property of an unresolved occurrence at read time.

### `updateTask(input: UpdateTaskInput): ActionResult<Task>`

**Guard**: `requireParent()` (FR-389).

```ts
type UpdateTaskInput = {
  id: string
  patch: Partial<Omit<TaskInput, 'saveToTaskBox'>>   // "Save to task box" is a create-time choice
}
```

1. The task is re-read through the admin client, scoped to the household → `NOT_FOUND` if missing
   (FR-393's "another device deleted it": the client shows the message and closes the form rather
   than recreating it).
2. **No scope is accepted, ever** (FR-331). A `scope` or an occurrence key in the payload is
   `VALIDATION`. Every edit applies to the whole task and reaches every assignee (FR-324).
3. The **merged** shape is validated, not the patch: switching `routine` to `true` requires the
   target type's own fields — a repeat, weekdays and at least one time of day — before it will save
   (FR-318, US2-8), and switching it to `false` requires the chore fields and clears `timesOfDay`
   and `trackHabit`.
4. `assigneeIds` present rewrites the link set wholesale, preserving the `sort_order` of assignees
   that survive and appending new ones. Turning `upForGrabs` on **clears the assignees in the same
   action, first** — the 017 trigger refuses the flip otherwise, and that ordering is the contract.
5. **No edit is ever refused because the task carries resolutions, and none deletes one** (FR-332).
   A changed due date, repeat, interval, end date or type can strand a resolution on a date or a slot
   the task no longer produces; the row is kept and simply not surfaced, which is what deriving
   occurrences does for free.
6. `updated_by = actor.profileId`.

**Two edits worth naming in the form's own copy**, because the behaviour is right but not obvious:
changing a Completed Date chore's delay mid-cycle moves the open occurrence on the next read (it has
no stored identity to move, and it may land in the past, which is what "three days after it was last
done" means); and changing `startsOn` after that chain has run does **nothing**, because the seed is
consulted only while a chain has no tail — the field should say so, or be labelled as the *first*
due date once resolutions exist, rather than silently accepting an edit that has no effect.

### `deleteTask(input: DeleteTaskInput): ActionResult<null>`

**Guard**: `requireParent()` (FR-389).

```ts
type DeleteTaskInput = {
  id: string
  confirm: boolean                     // must be true — FR-258's deleteCategory precedent
  scope?: TaskScope                    // required iff the task repeats; forbidden on a one-off
  occurrenceKey?: TaskOccurrenceKey    // required for 'this' and 'this_and_future'
}
```

`confirm !== true` → `VALIDATION`. A missing scope on a repeating task is `VALIDATION` (the server
never guesses a scope). `scope: 'this'` **on a routine** is `VALIDATION` — FR-347's verified
asymmetry: a routine's single occurrence is removed with **Skip** (FR-359), which is the same record
a "this occurrence" delete writes anyway (FR-364). An `occurrenceKey` the shared expander does not
produce is `NOT_FOUND`, so a stale client cannot delete a phantom.

| Case | What is written |
|---|---|
| One-off / Anytime chore | delete the `tasks` row; assignees and resolutions cascade |
| `this` (repeating chore only) | a **skip** row on that occurrence — the identical write to `skipTaskOccurrence`, one code path (FR-364). On a **Completed Date** chore this *advances* the cycle by the configured delay (FR-362), so the next one arrives in a fortnight rather than never; the confirmation copy must say so, because the alternative reading — a single delete killing the chore for ever — is the one a parent will assume |
| `this_and_future` | **rule mode**: re-emit the rule with `UNTIL` = the cut − 1 day, through the one emitter. **Cursor mode**: `renew_until` = the open occurrence's date − 1 day, which suppresses it and everything after it. Either way every earlier occurrence and every stored resolution survives (FR-347). On the series' **first** occurrence the scope is promoted to `all` and the `tasks` row is deleted — there is nothing earlier to keep, and an empty leading segment is the thing Phase 2's FR-241 exists to prevent. Truncating instead would set `UNTIL` to the day before `starts_on`, leaving a live row that generates nothing, still appears in the Task list surfaces and still counts against FR-391's assignee arithmetic — a ghost only a parent editing it can clear (delivered by T052; asserted by T048) |
| `all` | delete the `tasks` row — assignees and resolutions cascade, so no skip ghost can outlive it |

**There is no split.** Phase 2 needed `split_event_series` because a `this_and_future` edit had to
re-home per-occurrence overrides onto a new series row atomically. Tasks have no per-occurrence
overrides (FR-331) and `this_and_future` is a *delete* only, so truncating is a single UPDATE and no
function is required.

### `moveRoutine(input): ActionResult<null>`

**Guard**: `requireVerifiedActor()` + the FR-351 ownership rule (a member may reorder only within
their own column — FR-389).

```ts
type MoveRoutineInput = {
  taskId: string
  profileId: string                 // whose column — the row being reordered
  previousTaskId: string | null     // the routine above the drop, within the same section
  nextTaskId: string | null         // the routine below it
}
```

Writes **one** `family.task_assignees.sort_order`, from Phase 1's `sortOrderBetween`, rebalancing
the Profile's set only when `needsRebalance` says so. Refuses, with `VALIDATION`, a move whose
neighbours are not routines of the same Profile in the same section, and refuses any move of a
**chore** outright — FR-311 forbids reordering chores at all, and their order is a fixed rule of the
read, not stored state.

**FR-309's column reorder is not a new action**: it is Phase 1's `reorderCategories`, already
`requireParent()`, which already satisfies FR-389's restriction. Only the drag surface on the Tasks
tab is new work — and it carries two consequences the caller must handle, because the shipped action
takes the **complete** ordered id list of every household category and rebalances all of them
`[code: lib/family/actions/categories.ts:226]`. First, there is **one household order, not a per-tab
one**: dragging a Tasks column also reorders the calendar's profile chip row and the settings list
(FR-309). Second, the Tasks board renders a **filtered subset** — Labels never appear, a Profile with
**Show on Tasks tab** off is absent (FR-313), and per-device hidden profiles are absent (FR-383) — so
the drag handler must splice the moved profile within the visible subsequence and then re-emit the
**full** household order, preserving the relative position of every id the board does not render.
Getting that reconstruction wrong silently reorders or drops Labels.

---

## Resolutions

The three verbs share one input, one guard rule, and one refusal path. The occurrence is validated
by the **same** `expandTaskDay` module the browser renders from — one name and one signature,
`expandTaskDay(tasks, resolutions, cursors, { displayedDate, todayDate, zone })`, fixed in
`research.md` R315, because the identity of that module is the property this contract rests on, so client and server cannot
disagree about what an occurrence is; `cyclePrev` is sent by the client, checked against
`family.task_cursors`, and finally arbitrated by the occurrence key's unique index — a device that
still believes cycle *n* is open sends *n*'s id, which cycle *n+1* already occupies, and collides
rather than forking the chain.

`resolvedOn` is always **the household-local date of the write**, taken server-side from
`household_settings.timezone` — never from the client, and never the occurrence's own date. That is
FR-354's whole point: a chore due Tuesday and ticked Friday is recorded on **Friday**, Friday's count
includes it, and Tuesday still shows it completed-late (SC-308).

### `completeTaskOccurrence(input): ActionResult<TaskResolution>`

**Guard**: `requireVerifiedActor()` + ownership (FR-350, FR-351).

```ts
type CompleteOccurrenceInput = {
  occurrence: TaskOccurrenceKey
  creditProfileId?: string       // REQUIRED iff the task is up for grabs; forbidden otherwise
};
```

`creditProfileId` missing on an up-for-grabs occurrence is `VALIDATION` — a claim can never be
anonymous (FR-368) — and present on an assigned task is `VALIDATION`, because the credit *is* the
assignee. A member naming anyone but themselves is `FORBIDDEN` (US3-13). Inserts one
`family.task_resolutions` row: `status = 'complete'`, `category_id = creditProfileId ?? assigneeId`,
`created_by = actor.profileId`, `resolved_on` as above. **This is the claim path** (FR-367): a
claimed occurrence leaves the Up for Grabs column and appears completed in that Profile's column
because that is what the stored credit makes the expander render — nothing moves and nothing is
reassigned.

Then, for a routine with `track_habit`, the streak checkpoint on that assignee's join row
(FR-371/373): advance `streak_count` when every one of that routine's occurrences for that person on
that day is now complete, and advance `streak_through` to the day either way.

A duplicate key (`23505`) is `CONFLICT`: the action re-reads the winning row and overrides the
message with the credited Profile's name (FR-370). Two devices claiming in the same second reach
exactly one recorded claim and one refusal that names who got there first (SC-311); an ordinary
double-tap takes the identical path and simply reports the state.

### `skipTaskOccurrence(input): ActionResult<TaskResolution>`

**Guard**: `requireVerifiedActor()` + ownership.

Same input, without `creditProfileId`. Refused with `VALIDATION` on a one-off chore — Skip exists for
routines and repeating chores only (FR-359), enforced again by the insert trigger. Inserts
`status = 'skipped'` with `resolved_on` set, and `category_id` = the assignee, or **null** for an
unclaimed up-for-grabs occurrence, which is skipped for the whole household because it belongs to
nobody (FR-363, FR-368, US3-12).

Three consequences the write gets for free, and one it must do: a skipped occurrence leaves the day's
total and the ring, because the counters are computed over unresolved-plus-completed and this row is
neither (FR-360, SC-309); a Completed Date chore's cycle advances from the **skip** date by the
configured delay, because the chain tail moved (FR-362, US3-8); the skip is per occurrence and per
assignee, because the chain owner is in the key (FR-363). The one deliberate write is
`streak_through` advancing while `streak_count` holds — a skip protects a streak without advancing it
(FR-373, US4-7), and a stored counter cannot express that without the date.

### `unresolveTaskOccurrence(input): ActionResult<null>`

**Guard**: `requireVerifiedActor()` + ownership.

Takes the same `TaskOccurrenceKey`, looks the row up under it, and **deletes** it — FR-355 ("removing
the resolution rather than marking it") and FR-361's Unskip are the same write, and this one action
serves both. The card returns to the 40 % tint and the column's ring and count go back by one
(US1-7); an undone up-for-grabs completion returns to the Up for Grabs column belonging to nobody
(FR-369), because the credit was the row.

`23503` from the chain's foreign key is `CONFLICT` with FR-344's message: the occurrence this
completion scheduled has itself been resolved, and withdrawing it would destroy a real record. That
refusal is a foreign key rather than a read-then-delete, so a concurrent completion of the next cycle
cannot slip between the check and the write. **It reads onto unskip as well as un-complete** — the
spec states the refusal only for completions, but a skip advances the cycle exactly as a completion
does, so the hazard is identical and the constraint does not care which status it is protecting.

Then FR-374's recompute: the streak checkpoint for that routine and that assignee is recomputed from
the stored resolutions, so the badge always describes records rather than a counter nobody can audit
(SC-312).

---

## The Task Box

### `createTaskBoxItem(input): ActionResult<TaskBoxItem>` · `updateTaskBoxItem(input): ActionResult<TaskBoxItem>` · `deleteTaskBoxItem(input): ActionResult<null>`

**Guard**: `requireParent()` on all three (FR-389).

```ts
type TaskBoxItemInput  = { summary: string; emoji?: string | null; routine: boolean };  // FR-377
type UpdateTaskBoxItem = { id: string; patch: Partial<TaskBoxItemInput> };              // FR-380
type DeleteTaskBoxItem = { id: string; confirm: boolean };                              // FR-381
```

Exactly three fields, on create and on edit. **No star value is accepted, returned or shown** — the
column exists and nothing reads it (FR-329, FR-380, SC-319), and the template edit form offers three
fields, which is one of the things SC-319's audit checks.

`deleteTaskBoxItem` requires `confirm: true` (`VALIDATION` otherwise) behind a warning that the
deletion cannot be undone, and **tasks already created from the template are untouched** (FR-381) —
structurally, because no column anywhere references a template: `createTask` copies three values and
keeps no link.

**Adding *from* a template is not an action** (FR-378): choosing one opens the ordinary create form
pre-filled with its title, emoji and type, with assignment and scheduling empty and still required,
and the save is `createTask` like any other (SC-318). **Saving *to* the box is a flag on
`createTask`** (FR-379), not a separate call, so US4-14 is one save.

The seventeen seeded templates are not written by any action: `family.seed_task_box()` runs in
migration 020 when a household is set up (FR-382, Assumption 23), and they are the household's own
copies from the first day — editable and deletable through the three actions above.

---

## Amendment to a Phase 1 surface: the Profile delete dialog (FR-391)

Phase 2 already amended this dialog once, to show how many events a category's deletion affects.
Phase 3 amends it a **second** time, and makes it carry two opposite promises at once (Assumption 24,
SC-317).

**The counts are reads, and reads do not go through actions.** `fetchCategoryTaskCounts` in
`lib/family/queries.ts`, over the RLS read path served by `task_assignees_category_idx`, returns
both numbers the dialog must state:

- **losing an assignee** — tasks this Profile is assigned to that have at least one other assignee;
- **deleted outright** — tasks whose only assignee is this Profile.

Cached under `familyKeys.categoryTaskCounts(hid, categoryId)`, beside Phase 2's
`categoryEventCount`. The copy must say both promises in the same breath, because they are opposite
and an operator will notice: **no event is destroyed by deleting a category** (002 FR-274), while a
**task left with nobody to do it is deleted with the Profile** — a chore becomes up-for-grabs by an
explicit choice, never by attrition.

**`deleteCategory` itself gains one statement.** After the category delete — whose cascades take the
assignments and that Profile's own resolution chains (`assignee_id`, `on delete cascade`) — the
action deletes the tasks it computed as orphaned, by id, scoped to the household. Up-for-grabs tasks
are excluded by construction: they legitimately have no assignee. A crash between the two statements
leaves a task with no assignee on nobody's board — retained, not lost, repairable by re-running the
cleanup, and recorded in `data-model.md` as the phase's one accepted residual rather than hidden.

**One refinement of FR-391 the plan must state**: "that Profile's own resolutions" is read as *the
rows on that Profile's own chains*, which the `assignee_id` cascade removes. A past **claim** of an
up-for-grabs chore keeps its row and loses only its credit (`on delete set null (category_id)`),
because deleting it would unlink the middle of the household's chain, rewind the cursor and resurrect
a settled occurrence. That is the one way a stored completion can end up crediting nobody, and it is
the reason FR-368's rule lives in an INSERT trigger rather than a table CHECK.

**Two other shipped surfaces need no action change at all**: `reorderCategories` (FR-309) and
`updateCategory`'s `show_on_tasks` (FR-313) are already `requireParent()`. What FR-313 adds is a
*read* rule — a Profile with the switch off is withdrawn from the assignment picker and its column
disappears for every device — with its existing tasks and history untouched, and it stays a different
thing from the per-device filter set (FR-383/384), which changes nothing stored and never leaves the
device.

---

## Database functions (delta)

Same discipline as Phases 1 and 2: `SECURITY DEFINER`, `search_path = ''`, revoked from `public`,
callable only by the roles listed. The policy suite asserts the combined inventory exactly.

| Function | Kind | Callable by | Purpose |
|---|---|---|---|
| `family.assert_task_assignee()` | trigger | nobody | FR-323 (a Label may never be assigned) and FR-365 (no assignee on an up-for-grabs task) |
| `family.assert_up_for_grabs_is_unassigned()` | trigger | nobody | the other direction of FR-365 — a task cannot become up-for-grabs while somebody is assigned |
| `family.assert_task_resolution()` | trigger (**INSERT only**) | nobody | FR-359, FR-363, FR-368, and the chain's shape. INSERT-only is what makes FR-332 true: no task edit can ever re-evaluate a stored resolution |
| `family.seed_task_box(uuid)` | function | `service_role` | FR-382's seventeen templates, idempotent by emptiness so FR-381's permanent deletion is not undone |

**No function is on the write path.** The two resolution RPCs an earlier draft proposed are not
needed once the Completed Date cursor is derived rather than stored: complete and skip are one
INSERT, undo is one DELETE, FR-370 is the unique index and FR-344 is the chain's foreign key. The one
companion write that remains — the streak checkpoint — has a half-state (a stale badge) that FR-374's
recompute already heals, which is Phase 1's documented non-atomic-action posture and not Phase 2's
data-loss bar.

---

## Read path (not an action)

Phase 1's read contract extends unchanged in kind: the browser queries Supabase directly with the
publishable key under RLS, explicit column lists (`TASK_COLUMNS`, `TASK_ASSIGNEE_COLUMNS`,
`TASK_RESOLUTION_COLUMNS`, `TASK_CURSOR_COLUMNS`, `TASK_BOX_COLUMNS` join `rows.ts`), explicit
`.eq('household_id', …)` even under RLS. **Anyone at a signed-in device reads the whole board with no
punch-in and no prompt** (FR-387, US1-9); **writes require an actor** — the Phase 1 asymmetry, now
covering four more tables and one view.

**Four cached reads plus one lazy one**, every key under the `["family"]` prefix so Phase 1's bare
`invalidateQueries({ queryKey: familyKeys.all })` — used by both `useFamilyRealtime` and
`withActor`'s success path — sweeps them all with **zero new machinery**:

| Query | Key | Window |
|---|---|---|
| `fetchTasks` — every task row, `task_assignees` (with the streak pair) embedded | `familyKeys.tasks(hid)` | none |
| `fetchTaskResolutions` — the anchored **week** containing the displayed day, plus every `occurrence_date is null` row | `familyKeys.taskWeek(hid, weekStartISO)` | one week |
| `fetchTaskCarryForward` — `[today − 28, weekStart(today) − 1]`, one day wider than the render bound (see the carry pass below), `enabled` only while the displayed day **is** today | `familyKeys.taskCarry(hid, todayISO)` | the FR-357 tail |
| `fetchTaskCursors` — `family.task_cursors`, the tail of every Completed Date chain | `familyKeys.taskCursors(hid)` | none |
| `fetchTaskBox` — `enabled` only while the sheet is open | `familyKeys.taskBox(hid)` | none |

`app/family/(app)/tasks/page.tsx` is a server component that fetches the first four with the server
client under RLS and seeds each as `initialData` **for its own key only**, so the wall tablet's first
paint is the board with no loading state — the shipped `calendar/page.tsx` pattern. Adjacent weeks
are prefetched when the anchor settles.

**What the browser derives**, in one pure, non-bypassable module (`lib/family/tasks/expand.ts`, the
same entry point the resolve and delete actions call to validate an occurrence key):

- **rule-mode occurrences** — routines and Scheduled Date chores — from `rrule` through the shared
  `ruleDatesIn()`, in the household's timezone with Phase 2's DST gap/fold rules unchanged (FR-326,
  SC-313), cross-producted with `times_of_day` so a routine in two slots contributes two separately
  completable occurrences (FR-335, US2-13);
- **the Completed Date open occurrence** — `tail.resolved_on + delay`, or the seed
  `max(startsOn, chainStartedOn)` when the chain has no tail, suppressed past `renew_until`
  (`lib/family/tasks/cursor.ts`); exactly one per chain, and none at all while `renew_until` has
  passed (FR-343, SC-307);
- **the Anytime chore's single undated occurrence**, present every day until it is completed and
  never late (FR-328);
- **the late carry-forward pass** — a bounded second walk over the past days, run only when the
  displayed day is today, placing each unresolved chore occurrence on today while it keeps its own
  `scheduledDate` as identity and as what the card shows (FR-356/357/358, SC-308). **The bound is a
  strict inequality, not an inclusive range**: an occurrence is carried onto today when
  `todayEpochDay − scheduledEpochDay < CARRY_FORWARD_DAYS` — so at 28, day 27 is carried, **day 28
  is not**, day 29 is not, which is FR-357's own wording ("stop carrying it forward onto today
  **28 days** after its scheduled date") and what the quickstart's `today − 28` fixture pins. The
  equivalent closed range is `[today − (CARRY_FORWARD_DAYS − 1), today − 1]`; it is written as the
  inequality because the range form is what produced an off-by-one between this contract and the
  fixture. `CARRY_FORWARD_DAYS = 28` lives once, in `lib/family/tasks/dates.ts`, consumed by both the
  carry read's window and this pass, so there is one number and it cannot drift — the **read** window
  is deliberately one day wider (`[today − 28, weekStart(today) − 1]`), because the pass must see
  that the day-28 occurrence is resolved before it declines to carry it (R316, data-model §"How the
  board is read");
  **The pass skips the bound for an occurrence whose task has `renew_after_amount is not null`** — the
  Completed Date open occurrence, which arrives through the unwindowed cursor read rather than the
  carry window. That mode has at most one open occurrence and cannot accumulate, and the occurrence
  *is* the cursor: bounded literally, a chore neglected 28 days would be on no reachable screen,
  nothing could resolve it, and no next occurrence could ever be scheduled (FR-343 vs FR-357, resolved
  in `research.md` R316). Rule-mode chores keep the bound exactly as FR-357 states it;
- **the counters** — each column's ring and completed-of-total — computed in a memo that branches
  **above** every display filter and the search, which is what makes FR-384's "filters never move the
  counters" a property of the graph rather than a rule someone must remember (SC-310, SC-320);
- **the four sub-types and the sections** — Timed, All-day, Anytime, Late (FR-325) and the fixed chore
  order of FR-311 — none of which is stored.

**One consequence Phase 2 does not have**: a resolution changes what is on *future* days, because
completing today's Completed Date occurrence creates tomorrow's. The bare `["family"]` invalidation
already covers it, but it is now **load-bearing** rather than merely convenient, and narrowing it
later would break this mode first.

**Live updates (FR-392, SC-306)**: `tasks`, `task_assignees`, `task_resolutions` and
`task_box_items` join the existing `family:${householdId}` channel in `useFamilyRealtime.ts`,
**without** the server-side `household_id` filter — with default replica identity a DELETE payload
carries only primary-key columns, so a filtered subscription would silently never fire on deletes,
and **this phase deletes on the hot path** (an un-complete and an unskip each remove a row). Every
payload, all three operations, is a bare invalidation signal: *something changed, re-read*. No payload
is ever rendered — a deleted task's title is protected data — INSERT/UPDATE payloads remain
RLS-checked, and the re-read goes through the RLS-governed queries above. That is what discharges
SC-306's five seconds and SC-311's "both screens agreeing", with no `CONFLICT` merge and no dialog:
the losing device simply refetches the newer truth.

**No optimistic cache write exists anywhere** (FR-393): the circle shows a busy state for one
sub-second round trip and then paints from the refetch. Nothing is shown as done that is not stored,
nothing is queued offline, and the two things a hand-patched cache would get wrong — the chain's next
occurrence and the streak counter — both move server-side on the same write.

---

## Error-handling contract (delta)

Phase 1's and Phase 2's tables stand; these rows are added or made specific. **No new `ActionError`
member.**

| Situation | Behaviour |
|---|---|
| Any write with nobody punched in — including a request that bypasses the interface | `NO_ACTOR`; the client opens the punch-in sheet at the moment of the tap and retries once on success. Nothing is written (FR-350, SC-303); a dismissed sheet leaves the card untouched |
| A member creating, editing or deleting a task, or touching a template | `FORBIDDEN` (FR-389, US2-15) |
| A member resolving another Profile's occurrence, or claiming an up-for-grabs one for somebody else | `FORBIDDEN`, with the message overridden to name whose task it is and that a parent may do it (FR-351, US1-5, US3-13, SC-304) |
| A completion or claim of an up-for-grabs occurrence with no credited Profile | `VALIDATION` — never anonymous (FR-368) |
| `creditProfileId` sent for an assigned task | `VALIDATION` — the credit is the assignee |
| Skip attempted on a one-off chore | `VALIDATION` (FR-359); the trigger refuses it again |
| Scope missing on a repeating task's delete, present on a one-off, or `this` on a routine | `VALIDATION` (FR-347; the server never infers a scope) |
| A scope or occurrence key sent to `updateTask` | `VALIDATION` (FR-331 — tasks have no per-occurrence overrides) |
| An occurrence key the shared expander does not produce | `NOT_FOUND` — validated by the module the browser renders from, so a stale client cannot resolve or delete a phantom |
| Task or resolution deleted by another device before the write | `NOT_FOUND`; the details sheet closes rather than recreating it (FR-393) |
| Two devices claim the same up-for-grabs occurrence in the same second | `23505` → `CONFLICT`, message naming the credited Profile; exactly one row exists and both screens agree within seconds (FR-370, SC-311) |
| The same occurrence resolved twice (an ordinary double-tap) | the identical path — `CONFLICT` reporting the stored state, never a duplicate row |
| Un-complete or unskip whose scheduled successor has itself been resolved | `23503` → `CONFLICT` with FR-344's message; nothing is deleted |
| Device offline at commit | The action is never reached; the client refuses with the offline message and stores nothing — never queued, never optimistically shown (FR-393) |
| Two devices edit the same task concurrently | Last write wins; no `CONFLICT`, no merge. The loser refetches the newer version within seconds via the realtime signal |
| `deleteTask` or `deleteTaskBoxItem` without `confirm: true` | `VALIDATION` |
| Malformed repeat (interval outside 1–99, empty weekdays, `until` before the start, a routine sent `monthly` or `after_completion`, an Anytime chore sent a repeat) | `VALIDATION` with `fieldErrors` against the field (FR-330); the form's other entries are preserved by the client |
| Database rejects a value the action missed (a slot-set CHECK, the repeat-mode CHECKs, the rrule grammar, an assignee that is a Label, a chain link crossing chains) | `VALIDATION` — the constraint is the second line and its message is never echoed verbatim |
| Id outside the caller's household | `NOT_FOUND` — never `FORBIDDEN`, so nothing confirms the row exists (Phase 1 rule, unchanged) |
| Any other database failure mid-action | `UNAVAILABLE`; logged server-side as a string, never surfaced verbatim |
