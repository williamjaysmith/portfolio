# Contracts: Server Actions & Database Functions — Week Calendar

**Feature**: `002-family-week-calendar` | **Date**: 2026-09-02

What Phase 2 adds to the Phase 1 action surface (`specs/001-family-foundation/contracts/server-actions.md`
remains in force, unamended except where this file says so). Three new actions in
`lib/family/actions/events.ts` — `createEvent`, `updateEvent`, `deleteEvent` — one new database
function, one amendment to a Phase 1 dialog's data needs, and an extended read path. Every action
starts with `"use server"`, returns `Promise<ActionResult<…>>` through `runAction()`, and is
validated with Zod 4 (`lib/family/validation.ts`) before anything reaches the database — the
database constraints of `data-model.md` are the second line, not the first.

**There is no drag action.** A drag commit is `updateEvent` with a scope and new times — a drag is
a fast way to fill in an edit (decided per r-drag §3.3/r-client §5: one write path, one validation
surface, one policies-tier test suite discharges SC-205/SC-206/SC-207 for form and gesture alike).

## Guards: every event write is `requireActor`, none is parent-only

Verified against the spec's Authorization group: FR-270 requires a punched-in actor for every
create, edit, delete and drag commit, enforced by the server; **FR-272 opens event writes to any
punched-in profile, parent or member** — Phase 1 reserves parent-only for profiles, labels, PINs,
roles and household settings, and events are not on that list (Assumption 23). So:

```ts
const { user, householdId } = await requireMember();  // NOT_AUTHENTICATED | NOT_A_MEMBER
const actor = await requireActor();                    // NO_ACTOR — the signed cookie, never the body
// requireParent() is NOT used by any event action.
```

`created_by`/`updated_by` come from `actor.profileId` (FR-271); no action accepts a profile id
from the client to identify the actor. Every admin-client write is scoped
`.eq('household_id', householdId)` — with the service role there is no RLS, so that clause is the
tenancy check. Every successful write re-mints the actor cookie (`touchActor()`, the Phase 1 idle
model), and the client wraps every call in `withActor(...)`, which is what produces punch-in **on
demand at the moment of the write** (FR-248, FR-275) and sweeps the query cache on success.

FR-275 in practice: a drag begun before an idle punch-out still demands a PIN at the drop, because
the server checks the cookie when `updateEvent` runs, not when the block was grabbed; a `NO_ACTOR`
result reopens the punch-in sheet and retries once (Phase 1 error-handling row, unchanged).

## Shared result shape

`ActionResult<T>` and the `ActionError` enum are **unchanged from Phase 1** — no new codes.
Phase 2 maps its new situations onto the existing ones (table at the end); most notably FR-288's
"the event no longer exists" is `NOT_FOUND`, and a device that is offline never reaches an action
at all — the client surfaces the failed call as the `UNAVAILABLE` message and writes nothing.

## Shared input shapes

```ts
type Scope = 'this' | 'this_and_future' | 'all';   // the verified pyskylight enum (FR-237)

type RepeatChoice =                                 // FR-231/232 — the four UI choices
  | { kind: 'never' }
  | { kind: 'daily';   until?: string | null }      // 'YYYY-MM-DD' | null = never ends
  | { kind: 'weekly';  weekdays: Weekday[]; until?: string | null }  // ≥ 1 weekday
  | { kind: 'monthly'; until?: string | null };     // day-of-month derived from the start

type EventTimes =
  | { allDay: false; startsAt: string; endsAt: string }      // ISO instants, endsAt > startsAt
  | { allDay: true;  startDate: string; endDate: string };   // 'YYYY-MM-DD', endDate >= startDate (inclusive)
```

**Clients never send an rrule string.** The form submits `RepeatChoice`; the server action's
emitter (`lib/family/recurrence/grammar.ts`) is the sole producer of rule strings, writing the
canonical grammar — fixed field order `FREQ;INTERVAL=1;UNTIL;WKST` (weekly only) then
`BYDAY`/`BYMONTHDAY`; `UNTIL` as a plain date for all-day series and as the household-zone
end-of-day converted to UTC for timed series; inclusivity enforced by local-date comparison in the
expander. This kills rule-injection and parse-mismatch as a class (r-recurrence §2). Zod rules:

