# Tasks: Family Foundation

**Input**: Design documents from `/specs/001-family-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: Included — the constitution (§II) mandates test-first for pure logic, and SC-001/SC-002 are database guarantees that require the two-client policy suite. Test tasks precede their implementation tasks and must fail first.

**Organization**: Grouped by user story so each is an independently verifiable increment. Setup and Foundational phases block everything; the five story phases then land in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different files, no dependency on an incomplete task
- **[US#]**: the user story from spec.md the task serves

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, client factories, local Supabase wiring, test scaffolding

- [ ] T001 Install runtime deps `@supabase/ssr @supabase/supabase-js @tanstack/react-query jose zod server-only` (package.json; lucide-react already present)
- [ ] T002 [P] Create `lib/family/types.ts` — Household, Category (Profile/Label union), Actor, HouseholdSettings, ActionResult/ActionError from contracts/server-actions.md
- [ ] T003 [P] Create Supabase client factories `lib/family/supabase/{client,server,proxy}.ts` (@supabase/ssr cookie pattern) and `lib/family/supabase/admin.ts` opening with `import 'server-only'` (plan risk #3)
- [ ] T004 [P] `supabase init` at repo root (config.toml with `family` in `api.schemas`), `supabase link --project-ref zgmltllcyqylgtazunai`; commit config.toml, gitignore `supabase/.temp`
- [ ] T005 [P] Split Vitest into `unit` and `policies` projects in vitest.config.ts; policies project auto-skips with a visible notice when local Supabase (:54321) is not running

**Checkpoint**: `npm run typecheck` green; `supabase start` boots locally.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the schema everything reads, the pure logic everything calls, the token layer everything renders with

**⚠️ CRITICAL**: no user story work until this phase is complete.

### Migrations (write exactly per data-model.md; sequential — each references the last)

- [ ] T006 Migration `supabase/migrations/001_family_schema.sql` — schema, pgcrypto, `palette_color` domain (20 hexes), `touch_updated_at()`
- [ ] T007 Migration `supabase/migrations/002_households.sql` — households, household_users, `is_member()`/`my_household()` (STABLE SECURITY DEFINER), read-only policies, grants; **no write policies** (FR-004)
- [ ] T008 Migration `supabase/migrations/003_categories.sql` — categories with the three coherence constraints (label-has-no-person-fields, profile-has-no-emoji, avatar-is-coherent), fractional `sort_order`, read policy, `grant select` only
- [ ] T009 Migration `supabase/migrations/004_pins.sql` — pin columns, `set_pin()` (member-gated — FR-018), `verify_pin()` (reason enum + atomic 5-strikes/15-min lockout), `revoke` from anon/authenticated
- [ ] T010 Migration `supabase/migrations/005_settings.sql` — household_settings with CHECK constraints, read policy
- [ ] T011 Migration `supabase/migrations/006_storage.sql` — private `family-avatars` bucket (5 MB, jpeg/png/webp), member-read storage policy keyed on path prefix
- [ ] T012 Migration `supabase/migrations/007_seed.sql` — one household, allowlist rows for the two parent emails (**operator supplies the emails**), three profiles on distinct palette colours, settings row; **no PINs** (exercises FR-018 on day one)
- [ ] T013 Apply: `supabase db push`, then dashboard → API → Exposed schemas → add `family`; verify via `mcp__supabase__list_tables` for schema `family` and a REST probe per quickstart §4

### Pure logic — tests FIRST (constitution §II; each pair: red, then green)

- [ ] T014 [P] Failing tests `lib/family/__tests__/unit/colors.test.ts` — palette membership, `isPaletteColor`, tint math (40%/20% mix values per master map §3.1), then implement `lib/family/colors.ts`
- [ ] T015 [P] Failing tests `lib/family/__tests__/unit/permissions.test.ts` — parent vs member vs no-actor across every Phase-1 operation, last-parent-delete refusal rule, then implement `lib/family/permissions.ts`
- [ ] T016 [P] Failing tests `lib/family/__tests__/unit/actor-token.test.ts` — round-trip, expiry, tampered-signature → null, wrong-secret → null, then implement `lib/family/actor-token.ts` (jose HS256, `FAMILY_ACTOR_SECRET`)
- [ ] T017 [P] Failing tests `lib/family/__tests__/unit/validation.test.ts` — category input (label bounds, off-palette colour, label-with-birthday rejected), PIN regex, settings patch bounds, then implement `lib/family/validation.ts` (Zod)
- [ ] T018 `lib/family/actor.ts` (HTTP-only cookie read/write/clear, path `/family`) and `lib/family/guards.ts` (`requireMember`/`requireActor`/`requireParent` per contracts) — depends on T003, T016

### Shared presentation layer (three of five stories render profile colour)

- [ ] T019 [P] `app/family/tokens.css` — chrome tokens, the 20 palette custom properties, type scale and metric ratios from `07-visual-design-system.md` §8, tint helper classes using `color-mix` + `@supports` fallback (research R8)
- [ ] T020 [P] `app/family/layout.tsx` — Fraunces + DM Sans via `next/font/google` scoped to `/family`, `robots: { index: false }` (FR-007), imports tokens.css, `<html>` untouched (portfolio owns root layout)

**Checkpoint**: migrations applied to the live project; unit suite green; `family` schema queryable.

---

## Phase 3: User Story 1 — Only our family can get in (P1) 🎯 MVP

**Goal**: strangers see a sign-in screen and nothing else; the database itself refuses non-members.

**Independent Test**: quickstart "SC-001" — three paths (signed out, wrong account, direct REST) all fail; allowlisted parent lands in the shell.

- [ ] T021 [US1] `proxy.ts` at repo root — matcher `/family/:path*`, session refresh via `lib/family/supabase/proxy.ts`, unauthenticated → `/family/sign-in`; a comment stating it is NOT the authorization boundary (research R1)
- [ ] T022 [P] [US1] `app/family/(auth)/sign-in/page.tsx` — "Continue with Google" via `signInWithOAuth`, brand-styled with tokens
- [ ] T023 [P] [US1] `app/family/(auth)/auth/callback/route.ts` — code exchange, then allowlist check (`family.household_users` for `auth.uid()`); non-member → sign out + redirect `/family/not-authorized`
- [ ] T024 [P] [US1] `app/family/(auth)/not-authorized/page.tsx` — "unrecognised account" message, no household data, sign-out link
- [ ] T025 [US1] `app/family/(app)/layout.tsx` — server-side `requireMember()` gate (redirect on failure, before any child renders) + minimal placeholder content area; `app/family/(app)/page.tsx` redirect → `/family/calendar`; bare placeholder `calendar/page.tsx`
- [ ] T026 [US1] Policy suite `lib/family/__tests__/policies/access.test.ts` — two-client tests: member reads household/categories/settings; non-member gets zero rows from all three; anon key with no session gets zero rows (SC-001c)
- [ ] T027 [US1] Manual quickstart SC-001 run — record the three outcomes in the PR/commit body; requires Google provider enabled (operator step, quickstart §3)

**Checkpoint**: deployable MVP — the family can sign in and strangers cannot get anything, even via curl.

---

## Phase 4: User Story 2 — Punch in to act, browse freely (P1)

**Goal**: viewing is free; acting requires profile + PIN; a child cannot act as a parent even by hand-crafted request.

**Independent Test**: quickstart "SC-002" and "SC-010"; wrong-PIN, lockout, idle punch-out all behave per spec scenarios 1–9.

- [ ] T028 [US2] `lib/family/actions/punch-in.ts` — `punchIn` (verify_pin RPC via admin client → mint cookie), `punchOut`, `getActor`, `extendActor` per contracts; reason mapping BAD_PIN/PIN_LOCKED/NO_PIN/NOT_FOUND
- [ ] T029 [US2] `setProfilePin` in `lib/family/actions/pins.ts` — **member-gated, deliberately not parent-gated** (FR-018); PIN `^[0-9]{4}$`
- [ ] T030 [P] [US2] `app/family/(app)/components/PunchInSheet.tsx` — "Who's here?" avatar grid (only PIN-holding profiles selectable — spec US2 scenario 9), 4-digit pad, per-reason error states, no proximity hints
- [ ] T031 [P] [US2] `app/family/(app)/components/ActorBadge.tsx` — current actor chip + explicit punch-out
- [ ] T032 [US2] `FamilyProvider` in `app/family/(app)/layout.tsx` context — TanStack Query client, actor state, `withActor()` interceptor that opens the sheet, retries the intercepted action on success (contracts error-handling row 3)
- [ ] T033 [US2] Idle punch-out — cookie expiry from `punch_out_minutes`, client timer that clears actor UI on expiry, `extendActor` on successful mutations (FR-013)
- [ ] T034 [US2] Policy/action tests `lib/family/__tests__/policies/punch-in.test.ts` — wrong PIN refused; 5th failure locks 15 min; success resets counter; `verify_pin`/`set_pin` not callable with anon or authenticated keys (revoke check); member-role actor refused on a parent action at the server (SC-002); PIN settable with no actor punched in (SC-010)

**Checkpoint**: the access model is complete and adversarially tested — everything after this is features on rails.

---

## Phase 5: User Story 3 — The household sees itself (P1)

**Goal**: parents manage Profiles and Labels; colour identity works end to end.

**Independent Test**: create/edit/reorder/delete profiles and labels from Settings; chip row reflects changes live; off-palette colour refused by the database.

- [ ] T035 [P] [US3] `lib/family/queries.ts` — categories/settings/household reads via `supabase.schema('family')`, TanStack Query hooks (`useCategories`, `useSettings`)
- [ ] T036 [US3] `lib/family/actions/categories.ts` — `createCategory`/`updateCategory`/`deleteCategory`(confirm + last-parent refusal → CONFLICT + clears actor if self-delete)/`reorderCategories` (fractional index), all `requireParent`
- [ ] T037 [US3] `uploadAvatar` in `lib/family/actions/avatars.ts` — server-side MIME/size validation, path `<household>/<profile>.<ext>`, replaces prior object, never clobbers on failure (contracts)
- [ ] T038 [P] [US3] Ten original illustrated animal avatars (SVG) in `public/family/avatars/` + manifest list in `lib/family/avatars.ts` — our own artwork, shape-of-feature only (spec assumption)
- [ ] T039 [P] [US3] `ColorPicker.tsx` (20 swatches, duplicate-colour warning per spec edge case), `AvatarPicker.tsx` (illustration grid + photo upload), `ProfileForm.tsx` (profile vs label field switching per data-model constraints) in `app/family/(app)/components/`
- [ ] T040 [US3] `app/family/(app)/settings/page.tsx` — household section (name, name-vs-date, time format, punch-out minutes via `updateHouseholdSettings` in `lib/family/actions/settings.ts`), profiles/labels list with add/edit/delete/reorder, PIN management (set/reset, works with no actor)
- [ ] T041 [US3] `ProfileChip.tsx` + `ProfileChipRow.tsx` — cap 100% / body 40% tint anatomy per `07-visual-design-system.md` §4.3, avatar + name (no task counter yet — deferred per master-map assumption), Realtime invalidation of `useCategories`
- [ ] T042 [US3] Tests `lib/family/__tests__/policies/categories.test.ts` — off-palette colour rejected by the domain; label-with-birthday rejected by CHECK; last-parent delete refused; reorder persists; member actor refused on all five actions

**Checkpoint**: the family exists in the app, colour-coded, manageable by parents only.

---

## Phase 6: User Story 4 — It looks and moves like the real thing (P2)

**Goal**: the Skylight shell — rail/bottom-nav, top bar, chips, FAB — at reference fidelity across three widths.

**Independent Test**: screenshots at 1180×820 (iPad landscape), 820×1180 (portrait), 390×844 (phone) match the layouts in `07-visual-design-system.md` §6; keyboard + a11y checks pass.

- [ ] T043 [P] [US4] `Sidebar.tsx` (landscape rail: icon+label, white active pill, Settings pinned bottom) + `BottomNav.tsx` (portrait/phone: same treatment horizontal) from one nav config in `lib/family/nav.ts`; tab order Calendar·Tasks·Rewards·Meals·Lists (master map §2)
- [ ] T044 [P] [US4] `TopBar.tsx` — household name or date per setting (FR-031), live clock honouring `time_format`, midnight rollover without reload (spec edge case), right-aligned pill slots (view switcher slot empty until Phase 2 of the project)
- [ ] T045 [US4] `Fab.tsx` — blue `+`, d≈90 ratio, per-tab create wiring (no-op sheet placeholders for future tabs); placeholder pages for tasks/rewards/meals/lists with the tab's icon and "coming soon" in-token styling (FR-029)
- [ ] T046 [US4] Per-device profile show/hide (FR-033) — visibility state in `localStorage` (try/catch wrapped), filter panel stub off the chip row
- [ ] T047 [US4] Responsive + fidelity pass — chrome-devtools MCP screenshots at the three widths, compared against `07-visual-design-system.md` §6.1; fix drift; no horizontal scroll (SC-006)
- [ ] T048 [US4] Accessibility pass — 44×44 targets, visible focus, aria-labels on icon-only controls, keyboard traversal of nav/sheet/forms, automated contrast check (SC-009); colour never sole carrier (name+avatar on every chip)

**Checkpoint**: the app *is* the Skylight shell; SC-004/SC-006 demonstrable.

---

## Phase 7: User Story 5 — It installs like an app (P3)

**Goal**: Add to Home Screen on the iPad yields a full-screen, landscape-first, signed-in app.

**Independent Test**: quickstart "SC-008".

- [ ] T049 [P] [US5] `app/family/manifest.ts` — name, short_name, `display: standalone`, `orientation: landscape-primary`, theme/background `#FFFFFF`, icon set; icons (192/512/maskable + apple-touch) in `public/family/icons/`; `apple-mobile-web-app-capable` metadata in `app/family/layout.tsx`
- [ ] T050 [US5] iPad install verification — install, relaunch, confirm full-screen + session; document the 7-day session re-check as a follow-up observation (SC-008)

