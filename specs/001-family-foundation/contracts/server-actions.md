# Contracts: Server Actions & Database Functions

**Feature**: `001-family-foundation` | **Date**: 2026-08-28

The interfaces Phase 1 exposes. There is no public HTTP API — the app's boundary is its server actions plus two database functions. Every action lives in `lib/family/actions/` and is marked `'use server'`.

## The rule every action follows

Per R1, `proxy.ts` is **not** an authorization boundary — Next.js explicitly warns that a matcher change can silently remove coverage from a server function. So every action begins with the same guard, and none of them trusts the caller:

```ts
// 1. Is there a real Supabase session, and is that account on the allowlist?
const { user, householdId } = await requireMember()      // throws → NOT_A_MEMBER

// 2. Who is punched in? (verified from the signed cookie, never from the body)
const actor = await requireActor()                        // throws → NO_ACTOR

// 3. Are they allowed to do this?
requireParent(actor)                                      // throws → FORBIDDEN
```

`requireActor()` reads and verifies the signed cookie server-side. **No action accepts a profile id from the client to identify the actor** — that would let a child act as a parent by editing a request.

## Shared result shape

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError; message: string }

type ActionError =
  | 'NOT_AUTHENTICATED'   // no Supabase session
  | 'NOT_A_MEMBER'        // signed in, but not on the allowlist
  | 'NO_ACTOR'            // nobody punched in
  | 'FORBIDDEN'           // punched in, but not a parent
  | 'BAD_PIN'
  | 'PIN_LOCKED'
  | 'NO_PIN'              // that profile cannot be an actor
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE'         // database unreachable — never silently succeeds
```

`message` is safe to show a user. Errors are never thrown across the boundary as exceptions, so a failure cannot leak a stack trace into the client.

---

## Punch-in

### `punchIn(profileId: string, pin: string)`

**Guard**: `requireMember()` only — a punch-in is *how* you become an actor.

1. Calls `family.verify_pin(profileId, pin)` via the service role.
2. On success, mints the signed actor token (profile id, role, household id, expiry = now + `punch_out_minutes`) and sets the HTTP-only cookie.
3. On failure, maps the reason: `bad_pin` → `BAD_PIN`, `locked` → `PIN_LOCKED`, `no_pin` → `NO_PIN`, `forbidden`/`not_found` → `NOT_FOUND`.

Returns `{ profileId, label, color, role, expiresAt }`.

**Never** reveals whether a wrong PIN was close, how many attempts remain, or that a profile exists to a non-member.

### `punchOut()`

**Guard**: none beyond a valid session. Clears the cookie. Idempotent — succeeds when nobody is punched in.

### `getActor()`

**Guard**: `requireMember()`. Returns the current actor or `null`. Used by the shell to render the punch-in state; safe to call on every render.

### `extendActor()`

**Guard**: `requireActor()`. Pushes the idle expiry forward. Called after any successful mutation so an active user is not punched out mid-task.

---

## Profiles and Labels

All five require `requireParent()` — FR-015.

### `createCategory(input)`

```ts
{
  label: string             // 1–40 chars, trimmed
  color: PaletteColor       // one of the 20; rejected by the domain otherwise
  isProfile: boolean
  avatar?: { kind: 'illustration'; id: string }   // profiles only
  emoji?: string                                   // labels only
  birthday?: string         // ISO date, profiles only
  dietaryPrefs?: string     // ≤ 280 chars, profiles only
  role?: 'parent' | 'member'                       // profiles only, default 'member'
}
```

Validated with Zod before it reaches the database; the database constraints are the second line, not the first. `sort_order` defaults to the end of the list.

Returns the created category. → `VALIDATION` on a bad shape, off-palette colour, or person-fields on a Label.

### `updateCategory(id, patch)`

Partial `input`. Cannot change `isProfile` — converting a Label to a Profile is a distinct operation and is **out of scope for Phase 1** (the reference product has it; deferred). → `NOT_FOUND` if the id is outside the actor's household.

### `deleteCategory(id)`

Requires `confirm: true` (FR-026). Refuses to delete the **last remaining parent profile** → `CONFLICT`, so the household cannot orphan itself. If the deleted profile is the current actor, the action clears the actor cookie in the same response.

### `reorderCategories(orderedIds: string[])`

Recomputes fractional `sort_order` values. Idempotent.

### `setProfilePin(profileId, pin)`

**Guard**: `requireMember()` only — **deliberately not `requireParent()`**.

This is FR-018 and SC-010, the no-lockout rule. If every profile lacked a PIN, requiring an actor to set one would leave the household permanently read-only. A signed-in account on the allowlist is already proof of family membership, which is sufficient authority to set a PIN.

`pin` must match `^[0-9]{4}$`. Calls `family.set_pin`. Returns `{ ok: true }` — never echoes the PIN or its hash.

---

## Avatar upload

### `uploadAvatar(profileId, file)`

**Guard**: `requireParent()`.

Validates MIME type against `image/jpeg|png|webp` and size ≤ 5 MB **server-side** — the client check is a courtesy, not the control (R7). Stores at `<household_id>/<profileId>.<ext>`, sets `avatar_kind = 'photo'` and `avatar_path`, and removes any previous object for that profile.

→ `VALIDATION` on type or size. On storage failure the profile's existing avatar is left untouched.

---

## Settings

### `updateHouseholdSettings(patch)`

**Guard**: `requireParent()`. Accepts `displayName`, `showNameNotDate`, `timeFormat`, `startWeekOn`, `punchOutMinutes` (1–60), `textSize`, `density`. Validated with Zod; the database `CHECK` constraints are the backstop.

---

## Database functions

Both are `SECURITY DEFINER` and **revoked from `anon` and `authenticated`** — callable only by the service role from inside a server action.

| Function | Signature | Guard | Returns |
|---|---|---|---|
| `family.verify_pin` | `(target uuid, candidate text)` | household membership | `(ok boolean, reason text)` — `ok`/`bad_pin`/`locked`/`no_pin`/`forbidden`/`not_found` |
| `family.set_pin` | `(target uuid, new_pin text)` | household membership | `void`; raises on non-member, missing profile, or malformed PIN |

Supporting helpers used by RLS policies: `family.is_member(uuid) → boolean` and `family.my_household() → uuid`, both `STABLE SECURITY DEFINER`.

---

## Read path (not an action)

Reads do **not** go through server actions. The browser queries Supabase directly with the anon key under RLS:

```ts
supabase.schema('family').from('categories').select('*').order('sort_order')
```

RLS returns only the caller's household. This is what makes FR-008 work — anyone in the family can read everything without punching in — and what lets Realtime push live updates in later phases.

**Reads are open within the household; writes require an actor.** That asymmetry is the whole access model in one line.

---

## Error-handling contract

| Situation | Behaviour |
|---|---|
| Database unreachable during punch-in | `UNAVAILABLE`, action refused. Never optimistically allowed — see the offline edge case in the spec. |
| Session expires mid-action | `NOT_AUTHENTICATED`; the shell redirects to sign-in without exposing stale data. |
| Actor cookie expired | `NO_ACTOR`; the interface reopens the punch-in sheet and retries the original action on success. |
| Actor cookie tampered with | Signature check fails → treated as `NO_ACTOR`. Not distinguished, so tampering yields no signal. |
| Zod rejects input | `VALIDATION` with a field-level message; nothing is written. |
