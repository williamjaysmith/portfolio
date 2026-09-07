# Contracts — 009 The Calendar's Preview Bar

**Date**: 2026-09-07 · **Plan**: [plan.md](./plan.md)

This phase adds **no new server action** and **no new route handler**. It extends two shipped actions
by one field each, and adds one read. Every contract below is the shipped `ActionResult<T>` shape
through `runAction`, with the shipped punch-in gate.

---

## 1. `updateHouseholdSettings(patch)` — one more field

`lib/family/actions/settings.ts`, unchanged in every other respect.

```ts
// HouseholdSettingsPatch gains:
showCountdowns?: "always" | "three_months" | "one_month";
```

| Property | Contract |
|---|---|
| Actor | a punched-in **parent**. A punched-in member is refused by the server, not merely by a disabled control (`[P1]` FR-015) |
| Validation | the Zod enum above. Any other string is a validation failure with a household-worded message, never a database error surfaced raw |
| Partial | absent means unchanged, as every other field in this patch already behaves |
| Result | `ActionResult<HouseholdSettings>` — the whole settings row back, so the client's cache updates in one place |
| Failure | `FORBIDDEN` for a member, `VALIDATION` for a bad value, `UNAVAILABLE` for a write that could not complete. Never queued (`[P2]` FR-288) |

---

## 2. `createEvent(input)` and `updateEvent(id, patch, scope)` — one more field

`lib/family/actions/events.ts`.

```ts
// EventInput gains, and the patch type gains as optional:
countdownEnabled?: boolean;   // absent === false on create, unchanged on update
```

| Property | Contract |
|---|---|
| Actor | the shipped gate — a punched-in member or parent may write an event, unchanged by this phase |
| Default on create | `false`. `createEvent`'s current comment *"`countdown_enabled` stays at its default (FR-228)"* is replaced by the column, not by another comment |
| Scope on update | the shipped three-way prompt. **The flag is a property of the series** (R910), so a "this event only" edit of a repeat writes the flag to the tail the split produces, exactly as the per-event reminder does; `splitSeries` already passes `event.countdownEnabled` and needs no change |
| Result | `ActionResult<Event>`, unchanged |
| Failure | unchanged, including FR-288's refusal |

**What this must not do**: change what any existing field means, or make an event's save depend on
the countdown flag being present. Every shipped caller that omits it must keep working — which the
optional field and the shipped tests together enforce.

---

## 3. `fetchEventSearch(supabase, householdId, term)` — one new read

`lib/family/queries.ts`, alongside `fetchWeekEvents` and using the same row mapper.

```ts
export async function fetchEventSearch(
  supabase: SupabaseClient,
  householdId: string,
  term: string,
): Promise<Event[]>
```

| Property | Contract |
|---|---|
| Client | the **signed-in session's** client, never the admin client. RLS is the access control, as it is for every read on this tab |
| Match | `ilike '%term%'` on `summary`, with the term's `%`, `_` and `\` escaped before interpolation — a household typing `50%` searches for `50%` |
| Cap | a hard `limit`, so a one-character term cannot pull the whole table to a phone |
| Empty term | the hook is `enabled: false` below a minimum length; the function itself returns `[]` for a blank term rather than matching everything |
| Ordering | by start, soonest first — the shaping into results is `lib/family/calendar/search.ts`'s job, not the query's |
| Returns | `Event[]`, through the shipped mapper, so a result carries `countdownEnabled` and everything else an event carries |

`useEventSearch(householdId, term)` wraps it with the shipped `staleTime`, keyed by
`familyKeys.eventSearch(householdId, normalisedTerm)`.

**Anonymous access**: refused (`42501`), not empty (SC-911). This is the shipped `events` policy and
the policies test asserts it for this path as it does for the others.

---

## 4. What no contract here does

- **No delete, no bulk write.** Nothing in this phase removes anything.
- **No optimistic write.** `[P2]` FR-288 holds unchanged: a write that cannot complete is refused
  where the tap happened.
- **No new punch-in path.** Every write rides a gate that already exists.
- **No server-side task computation.** The progress numbers are derived on the client from cached
  reads (R905); no action returns them.