---

## Phase 8: Polish & Cross-Cutting

- [ ] T051 Full quickstart run top to bottom on a clean `.next`; fix any drift between docs and behaviour, updating `specs/001-family-foundation/quickstart.md` where reality won
- [ ] T052 [P] Error-path sweep — session-expiry redirect without stale content, DB-unreachable punch-in refusal message, storage-failure avatar retention (spec edge cases)
- [ ] T053 [P] `npm run graph` rebuild; `npm run fallow:audit` + `test` + `typecheck` + `lint` (delta vs the 13 pre-existing only); no suppressions
- [ ] T054 Update `CLAUDE.md` speckit block status + memory notes; final commit(s) on `001-family-foundation`

---

## Dependencies

```
Setup (T001–T005)
  └─► Foundational (T006–T020)          migrations sequential T006→T013; logic pairs T014–T017 parallel
        ├─► US1 (T021–T027)             MVP — deployable alone
        │     └─► US2 (T028–T034)      needs the gate + guards
        │           └─► US3 (T035–T042) needs parent-gated actions
        │                 └─► US4 (T043–T048) dresses what US3 renders
        └───────────────────► US5 (T049–T050) only needs T020's layout; can land any time after US1
Polish (T051–T054) last
```

US1→US2→US3 are genuinely sequential (each consumes the previous story's mechanism). US5 is independent after US1. Within every phase, `[P]` tasks can run concurrently.

## Parallel opportunities

- **Foundational**: T014, T015, T016, T017 (four TDD pairs, four files) + T019, T020 — six streams while T006–T013 (sequential migrations) proceed
- **US1**: T022, T023, T024 together after T021
- **US2**: T030, T031 while T028–T029 land
- **US3**: T035, T038, T039 together before T040–T041
- **US4**: T043, T044 together
- **MVP scope**: Phases 1–3 only (T001–T027) — sign-in, allowlist, database-enforced privacy, placeholder shell. Everything after is feature, not foundation.

## Format validation

54 tasks; every task has checkbox + ID + file path; `[P]` only where files are disjoint; story labels on all story-phase tasks and only there. ✓
