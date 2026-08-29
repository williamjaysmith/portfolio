# Quickstart: Family Foundation

**Feature**: `001-family-foundation` | **Date**: 2026-08-28

Everything needed to go from a clean checkout to a working `/family` shell, plus how to verify each security guarantee actually holds. Steps 1–4 are one-time account setup and are the operator's to do.

---

## 1. Supabase project

Already provisioned: project **`portfolio`**, ref **`zgmltllcyqylgtazunai`**, region **East US (Ohio)**, created with Data API on, automatic table exposure **off**, automatic RLS **on**.

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

`.env.local` is gitignored. The secret key must never reach a client component; `lib/family/supabase/admin.ts` carries `import 'server-only'` so an accidental client import fails the build.

Also export a personal access token so the Supabase CLI and MCP server can reach the project:

```bash
echo 'export SUPABASE_ACCESS_TOKEN=sbp_...' >> ~/.zshrc && source ~/.zshrc
```

## 3. Google OAuth

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID → Web application**
2. Authorized redirect URI — exactly:
   ```
   https://zgmltllcyqylgtazunai.supabase.co/auth/v1/callback
   ```
3. Copy Client ID and Secret into Supabase → **Authentication → Providers → Google** → enable.
4. Supabase → **Authentication → URL Configuration** → Site URL `http://localhost:3000`, additional redirect URLs `http://localhost:3000/**` and `https://willsmith.dev/**`.

## 4. Apply migrations

```bash
supabase link --project-ref zgmltllcyqylgtazunai
supabase db push
```

Then — **required, and easy to forget** — Supabase → **Project Settings → API → Exposed schemas** → add `family`.

> If a query returns a *permission* error rather than an empty result, the schema is not exposed or a `GRANT` is missing. That is a different failure from RLS filtering rows out, which returns `[]`. Check exposure first.

## 5. Run

```bash
npm install
npm run dev            # http://localhost:3000/family
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
#    → lands on /family/not-authorized, session cleared

# c) Direct data access with the publishable key and no session
curl -s "https://zgmltllcyqylgtazunai.supabase.co/rest/v1/categories" \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
     -H "Accept-Profile: family"
# expect []  — RLS returns nothing, not an error
```

(c) is the important one: it proves the guarantee lives in the database, not the interface.

### SC-002 — a child cannot perform a parent action

Automated in the policy suite, but verify by hand once:

1. Punch in as the child profile.
2. From the browser console, invoke a parent-only action directly (bypassing the disabled button).
3. Expect `FORBIDDEN`. The role comes from the signed cookie, never from the request body, so there is nothing in the request to tamper with.

### SC-010 — the household cannot lock itself out

1. Clear every `pin_hash`:
   ```sql
   update family.categories set pin_hash = null;
   ```
2. Reload. The app is fully readable; every mutating control asks for a PIN; no profile can be selected.
3. As a signed-in parent, open Settings → set a PIN. It must succeed **without** anyone being punched in — that is FR-018.

### SC-008 — installs and stays signed in

Open `/family` in Safari on the iPad → Share → Add to Home Screen → launch from the icon. Expect full-screen, no browser chrome, landscape-first, still signed in. Re-check after a week idle.

---

## Test suites

```bash
npm test                                     # everything
npm test -- lib/family/__tests__/unit        # pure logic — no database
npm test -- lib/family/__tests__/policies    # RLS — needs a database
```

The policy suite needs a local stack:

```bash
supabase start                               # local Postgres + Auth on :54321
supabase db reset                            # replay migrations + seed
npm test -- lib/family/__tests__/policies
supabase stop
```

It uses two clients — one authenticated as a member, one as a non-member — and asserts that the member reads their household and the non-member reads nothing. Mocking the Supabase client here would test the mock, not the policy, and would pass while production was wide open.

---

## Quality gates

All four must pass before every commit (`.claude/rules/quality-bars.md`):

```bash
npm run fallow:audit    # zero NEW findings vs baseline
npm test
npm run typecheck
npm run lint
```

`lint` currently reports **13 pre-existing problems** in `app/components/**` and `app/skyhammer/**` — unrelated to this feature, deliberately untouched. This feature must add none. Compare counts before and after; the delta is what matters.

No suppressions: no `fallow-ignore`, `eslint-disable`, `@ts-ignore`, threshold lifts or baseline bumps. If a gate fails, the code changes.

---

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Query returns a permission error | `family` not in Exposed schemas, or a missing `GRANT` | Add the schema (step 4); check the migration granted `select` |
| Query returns `[]` when rows exist | RLS is filtering — the account is not on the allowlist | Confirm the row in `family.household_users` |
| `infinite recursion detected in policy` | A policy queried its own table without `SECURITY DEFINER` | `is_member()` must be `SECURITY DEFINER` |
| OAuth returns `redirect_uri_mismatch` | Callback URL differs by even a character | Must be exactly the URL in step 3.2 |
| Punch-in always returns `NO_ACTOR` | `FAMILY_ACTOR_SECRET` missing or changed | Set it; changing it invalidates existing cookies by design |
| Build fails on a `server-only` import | A client component imported the admin client | Move the call into a server action — this guard is working |
| Profile colours all look identical | `color-mix()` unsupported | Expected fallback on old browsers (research R8); check Safari ≥ 16.2 |
