# Tasks: Family Foundation

**Input**: Design documents from `/specs/001-family-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md
**Amended**: 2026-08-31 — after the adversarial design review (see data-model.md "Amendments"). IDs T001–T054 are kept stable and re-scoped where the design moved; new work is T055+. `[X]` marks tasks already done.

**Tests**: Included — the constitution (§II) mandates test-first for pure logic, and SC-001/SC-002 are database guarantees that require the two-client policy suite. Test tasks precede their implementation tasks and must fail first.

**Organization**: Grouped by user story so each is an independently verifiable increment. Setup and Foundational phases block everything; the five story phases then land in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different files, no dependency on an incomplete task
- **[US#]**: the user story from spec.md the task serves
- **blocked-on-operator**: needs the hosted project's access token, Dashboard, or a physical device. Everything else proceeds against the local stack (quickstart §3).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, client factories, local Supabase wiring, test scaffolding

- [X] T001 Install runtime deps `@supabase/ssr @supabase/supabase-js @tanstack/react-query jose zod server-only` + dev `pg @types/pg`; npm scripts `test:unit`, `test:policies`, `family:seed` (package.json; lucide-react already present)
- [X] T002 [P] Create `lib/family/types.ts` (Household, Category, Actor, ActorSession, HouseholdSettings, input/patch shapes), `lib/family/rows.ts` (snake_case row types, `*_COLUMNS` constants, mappers — never `select('*')`) and `lib/family/errors.ts` (ActionResult/ActionError, `ActionFailure`, `runAction`)
- [X] T003 [P] `lib/family/env.ts` (`publicSupabaseEnv`, `serverSecrets`, `isLocalSupabase`; no `server-only` so unit tests can import it) and the Supabase client factories `lib/family/supabase/{client,server,proxy}.ts` (@supabase/ssr 0.12 `getAll`/`setAll` pattern) + `lib/family/supabase/admin.ts` opening with `import "server-only"` (plan risk); every `family` access via `.schema("family")`
- [X] T004 [P] `supabase/config.toml` (init already done): `api.schemas` += `family`; the Portfolio port block `55320–55329` (another project's stack owns `54321–54329` on this machine — never stop it); `auth.site_url`/`additional_redirect_urls` for `localhost:3000`; Google provider via `env(...)`, disabled locally; email provider left on locally for the dev sign-in; `supabase/seed.sql` comment-only placeholder; gitignore `supabase/.temp`. **`supabase link` is an operator step** (quickstart §4) — not part of this task
- [X] T005 [P] Vitest projects in `vitest.config.ts` (`extends: true` on each): `unit` (jsdom, `vitest.setup.ts`, excludes `lib/family/__tests__/policies/**`) and `policies` (node, included only when a TCP probe of `127.0.0.1:55321` succeeds; `FAMILY_POLICY_TESTS=1` turns skip into failure; `globalSetup`, `fileParallelism: false`, `testTimeout: 20000`); console notice when skipped

**Checkpoint**: `npm run typecheck` green; `supabase start` boots locally on `:55321`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the schema everything reads, the pure logic everything calls, the token layer everything renders with

**⚠️ CRITICAL**: no user story work until this phase is complete.

### Migrations (nine files, exactly per data-model.md; sequential — each references the last; idempotent where cheap; every function `revoke … from public` + `search_path = ''`)

- [X] T006 Migration `supabase/migrations/001_family_schema.sql` — schema, pgcrypto, `grant usage … to authenticated, service_role` (anon gets nothing), default privileges on tables/sequences to `service_role`, `palette_color` domain (20 hexes), `touch_updated_at()`
- [X] T007 Migration `supabase/migrations/002_households.sql` — households (+ `touch` trigger), **email-keyed** `household_users` (`id` pk, `email unique` normalised, `user_id null unique`, `claimed_at`), `is_member()`/`my_household()` keyed on `user_id`, `claim_membership()` (SECURITY DEFINER, `authenticated`-only), read-only policies, grants incl. `service_role`; **no write policies** (FR-004)
- [X] T008 Migration `supabase/migrations/003_categories.sql` — categories with the three coherence constraints, `created_by`/`updated_by` (self-referential; also added to `households` here), fractional `sort_order`, `assert_profile_account_is_member()` trigger, `guard_last_parent()` deferrable constraint trigger (delete **and** demotion, per-household lock, raises `LAST_PARENT`/`23514`), read policy, `grant select` to authenticated + `all` to service_role
- [X] T009 Migration `supabase/migrations/004_pins.sql` — `profile_pins` table (RLS on, **no client grants, `service_role` revoked**), `categories.has_pin` + `sync_has_pin()` trigger, `set_pin(p_user_id, p_profile, p_pin)` / `verify_pin(p_user_id, p_profile, p_candidate)` (row lock, reason enum, 5-strikes/15-min lockout, counter reset after an expired lock) / `clear_pin(p_user_id, p_profile)`, all checking `household_users` against `p_user_id`; `revoke` from public/anon/authenticated, `grant execute` to service_role
- [X] T010 Migration `supabase/migrations/005_settings.sql` — household_settings with CHECK constraints, **no `display_name`** (households.name is the one name), `created_by`/`updated_by`, read policy, grants
- [X] T011 Migration `supabase/migrations/006_storage.sql` — `can_read_avatar(text)` (text compare, never a uuid cast); bucket insert and read policy each inside a `DO` block catching `insufficient_privilege`/`undefined_table` → NOTICE (hosted storage ownership varies); no insert/delete policy (server writes via service role)
- [X] T012 Migration `supabase/migrations/007_seed.sql` — the household (`00000000-0000-4000-8000-000000000001`, "Our Family") + its settings row **only**; no emails, no names, no PINs. Plus `scripts/family-seed.mjs` (ESM, admin client, idempotent upserts, prints what it did): reads `FAMILY_SEED_PARENT_EMAILS` + optional `FAMILY_SEED_PROFILES` from `.env.local`; `--local` targets the local stack, creates dev user `dev@family.local`, allowlists it, seeds fixture profiles; refuses a non-local URL without `--yes`
- [X] T055 Migration `supabase/migrations/008_auth_hook.sql` — `hook_restrict_signup(jsonb)` (Before User Created; refuses any email not on the allowlist with `http_code 403`), grants to `supabase_auth_admin`, revoked from public/anon/authenticated. Enabling it on the hosted project is an operator step (quickstart §4 step 5, **last**)
- [X] T056 Migration `supabase/migrations/009_realtime.sql` — guarded `DO` block adding `family.categories`, `family.household_settings`, `family.households` to `supabase_realtime` (checks `pg_publication`/`pg_publication_tables`); default replica identity; ends with `notify pgrst, 'reload schema'`
- [X] T013 Apply locally: `supabase start` → `supabase db reset` → privilege-matrix and behaviour checks with `psql`/`pg` → `npm run family:seed -- --local` → REST probes (anon → `401`/`42501`; dev user sees rows). **Live push (`supabase db push`, Exposed schemas, providers, hook) is blocked-on-operator** — quickstart §4

### Pure logic — tests FIRST (constitution §II; each pair: red, then green)

- [X] T014 [P] Failing tests `lib/family/__tests__/unit/colors.test.ts` — 20 unique uppercase entries, `isPaletteColor` (exact, case-sensitive) + `normalizeHex`, `mixWithWhite` (`'#D5B6EC'`,0.4 → `'#EEE2F7'`; `'#000000'`,0 → `'#FFFFFF'`), `tints` 1/0.4/0.2, `initialsFor`, then implement `lib/family/colors.ts`
- [X] T015 [P] Failing tests `lib/family/__tests__/unit/permissions.test.ts` — `can(actor, op, ctx)` across every Phase-1 operation for parent / member / no actor; `set_pin`: parent ✓, null ✓ (FR-018), member ✗ `FORBIDDEN`; `manage_categories` with no actor allowed only while `!householdHasParent` (bootstrap, D6); `isLastParent`/`canDelete`/`canChangeRole`; `bootstrapRole`, then implement `lib/family/permissions.ts` (a partial file from an earlier run exists — inspect, reuse or overwrite)
- [X] T016 [P] Failing tests `lib/family/__tests__/unit/actor-token.test.ts` — round-trip, expiry (`now` past `exp`) → null, tampered payload → null, wrong secret → null, wrong audience → null, `alg: none` → null, `ttlSecondsOf`, then implement `lib/family/actor-token.ts` (jose HS256, `aud: 'family-actor'`, pure — no cookies, no env)
- [X] T017 [P] Failing tests `lib/family/__tests__/unit/validation.test.ts` — category input (label bounds, off-palette colour, label-with-birthday rejected, profile-with-emoji rejected, unknown `avatar.id` rejected), `validateCategoryPatch` against the merged record, PIN regex, settings patch bounds incl. `householdName`, `reorderSchema`, `fieldErrors`, then implement `lib/family/validation.ts` (Zod 4: `z.iso.date()`, `z.uuid()`, `z.flattenError`)
- [X] T057 [P] Failing tests `lib/family/__tests__/unit/ordering.test.ts` — `nextSortOrder`, `sortOrderBetween`, `needsRebalance`, `rebalance` (`GAP × (i+1)`), then implement `lib/family/ordering.ts`
- [X] T018 `lib/family/actor.ts` (`import "server-only"`; `ACTOR_COOKIE = 'family_actor'`, `readActor`/`writeActor`/`clearActor` with the D11 attributes — `secure` only in production, `path: '/family'`, clear = same attributes + `maxAge: 0`, never `cookies().delete()`) and `lib/family/guards.ts` (`requireMember` in React `cache()` with the `claim_membership` fallback, `getMember`, `requireActor` binding `uid`/`hid` to the session, `requireParent` **re-reading the profile row via the admin client** (D10), `requireParentOrBootstrap` + `householdHasParent` (D6)) — depends on T003, T016

### Shared presentation layer (three of five stories render profile colour)

- [X] T019 [P] `app/family/tokens.css` — plain custom properties under `.family` (not `:root`, no `@theme`, no second Tailwind import), all `--fam-` prefixed: chrome tokens, the 20 palette values, scale unit `--fam-u` + `--fam-t` with `[data-text-size]` 0.875/1/1.125, metric and type tokens from `07-visual-design-system.md` §8 as `calc(N * var(--fam-u))`, 44 px floors on every interactive control, `.fam-profile` tints via `color-mix` 100/40/20 % + `@supports` fallback (research R8)
- [X] T020 [P] `app/family/layout.tsx` — Fraunces + DM Sans via `next/font/google` with `.variable` classes on the same wrapper `<div>` as `.family`; imports tokens.css; `metadata`: `robots: { index: false, follow: false }` (FR-007), `manifest: '/family/manifest.webmanifest'`, `appleWebApp`, `other['apple-mobile-web-app-capable'] = 'yes'`; `export const viewport` (`themeColor '#FFFFFF'`, `viewportFit 'cover'`); `<html>` untouched (portfolio owns the root layout)

**Checkpoint**: migrations applied to the local stack; unit suite green; `family` schema queryable as the dev user.

---

## Phase 3: User Story 1 — Only our family can get in (P1) 🎯 MVP

**Goal**: strangers see a sign-in screen and nothing else; the database itself refuses non-members.

**Independent Test**: quickstart "SC-001" — three paths (signed out, wrong account, direct REST) all fail; allowlisted parent lands in the shell.

- [X] T021 [US1] `proxy.ts` at repo root — matcher `['/family/:path*']`; always refreshes the session via `updateSession` (FR-006); adds `X-Robots-Tag: noindex, nofollow` to every `/family` response; redirects to `/family/sign-in` only for protected paths — public: `/family/sign-in`, `/family/auth/*`, `/family/not-authorized`, `/family/manifest.webmanifest`, `/family/icons/*`, `/family/avatars/*`; redirect responses copy the refreshed cookies (`getAll().forEach(c => res.cookies.set(c))`); a comment stating it is NOT the authorization boundary (research R1)
- [X] T022 [P] [US1] `app/family/(auth)/sign-in/page.tsx` + `GoogleSignInButton.tsx` (client) — copy "Family calendar" / "Continue with Google" / "Only household accounts can sign in."; `signInWithOAuth` with `redirectTo` `${origin}/family/auth/callback`; brand-styled with tokens
- [X] T060 [P] [US1] `app/family/(auth)/sign-in/DevSignIn.tsx` (client) — email + password form rendered **only when** `NODE_ENV !== 'production'` **and** `NEXT_PUBLIC_SUPABASE_URL` matches `^https?://(127\.0\.0\.1|localhost)(:|/|$)`; `signInWithPassword` → `router.replace('/family/calendar')`; plus npm script `dev:local` running `next dev --turbopack` with the three local Supabase env vars inlined (URL `http://127.0.0.1:55321`, the CLI's fixed local keys)
- [X] T023 [P] [US1] `app/family/(auth)/auth/callback/route.ts` — `?error=` from the auth hook → `/family/not-authorized`; `exchangeCodeForSession`, then `rpc('claim_membership')` as the user; `null` → `signOut()` + redirect `/family/not-authorized`; otherwise redirect `/family/calendar` (FR-030 — **no `next` parameter**, no open redirect)
- [X] T024 [P] [US1] `app/family/(auth)/not-authorized/page.tsx` — "That Google account isn't part of this household." + "Try another account" (signs out, back to sign-in); no household data
- [X] T061 [P] [US1] `lib/family/actions/auth.ts` — `signOut()`: `clearActor()` + `supabase.auth.signOut()` then `redirect('/family/sign-in')` outside `try/catch`; used by not-authorized and Settings → Account
- [X] T025 [US1] `app/family/(app)/layout.tsx` — server gate: `getMember()`; `NOT_AUTHENTICATED` → `redirect('/family/sign-in')`, `NOT_A_MEMBER` → `redirect('/family/not-authorized')` before any child renders; loads household/settings/categories/actor and hands them to `<FamilyProvider initial={…}>` (T032); `app/family/(app)/page.tsx` redirect → `/family/calendar`; placeholder pages `calendar|tasks|rewards|meals|lists/page.tsx`
- [X] T026 [US1] Policy suite `lib/family/__tests__/policies/{global-setup,helpers,access.test}.ts` — global setup creates a fresh household + allowlist rows + three auth users (A, B, stranger) and tears them down; tests: `claim_membership` binds A; member reads household/categories/settings/roster; stranger gets `[]` from all four tables; anon REST probe → **HTTP 401 / `42501`** (D27); `household_users` shows only the own household
- [X] T062 [P] [US1] Policy suite `lib/family/__tests__/policies/privileges.test.ts` — the privilege matrix in data-model.md exactly (`has_schema_privilege`/`has_table_privilege`/`has_function_privilege` for anon, authenticated, service_role, supabase_auth_admin); `profile_pins` unreadable by authenticated **and** service_role; any new `t` for anon fails
- [ ] T027 **[BLOCKED ON OPERATOR]** [US1] Manual quickstart SC-001 run on the hosted project — record the three outcomes in the PR/commit body. **blocked-on-operator** (Google provider, schema exposure, seed, hook — quickstart §4)

**Checkpoint**: deployable MVP — the family can sign in and strangers cannot get anything, even via curl.

---

## Phase 4: User Story 2 — Punch in to act, browse freely (P1)

**Goal**: viewing is free; acting requires profile + PIN; a child cannot act as a parent even by hand-crafted request.

**Independent Test**: quickstart "SC-002" and "SC-010"; wrong-PIN, lockout, idle punch-out all behave per spec scenarios 1–9.

- [X] T028 [US2] `lib/family/actions/punch-in.ts` — `punchIn` (`requireMember` → admin `rpc('verify_pin', { p_user_id: user.id, p_profile, p_candidate })` → reason mapping BAD_PIN/PIN_LOCKED/NO_PIN/NOT_FOUND → TTL from `punch_out_minutes` → `writeActor`), `punchOut`, `getActor` (also confirms the profile still exists in this household, else clear + `null`), `extendActor`; all return `ActorSession` with `ttlSeconds` + `expiresAt` (D29); internal `touchActor()` shared with every mutating action
- [X] T029 [US2] `setProfilePin` in `lib/family/actions/pins.ts` — **D5 gating**: allowed with a parent actor or with **no actor** (FR-018/SC-010), refused with a member actor → `FORBIDDEN` (FR-015); PIN `^[0-9]{4}$`; admin `rpc('set_pin', { p_user_id, p_profile, p_pin })`; residual risk recorded in spec Assumptions, not silently changed
- [X] T059 [US2] `clearProfilePin` in `lib/family/actions/pins.ts` — `requireParent()`; admin `rpc('clear_pin', { p_user_id, p_profile })` (function from T009); `has_pin` flips via trigger
- [X] T030 [P] [US2] `app/family/(app)/components/PunchInSheet.tsx` + `PinPad.tsx` — native `<dialog>`, "Who's here?" avatar grid (PIN-less profiles shown but `aria-disabled`; locked profile shows the lock message), 4-digit pad with a real `<input inputMode="none">`, auto-submit on the 4th digit, per-reason error copy (one string for every wrong PIN — no proximity hints), empty states ("Nobody's set up yet." / "No one has a PIN yet…"), focus return to the triggering control, reduced-motion safe; component tests
- [X] T031 [P] [US2] `app/family/(app)/components/ActorBadge.tsx` — current actor chip + explicit punch-out (`aria-label="Punch out {Name}"`)
- [X] T032 [US2] `app/family/(app)/components/FamilyProvider.tsx` (`"use client"`, lives in **components/**, hydrated by the server layout — a server layout cannot host a context) — QueryClient singleton, `FamilyInitialData`, actor state, `withActor()` interceptor (opens the sheet when no actor; on `NO_ACTOR` result clears + reopens + retries once), `openPunchIn`/`punchOut`/`afterMutation`, `onAuthStateChange` → `SIGNED_OUT` clears the cache and redirects, one Realtime channel per D17 invalidating `['family']`, `avatarUrls` via `signAvatarUrls`; `useFamily()`
- [X] T033 [US2] Idle punch-out per the contracts' *Idle model* (D12) — timer at `(ttlSeconds − 2) s` clears the UI + fire-and-forget `punchOut()`; `pointerdown`/`keydown` heartbeat calls `extendActor()` only when remaining ≤ ½ TTL and ≥ 30 s since the last extend; extend after every successful mutation; `visibilitychange → visible` resyncs via `getActor()` (FR-013); no `setState` in `useEffect` (use `useSyncExternalStore`/event handlers)
- [X] T034 [US2] Policy suite `lib/family/__tests__/policies/pins.test.ts` — `set_pin` by A → `has_pin` flips; verify ok; wrong → `bad_pin`; 5th → `locked`; expired lock then one wrong → `bad_pin` not `locked`; success resets; stranger uid → `forbidden`; authenticated `rpc('verify_pin')` → `42501`; `set_pin` bad format raises; `clear_pin` → `has_pin` false
- [X] T063 [US2] Policy suite `lib/family/__tests__/policies/actions.test.ts` (SC-002/SC-010 at the server) — `vi.mock("server-only")`, in-memory cookie jar for `next/headers`, server client with `setSession` per user: `setProfilePin` with no actor → ok; `punchIn` child → ok; `createCategory` as child → `FORBIDDEN`; `setProfilePin` as child actor → `FORBIDDEN`; `punchIn` parent → ok; `createCategory` as parent → ok; `deleteCategory` last parent → `CONFLICT`; tampered cookie → `NO_ACTOR`; cookie from user A under user B's session → `NO_ACTOR`

**Checkpoint**: the access model is complete and adversarially tested — everything after this is features on rails.

---

## Phase 5: User Story 3 — The household sees itself (P1)

**Goal**: parents manage Profiles and Labels; colour identity works end to end.

**Independent Test**: create/edit/reorder/delete profiles and labels from Settings; chip row reflects changes live; off-palette colour refused by the database.

- [X] T035 [P] [US3] `lib/family/queries.ts` — `familyKeys`, `fetchCategories`/`fetchSettings`/`fetchHousehold` with the explicit `*_COLUMNS` lists from `rows.ts` and `.eq('household_id', hid)` (never `select('*')`), TanStack Query hooks `useCategories`/`useSettings`/`useHousehold` (`staleTime: 30_000`, browser client singleton)
- [X] T036 [US3] `lib/family/actions/categories.ts` — `createCategory` (`requireParentOrBootstrap`; bootstrap forces `isProfile=true, role='parent'`; `sort_order = nextSortOrder`), `updateCategory` (`requireParent`; `.eq('household_id')`; demotion pre-check → `CONFLICT`; `LAST_PARENT`/`23514` → `CONFLICT`), `deleteCategory(id, { confirm })` → `{ actorCleared }` (`confirm` false → `VALIDATION`; last parent → `CONFLICT`; removes the avatar object; self-delete clears the actor), `reorderCategories` (all ids in hid else `NOT_FOUND`; `rebalance`)
- [X] T058 [US3] FR-016 attribution (D14) — every mutating action in `categories.ts`, `avatars.ts`, `settings.ts` sets `created_by`/`updated_by` from the actor's profile id (`null` in the bootstrap/actor-less paths); policy test asserts the columns are populated after a parent write
- [X] T037 [US3] `uploadAvatar(profileId, formData)` in `lib/family/actions/avatars.ts` + `lib/family/image.ts` (magic-byte MIME sniff) — server-side size ≤ 5 MB and sniffed MIME (never `file.type`), `Uint8Array` upload with explicit `contentType` to `<household>/<profile>.<ext>`, row update, remove the previous object if its path differs, never clobbers on failure; `next.config.ts` `serverActions.bodySizeLimit: '6mb'` (verify the key against the installed Next types)
- [X] T064 [P] [US3] `signAvatarUrls(profileIds)` (`requireMember`; only ids in hid; `createSignedUrls(…, 3600)` via the admin client) and `removeAvatar(profileId)` (`requireParent`; clears the columns and the object) in `lib/family/actions/avatars.ts`; provider caches the URL map ~50 min; client-side resize to ≤ 512 px (canvas → webp, jpeg fallback) before upload
- [X] T038 [P] [US3] Ten original illustrated animal avatars (flat SVG) in `public/family/avatars/<id>.svg` (files from an earlier run exist — inspect, finish or replace) + `lib/family/avatars.ts` with the frozen ids `fox, bear, bunny, cat, dog, owl, frog, penguin, koala, panda`, `AVATAR_LABELS`, `isAvatarId`, `avatarSrc`, `AVATAR_MAX_BYTES`, `AVATAR_MIME_TYPES`, `extensionFor` — our own artwork, shape-of-feature only (spec assumption)
- [X] T039 [P] [US3] `app/family/(app)/components/settings/{ColorPicker,AvatarPicker,ProfileForm}.tsx` — 20 swatches as a radiogroup with palette names, duplicate-colour status "{Name} already uses this colour. You can still pick it — they'll just be harder to tell apart."; illustration grid + photo upload (two-step create → upload); profile vs label field switching per data-model constraints; "Show on Tasks tab" switch; component tests
- [X] T040 [US3] `app/family/(app)/settings/page.tsx` + `components/settings/{HouseholdSection,ProfilesSection,PinRow,DeleteDialog,AccountSection}.tsx` + `lib/family/actions/settings.ts` (`updateHouseholdSettings` writing `households.name` via `householdName` and the settings row) — the D13 control matrix: route readable by everyone; no actor → tapping a mutating control opens the punch-in sheet; member actor → controls **disabled** (not hidden) with one "Parents only" note per section; parent → enabled; PIN set/reset row enabled with no actor or a parent actor (D5); delete dialog copy per the product critique §2.7 (last parent: button disabled + explanation); Account section "Signed in as {email}" + **Sign out** always; buttons "Add a Profile" / "Add a Label" / "Save"
- [X] T041 [US3] `app/family/(app)/components/{Avatar,ProfileChip,ProfileChipRow}.tsx` — cap 100 % / body 40 % tint anatomy per `07-visual-design-system.md` §4.3, avatar + name (no task counter — deferred per master-map assumption); `Avatar` renders initials on the profile colour when there is no avatar (reference default); empty state "Add the first person" → `/family/settings#profiles`; Realtime invalidation of `useCategories` (payloads never rendered)
- [X] T042 [US3] Policy suite `lib/family/__tests__/policies/categories.test.ts` — off-palette colour → `23514`; label with birthday → `23514`; profile with emoji → `23514`; delete last parent → `23514` (`LAST_PARENT`); demote last parent → `23514`; a parent in household A cannot update an id from household B (`NOT_FOUND`); household delete cascades

**Checkpoint**: the family exists in the app, colour-coded, manageable by parents only.

---

## Phase 6: User Story 4 — It looks and moves like the real thing (P2)

**Goal**: the Skylight shell — rail/bottom-nav, top bar, chips, FAB — at reference fidelity across three widths.

**Independent Test**: screenshots at 1180×820 (iPad landscape), 820×1180 (portrait), 390×844 (phone) match the layouts in `07-visual-design-system.md` §6; keyboard + a11y checks pass.

- [X] T043 [P] [US4] `app/family/(app)/components/nav.ts` (one config in the **components** zone: order Calendar · Tasks · Rewards · Meals · Lists · (gap) · Settings; lucide `Calendar, Check, Star, Utensils, ListTodo, Settings`) + `Sidebar.tsx` (landscape rail: icon+label, white active pill, Settings pinned bottom) + `BottomNav.tsx` (same treatment horizontal, height 102u — derived, comment it; `env(safe-area-inset-bottom)`); both rendered, switched by CSS only — rail when `(orientation: landscape) and (min-width: 1024px)`, else bottom bar (D23); `aria-current="page"` via `usePathname`
- [X] T044 [P] [US4] `TopBar.tsx` + `Clock.tsx` — `households.name` or today's date per `show_name_not_date` (FR-031), live clock honouring `time_format` via `useSyncExternalStore` (server placeholder `--:--`, minute-boundary tick, re-tick on `visibilitychange`), midnight rollover without reload (spec edge case), right-aligned pill slots (Filter pill; view switcher slot empty until the calendar phase)
- [X] T045 [US4] `Fab.tsx` — blue `+`, d = 90u, inset 32u, above the bottom bar in portrait; goes through `withActor()` so the punch-in path is exercised from day one; per-tab `aria-label`; placeholder pages for tasks/rewards/meals/lists with the tab's icon and "Coming with the {Tab} phase" in-token styling (FR-029)
- [X] T046 [US4] `useDeviceVisibility.ts` — per-device profile show/hide (FR-033) in `localStorage['family:hidden-categories:v1']` via `useSyncExternalStore`, try/catch wrapped with an in-memory fallback + quiet notice; unknown ids pruned; punch-in picker ignores it
- [X] T065 [P] [US4] `FilterSheet.tsx` — opened from the Filter pill: every category as a 44 px checkbox row (avatar/emoji + name + colour dot), "Show all" at the top; distinct in copy and code from the household-wide "Show on Tasks tab" switch (FR-027); component test
- [X] T047 [US4] Responsive + fidelity pass — chrome-devtools MCP screenshots at the three widths, compared against `07-visual-design-system.md` §6.1; fix drift; no horizontal scroll (SC-006)
- [X] T048 [US4] Accessibility pass — 44×44 targets at every text size, visible focus (`:focus-visible` outline, white on the blue FAB), aria-labels on icon-only controls, keyboard traversal of nav/sheet/forms (complete a punch-in by keyboard only), Lighthouse accessibility at the three widths (SC-009); text only on white/tints with `--fam-text-primary`, no text on 100 % fills; colour never sole carrier (name+avatar on every chip)

**Checkpoint**: the app *is* the Skylight shell; SC-004/SC-006 demonstrable.

---

## Phase 7: User Story 5 — It installs like an app (P3)

**Goal**: Add to Home Screen on the iPad yields a full-screen, landscape-first, signed-in app.

**Independent Test**: quickstart "SC-008".

- [X] T049 [P] [US5] `app/family/manifest.webmanifest/route.ts` — a **route handler** (a nested `manifest.ts` is not a Next metadata route; root-only) returning JSON as `application/manifest+json`: name/short_name, `id`/`scope: '/family/'`, `start_url: '/family/calendar'`, `display: 'standalone'`, `orientation: 'landscape-primary'`, theme/background `#FFFFFF`, icon set; icons in `public/family/icons/` (`icon.svg` → `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` 180 via `qlmanage`); linked from `app/family/layout.tsx` (T020); let through by the proxy unauthenticated (T021)
- [ ] T050 **[BLOCKED ON OPERATOR]** [US5] iPad install verification — install, relaunch, confirm full-screen + session; rotate to portrait and confirm the bottom-bar layout (iPadOS ignores `orientation` — D28, spec assumption); document the 7-day session re-check as a follow-up observation (SC-008). **blocked-on-operator** (device)

---

## Phase 8: Polish & Cross-Cutting

- [ ] T051 **[PARTIAL — local run done; the hosted half needs the operator]** Full quickstart run top to bottom on a clean `.next` against the local stack; fix any drift between docs and behaviour, updating `specs/001-family-foundation/quickstart.md` where reality won
- [X] T052 [P] Error-path sweep — session-expiry redirect without stale content, DB-unreachable punch-in refusal ("Can't reach the house…"), storage-failure avatar retention, `NO_ACTOR` retry-once, avatar rejection copy (spec edge cases)
- [ ] T053 [P] `npm run graph` rebuild; `npm run fallow:audit` + `test` + `typecheck` + `lint` (delta vs the 13 pre-existing only); no suppressions
- [ ] T054 Update `CLAUDE.md` speckit block status + memory notes; final commit(s) on `001-family-foundation`

---

## Dependencies

```
Setup (T001–T005)
  └─► Foundational (T006–T020, T055–T057)   migrations sequential T006→T012→T055→T056→T013; logic pairs T014–T017, T057 parallel
        ├─► US1 (T021–T027, T060–T062)      MVP — deployable alone
        │     └─► US2 (T028–T034, T059, T063)   needs the gate + guards
        │           └─► US3 (T035–T042, T058, T064)  needs parent-gated actions
        │                 └─► US4 (T043–T048, T065)  dresses what US3 renders
        └───────────────────► US5 (T049–T050) only needs T020's layout; can land any time after US1
Polish (T051–T054) last
```

US1→US2→US3 are genuinely sequential (each consumes the previous story's mechanism). US5 is independent after US1. Within every phase, `[P]` tasks can run concurrently. Tasks marked **blocked-on-operator** (T013's live push, T027, T050) do not block anything that runs against the local stack.

## Parallel opportunities

- **Foundational**: T014, T015, T016, T017, T057 (five TDD pairs, five files) + T019, T020 — seven streams while T006–T012, T055, T056 (sequential migrations) proceed
- **US1**: T022, T060, T023, T024, T061, T062 together after T021
- **US2**: T030, T031 while T028, T029, T059 land
- **US3**: T035, T064, T038, T039 together before T040–T041
- **US4**: T043, T044, T065 together
- **MVP scope**: Phases 1–3 only (T001–T027 + T055–T057, T060–T062) — sign-in, allowlist, database-enforced privacy, placeholder shell. Everything after is feature, not foundation.

## Implementation waves (2026-08-31)

The build brief runs the foundation as parallel waves with disjoint file ownership: **A** database & seed (T004, T006–T013, T055, T056) · **B1/B2** pure lib (T014–T017, T057, T038's `avatars.ts`) · **C** server plumbing (T003, T018, T021, `next.config.ts`) · **D1/D2** tokens, layout, manifest, icons, avatar artwork (T019, T020, T038, T049) · **E** test infrastructure (T005, T026, T034, T042, T062, T063) · **F** this documentation sync. Wave 2 — auth surface (T022–T025, T060, T061), actions (T028, T029, T036, T037, T040's action, T059, T064, T035), shell chrome (T043–T046, T065), punch-in UX (T030–T033), settings (T039–T041) — starts once wave 1 typechecks.

## Format validation

65 tasks; every task has checkbox + ID + file path; `[P]` only where files are disjoint; story labels on all story-phase tasks and only there; T001–T002 done. ✓