| Rule | Refusal |
|---|---|
| `weekly` ⇒ `weekdays` non-empty, no duplicates | `VALIDATION` |
| `monthly` ⇒ BYMONTHDAY is derived from the start date's day-of-month, never sent | (not accepted) |
| `until` ⇒ ≥ the event's start date, compared as household-zone local dates | `VALIDATION` |
| `timezone` ⇒ in `Intl.supportedValuesOf('timeZone')` (trigger is the backstop) | `VALIDATION` |
| `summary` 1–120 trimmed; `description` ≤ 2000; `location` ≤ 200 | `VALIDATION` on the field |
| times coherent per shape (`endsAt > startsAt`; `endDate >= startDate`) | `VALIDATION` (FR-226) |
| `categoryIds` all in the household, no duplicates; may be empty (FR-213) | `NOT_FOUND` / `VALIDATION` |

---

## Events

### `createEvent(input: EventInput): ActionResult<Event>`

**Guard**: `requireActor()`.

```ts
type EventInput = EventTimes & {
  summary: string
  description?: string | null
  location?: string | null
  timezone: string            // the creating DEVICE's IANA zone — provenance only (FR-224)
  repeat: RepeatChoice
  categoryIds: string[]       // ordered — the stripe draw order (FR-227); may be []
}
```

Writes one `family.events` row (rrule emitted server-side, `countdown_enabled` untouched at its
default — FR-228) and the `event_categories` links with `position` = array index. `created_by` =
`updated_by` = the actor (FR-271 — the punch-in, not the device, and never Cleo just because the
event is *for* Cleo). Returns the created `Event` row for the form's benefit; the grid itself
updates via invalidation.

There is no timezone picker (FR-224): the client fills `timezone` from
`Intl.DateTimeFormat().resolvedOptions().timeZone`. Nothing renders or expands from it — the
household zone (FR-284) does that work — so a wrong value costs nothing this phase.

### `updateEvent(input: UpdateEventInput): ActionResult<{ eventId: string; splitEventId: string | null }>`

**Guard**: `requireActor()`.

```ts
type UpdateEventInput = {
  id: string
  patch: Partial<EventInput>       // timezone is NOT patchable — provenance is written once
  scope?: Scope                    // REQUIRED iff the event has a rule; FORBIDDEN on a one-off (FR-238)
  occurrenceDate?: string          // 'YYYY-MM-DD', the occurrence's ORIGINAL household-local date;
                                   // required for scope 'this' and 'this_and_future'
}
```

Scope machinery, in order:

1. The event is re-read through the admin client, scoped to the household → `NOT_FOUND` if
   missing (this is FR-288's "another device deleted it": the client shows the message and closes
   the form).
