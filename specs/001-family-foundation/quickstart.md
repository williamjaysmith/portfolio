# Quickstart: Family Foundation

**Feature**: `001-family-foundation` | **Date**: 2026-08-28 | **Amended**: 2026-08-31, 2026-09-02 (shared household password — no Google Cloud Console, no provider secrets)

Everything needed to go from a clean checkout to a working `/family` shell, plus how to verify each security guarantee actually holds. Day-to-day development runs against the **local** Supabase stack (§3); the hosted project needs a one-time set of **operator steps** (§4) that require the account's access token and Dashboard.

---

## 1. Supabase project

Already provisioned: project **`portfolio`**, ref **`zgmltllcyqylgtazunai`**, region **East US (Ohio)**, created with Data API on, automatic table exposure **off**, automatic RLS **on**. Nothing has been pushed to it yet — see §4.

## 2. Environment

```bash
cp .env.example .env.local
```

Fill from **Project Settings → API Keys** (use the new-format keys — the legacy `anon`/`service_role` JWTs are deprecated by end of 2026):

| Variable | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | already filled | no — public in every request |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | "publishable" (`sb_publishable_…`) | no — access is enforced by RLS |
| `SUPABASE_SECRET_KEY` | "secret" (`sb_secret_…`) | **yes — bypasses all RLS** |
| `FAMILY_ACTOR_SECRET` | `openssl rand -base64 32` | **yes — signs the actor cookie** |
| `FAMILY_ACCOUNT_EMAIL` | the household account's address — any address you control, e.g. `household@willsmith.dev`. Nobody ever types it: `signIn` reads it on the server and pairs it with the typed password | personal — server-side only, never sent to the browser |
| `FAMILY_ACCOUNT_PASSWORD` | the shared household password | **yes — but only `scripts/family-seed.mjs` reads it, to create the account (re-running the seed is how you rotate it). Nothing at runtime does; the app never holds or compares a password** |
| `FAMILY_SEED_PARENT_EMAILS` | optional, comma-separated. **Extra** addresses to allowlist — the shared account is allowlisted for you, so leave it empty unless a second account genuinely needs in | personal — read only by the seed script |
| `FAMILY_SEED_PROFILES` | optional JSON array of starting profiles (`label`, `color`, optional `role`, `avatar`, `birthday`, `emoji`, `isProfile`; see the header of `scripts/family-seed.mjs` for the exact shape) | personal — read only by the seed script |
| `FAMILY_DEV_PASSWORD` | `--local` only: the password for the local `dev@family.local` account | local throwaway |

`.env.local` is gitignored. The secret key must never reach a client component; `lib/family/supabase/admin.ts` carries `import 'server-only'` so an accidental client import fails the build. `FAMILY_ACCOUNT_EMAIL` has no `NEXT_PUBLIC_` prefix on purpose — the sign-in page must contain one field and no address (FR-002). The seed variables are read by `scripts/family-seed.mjs` only, and no email, name or password is ever committed (constitution §VII).

> **Changing the household password later** is a Dashboard action — **Authentication → Users →** the household account — not an edit to `.env.local`. Supabase holds the only copy that matters; `FAMILY_ACCOUNT_PASSWORD` is stale the moment you change it there, and nothing at runtime reads it. This is also the "we forgot the password" path, because no recovery mail is ever sent (spec edge case).

Local-only overrides for the policy suite and the seed script — defaults are the CLI's fixed local constants, so set these only if you changed them: `SUPABASE_LOCAL_URL` (`http://127.0.0.1:55321`), `SUPABASE_LOCAL_PUBLISHABLE_KEY`, `SUPABASE_LOCAL_SECRET_KEY`, `SUPABASE_LOCAL_DB_URL` (`postgresql://postgres:postgres@127.0.0.1:55322/postgres`). `supabase status -o env` prints the real values — trust it over this page.

For the operator steps in §4, also export a personal access token so the Supabase CLI and MCP server can reach the project:

```bash
echo 'export SUPABASE_ACCESS_TOKEN=sbp_...' >> ~/.zshrc && source ~/.zshrc
```

## 3. Local stack (day-to-day development)

The Portfolio stack uses its own port block (`supabase/config.toml`): API **55321**, DB **55322**, shadow 55320, Studio **55323**, Inbucket 55324, analytics 55327, pooler 55329. Another project's stack already occupies the CLI defaults `54321–54329` on this machine — leave it running; the two coexist.

