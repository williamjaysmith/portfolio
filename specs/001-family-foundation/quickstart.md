# Quickstart: Family Foundation

**Feature**: `001-family-foundation` | **Date**: 2026-08-28 | **Amended**: 2026-08-31

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
| `FAMILY_SEED_PARENT_EMAILS` | comma-separated Google addresses of the parents | personal — read only by the seed script, never committed |
| `FAMILY_SEED_PROFILES` | optional JSON array of starting profiles (`label`, `color`, optional `role`, `avatarId`, `birthday`; see the header of `scripts/family-seed.mjs` for the exact shape) | personal — same |

`.env.local` is gitignored. The secret key must never reach a client component; `lib/family/supabase/admin.ts` carries `import 'server-only'` so an accidental client import fails the build. The seed variables are read by `scripts/family-seed.mjs` only — the app never sees them, and no email or name is ever committed (constitution §VII).

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
npm run family:seed -- --local        # allowlists + creates the dev account dev@family.local,
                                      # seeds fixture profiles into the "Our Family" household
npm run dev:local                     # next dev with the local URL + keys inlined → http://localhost:3000/family
```

Open `http://localhost:3000/family/sign-in`. Against the local stack the page shows an **email + password dev sign-in form** under the Google button (rendered only when `NODE_ENV !== 'production'` **and** the Supabase URL is `127.0.0.1`/`localhost` — it never renders against the hosted project). Sign in as the dev account the seed script printed; `requireMember()` claims the allowlist row on the first request and you land on `/family/calendar`.

Studio: `http://127.0.0.1:55323`. Email provider stays **on** locally (it is what the dev form uses); the Before-User-Created hook is not enabled locally.

Editing `config.toml` needs `supabase stop && supabase start`. `supabase db reset` is the fastest way back to a clean state — the seed script is idempotent, so re-run it afterwards.

## 4. Hosted project — operator steps (one time, in this order)

Everything here needs the Dashboard or `SUPABASE_ACCESS_TOKEN`; none of it is done by the implementation.

1. **Push the schema**
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_...
   supabase link --project-ref zgmltllcyqylgtazunai
   supabase migration list              # confirm the remote side is empty
   supabase db push                     # applies 001–009
   ```
   Watch for two NOTICEs from `006_storage.sql`: if the bucket or its read policy could not be created (hosted `storage` objects are owned by `supabase_storage_admin`), create the bucket in **Storage → New bucket**: name `family-avatars`, **private**, 5 MB limit, allowed types `image/jpeg, image/png, image/webp`. The read policy is optional — the app mints signed URLs server-side.
2. **Expose the schema** — **Project Settings → API → Exposed schemas** → add `family` (or `PATCH /v1/projects/{ref}/postgrest` with `db_schema`). `db push` does not do this. Required, and easy to forget.
3. **Auth providers** — **Authentication → Providers**:
   - **Google: on.** Create the OAuth client in Google Cloud Console (**APIs & Services → Credentials → Create OAuth client ID → Web application**) with the authorized redirect URI exactly
     ```
     https://zgmltllcyqylgtazunai.supabase.co/auth/v1/callback
     ```
     and paste the Client ID / Secret into the provider.
   - **Email: off.** Otherwise `signUp` with the publishable key mints an `authenticated` session for anyone.
   - **Anonymous sign-ins: off** (they also assume the `authenticated` role).
   - **URL Configuration**: Site URL `https://willsmith.dev`; additional redirect URLs `http://localhost:3000/**` and `https://willsmith.dev/**`.
   - **Sessions**: leave "Time-box user sessions" and "Inactivity timeout" off (defaults) — FR-006 needs a wall tablet to stay signed in for days.
4. **Seed the people** — with `FAMILY_SEED_PARENT_EMAILS` (and optionally `FAMILY_SEED_PROFILES`) in `.env.local`:
   ```bash
   npm run family:seed -- --yes        # refuses to touch a non-local URL without --yes; prints the target first
   ```
   Inserts the allowlist rows and starting profiles. **No PINs** — they are set from Settings on first run (FR-018).
5. **Enable the sign-up hook — LAST** — **Authentication → Hooks → Before User Created** → `family.hook_restrict_signup`. Do this only after step 4, or the parents' own first sign-in is refused. With it on, no `auth.users` row is ever created for an address that is not on the allowlist.
6. Verify SC-001 a/b/c, SC-002 and SC-010 below; install on the iPad (SC-008).

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

# b) Signed in with a non-allowlisted Google account
#    → the Before-User-Created hook refuses the account (403 from Auth) and the callback lands on
#      /family/not-authorized. Before the hook is enabled: the account is created, the callback's
#      claim_membership() returns null → signed out → /family/not-authorized. Either way: no data.

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
| OAuth returns `redirect_uri_mismatch` | Callback URL differs by even a character | Must be exactly the URL in §4 step 3 |
| A parent's first Google sign-in lands on `/family/not-authorized` | The Before-User-Created hook was enabled before the allowlist rows existed, or the address differs in case/whitespace from the seed | Seed first (§4 step 4), hook last (step 5); addresses are stored lower-cased |
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
