# Contracts: Server Actions & Database Functions

**Feature**: `001-family-foundation` | **Date**: 2026-08-28 | **Amended**: 2026-08-31 (D3, D5, D6, D10–D16, D29 — see data-model.md "Amendments"), 2026-09-02 (`signIn`; the OAuth callback route removed — FR-002)

The interfaces Phase 1 exposes. There is no public HTTP API — the app's boundary is its server actions plus a handful of database functions. Since 2026-09-02 there is **no route handler in the auth surface at all**: sign-in is a server action, and the `/family/auth/callback` route that exchanged an OAuth code is gone. Every action lives in `lib/family/actions/`, starts with `"use server"`, and returns `Promise<ActionResult<…>>` through `runAction()` from `lib/family/errors.ts`. Types referenced below are the ones in `lib/family/types.ts`.

## The rule every action follows

Per R1, `proxy.ts` is **not** an authorization boundary — Next.js explicitly warns that a matcher change can silently remove coverage from a server function. So every action begins with the same guards (`lib/family/guards.ts`), and none of them trusts the caller:

```ts
// 1. Is there a real Supabase session, and is that account on the allowlist?
const { user, householdId } = await requireMember();     // throws → NOT_AUTHENTICATED | NOT_A_MEMBER

// 2. Who is punched in on THIS device, under THIS account? (signed cookie, never the body)
const actor = await requireActor();                       // throws → NO_ACTOR

// 3. Are they a parent — according to the database, right now?
const parent = await requireParent();                     // throws → NO_ACTOR | FORBIDDEN
```

| Guard | What it does | Throws |
|---|---|---|
| `requireMember()` | `getClaims()` on the request's Supabase client (verified JWT, not `getSession()`) → `rpc('my_household')` → on `null`, one `rpc('claim_membership')` (covers the very first sign-in and "allowlisted after the account already existed") → else refuse. Wrapped in React `cache()` so a request pays once. **This fallback is where membership binds** — there is no callback route, so the allowlist row is claimed on the first page load after `signIn`. | `NOT_AUTHENTICATED`, `NOT_A_MEMBER` |
| `getMember()` | Non-throwing variant for layouts (`null` instead of throwing). | — |
| `requireActor()` | Reads the `family_actor` cookie, verifies the JWT (HS256 only, audience `family-actor`), **and** requires `actor.userId === member.user.id && actor.householdId === member.householdId`. A cookie minted under another account on the same device is not an actor. | `NO_ACTOR` |
| `requireParent()` | `requireActor()`, then **re-reads the profile row through the admin client** (`id, household_id, role, is_profile`). The role in the JWT is a hint; the database is the truth — a parent demoted or deleted on another device loses parent powers immediately, not at cookie expiry. Row missing / not a profile / other household → `NO_ACTOR` and the cookie is cleared. | `NO_ACTOR`, `FORBIDDEN` |
| `requireParentOrBootstrap()` | When the household has **zero parent profiles** (`householdHasParent()` via the admin client), a signed-in member may proceed with no actor: returns `{ actor: null, bootstrap: true }`. Otherwise identical to `requireParent()` (returns `{ actor, bootstrap: false }`). Closed the moment a parent exists, and the last-parent trigger means it cannot reopen. | as `requireParent()` |

**No action accepts a profile id from the client to identify the actor** — that would let a child act as a parent by editing a request. The cookie is the only source. Every write through the admin client is additionally scoped `.eq('household_id', householdId)` — with the service role there is no RLS, so that clause is the tenancy check.

## Shared result shape

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError; message: string; fieldErrors?: FieldErrors }

