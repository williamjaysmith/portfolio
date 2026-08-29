# Phase 0 Research: Family Foundation

**Feature**: `001-family-foundation` | **Date**: 2026-08-28

Every unknown in the Technical Context, resolved. Each entry records the decision, why, and what was rejected. Facts verified against a primary source this session are marked `[verified]`.

---

## R1 — Request interception: `proxy.ts`, not `middleware.ts`

**Decision**: Use `proxy.ts` at the repository root, exporting a function named `proxy`.

**Rationale**: `[verified]` Next.js 16 deprecated and renamed the `middleware` convention. From the official reference: *"The `middleware` file convention is deprecated and has been renamed to `proxy`."* The version history is explicit: `v16.0.0 — Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime.* This repo runs Next 16.1.6, and the installed constants expose both `MIDDLEWARE_FILENAME` and `PROXY_FILENAME`, confirming both are recognised but only one is current.

**Critical corollary — this changes the security design.** The same reference warns:

> *"Server Functions are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Proxy coverage. A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. **Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone.**"*

So `proxy.ts` is a **redirect convenience, not a security boundary**. Every server action re-checks the session and the actor itself. This is what FR-015 demands ("enforce on the server rather than by hiding controls") and it is why the design has three independent layers (§R5).

**Alternatives rejected**: `middleware.ts` — works today but is deprecated and would need migrating. Relying on proxy alone for authorization — explicitly warned against by the framework.

---

## R2 — PIN verification: a Postgres `SECURITY DEFINER` function, not application code

**Decision**: PIN hashes live in a column no client role can read. Verification happens in `family.verify_pin(profile_id, pin)`, a `SECURITY DEFINER` function using `pgcrypto`'s `crypt()` with a blowfish salt. It performs rate-limiting and returns only a boolean plus a reason.

**Rationale**: Three properties fall out for free:

1. **The hash never leaves Postgres.** No application code, no service-role client, and no network hop ever holds it. A bug in a server action cannot leak it because the value is not reachable.
2. **Rate limiting is atomic** with the attempt itself — one statement, no race between "check attempts" and "record attempt", which a two-step application implementation would have.
3. **It cannot be bypassed by the client.** `SECURITY DEFINER` means the function runs as its owner; the calling role is only granted `EXECUTE`, never `SELECT` on the hash column.

`pgcrypto` ships with Supabase and needs only `CREATE EXTENSION`.

**Alternatives rejected**: `bcryptjs` in a server action — requires reading the hash out of the database into Node, which means a service-role client in request-handling code and a hash crossing two boundaries for no benefit. A JWT claim carrying the role — considered for Phase 1 and rejected as premature; a custom access-token hook is meaningful complexity and the cookie approach (§R3) is sufficient and simpler to reason about.

**Note on cost**: bcrypt is deliberately slow (~100 ms at cost 10). That is the point, and it is imperceptible against SC-003's 5-second budget.

---

## R3 — Actor session: a signed, HTTP-only cookie

**Decision**: On successful PIN entry, the server action mints a compact JWT (HS256, via `jose`) containing the profile id, role, household id and an expiry, and sets it as an HTTP-only, `Secure`, `SameSite=Lax` cookie scoped to `/family`. Every server action verifies the signature and expiry before acting. Idle expiry is refreshed on each successful mutation.

**Rationale**: The actor is a *client-side convenience over a server-verified fact*. It must be unforgeable (signed), invisible to scripts (HTTP-only, which also removes an XSS escalation path), and per-device (a cookie naturally is — satisfying the "two people punch in on different devices" edge case with no extra work). `jose` is the standard, audited primitive and works in both runtimes.

**Why not just a database session row**: it would need a lookup on every action and a cleanup job, to buy revocation we do not need for a 3-minute idle window.

**Alternatives rejected**: Unsigned cookie holding a profile id — trivially forgeable, would let a child act as a parent by editing a cookie. Hand-rolled HMAC — rolling one's own auth crypto for no gain over `jose`. `localStorage` — readable by any script and unavailable to server actions.

---

## R4 — Custom `family` schema: exposure and grants

**Decision**: All tables live in a `family` schema. Post-migration, `family` is added to **Project Settings → API → Exposed schemas**, and the client calls `supabase.schema('family')`. Because the project was created with *"Automatically expose new tables"* off, every table needs an explicit `GRANT` in its migration.

**Rationale**: Schema separation is what lets the one free-tier project host future sub-apps without name collisions or accidental cross-app exposure. The explicit grants are a feature, not a tax: a table is invisible to the API until a migration deliberately exposes it, which is exactly the private-by-default posture constitution §VII asks for.

**Consequence to remember**: a new table with RLS enabled but no `GRANT` returns a permission error, not an empty set — a different failure mode from "RLS filtered everything out". The quickstart documents both so the difference is not mistaken for a policy bug.

**Alternatives rejected**: Everything in `public` with a `family_` prefix — works, but gives up the separation and makes a future sub-app's tables indistinguishable. Leaving auto-expose on — contradicts the deliberate-exposure decision made at project creation.

---

## R5 — Authorization: three independent layers

**Decision**: Enforce at three levels, each sufficient to deny on its own.

| Layer | Enforces | Mechanism |
|---|---|---|
| 1. Household membership | "Are you family at all?" | RLS on every table via `family.is_member()`, checked against `auth.uid()` |
| 2. Actor identity | "Who is doing this?" | Signed cookie (§R3), verified inside each server action |
| 3. Actor role | "Are you allowed to do *this*?" | Explicit check in each parent-only server action |

`family.is_member()` is a `STABLE SECURITY DEFINER` function so policies can call it without every table needing a join, and so the membership table itself is not subject to recursive policy evaluation.

**Rationale**: SC-001 and SC-002 require that a request bypassing the interface still fails. Layer 1 alone stops strangers even with a stolen anon key, because the anon key carries no household membership. Layers 2 and 3 stop a child from performing parent actions even if they craft the request by hand, because the cookie is signed and the role is read from it server-side, never from the request body.

**Known pitfall, designed around**: a policy that references its own table recursively will error at query time. `is_member()` being `SECURITY DEFINER` sidesteps this; the migration includes a test that a member can read and a non-member gets zero rows.

**Alternatives rejected**: RLS alone — cannot express "which *profile* is acting", since Supabase Auth knows the account, not which family member is standing at the tablet. Application checks alone — a leaked anon key would expose everything.

---

## R6 — PIN rate limiting

**Decision**: Track `failed_attempts` and `locked_until` on the profile row, updated inside `verify_pin()`. Five consecutive failures lock that profile's punch-in for 15 minutes; any success resets the counter.

**Rationale**: A 4-digit PIN is 10,000 combinations — brute-forceable in seconds without a limit. Locking per profile rather than per device means a child cannot lock a parent out by hammering their own PIN, and the lock is visible to the household rather than hidden in an edge cache. Postgres is already in the request path, so this adds no infrastructure.

**Deliberate non-goal**: this is a household of three behind an authenticated allowlist, not a public login. The threat is a curious child, not a botnet. Five attempts and a visible cooldown is proportionate; IP-based limiting or a captcha would be theatre.

**Alternatives rejected**: Upstash Redis — a paid dependency for a problem one column solves. Exponential backoff — harder to explain to a child than "wait 15 minutes".

---

## R7 — Avatar storage

**Decision**: A private Supabase Storage bucket `family-avatars`. Uploads go through a server action that validates type and size, then stores at `<household_id>/<profile_id>.<ext>`. Reads use short-lived signed URLs. Limits: 5 MB, `image/jpeg|png|webp` only.

**Rationale**: Photos of a child must not be publicly addressable — a public bucket means a guessable URL is world-readable forever, which fails constitution §VII. Path-prefixing by household makes the storage policy a simple prefix match. Server-side validation is required because a client-side file-type check is trivially bypassed.

**Alternatives rejected**: Public bucket — unacceptable for children's photos. Base64 in Postgres — bloats every profile query for no benefit.

---

## R8 — The tint system in CSS

**Decision**: One CSS custom property per profile holding its palette hex; all derived surfaces use `color-mix(in srgb, var(--profile) 40%, white)` and `20%`. Applied by setting `--profile` on a container element.

**Rationale**: This is a direct implementation of the research's most reusable finding — one accent at three fixed strengths reproduces the reference product's entire colour treatment. Deriving in CSS rather than JavaScript means no recomputation on re-render and no hydration mismatch. `color-mix()` is supported in Safari 16.2+, which comfortably covers any iPad capable of running current iPadOS.

**Fallback**: for browsers without `color-mix`, an `@supports` block supplies the full-strength colour everywhere. Legible, less pretty, no layout change. Not worth more than that for a household of three on known devices.

**Alternatives rejected**: Precomputing three hexes per profile in the database — triples the stored state and makes changing a colour a multi-column write. Tailwind opacity utilities — they modify the element's own alpha, which would fade the text too, not just the background.

---

## R9 — PWA installability

**Decision**: Ship a Web App Manifest in Phase 1 (`display: standalone`, `orientation: landscape-primary`, icons, theme colour). **Defer the service worker to Phase 5**, where it arrives with the offline cache it exists to serve.

**Rationale**: On iOS/iPadOS, Add to Home Screen requires only a manifest served over HTTPS — a service worker is not needed for installation, only for offline capability. Since the iPad is the target and offline is explicitly a Phase 5 requirement, shipping an empty service worker now would be ceremony with a real cost: a stale-cache class of bug during the phase where the app changes most.

**Consequence, accepted**: Chrome on Android will not show an install prompt until Phase 5. No one in this household uses Android for this, and Add to Home Screen still works manually.

**Alternatives rejected**: A PWA plugin — pulls in build machinery for a manifest we can write by hand in twenty lines. Shipping a no-op service worker now — adds a cache-invalidation failure mode during active development for zero benefit.

---

## R10 — Testing strategy

**Decision**: Three tiers.

| Tier | Covers | Tool |
|---|---|---|
| Unit | Pure logic: permission rules, colour derivation, PIN-format validation, actor-token encode/decode | Vitest — fast, no I/O |
| Policy | Every RLS policy: member reads, non-member reads nothing, parent-only writes | Vitest integration suite against a local Supabase, two clients (member / non-member) |
| Visual | Shell at three viewport widths | Manual, with Chrome DevTools MCP screenshots against the reference layouts |

**Rationale**: Constitution §II requires a failing-first test for pure logic; the permission module is exactly that and is the highest-value thing in the phase to test. But SC-001 and SC-002 are *database* guarantees — a unit test of application code cannot prove that a non-member's query returns nothing, because the enforcement is in Postgres. Those need a real database and two real clients, which is what the policy tier is for.

**Alternatives rejected**: pgTAP — the idiomatic choice for testing policies in SQL, rejected because it introduces a second test runner and reporting format for a suite that will hold perhaps twenty assertions. Revisit if policy tests outgrow the Vitest tier. Mocking the Supabase client for policy tests — would test the mock, not the policy, and would pass while production was wide open.

---

## R11 — Data access and live updates

**Decision**: `@supabase/ssr` for the browser/server/proxy client factories. TanStack Query for caching and optimistic updates. A single Realtime channel subscribed in the shell provider, invalidating query keys on change.

**Rationale**: `@supabase/ssr` is the supported way to share an auth session across server components, server actions and `proxy.ts` via cookies. Phase 1 has little data to cache, but the provider and client factories are foundation by definition — every later phase plugs into them, and retrofitting them later would touch every screen.

**Scope note**: Phase 1 wires the plumbing and proves it with profiles. The interesting cache invalidation arrives with the calendar in Phase 2.

**Alternatives rejected**: Server actions for all reads — loses the live-update property the wall tablet exists for. SWR — equivalent; TanStack Query has the stronger optimistic-update story, which Phase 3's task-tapping needs.

---

## R12 — Typefaces

**Decision**: Fraunces (serif) and DM Sans (sans), self-hosted via `next/font/google`, scoped to the `/family` layout only.

**Rationale**: The reference product's faces are commercial and were never confirmed for the device UI. These are the closest free matches identified in the design research — DM Sans notably shares the double-storey `a` with single-storey `g` pairing that characterises the original sans. `next/font` self-hosts and preloads, so there is no third-party request and no layout shift. Scoping to the `/family` layout keeps the portfolio's own typography untouched.

**Alternatives rejected**: Licensing the originals — real money for a family calendar. System fonts — abandons the fidelity goal that constitution §VIII makes a requirement.

---

## Resolved unknowns

| Was unknown | Resolution |
|---|---|
| Which request-interception convention Next 16 uses | `proxy.ts` `[verified]` — R1 |
| Whether proxy can be the authorization boundary | No, explicitly `[verified]` — R1, R5 |
| Where PIN hashing happens | In Postgres, `SECURITY DEFINER` + `pgcrypto` — R2 |
| How the actor is carried | Signed HTTP-only JWT cookie — R3 |
| How a custom schema reaches the client | Exposed schemas + explicit grants — R4 |
| Whether a service worker is needed to install on iPad | No — manifest suffices — R9 |
| How RLS policies get tested | Local Supabase + two clients — R10 |

No `NEEDS CLARIFICATION` items remain.