```bash
supabase start                        # boots Postgres + Auth + PostgREST + Storage + Realtime on :553xx
supabase db reset                     # replays migrations 001–009 (+ the comment-only seed.sql)
npm run family:seed -- --local        # creates the local account dev@family.local, allowlists it,
                                      # seeds the fixture profiles and labels
npm run dev:local                     # next dev with the local URL + keys inlined → http://localhost:3000/family
```

`--local` needs no `FAMILY_ACCOUNT_*` at all: it creates `dev@family.local` with `FAMILY_DEV_PASSWORD` (or the script's built-in default) and prints the address it used, never the password. But the **app** still reads `FAMILY_ACCOUNT_EMAIL`, so put `FAMILY_ACCOUNT_EMAIL=dev@family.local` in `.env.local` next to `FAMILY_ACTOR_SECRET` — `npm run dev:local` inlines the local Supabase URL and keys and reads the rest from that file. Sign-in then exercises exactly the production code path.

Open `http://localhost:3000/family/sign-in`. There is **one field**, a password, and it behaves identically against the local stack and the hosted project — there is no dev-only form and no second sign-in method to keep working. Type the local password; `requireMember()` claims the allowlist row on the first request and you land on `/family/calendar`.

Studio: `http://127.0.0.1:55323`. The Email provider stays **on** locally *and* on the hosted project — it is the door the household password goes through. What is off on the hosted project (§4 step 5) is new sign-ups; locally, leave sign-ups on and the Before-User-Created hook off, so `supabase db reset` + seed always gets you back in.

Editing `config.toml` needs `supabase stop && supabase start`. `supabase db reset` is the fastest way back to a clean state — the seed script is idempotent, so re-run it afterwards.

## 4. Hosted project — operator steps (one time, in this order)

Everything here needs the Dashboard or `SUPABASE_ACCESS_TOKEN`; none of it is done by the implementation. There is no Google Cloud Console step and no provider client id or secret to paste anywhere — since 2026-09-02 the household signs in with one shared password on one account (research R13).

**The order is the whole point.** The one account must exist *before* the door is bolted: the seed creates it through the Admin API, and step 5 then turns new sign-ups off and switches on the hook that refuses any address not on the allowlist. Do 5 before 4 and the only account the household has may be refused at creation — recoverable only by turning the hook back off, which is exactly the confusion worth avoiding at 11pm on a wall tablet.

1. **Push the schema**
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_...
   supabase link --project-ref zgmltllcyqylgtazunai
   supabase migration list              # confirm the remote side is empty
   supabase db push                     # applies 001–009
   ```
   Watch for two NOTICEs from `006_storage.sql`: if the bucket or its read policy could not be created (hosted `storage` objects are owned by `supabase_storage_admin`), create the bucket in **Storage → New bucket**: name `family-avatars`, **private**, 5 MB limit, allowed types `image/jpeg, image/png, image/webp`. The read policy is optional — the app mints signed URLs server-side.
2. **Expose the schema** — **Project Settings → API → Exposed schemas** → add `family` (or `PATCH /v1/projects/{ref}/postgrest` with `db_schema`). `db push` does not do this. Required, and easy to forget.
3. **Choose the household credential** — in `.env.local`:
   ```bash
   FAMILY_ACCOUNT_EMAIL=household@willsmith.dev     # any address you control; nobody types it
   FAMILY_ACCOUNT_PASSWORD=…                        # what the household will actually type
   ```
   The address is only an identifier for Supabase — no mail is ever sent to it, and it never reaches the browser. Pick the password the way you would a door key the two of you share: long, memorable, written down somewhere physical if you like. Do not commit either.

   **Deployed runs need `FAMILY_ACCOUNT_EMAIL` in the Vercel project's environment too** (alongside `SUPABASE_SECRET_KEY` and `FAMILY_ACTOR_SECRET`) — `.env.local` covers only local runs, and without it every sign-in fails with the same unhelpful-by-design message. `FAMILY_ACCOUNT_PASSWORD` is **not** needed in Vercel: nothing at runtime reads it.
4. **Create the account and the allowlist row**
   ```bash
   npm run family:seed -- --yes        # refuses to touch a non-local URL without --yes; prints the target first
   ```
   Creates the household account with `email_confirm: true` (which is what makes a mail service unnecessary — nothing is ever sent), inserts its `household_users` allowlist row, and adds `FAMILY_SEED_PROFILES` if you set any. It prints the address it used and never the password. Re-running it re-applies the password, which is the other way to rotate it. **No PINs** — they are set from Settings on first run (FR-018).
5. **Close the door — LAST** — **Authentication**:
   - **Providers → Email: ON.** It is the only provider and the only way in; turning it off locks the household out. (This is the reverse of the pre-2026-09-02 instruction, which had Email off and Google on.)
   - **Sign In / Providers → "Allow new users to sign up": OFF.** This is what stops `signUp` with the publishable key minting an `authenticated` session for anyone (FR-004).
   - **Anonymous sign-ins: OFF** (they also assume the `authenticated` role).
   - **Hooks → Before User Created → `family.hook_restrict_signup`: ON.** Belt to the sign-up switch's braces: even if sign-ups are re-enabled by accident, no `auth.users` row is created for an address that is not on the allowlist. Only after step 4, or it refuses the household's own account.
   - **URL Configuration**: Site URL `https://willsmith.dev`; additional redirect URLs `http://localhost:3000/**` and `https://willsmith.dev/**`. (Nothing in the app redirects through Supabase any more, but the site URL is still used by the Dashboard's own password-reset mail if you ever send one.)
   - **Sessions**: leave "Time-box user sessions" and "Inactivity timeout" off (defaults) — FR-006 needs a wall tablet to stay signed in for days.
6. **Sign in once** at `https://willsmith.dev/family/sign-in` to confirm the whole chain: the password is accepted, `claim_membership()` binds the allowlist row on that first page load (there is no callback route), and you land on `/family/calendar`.
7. Verify SC-001 a/b/c, SC-002 and SC-010 below; install on the iPad (SC-008).

## 5. Run

```bash
npm run dev            # against the hosted project (needs §4 done)   → http://localhost:3000/family
npm run dev:local      # against the local stack (§3)
```

---

## Verifying the security guarantees

These are the acceptance criteria that matter. Each maps to a success criterion in the spec.

### SC-001 — nobody outside the family gets in

Three independent paths, all must fail:

```bash
# a) Signed out → redirected, and no household data in the HTML
curl -s -i http://localhost:3000/family/calendar | head -20        # expect 307 → /family/sign-in

# b) A wrong password on the sign-in screen
#    → no session is created; the screen shows one message ("That password isn't right.") that does
#      not distinguish a wrong password from an account that does not exist. There is no second
#      account to try, no sign-up link, and no address in the page to attack.
#    → and if an authenticated account somehow existed off the allowlist: claim_membership() returns
#      null, requireMember() refuses, and /family/not-authorized renders with no household data.

# c) Direct data access with the publishable key and no session
curl -s -i "https://zgmltllcyqylgtazunai.supabase.co/rest/v1/categories?select=id" \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
     -H "Accept-Profile: family"
# expect HTTP 401 with {"code":"42501", ...} — anon has no USAGE on schema family.
# An *authenticated* non-member (a session whose account is not on the allowlist) gets 200 and [] —
# that is RLS filtering, and it is what the policy suite asserts (access.test.ts).
```

(c) is the important one: it proves the guarantee lives in the database, not the interface. If you get `406` / `PGRST106` instead, the schema is not exposed (step §4.2) — a different failure.

### SC-002 — a child cannot perform a parent action

Automated in the policy suite (`actions.test.ts`), but verify by hand once:

1. Punch in as the child profile.
2. From the browser console, invoke a parent-only action directly (bypassing the disabled button).
3. Expect `FORBIDDEN`. The role comes from the signed cookie and is re-read from the database, never from the request body, so there is nothing in the request to tamper with.

### SC-010 — the household cannot lock itself out

1. Remove every PIN:
   ```sql
   delete from family.profile_pins;      -- has_pin resets to false via trigger
   ```
   (A fresh seed is already in this state — nothing seeds a PIN.)
2. Reload. The app is fully readable; every mutating control asks for a PIN; no profile can be selected in the picker.
3. Signed in, with nobody punched in, open Settings → set a PIN on a parent profile. It must succeed **without** anyone being punched in — that is FR-018.
4. Punch in as a member and try the same PIN row: it is disabled and the server answers `FORBIDDEN`.

### SC-008 — installs and stays signed in

Open `/family` in Safari on the iPad → Share → Add to Home Screen → launch from the icon. Expect full-screen, no browser chrome, still signed in. Rotate to portrait: the rail becomes a bottom bar (iPadOS ignores the manifest's `orientation` — landscape-first is a layout guarantee, not a lock). Re-check the session after a week idle.

---

## Test suites

```bash
npm test                 # both projects; the policies project auto-skips with a console notice when :55321 is down
npm run test:unit        # pure logic + component tests — no database
npm run test:policies    # RLS / privileges / PIN / actions — FAMILY_POLICY_TESTS=1, so a missing stack is a FAILURE, not a skip
npm run test:coverage    # the above plus an Istanbul report in coverage/ — read by the fallow gate
```

The policy suite needs the local stack from §3 (`supabase start && supabase db reset`); its global setup creates its own household, allowlist rows and three auth users (two members, one stranger) and deletes them afterwards, so it does not depend on the seed script. It asserts: members read their household and strangers read `[]`; anon gets `401`/`42501`; the privilege matrix in data-model.md matches exactly; PIN lockout and reset semantics; last-parent refusal; and, at the server-action level, SC-002 and SC-010 including a tampered cookie and a cookie from another account. Mocking the Supabase client here would test the mock, not the policy, and would pass while production was wide open.

---

## Quality gates

All four must pass before every commit (`.claude/rules/quality-bars.md`):

```bash
npm run fallow:audit    # regenerates coverage, then: zero NEW findings vs baseline
npm test
npm run typecheck
npm run lint
```

**Coverage feeds the gate.** fallow scores each function's CRAP as
`cyclomatic² × (1 − coverage)³ + cyclomatic` and fails at 30. With no coverage data it
assumes *nothing* is tested, so any function with five or more branches fails on arithmetic
alone. `.fallowrc.json` therefore points `health.coverage` at `coverage/coverage-final.json`
(Istanbul, written by `npm run test:coverage`), and `npm run fallow:audit` regenerates it
first. The thresholds themselves are untouched — `maxCyclomatic: 20`, `maxCognitive: 15`, and
fallow's default `maxCrap: 30`; supplying real coverage makes the score *accurate*, it does not
relax it. If the git `pre-commit` hook (which calls `fallow` directly) reports complexity
findings you do not recognise, run `npm run test:coverage` once and try again — the report is
stale or missing.

`lint` currently reports **13 pre-existing problems** in `app/components/**` and `app/skyhammer/**` — unrelated to this feature, deliberately untouched. This feature must add none. Compare counts before and after; the delta is what matters.

No suppressions: no `fallow-ignore`, `eslint-disable`, `@ts-ignore`, threshold lifts or baseline bumps. If a gate fails, the code changes.

---

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Anonymous REST probe returns `401` / `42501` | **Expected** — `anon` has no grant on the schema | Nothing; this is SC-001(c) passing |
| REST returns `406` / `PGRST106` | `family` not in Exposed schemas | §4 step 2 |
| A server action fails with `permission denied for schema family` | `service_role` grants missing — `001` must `grant usage … to service_role` and set default privileges; BYPASSRLS does not bypass GRANTs | Re-apply `001`; check `select has_schema_privilege('service_role','family','usage')` |
| Query returns `[]` when rows exist | RLS is filtering — the account is not on the allowlist, or has not claimed its row | Confirm the row in `family.household_users` and that `user_id` is bound (`claim_membership()` runs on first sign-in) |
| Punch-in returns `NOT_FOUND` for every profile | `p_user_id` passed to `verify_pin` is not the session user, or that account is not a member of the profile's household (`household_users.user_id` still null) | Pass `user.id` from `requireMember()`; check the allowlist row is claimed |
| `infinite recursion detected in policy` | A policy queried its own table without `SECURITY DEFINER` | `is_member()` must be `SECURITY DEFINER` |
| "That password isn't right." every time | By design the message cannot tell you which of these it is: the password is wrong; `FAMILY_ACCOUNT_EMAIL` is set but points at an address with no account; the account was never seeded; or the Email provider was turned off | Check `select email from auth.users` for the address in `FAMILY_ACCOUNT_EMAIL`; if it is missing, run §4 step 4 (temporarily re-enabling sign-ups if the hook blocks it). If it exists, set a new password in **Authentication → Users** |
| "Can't reach the house right now." on sign-in | `UNAVAILABLE`, not a credential failure — `FAMILY_ACCOUNT_EMAIL` is **unset** in this environment (a Vercel deploy that never got it, most often), or Supabase is unreachable | Set it where the app runs, not just in `.env.local`; the server log carries the reason string |
| Sign-in succeeds but lands on `/family/not-authorized` | The account exists but no allowlist row matches it — the seed did not run, or the address differs in case/whitespace | Confirm a `family.household_users` row whose `email` equals the account address (stored lower-cased); `claim_membership()` binds it on the next page load |
| The sign-in page shows an email field, or the household address appears in the HTML | A regression against FR-002 — the address is server-side only | `FAMILY_ACCOUNT_EMAIL` must have no `NEXT_PUBLIC_` prefix, and only `familyAccountEmail()` in `lib/family/env.ts` (called from the `signIn` action) may read it |
| Punch-in always returns `NO_ACTOR` | `FAMILY_ACTOR_SECRET` missing or changed; or the cookie was minted under a different account on this device | Set it (changing it invalidates existing cookies by design); sign out and back in |
| Punch-in works in Chrome but not Safari on `http://localhost` | Cookie set with `Secure` on a non-HTTPS origin | `secure` must be `NODE_ENV === 'production'`; use `npm run dev:local` |
| Punch-out leaves the actor badge | Cookie cleared with `cookies().delete()` (`Path=/`) instead of `Path=/family` + `maxAge: 0` | Clear with the identical attributes |
| Manifest not picked up (no `<link rel="manifest">`, no install prompt) | A nested `app/family/manifest.ts` is **not** a Next metadata route (root-only) | The manifest must be served by the route handler `app/family/manifest.webmanifest/route.ts` and linked via `metadata.manifest` in `app/family/layout.tsx`; the proxy must let that path through unauthenticated |
| `006_storage.sql` prints a NOTICE about the bucket or policy | Hosted `storage` objects are owned by `supabase_storage_admin` | Create the bucket in the Dashboard (§4 step 1); the policy is optional |
| Live updates never arrive | Tables not in `supabase_realtime` | `009_realtime.sql`; check `select * from pg_publication_tables where pubname = 'supabase_realtime'` |
| `supabase start` fails with a port conflict | Another stack owns `54321–54329` | This repo's `config.toml` uses `553xx`; do not stop the other stack |
| Build fails on a `server-only` import | A client component imported the admin client, `actor.ts` or `guards.ts` | Move the call into a server action — this guard is working |
| Profile colours all look identical | `color-mix()` unsupported | Expected fallback on old browsers (research R8); check Safari ≥ 16.2 |

---

## Known gaps carried into Phase 2

Real, recorded, and deliberately not fixed in Phase 1.

- **A photo can only be added after a profile is saved.** US3-3 reads as though
  the choice is offered while creating one; the avatar picker in the create form
  offers the ten illustrations and "initials", and the photo control lives on the
  saved row. Uploading needs an id to store against, so wiring it into creation
  means a create-then-upload sequence with its own partial-failure story.
- **`updateHouseholdSettings` and `reorderCategories` are not atomic.** Each
  writes more than once without a transaction. Validation precedes every write,
  so a rejected input writes nothing, but a database failure part-way through
  leaves the rest unwritten. `reorderCategories` is self-healing (the order is
  recomputed from scratch next time); the settings pair is not.
- **`.fam-tint-20` has no consumer yet.** FR-036 specifies three strengths and
  FR-037 says the token layer serves every later phase; the 20 % rung is the
  Tasks/Rewards column header, which arrives in Phase 3. fallow reports it as
  dead CSS surface (advisory) until then.
- **Sizing literals sit beside the tokens that mean the same thing.** The 44 px
  touch floor and the nav icon sizes are written as literals rather than read
  from `--fam-touch` / `--fam-nav-icon`, because the floor must NOT scale with
  the viewport — that is the point of a floor. fallow reports each as token
  drift (advisory).
- **`density` is stored and unused.** Nothing in the shell reads a spacing token
  it could scale; every gap is a literal Tailwind class.