type ActionError =
  | 'NOT_AUTHENTICATED'   // no Supabase session
  | 'NOT_A_MEMBER'        // signed in, but not on the allowlist
  | 'NO_ACTOR'            // nobody punched in (expired / tampered / wrong account — not distinguished)
  | 'FORBIDDEN'           // punched in, but not allowed to do this
  | 'BAD_PIN'
  | 'PIN_LOCKED'
  | 'NO_PIN'              // that profile cannot be an actor
  | 'VALIDATION'          // fieldErrors carries the Zod field messages
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE'         // database unreachable or unknown failure — never silently succeeds
```

`message` is safe to show a user (`ACTION_MESSAGES` supplies the default per code). Errors are never thrown across the boundary as exceptions, so a failure cannot leak a stack trace into the client; `redirect()`/`notFound()` signals pass through `runAction` untouched.

---

## Punch-in

### `punchIn(profileId: string, pin: string): ActionResult<ActorSession>`

**Guard**: `requireMember()` only — a punch-in is *how* you become an actor.

1. Validates `pin` against `^[0-9]{4}$` → `VALIDATION` otherwise (garbage never reaches bcrypt).
2. Calls `family.verify_pin(p_user_id := user.id, p_profile := profileId, p_candidate := pin)` through the admin client. `p_user_id` is the verified session user — `auth.uid()` is NULL under the service role, so the function must be told who is asking.
3. On failure, maps the reason: `bad_pin` → `BAD_PIN`, `locked` → `PIN_LOCKED`, `no_pin` → `NO_PIN`, `forbidden`/`not_found` → `NOT_FOUND`.
4. On success, reads `household_settings.punch_out_minutes`, sets `ttlSeconds = minutes × 60`, mints the actor token and writes the cookie (see *Actor cookie*).

Returns `ActorSession = { profileId, label, color, role, expiresAt, ttlSeconds }` — nothing that is not already readable within the household.

**Never** reveals whether a wrong PIN was close, how many attempts remain, or that a profile exists to a non-member.

### `punchOut(): ActionResult<null>`

**Guard**: none beyond a valid session. Clears the cookie (identical attributes, `maxAge: 0`). Idempotent — succeeds when nobody is punched in.

### `getActor(): ActionResult<ActorSession | null>`

**Guard**: `requireMember()`. Verifies the cookie **and** confirms the profile still exists in this household (admin select); if not, clears the cookie and returns `null`. Used by the shell on load and on `visibilitychange`; safe to call on every render.

### `extendActor(): ActionResult<ActorSession>`

**Guard**: `requireActor()`. Re-mints the token with a fresh TTL. Called by the client heartbeat (see *Idle model*). Every mutating action performs the same re-mint internally (`touchActor()`) after a successful write, so an active user is never punched out mid-task.

---

## PINs

### `setProfilePin(profileId: string, pin: string): ActionResult<null>`

**Guard**: `requireMember()` plus the actor rule below — **deliberately not `requireParent()`** (FR-018, SC-010, the no-lockout rule).

| Actor state on this device | Result |
|---|---|
| Nobody punched in | **Allowed.** A signed-in household session is the authority — without this a PIN-less household is permanently read-only. |
| Member (child) punched in | **`FORBIDDEN`.** Setting PINs is parent-only management (FR-015). |
| Parent punched in | Allowed. |

`pin` must match `^[0-9]{4}$`. Calls `family.set_pin(user.id, profileId, pin)`; a target that is not a profile in the caller's household → `NOT_FOUND`. Never echoes the PIN or its hash.

**Gating depends on where the household is, not on a fixed rule:**

| Household state | Actor required |
|---|---|
| No parent profile holds a PIN | none — a signed-in member may set one (FR-018, SC-010) |
| Some parent holds a PIN | a punched-in **parent** |

A punched-in member is refused in both cases (FR-015). The window closes as soon as it can be closed: while nobody can punch in, requiring an actor would leave the household permanently read-only; once a parent can identify themselves, an actor-less caller at the always-signed-in tablet must no longer be able to reset a parent's PIN. The client mirrors this — the PIN row calls the action directly in the first case and routes through the punch-in gate in the second — but the server decides.

### `clearProfilePin(profileId: string): ActionResult<null>`

**Guard**: `requireParent()`. Calls `family.clear_pin(user.id, profileId)`; the profile's `has_pin` flips to `false` and it can no longer be selected in the picker. Not available in the actor-less path — removing a PIN never helps a locked-out household.

---

## Profiles and Labels

### `createCategory(input: CategoryInput): ActionResult<Category>`

**Guard**: `requireParentOrBootstrap()`.

```ts
{
  label: string             // 1–40 chars, trimmed
  color: PaletteColor       // one of the 20; rejected by the domain otherwise
  isProfile: boolean
  avatar?: { kind: 'illustration'; id: AvatarId } | null   // profiles only; photos via uploadAvatar
  emoji?: string | null     // labels only, optional
  birthday?: string | null  // ISO date, profiles only
  dietaryPrefs?: string | null   // ≤ 280 chars, profiles only
  role?: 'parent' | 'member'     // profiles only, default 'member'
  showOnTasks?: boolean          // default true
}
```

Validated with Zod (`lib/family/validation.ts`) before it reaches the database; the database constraints are the second line, not the first. `sort_order` = `nextSortOrder(existing)` (end of the list). `created_by`/`updated_by` = the actor's profile id, or `null` in the bootstrap path.

**Bootstrap** (`bootstrap: true`): the household has no parent yet, so the created record is forced to `isProfile: true, role: 'parent'` whatever the input said — the first person is a parent. After that the normal parent-only rule applies.

Returns the created category. → `VALIDATION` on a bad shape, off-palette colour, unknown `avatar.id`, or person-fields on a Label.

### `updateCategory(id: string, patch: CategoryPatch): ActionResult<Category>`

**Guard**: `requireParent()`. Partial `input` minus `isProfile` — converting a Label to a Profile is a distinct operation and **out of scope for Phase 1**. Cross-field rules are evaluated against the merged record (`validateCategoryPatch`). Scoped `.eq('household_id', householdId)` → `NOT_FOUND` if the id is outside the actor's household. Demoting the last parent: pre-checked → `CONFLICT`, and the trigger's `LAST_PARENT` (SQLSTATE `23514`) is mapped to `CONFLICT` as the backstop. Sets `updated_by`.

### `deleteCategory(id: string, opts: { confirm: boolean }): ActionResult<{ actorCleared: boolean }>`

**Guard**: `requireParent()`. `confirm !== true` → `VALIDATION` (FR-026). Refuses to delete the **last remaining parent profile** → `CONFLICT`, so the household cannot orphan itself. Removes the profile's storage object if it had a photo avatar (using the stored `avatar_path`, never a guessed name). If the deleted profile is the current actor, clears the actor cookie in the same response and returns `actorCleared: true`.

### `reorderCategories(orderedIds: string[]): ActionResult<null>`

**Guard**: `requireParent()`. Every id must belong to the household → `NOT_FOUND` otherwise. Rewrites `sort_order` with `rebalance()` (`1000, 2000, …`). Idempotent.

---

## Avatars

### `uploadAvatar(profileId: string, formData: FormData): ActionResult<Category>`

**Guard**: `requireParent()`. The file is under the `file` field. The client has already resized to ≤ 512 px (canvas → `image/webp`, `image/jpeg` fallback) — a courtesy, not the control.

Server-side: size ≤ 5 MB and MIME sniffed from **magic bytes** (`lib/family/image.ts`), never from `file.type` → `VALIDATION` on either. Uploads a `Uint8Array` with an explicit `contentType` to `<household_id>/<profileId>.<ext>` in the private `family-avatars` bucket, then sets `avatar_kind = 'photo'`, `avatar_path`, `avatar_id = null`, and removes the previous object if its path differs (an extension change). On storage failure the profile's existing avatar is left untouched. `next.config.ts` raises the server-action body limit to `6mb` for this one path.

### `removeAvatar(profileId: string): ActionResult<Category>`

**Guard**: `requireParent()`. Clears `avatar_kind`/`avatar_id`/`avatar_path` and removes the storage object if there was one. The profile falls back to initials on its colour.

### `signAvatarUrls(profileIds: string[]): ActionResult<Record<string, string>>`

**Guard**: `requireMember()`. Only ids in the caller's household with a photo avatar are considered; returns `{ [profileId]: signedUrl }` from `createSignedUrls(paths, 3600)` via the admin client. The client caches the map for ~50 minutes (`staleTime` below the URL TTL). This is why the app never depends on a `storage.objects` policy.

---

## Settings

### `updateHouseholdSettings(patch: HouseholdSettingsPatch): ActionResult<{ household: Household; settings: HouseholdSettings }>`

**Guard**: `requireParent()`. Accepts `householdName` (1–60, trimmed — written to `households.name`, the one household name), `showNameNotDate`, `timeFormat`, `startWeekOn`, `punchOutMinutes` (1–60), `textSize`, `density` (written to `household_settings`). Validated with Zod; the database `CHECK` constraints are the backstop. Sets `updated_by` on both rows. Two statements, not one transaction — acceptable for a single household.

---

## Auth

### `signIn(previousState: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>>`

**Guard**: none — this action is *how* a session begins. It is the only entry point to `/family`; there is no OAuth callback route and no second form.

The signature is `useActionState`'s reducer shape, so `SignInForm.tsx` hands the action straight to the hook **and the form still posts without JavaScript**. The only field is `password`; a missing or non-string entry becomes `""` rather than a crash. There is no success payload — success leaves through `redirect()`.

1. Reads the household account's address from **server-side env** via `familyAccountEmail()` (`FAMILY_ACCOUNT_EMAIL`, deliberately not a `NEXT_PUBLIC_*` name). It is never accepted from the caller, never rendered, and never returned — the client sends a password and nothing else, so there is no address in the page, in the bundle, or on the wire.
2. An empty password is refused before Supabase is called: the answer would be identical, and it costs a round trip and a rate-limit slot.
3. Calls `supabase.auth.signInWithPassword({ email, password })` on the request's server client, so the session cookies are set on the response.
4. **Supabase validates the password.** This application never holds it, hashes it, compares it, or logs it. `FAMILY_ACCOUNT_PASSWORD` exists only so the seed script can create the account; nothing at runtime reads that variable, and the correct password is not knowable to any code in this repository.
5. On success, clears any actor cookie the previous person left on this device (D11 — a new session means a new person at the tablet), then `redirect('/family/calendar')` **outside** the `try/catch` (FR-030). Membership binds on the next request: `requireMember()` calls `my_household()` and falls back to `claim_membership()`, which is why removing the callback route cost nothing.
6. On a rejected credential → `NOT_AUTHENTICATED` with one explicit message, **"That password isn't right."** (not the shared `ACTION_MESSAGES` default for that code, which speaks of an expired session). The failure is **deliberately indistinguishable**: a wrong password, an empty field, an account that does not exist and a disabled account all produce that one message. Nothing on the screen ever confirms that an account exists, and Supabase's own error text is never echoed.
7. A failure *before* Supabase answers — a missing `FAMILY_ACCOUNT_EMAIL`, a network fault — is `UNAVAILABLE` ("Can't reach the house right now…"), logged server-side as a message string only, never the caught object. This is the one distinction the screen draws, and it draws it in the safe direction: it says the *house* is unreachable, never anything about the account.

Rate limiting is Supabase's own on `/token?grant_type=password`; no attempt counter lives in this application, and none is exposed to the caller.

The surface around it (`app/family/(auth)/sign-in/`): title **"Family calendar"**, label **"Household password"**, one `type="password"` field with `autoComplete="current-password"`, submit **"Sign in"** / **"Signing in…"**, footer **"Only household accounts can sign in."**, and a permanently rendered `role="alert"` line so the message arrives in a region a screen reader already watches and the layout does not jump. The page redirects an already-signed-in visitor to `/family/calendar` rather than showing them a password box.

### `signOut(): Promise<never>`

**Guard**: none. Clears the actor cookie, calls `supabase.auth.signOut()`, then `redirect('/family/sign-in')` **outside** any `try/catch`. Available to everyone from Settings → Account; signing out is not a data mutation and needs no actor. Clearing the actor here is what stops one person's punch-in surviving into the next person's use of the same device.

The Account section says **"Signed in to the household account"** — not "Signed in as {email}". With one shared account the address identifies nobody, and FR-002 keeps it off the client entirely; who is *here* is the punch-in badge, which is elsewhere on the screen.

---

## Actor cookie

| Attribute | Value |
|---|---|
| name | `family_actor` |
| `httpOnly` | `true` |
| `sameSite` | `'lax'` — server actions POST to the page they were invoked from, so the cookie is sent |
| `secure` | `process.env.NODE_ENV === 'production'` — Safari drops `Secure` cookies on `http://localhost`, so an unconditional flag silently breaks punch-in in development |
| `path` | `'/family'` |
| `maxAge` | `ttlSeconds` (= `punch_out_minutes × 60`) |

Value: an HS256 JWT signed with `FAMILY_ACTOR_SECRET` via `jose`, claims `{ sub: profileId, uid: userId, hid: householdId, role, aud: 'family-actor', iat, exp }`. Verification pins `algorithms: ['HS256']` and the audience, so a token signed by any other use of the same secret — or an `alg: none` token — is rejected. **Any** verification failure (expired, bad signature, wrong audience, malformed, missing claims) yields `null`, i.e. `NO_ACTOR`, with no signal as to which.

Clearing = setting the same name with the **identical** attributes and `maxAge: 0`. Never `cookies().delete(name)`: it defaults to `Path=/`, which does not replace a `Path=/family` cookie, and punch-out would silently leave the actor in place.

## Idle model

*Idle* means **no interaction on this device**, matching spec US2-7 — not "no mutation".

- **Server**: cookie `maxAge` and JWT `exp` are both `punch_out_minutes × 60`; every response carrying an `ActorSession` includes `ttlSeconds` so the client never compares server time to its own clock.
- **Client timer**: on each `ttlSeconds` received, reset a timeout for `(ttlSeconds − 2) s` that clears the actor from the UI and fires a fire-and-forget `punchOut()` — the client always goes first, so the user never sees a stale badge.
- **Heartbeat**: `pointerdown`/`keydown` listeners (capture) call `extendActor()` only when the remaining time is ≤ ½ of the TTL **and** ≥ 30 s have passed since the last extend — worst case one request per 30 s per punched-in device. Every successful mutation also extends (the action already re-minted the cookie; the client just refreshes its timer from the returned `ttlSeconds`).
- **Background tabs**: `visibilitychange → visible` calls `getActor()` to resync; `null` clears the UI.
- **Server truth wins**: any `NO_ACTOR` result clears the UI, opens the punch-in sheet, and retries the intercepted action once on success (error-handling row 3). This is how the client learns about an expiry it slept through.

---

## Database functions

All `SECURITY DEFINER` with `search_path = ''`, all revoked from `public`. The three PIN functions are callable **only** by the service role from inside a server action; the caller identity is an explicit parameter because `auth.uid()` is NULL under that role.

| Function | Signature | Callable by | Returns |
|---|---|---|---|
| `family.verify_pin` | `(p_user_id uuid, p_profile uuid, p_candidate text)` | `service_role` | `(ok boolean, reason text)` — `ok`/`bad_pin`/`locked`/`no_pin`/`forbidden`/`not_found` |
| `family.set_pin` | `(p_user_id uuid, p_profile uuid, p_pin text)` | `service_role` | `void`; raises `42501` on non-member / null caller, `P0002` on a missing profile, `22023` on a malformed PIN |
| `family.clear_pin` | `(p_user_id uuid, p_profile uuid)` | `service_role` | `void`; same membership checks; deletes the `profile_pins` row (has_pin → false) |
| `family.claim_membership` | `()` | `authenticated` | the household id after binding `auth.uid()` to the caller's confirmed email, or `null` |
| `family.is_member` | `(target_household uuid)` | `authenticated`, `service_role` | `boolean` — used by every RLS policy |
| `family.my_household` | `()` | `authenticated`, `service_role` | `uuid` or `null` |
| `family.can_read_avatar` | `(object_name text)` | `authenticated` | `boolean` — the (optional) storage read policy |
| `family.hook_restrict_signup` | `(event jsonb)` | `supabase_auth_admin` | `{}` to allow, `{ error: { message, http_code: 403 } }` to refuse account creation |

Trigger functions (`touch_updated_at`, `sync_has_pin`, `guard_last_parent`, `assert_profile_account_is_member`) are executable by nobody. The policy suite asserts this inventory exactly.

---

## Read path (not an action)

Reads do **not** go through server actions. The browser queries Supabase directly with the publishable key under RLS, always with an explicit column list and an explicit household filter:

```ts
supabase.schema('family').from('categories')
  .select(CATEGORY_COLUMNS)              // from lib/family/rows.ts — never select('*')
  .eq('household_id', householdId)       // explicit even under RLS (constitution §VII)
  .order('sort_order')
```

`CATEGORY_COLUMNS`, `HOUSEHOLD_COLUMNS`, `SETTINGS_COLUMNS` in `rows.ts` are the whole privacy contract of the read path: nothing PIN-related is in the list because nothing PIN-related exists on a readable table. RLS returns only the caller's household. This is what makes FR-008 work — anyone in the family can read everything without punching in — and what lets Realtime push live updates: the provider subscribes to one channel of `postgres_changes` on `family.categories`, `family.household_settings` (filter `household_id=eq.<hid>`) and `family.households` (filter `id=eq.<hid>`) and invalidates the `['family']` query prefix. Payloads are triggers only, never rendered.

**Reads are open within the household; writes require an actor.** That asymmetry is the whole access model in one line.

---

## Error-handling contract

| Situation | Behaviour |
|---|---|
| Wrong household password, empty field, or an account that does not exist | `NOT_AUTHENTICATED` with one message for all three ("That password isn't right."). No session is created and nothing distinguishes the cases — the screen never confirms an account exists, and Supabase's error text is never returned. |
| `FAMILY_ACCOUNT_EMAIL` missing, or Supabase unreachable during sign-in | `UNAVAILABLE`; the message names the *house*, not the account. Logged server-side as a string, never the caught object. |
| Database unreachable during punch-in | `UNAVAILABLE`, action refused. Never optimistically allowed — see the offline edge case in the spec. |
| Session expires mid-action | `NOT_AUTHENTICATED`; the shell clears its query cache and redirects to sign-in without exposing stale data. |
| Actor cookie expired | `NO_ACTOR`; the interface clears the actor, reopens the punch-in sheet and retries the original action once on success. |
| Actor cookie tampered with, wrong audience, `alg: none`, or minted under another account | Verification fails → `NO_ACTOR`. Not distinguished from expiry, so tampering yields no signal. |
| Actor's profile deleted or demoted elsewhere | `requireParent()` re-reads the row → `NO_ACTOR` (missing) or `FORBIDDEN` (demoted); cookie cleared on `NO_ACTOR`. |
| Zod rejects input | `VALIDATION` with `fieldErrors`; nothing is written. |
| Database rejects a value (off-palette colour, `CHECK` violation, malformed PIN) | `VALIDATION` — the domain/constraint is the second line of defence and its message is not echoed verbatim. |
| Last-parent delete or demotion | Pre-check → `CONFLICT`; trigger `LAST_PARENT` / SQLSTATE `23514` → `CONFLICT` as backstop. |
| Id outside the caller's household | `NOT_FOUND` — never `FORBIDDEN`, so nothing confirms the row exists. |
| Any other database or storage error | `UNAVAILABLE`; logged server-side (`console.error` in `runAction`), never surfaced verbatim. |
