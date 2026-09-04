# Implementation Plan: Family Foundation

**Branch**: `001-family-foundation` | **Date**: 2026-08-28 | **Amended**: 2026-09-02 (shared household password) | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-family-foundation/spec.md`

## Summary

Build the foundation for `/family`: a household-scoped Supabase schema with row-level security, sign-in on a single shared household password backed by an email allowlist, a punch-in actor model that attributes every change to a named family member, the Skylight-style app shell, Profiles & Labels, the design-token layer, and home-screen installability.

The technical core is **three independent authorization layers** — database membership, a signed actor cookie, and a server-side role check — because the framework explicitly warns that request interception cannot be relied on as a security boundary, and because row-level security can see *which account* is asking but not *which family member is standing at the tablet*.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+
**Primary Dependencies**: Next.js 16.1.6 (App Router), React 19.1.0, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, `@tanstack/react-query`, `jose`, `zod`, `lucide-react`
**Storage**: Supabase Postgres, schema `family`, project `zgmltllcyqylgtazunai` (East US / Ohio); Supabase Storage bucket `family-avatars`
**Testing**: Vitest 4 + Testing Library (unit); Vitest integration suite against a local Supabase (policies)
**Target Platform**: iPadOS Safari (primary, landscape, installed to home screen); iOS/Android Safari & Chrome (phones); desktop browsers (development)
**Project Type**: Web application — a self-contained sub-app inside an existing Next.js portfolio
**Performance Goals**: Punch-in to recorded change under 5 s including PIN entry (SC-003); shell interactive in under 2 s on the target iPad over home Wi-Fi
**Constraints**: Supabase free tier (500 MB database, 1 GB storage); no horizontal scroll at any of three viewport widths; WCAG 2.1 AA; 44×44 pt minimum touch targets
**Scale/Scope**: One household, 3 profiles, 2 authenticated accounts, ~5 concurrent devices. Roughly 60 source files, 9 migrations, one seed script.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. Sub-apps are self-contained** | PASS | Everything lives under `app/family/**` and `lib/family/**`. The only portfolio-level files touched are `package.json` (deps + scripts), `.gitignore`, `vitest.config.ts` (test projects), `next.config.ts` (server-action body limit only) and the new root `proxy.ts` — never `globals.css` or the root layout. Nothing is extracted for reuse — there is no second consumer. |
| **II. Test-first for logic** | PASS | `permissions.ts`, `colors.ts`, `actor-token.ts` and PIN-format validation are pure and unit-tested before implementation. RLS policies get a real-database integration suite, because a unit test cannot prove a database guarantee (research R10). |
| **III. Accessible and touch-first** | PASS | FR-035 (44×44 pt), FR-039 (contrast, keyboard, focus, colour never the sole carrier). Profile chips pair colour with name and avatar. |
| **IV. Layered, boundary-enforced architecture** | PASS | `lib/family/**` holds domain and data access and imports nothing from `app/**`; pages compose components; components call `lib`. Enforced by the fallow `boundaries` config, so a violation fails the commit gate. |
| **V. Quality gates** | PASS | `fallow:audit`, `test`, `typecheck`, `lint` all green before each commit. No suppressions. Note the repo currently carries 13 pre-existing lint problems in unrelated components — this feature adds none, and does not silence them. |
| **VI. Degrade gracefully** | PASS | A database-unreachable punch-in is refused, never optimistically allowed (contracts). Session expiry redirects without exposing stale data. Deleting the last parent is refused rather than orphaning the household. |
| **VII. Private by default** | PASS | Allowlist with no sign-up path; RLS on every table; `noindex`; private avatar bucket with signed URLs; PIN hashes unreadable by any client role; a child cannot act as a parent even by hand-crafting the request. |
| **VIII. Fidelity is specified** | PASS | The spec asserts only `[V]` facts; 13 inferences and unknowns are recorded as explicit decisions under Assumptions. The punch-in model is logged as divergence #1 with its evidence. |

**Result: PASS. No violations, so Complexity Tracking is empty and omitted.**

### Re-check after Phase 1 design

Design introduced two things worth re-testing against the constitution:

- **Writes bypass RLS via the service role.** Justified under §VII rather than in tension with it: RLS cannot see the punch-in actor, so granting `authenticated` direct write access would let any signed-in device write *without* an actor — strictly weaker. Writes are funnelled through server actions that verify the actor first. Reads remain on RLS. Re-check: **PASS**.
- **`setProfilePin` works with no actor, not only with a punched-in parent.** A deliberate narrowing to satisfy FR-018/SC-010, without which a PIN-less household is permanently read-only. The authority is still proven family membership; a punched-in *member* is refused (FR-015). The residual risk — anyone at a signed-in device can reset a PIN while nobody is punched in — is recorded plainly in the spec's Assumptions rather than silently accepted. Re-check: **PASS**.
- **Sign-in is one shared household credential (2026-09-02).** Google is gone; `/family` has a single Supabase account whose address is server-side env and whose password Supabase alone validates. Tested against §VII: the account is a *door*, not an identity — every guarantee §VII rests on (RLS keyed to `auth.uid()`, the allowlist, PIN hashes unreadable, a child unable to act as a parent) is untouched, and attribution was never a property of the sign-in. The alternative the household first asked for — a password checked in `.env` with no Supabase session — was rejected here, not merely on taste: without a session there is no `auth.uid()`, so RLS has nothing to filter on, and the publishable key that ships in every browser would read the family's data. Re-check: **PASS**.
- **Amendments after adversarial review (2026-08-31).** Three blockers found by execution against a Postgres 17 Supabase image (email-keyed allowlist, `service_role` grants, caller-explicit PIN functions), one high finding (PIN hashes readable through the table-level grant → `profile_pins` with no client grants), and the Auth-API hole in FR-004 (sign-up hook + providers off) are all recorded in data-model.md's "Amendments" section with rationale. None weakens a guarantee; each closes a gap between what the spec promised and what the schema delivered. Re-check: **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-family-foundation/
├── plan.md              # This file
├── spec.md              # Approved specification
├── research.md          # Phase 0 — 12 resolved decisions, + R13 (sign-in, 2026-09-02)
├── data-model.md        # Phase 1 — schema, policies, constraints
├── quickstart.md        # Phase 1 — setup and verification
├── contracts/
│   └── server-actions.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output — created by /speckit.tasks
```

### Source code (repository root)

```text
proxy.ts                                  # Next 16 convention (was middleware.ts); NOT an auth boundary
next.config.ts                            # + serverActions.bodySizeLimit for avatar upload (only change)
vitest.config.ts                          # unit + policies projects

app/family/
├── layout.tsx                            # fonts, tokens, metadata (noindex, manifest link, appleWebApp), viewport
├── tokens.css                            # --fam-* custom properties under .family
├── manifest.webmanifest/route.ts         # PWA manifest as a route handler (nested manifest.ts is not served)
├── (auth)/layout.tsx                     # bare frame for the signed-out screens
├── (auth)/sign-in/page.tsx               # one password field, nothing else
├── (auth)/sign-in/SignInForm.tsx         # 'use client': password + submit → signIn()
├── (auth)/not-authorized/page.tsx        # allowlist rejection (backstop; no sign-up path)
└── (app)/
    ├── layout.tsx                        # server gate + initial data → FamilyProvider
    ├── page.tsx                          # redirect → /family/calendar
    ├── calendar|tasks|rewards|meals|lists/page.tsx   # placeholders
    ├── settings/page.tsx                 # profiles, labels, PINs, preferences, account
    └── components/
        ├── FamilyProvider.tsx            # 'use client': query client, actor, idle model, realtime, withActor()
        ├── nav.ts  Sidebar.tsx  BottomNav.tsx  TopBar.tsx  Clock.tsx  Fab.tsx
        ├── Avatar.tsx  ProfileChip.tsx  ProfileChipRow.tsx  FilterSheet.tsx  useDeviceVisibility.ts
        ├── PunchInSheet.tsx  PinPad.tsx  ActorBadge.tsx
        ├── settings/{HouseholdSection,ProfilesSection,ProfileForm,ColorPicker,AvatarPicker,PinRow,DeleteDialog,AccountSection}.tsx
        └── __tests__/                    # component tests (components + lib imports only)

lib/family/
├── types.ts                              # shared domain types
├── rows.ts                               # row shapes, explicit column lists, mappers (never select('*'))
├── errors.ts                             # ActionResult / ActionFailure / runAction
├── env.ts                                # env access (no server-only, so unit tests can import)
├── colors.ts                             # 20-colour palette + tint derivation
├── avatars.ts                            # frozen illustration ids + limits
├── ordering.ts                           # fractional-index helpers
├── permissions.ts                        # pure authorization rules (incl. bootstrap)
├── validation.ts                         # Zod schemas
├── actor-token.ts                        # sign/verify the actor JWT (pure)
├── actor.ts                              # cookie read/write/clear (server-only)
├── guards.ts                             # requireMember/requireActor/requireParent/requireParentOrBootstrap
├── queries.ts                            # RLS-backed reads + TanStack hooks
├── image.ts                              # magic-byte MIME sniff
├── supabase/{client,server,admin,proxy}.ts
├── actions/{auth,punch-in,pins,categories,avatars,settings}.ts   # auth.ts = signIn + signOut; only signIn reads FAMILY_ACCOUNT_EMAIL
└── __tests__/
    ├── unit/                             # colors, ordering, validation, permissions, actor-token
    └── policies/                         # global-setup, helpers, access, privileges, pins, categories, actions

supabase/
├── config.toml                           # family exposed locally; ports 553xx
├── seed.sql                              # comment-only placeholder
└── migrations/001–009_*.sql              # schema, households, categories, pins, settings, storage, seed, auth hook, realtime
scripts/family-seed.mjs                   # people + allowlist from .env.local (never committed)
public/family/icons/                      # PWA icons
public/family/avatars/<id>.svg            # ten original illustrated animals
```

**Structure Decision**: A feature module inside the existing Next.js app, following the convention already set by `app/colectivo/routes/`. `app/family/**` is presentation; `lib/family/**` is domain and data access and never imports from `app/**`. The route group split — `(auth)` outside the shell, `(app)` inside it — means the shell's provider chain is not constructed for a signed-out visitor, so there is no path by which household content can render before authentication resolves. Since the auth change of 2026-09-02 the `(auth)` group holds **no route handler at all**: sign-in is a server action, so the only public surface is one page with one password field. Fallow's boundary rules enforce the import direction at the commit gate.

## Implementation phasing

Ordered so each step is independently verifiable. `/speckit.tasks` will expand these.

| # | Step | Verifiable by |
|---|---|---|
| 1 | Dependencies + Supabase client factories | Typecheck; a smoke query against the live project |
| 2 | Migrations 001–009, applied to the local stack | `supabase db reset`; tables visible; privilege matrix holds; live `supabase db push` is an operator step |
| 3 | `permissions.ts`, `colors.ts`, `actor-token.ts` — **tests first** | Unit suite green; these are pure and need no database |
| 4 | Household-password sign-in, `proxy.ts`, allowlist | Signed-out redirect; the household password reaches the shell; a wrong one is refused with one message |
| 5 | Policy integration suite | Member reads; non-member gets zero rows; SC-001 demonstrated |
| 6 | Punch-in: `verify_pin`, actions, sheet, cookie, rate limit | Correct PIN acts; wrong PIN refused; 5 failures lock; SC-002 demonstrated |
| 7 | Design tokens + shell (sidebar/bottom nav, top bar, chips, FAB) | Renders at three widths; screenshots against the reference layouts |
| 8 | Profiles & Labels CRUD + reorder + avatars + settings | Full round-trip as a parent; every write refused as a member |
| 9 | Manifest route + icons; seed script against the hosted project | Installs to the iPad home screen and launches full-screen; parents on the allowlist |

## Risks

| Risk | Mitigation |
|---|---|
| A policy that references its own table recurses and errors at query time | `is_member()` is `SECURITY DEFINER`, sidestepping recursion; the policy suite covers it explicitly |
| Custom schema not reachable from the client | `family` must be added to **Exposed schemas** *and* granted; both are in the quickstart, and the failure mode (permission error, not empty set) is documented so it is not mistaken for a policy bug |
| Service-role key leaking into a client bundle | `lib/family/supabase/admin.ts` carries `import 'server-only'`; a client import fails the build rather than shipping |
| The 13 pre-existing lint errors mask a new one | They are in files this feature does not touch; the gate is run before and after so any delta is attributable |
| The household password is one secret shared by two people, and Supabase's Email provider must stay **on** for it to work — so the sign-up switch is the only thing standing between the publishable key and a self-minted session | Quickstart §4 turns "Allow new users to sign up" **off** and enables the Before-User-Created hook, in that order and only after the one account exists; the privilege matrix means even a minted session reads `[]`, because it is not on the allowlist |
| The household account is seeded *after* the schema but *before* sign-ups are closed; getting that order wrong locks the family out of their own project | Quickstart §4 numbers the steps and says why; recovery is the Dashboard (create/reset the account), which is also the documented "forgot the password" path (spec edge case) |
| The admin client cannot write to `family` — `BYPASSRLS` skips policies, not `GRANT`s (verified against a Postgres 17 Supabase image: "permission denied for schema family") | `001` grants `usage` to `service_role` and sets default privileges on tables/sequences; the PIN functions get explicit `execute`; the policy suite asserts the whole privilege matrix so a missing grant fails a test, not a user |
| Hosted `storage` objects are owned by `supabase_storage_admin`, so `006`'s bucket insert / `create policy` may be refused on `db push` | Both statements run inside guarded `DO` blocks that NOTICE instead of failing; the operator creates the bucket in the Dashboard if needed; the app never depends on the storage policy — reads use server-minted signed URLs |

## Progress

- [x] Phase 0 — research complete (12 decisions, no open unknowns)
- [x] Phase 1 — data model, contracts, quickstart written
- [x] Constitution check — pass, before and after design
- [x] Phase 2 — `/speckit.tasks`
- [x] Adversarial design review — findings folded into data-model.md, contracts, quickstart, tasks (2026-08-31)
- [ ] Phase 3 — implementation in progress (2026-08-31): wave 1 (database, pure lib, server plumbing, tokens/layout, test infrastructure) building in parallel; live-project push, providers and the sign-up hook remain operator steps
- [x] Auth change (2026-09-02) — FR-002 replaced: Google sign-in and its callback route give way to one shared household password on a single Supabase account. Spec, contracts, research (R13), quickstart and tasks amended together; the schema, RLS, allowlist, punch-in and PINs are untouched. Operator steps changed shape: no Google Cloud client, no provider secrets — seed the account, then close sign-ups