2. **One-off** (`rrule` null): `scope`/`occurrenceDate` present → `VALIDATION` (FR-238 — the
   reference's live client answers 400 to exactly this on one-time items). The row is updated in
   place. `patch.repeat` other than `never` is allowed here: it turns the one-off into a series
   (the form's repeat field is just another field).
3. **Repeating**: `scope` absent → `VALIDATION` (the server never guesses a scope; FR-250 says
   the person always chooses). For `this` and `this_and_future`, `occurrenceDate` must name a
   real, unskipped occurrence — the action validates it by running the **same**
   `expandSeries`/`expandWindow` code the browser renders from (one implementation, zero drift)
   → `NOT_FOUND` otherwise.
4. **`scope: 'this'`** (FR-239): the patch may touch only time (`allDay`/`startsAt`/`endsAt`/
   `startDate`/`endDate`), `summary`, `location`, `description`. `categoryIds` present →
   `VALIDATION` (FR-287 — the UI never offers it; the server enforces it). `repeat` present →
   `VALIDATION` (a repeat is a series property). Upserts the `override` exception row keyed by
   `occurrenceDate` (merging onto any existing override). Time is the one part that **replaces**
   rather than merges: when the incoming time override's shape differs from the stored one — an
   FR-251 band↔grid drag at scope `this` on an occurrence already carrying a timed override — the
   action nulls the opposite pair in the same upsert, so the row always satisfies 012's
   `exception_time_shape` CHECK instead of surfacing `VALIDATION` on a legitimate gesture; pinned
   by a scope-test case in the policies tier. The key never changes even when the
   patch moves the occurrence to another date — the read path always finds it (data-model, "How
   the week is read").
5. **`scope: 'this_and_future'`**: if `occurrenceDate` is the series' **first** occurrence, the
   scope is silently promoted to `all` (FR-241 — no split, no empty leading segment). Otherwise
   the action computes the head's truncated rule (`UNTIL` = cut − 1 day), the self-contained tail
   row (the patch applied, start moved to the chosen occurrence, the series' original `UNTIL`
   carried over), and the tail's category set (the patch's `categoryIds` if given, else a copy),
   then calls `family.split_event_series(...)` — **one transaction**, so a truncated head cannot
   exist without its tail. Exceptions dated on or after the cut move to the tail with their date
   keys unchanged. Returns `splitEventId` = the tail's id.
6. **`scope: 'all'`** (FR-242): updates the `events` row in place — the *segment* the id names;
   a series split earlier is two series and this write reaches only one, which the dialog's
   wording states. `categoryIds` in the patch rewrites the link set wholesale in draw order.

Rule/start coherence on a splitting or series-level time change: the emitter re-derives the
rule's anchor parts from the new start — `BYMONTHDAY` from the new start's day-of-month, a weekly
`BYDAY` set shifted by the move's day delta, `UNTIL`'s form switched to match a changed `all_day`
— because a rule that disagrees with its own start date is unexpandable nonsense and the emitter's
invariant (r-recurrence §2.3) is that they never disagree.

**The drag path is this action.** A move is `patch: { startsAt, endsAt }` (or the all-day pair); a
resize is the same with one edge changed; a band↔grid conversion (FR-251) is
`patch: { allDay: true, startDate, endDate }` or `{ allDay: false, startsAt, endsAt }`. The client
sequence is fixed by FR-250/SC-206: scope dialog first (repeat only, same component and wording as
edit), then `withActor` (punch-in only if nobody is punched in), then this action. Dismissing
either step abandons the pipeline with nothing written (FR-249). No optimistic cache write exists
anywhere (FR-288); the drag layer holds a visual pending overlay until the post-invalidation
refetch resolves.

### `deleteEvent(input: DeleteEventInput): ActionResult<null>`

**Guard**: `requireActor()`.

```ts
type DeleteEventInput = {
  id: string
  confirm: boolean                 // must be true — FR-258, the deleteCategory precedent
  scope?: Scope                    // required iff repeating; forbidden on a one-off (FR-238)
  occurrenceDate?: string          // required for 'this' and 'this_and_future'
}
```

`confirm !== true` → `VALIDATION`. Once confirmed the delete is final — no undo, no trash
(FR-258, SC-212). By scope:

| Case | What is written |
|---|---|
| One-off | delete the row; links and exceptions cascade |
| `this` (FR-240) | upsert a `skip` exception on `occurrenceDate` — replacing any override there, which is how US2-19's sibling case (deleting an occurrence that carried a per-occurrence edit) removes the edit with the occurrence |
| `this_and_future` (FR-286) | on the first occurrence: delete the whole series (= FR-241's spirit). Otherwise two ordered statements: **truncate first** (re-emit `UNTIL` = cut − 1 day), then delete exceptions `occurrence_date >= cut`. A failure between them leaves only inert rows the expander never reaches — never a wrong calendar (data-model 012) |
| `all` (FR-243) | delete the `events` row — the segment; exceptions and links cascade, so no skip ghost can outlive it |

Returns `null`: the grid updates via invalidation, and there is nothing to hand back from a
deletion.

---

## Amendment to a Phase 1 surface: the category-delete count (FR-274)

Phase 1's `deleteCategory` action and its cascade are already correct — links vanish, events
survive. What changes is the **confirmation dialog's data**: it must now say how many events are
affected (Assumption 24 treats this as work, not inheritance). No new action: the count is a read,
and reads do not go through actions. The dialog fetches
`event_categories` filtered `household_id` + `category_id` with `count: 'exact', head: true`
through the RLS read path (`fetchCategoryEventCount` in `lib/family/queries.ts`), served by
`event_categories_category_idx`. The action itself is unamended.

---

## Database functions (delta)

Same discipline as Phase 1: `SECURITY DEFINER`, `search_path = ''`, revoked from `public`,
callable only by the roles listed. The policy suite asserts the combined inventory exactly.

| Function | Signature | Callable by | Returns |
|---|---|---|---|
| `family.split_event_series` | `(p_household_id uuid, p_event_id uuid, p_actor uuid, p_head_rrule text, p_cut date, p_tail_event jsonb, p_tail_category_ids uuid[])` | `service_role` | the tail's `uuid`; raises `P0002` when the id is not a series in that household. Locks the head row, so concurrent scope-writes on one series serialise |
| `family.assert_event_timezone` / `family.assert_settings_timezone` | trigger | nobody | validity backstops for the two timezone columns |

The split function applies pre-computed values only — both rrule strings come from the one
TypeScript emitter, so no recurrence logic exists in SQL (data-model 015).

---

## Read path (not an action)

Phase 1's read contract extends unchanged in kind: the browser queries Supabase directly with the
publishable key under RLS, explicit column lists (`EVENT_COLUMNS`, `EVENT_CATEGORY_COLUMNS`,
`EVENT_EXCEPTION_COLUMNS` join `rows.ts`), explicit `.eq('household_id', …)` even under RLS.
Anyone in the family reads the whole week with no punch-in (FR-269); **reads are open within the
household; writes require an actor** — the Phase 1 asymmetry, now covering four more tables.

**One query per anchored week** (`fetchWeekEvents`): the three-branch OR — every series row
(`rrule not null`), plus one-off timed rows overlapping the window, plus one-off all-day rows
overlapping the window — with categories and exceptions embedded. One round trip, no client
padding, no derived search columns (data-model, "How the week is read"). Cached under
`familyKeys.week(householdId, weekStartISO)` = `["family","events",hid,weekStart]` — the anchored
week of FR-289, never the phone slice — so Phase 1's bare `invalidateQueries(["family"])` sweeps
it with zero new machinery. Adjacent weeks are prefetched when the anchor settles; the current
week is server-seeded as `initialData` by the calendar `page.tsx` (the layout.tsx pattern).

**Expansion is client-side and non-bypassable**: the query returns series rows, not occurrences;
`expandWindow(events, window, householdTz)` in `lib/family/calendar/expand.ts` is the single
entry point every renderer uses — and the same module `updateEvent`/`deleteEvent` call to
validate an `occurrenceDate`, so client and server can never disagree about what an occurrence
is. It expands in the household's timezone (FR-234), applies the DST gap/fold rules (FR-235/236)
and the exception set (FR-239/240), and is memoized once per mounted week.

**Live updates (FR-276, Assumption 39)**: the three calendar tables join the existing
`family:${householdId}` channel in `useFamilyRealtime.ts`, **without** the server-side
`household_id` filter — with default replica identity a DELETE payload carries only primary-key
columns, so a filtered subscription would silently never fire on deletes. Every payload, all
three operations, is a bare invalidation signal: "something changed, re-read". No payload is ever
rendered (the Phase 1 comment stands; a deleted event's title is protected data), INSERT/UPDATE
payloads remain RLS-checked, the re-read goes through the RLS-governed window query, and the
household is the project's only tenant. This is what discharges SC-204 (a moved occurrence on a
second device within 5 s, no reload) and the later-write-wins edge case — no CONFLICT code, no
merge, no dialog: the second device simply refetches the newer truth.

---

## Error-handling contract (delta)

Phase 1's table stands; these rows are added or made specific:

| Situation | Behaviour |
|---|---|
| Write attempted with nobody punched in — form save, delete, or drag drop, including a request that bypasses the interface | `NO_ACTOR`; the client opens the punch-in sheet and retries once on success. Nothing is written (SC-205); a dismissed sheet abandons a drag with the block back where it started (FR-249) |
| Scope supplied for a non-repeating event, or missing for a repeating one | `VALIDATION` (FR-238; the server never infers a scope) |
| `categoryIds` or `repeat` in a `scope: 'this'` patch | `VALIDATION` (FR-287, FR-239) |
| `occurrenceDate` that is not a real, unskipped occurrence of that series | `NOT_FOUND` — validated by the shared expander, so a stale client cannot edit a phantom |
| Event deleted by another device before the save | `NOT_FOUND`; the client shows "this event no longer exists" and closes the form without recreating it (FR-288) |
| Device offline at commit | The action is never reached; the client refuses with the offline message and stores nothing — never queued, never optimistically shown (FR-288) |
| Two devices edit the same event concurrently | Last write wins; no `CONFLICT`, no merge. The loser's device refetches the newer version within seconds via the realtime signal |
| `delete` without `confirm: true` | `VALIDATION` (FR-258) |
| Malformed repeat choice (empty weekdays, `until` before start, bad zone) | `VALIDATION` with `fieldErrors` against the field (FR-262); the form's other entries are preserved by the client |
| Database rejects a value the action missed (time-shape CHECK, rrule CHECK, timezone trigger `22023`, exception payload CHECK) | `VALIDATION` — the constraint is the second line and its message is not echoed verbatim |
| Id outside the caller's household | `NOT_FOUND` — never `FORBIDDEN`, so nothing confirms the row exists (Phase 1 rule, unchanged) |
| `split_event_series` raises `P0002` (series vanished between read and lock) | `NOT_FOUND`, same as the deleted-elsewhere row |
| Any other database failure mid-action | `UNAVAILABLE`; logged server-side as a string, never surfaced verbatim. The split is transactional, so a failure leaves the series whole |
