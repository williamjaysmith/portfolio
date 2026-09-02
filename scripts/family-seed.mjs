#!/usr/bin/env node
/**
 * family-seed — creates the household ACCOUNT and puts the PEOPLE into the /family household.
 *
 * Migration 007 creates the household ("Our Family", fixed id) and its settings row but,
 * by design, no emails and no names (constitution §VII). This script adds them, from
 * environment variables, and is safe to re-run: every write is an upsert keyed on the
 * allowlist email or the category label. It never sets a PIN — PINs are created from the
 * app (FR-018).
 *
 * The household signs in with ONE shared Supabase account (FR-002): no identity provider
 * and no mail service, so the account is created here with `email_confirm: true` and no
 * confirmation mail is ever sent. This is the only place FAMILY_ACCOUNT_PASSWORD is read —
 * at runtime Supabase validates the password and the app never holds it. The password is
 * never printed, and re-running the seed re-applies it, which is how you rotate it.
 *
 * Run this BEFORE closing sign-ups at the Auth API and enabling the Before-User-Created
 * hook (FR-004) — afterwards the account can no longer be created.
 *
 * Usage
 *   npm run family:seed -- --local     local stack (http://127.0.0.1:55321, the CLI's fixed
 *                                      secret key). Creates the dev account dev@family.local,
 *                                      allowlists it, and seeds the fixture profiles/labels
 *                                      unless FAMILY_SEED_PROFILES is set.
 *   npm run family:seed -- --yes       hosted project from .env.local
 *                                      (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY).
 *                                      Without --yes a non-local URL is refused.
 *
 * Environment (`npm run family:seed` loads .env.local via `node --env-file-if-exists`)
 *   FAMILY_ACCOUNT_EMAIL       the ONE household account's address (required unless --local).
 *                              The same value the app reads server-side; it is never shown
 *                              in the browser.
 *   FAMILY_ACCOUNT_PASSWORD    that account's password (required unless --local). Known to
 *                              the household; never logged, never committed.
 *   FAMILY_SEED_PARENT_EMAILS  optional extra addresses to allowlist, comma-separated. Not
 *                              needed for the shared account — it is allowlisted for you.
 *   FAMILY_SEED_PROFILES       optional JSON array of categories to create/update:
 *                              [{ "label": "Alex", "role": "parent", "color": "#2178AF",
 *                                 "avatar": "fox", "birthday": "2001-02-03" },
 *                               { "label": "Holidays", "color": "#FDC36D", "emoji": "🎉",
 *                                 "isProfile": false }]
 *                              role defaults to "member", isProfile to true; avatar is an id
 *                              from lib/family/avatars.ts; colour must be a palette hex.
 *   FAMILY_DEV_PASSWORD        --local only; password for dev@family.local
 *                              (default: the DEV_PASSWORD_DEFAULT constant below)
 *   SUPABASE_LOCAL_URL / SUPABASE_LOCAL_SECRET_KEY   --local overrides
 *
 * Exit code 1 on any error (nothing is rolled back — re-run after fixing the input).
 */

import { createClient } from "@supabase/supabase-js";

const HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
const HOUSEHOLD_NAME = "Our Family";
const LOCAL_URL = "http://127.0.0.1:55321";
// Fixed constant minted by the Supabase CLI for every local stack — public, not a secret.
const LOCAL_SECRET_KEY = "sb_secret_LOCAL_REDACTED";
const LOCAL_URL_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/;
const DEV_EMAIL = "dev@family.local";
const DEV_PASSWORD_DEFAULT = "family-dev-password";
const SORT_GAP = 1000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;
const HEX_RE = /^#[0-9A-F]{6}$/;

const FIXTURE_PROFILES = [
  { label: "Alex", role: "parent", color: "#2178AF", avatar: "fox" },
  { label: "Sam", role: "parent", color: "#CB434C", avatar: "bear" },
  { label: "Kit", role: "member", color: "#B6E085", avatar: "bunny" },
  { label: "Holidays", color: "#FDC36D", emoji: "🎉", isProfile: false },
];

class SeedError extends Error {}

function parseArgs(argv) {
  const flags = { local: false, yes: false };
  for (const arg of argv) {
    if (arg === "--local") flags.local = true;
    else if (arg === "--yes") flags.yes = true;
    else throw new SeedError(`unknown argument ${arg} (expected --local and/or --yes)`);
  }
  return flags;
}

function localTarget(env) {
  return {
    url: env.SUPABASE_LOCAL_URL || LOCAL_URL,
    secretKey: env.SUPABASE_LOCAL_SECRET_KEY || LOCAL_SECRET_KEY,
  };
}

/** The one thing standing between a mistyped command and the real household. */
function assertSeedable(url, allowRemote) {
  if (!LOCAL_URL_RE.test(url) && !allowRemote) {
    throw new SeedError(`refusing to seed the non-local project at ${url} without --yes`);
  }
}

function hostedTarget(env, allowRemote) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new SeedError(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (set them in .env.local, or pass --local)",
    );
  }
  assertSeedable(url, allowRemote);
  return { url, secretKey };
}

function resolveTarget(flags, env) {
  return flags.local ? localTarget(env) : hostedTarget(env, flags.yes);
}

function parseEmails(raw) {
  if (!raw) return [];
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  for (const email of emails) {
    if (!EMAIL_RE.test(email)) throw new SeedError(`invalid email in FAMILY_SEED_PARENT_EMAILS: "${email}"`);
  }
  return [...new Set(emails)];
}

function parseProfiles(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new SeedError(`FAMILY_SEED_PROFILES is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed)) throw new SeedError("FAMILY_SEED_PROFILES must be a JSON array");
  return parsed.map(normaliseProfile);
}

function requireLabel(spec, index) {
  const label = typeof spec.label === "string" ? spec.label.trim() : "";
  if (label.length < 1 || label.length > 40) {
    throw new SeedError(`FAMILY_SEED_PROFILES[${index}].label must be 1–40 characters`);
  }
  return label;
}

function requireColor(spec, index) {
  const color = typeof spec.color === "string" ? spec.color.trim().toUpperCase() : "";
  if (!HEX_RE.test(color)) {
    throw new SeedError(`FAMILY_SEED_PROFILES[${index}].color must be a #RRGGBB palette colour`);
  }
  return color;
}

function requireRole(spec, index) {
  const role = spec.role ?? "member";
  if (role !== "parent" && role !== "member") {
    throw new SeedError(`FAMILY_SEED_PROFILES[${index}].role must be "parent" or "member"`);
  }
  return role;
}

/** Fields that only mean something on a person. */
function hasProfileOnlyFields(spec, role) {
  return role !== "member" || Boolean(spec.avatar) || Boolean(spec.birthday);
}

/** Profiles and Labels are one record type, so the kinds must not mix fields. */
function assertKindFields(spec, index, isProfile, role) {
  if (!isProfile) {
    if (hasProfileOnlyFields(spec, role)) {
      throw new SeedError(`FAMILY_SEED_PROFILES[${index}] is a label: no role, avatar or birthday allowed`);
    }
    return;
  }
  if (spec.emoji) {
    throw new SeedError(`FAMILY_SEED_PROFILES[${index}] is a profile: emoji is for labels only`);
  }
}

function optionalString(value) {
  return typeof value === "string" ? value : null;
}

function normaliseProfile(spec, index) {
  if (typeof spec !== "object" || spec === null) {
    throw new SeedError(`FAMILY_SEED_PROFILES[${index}] must be an object`);
  }
  const isProfile = spec.isProfile !== false;
  const role = requireRole(spec, index);
  assertKindFields(spec, index, isProfile, role);

  return {
    label: requireLabel(spec, index),
    color: requireColor(spec, index),
    isProfile,
    role,
    avatar: optionalString(spec.avatar),
    emoji: optionalString(spec.emoji),
    birthday: optionalString(spec.birthday),
  };
}

function toRow(spec) {
  return {
    label: spec.label,
    color: spec.color,
    is_profile: spec.isProfile,
    role: spec.role,
    avatar_kind: spec.avatar ? "illustration" : null,
    avatar_id: spec.avatar,
    emoji: spec.emoji,
    birthday: spec.birthday,
  };
}

function unwrap(result, what) {
  if (result.error) throw new SeedError(`${what}: ${result.error.message} (${result.error.code ?? "no code"})`);
  return result.data;
}

async function ensureHousehold(fam, log) {
  const existing = unwrap(
    await fam.from("households").select("id, name").eq("id", HOUSEHOLD_ID).maybeSingle(),
    "read household",
  );
  if (existing) {
    log(`household   ${HOUSEHOLD_ID}  "${existing.name}"  (kept)`);
  } else {
    unwrap(await fam.from("households").insert({ id: HOUSEHOLD_ID, name: HOUSEHOLD_NAME }), "create household");
    log(`household   ${HOUSEHOLD_ID}  "${HOUSEHOLD_NAME}"  (created)`);
  }
  const settings = unwrap(
    await fam.from("household_settings").select("household_id").eq("household_id", HOUSEHOLD_ID).maybeSingle(),
    "read settings",
  );
  if (!settings) {
    unwrap(await fam.from("household_settings").insert({ household_id: HOUSEHOLD_ID }), "create settings");
    log("settings    (created with defaults)");
  }
}

async function findUserByEmail(admin, email) {
  const listed = unwrap(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list users");
  const user = listed.users.find((u) => u.email === email);
  if (!user) throw new SeedError(`${email} exists but could not be found`);
  return user;
}

/**
 * The ONE account the household signs in with (FR-002).
 *
 * `email_confirm: true` is what makes a mail service unnecessary: the account is usable
 * the moment it exists and nothing is ever sent to that address. Re-running re-applies
 * the password, so rotating it is "edit .env.local, seed again". The password is a
 * parameter here and never a log line.
 */
async function ensureAccount(admin, account) {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });
  if (!created.error) return { id: created.data.user.id, status: "created" };
  if (!/already|exists|registered/i.test(created.error.message)) {
    throw new SeedError(`create ${account.email}: ${created.error.message}`);
  }
  const user = await findUserByEmail(admin, account.email);
  unwrap(
    await admin.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
    }),
    `set the password for ${account.email}`,
  );
  return { id: user.id, status: "existing; password re-applied" };
}

/**
 * Which account this run creates. Hosted must be told both halves; --local keeps the
 * dev fixture, so a local stack never needs the real household credentials near it.
 */
/** Never trims: a password may legitimately begin or end with a space. */
function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new SeedError(`${name} is required (set it in .env.local, or pass --local)`);
  }
  return value;
}

function requireHouseholdAccount(env) {
  const email = requiredEnv(env, "FAMILY_ACCOUNT_EMAIL").trim().toLowerCase();
  const password = requiredEnv(env, "FAMILY_ACCOUNT_PASSWORD");
  if (!EMAIL_RE.test(email)) {
    throw new SeedError(`FAMILY_ACCOUNT_EMAIL is not an email address: "${email}"`);
  }
  return { email, password };
}

function resolveAccount(flags, env) {
  if (flags.local) {
    return { email: DEV_EMAIL, password: env.FAMILY_DEV_PASSWORD || DEV_PASSWORD_DEFAULT };
  }
  return requireHouseholdAccount(env);
}

/**
 * Which of the wanted addresses are already on this household's list and which
 * still have to go on it. An address held by a DIFFERENT household is never
 * moved: allowlist rows are how a person is bound to their family (D1).
 */
function partitionAllowlist(emails, existing) {
  const byEmail = new Map(existing.map((row) => [row.email, row]));
  const kept = [];
  const toInsert = [];
  for (const email of emails) {
    const row = byEmail.get(email);
    if (!row) {
      toInsert.push({ household_id: HOUSEHOLD_ID, email });
      continue;
    }
    if (row.household_id !== HOUSEHOLD_ID) {
      throw new SeedError(`${email} is already allowlisted in another household (${row.household_id})`);
    }
    kept.push(row);
  }
  return { kept, toInsert };
}

function keptLine(row) {
  return `allowlist   ${row.email}  (kept${row.user_id ? ", claimed" : ""})`;
}

async function insertAllowlist(fam, toInsert, log) {
  if (toInsert.length === 0) return;
  unwrap(await fam.from("household_users").insert(toInsert), "allowlist emails");
  for (const row of toInsert) log(`allowlist   ${row.email}  (added)`);
}

async function allowlist(fam, emails, log) {
  if (emails.length === 0) return;
  const existing = unwrap(
    await fam.from("household_users").select("email, household_id, user_id").in("email", emails),
    "read allowlist",
  );
  const { kept, toInsert } = partitionAllowlist(emails, existing);
  for (const row of kept) log(keptLine(row));
  await insertAllowlist(fam, toInsert, log);
}

function describe(spec, outcome) {
  const kind = spec.isProfile ? "profile" : "label";
  const trailing = spec.isProfile ? spec.role : (spec.emoji ?? "");
  return `${kind.padEnd(11)} ${spec.label}  ${spec.color}  ${trailing}  (${outcome})`;
}

async function insertCategory(fam, spec, sortOrder) {
  unwrap(
    await fam
      .from("categories")
      .insert({ ...toRow(spec), household_id: HOUSEHOLD_ID, sort_order: sortOrder }),
    `create "${spec.label}"`,
  );
}

async function updateCategory(fam, spec, row) {
  if (row.is_profile !== spec.isProfile) {
    throw new SeedError(
      `"${spec.label}" already exists as a ${row.is_profile ? "profile" : "label"}; cannot convert it`,
    );
  }
  const patch = toRow(spec);
  if (row.avatar_kind === "photo") {
    // Never replace a photo somebody uploaded with the seed's illustration.
    delete patch.avatar_kind;
    delete patch.avatar_id;
  }
  unwrap(
    await fam.from("categories").update(patch).eq("id", row.id).eq("household_id", HOUSEHOLD_ID),
    `update "${spec.label}"`,
  );
}

async function upsertCategories(fam, specs, log) {
  if (specs.length === 0) return;
  const existing = unwrap(
    await fam
      .from("categories")
      .select("id, label, is_profile, avatar_kind, sort_order")
      .eq("household_id", HOUSEHOLD_ID),
    "read categories",
  );
  const byLabel = new Map(existing.map((row) => [row.label, row]));
  let maxSort = existing.reduce((max, row) => Math.max(max, Number(row.sort_order)), 0);

  for (const spec of specs) {
    const row = byLabel.get(spec.label);
    if (row) {
      await updateCategory(fam, spec, row);
      log(describe(spec, "updated"));
      continue;
    }
    maxSort += SORT_GAP;
    await insertCategory(fam, spec, maxSort);
    log(describe(spec, "created"));
  }
}

/** Explicit JSON wins; --local falls back to the fixtures, hosted to nothing. */
function resolveProfiles(flags, env) {
  if (env.FAMILY_SEED_PROFILES) return parseProfiles(env.FAMILY_SEED_PROFILES);
  return flags.local ? FIXTURE_PROFILES.map(normaliseProfile) : [];
}

/**
 * Creates (or refreshes) the sign-in account and returns the address to allowlist —
 * the account is worthless without an allowlist row, so the two always happen together.
 */
async function seedAccount(admin, account, log) {
  const user = await ensureAccount(admin, account);
  log(`account     ${account.email}  ${user.id}  (${user.status}; password not shown)`);
  return account.email;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const env = process.env;
  const target = resolveTarget(flags, env);
  const account = resolveAccount(flags, env);
  const emails = parseEmails(env.FAMILY_SEED_PARENT_EMAILS);
  const profiles = resolveProfiles(flags, env);

  const lines = [];
  const log = (line) => lines.push(line);
  const admin = createClient(target.url, target.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const fam = admin.schema("family");

  console.log(`family-seed → ${target.url}${flags.local ? " (local)" : ""}`);
  await ensureHousehold(fam, log);

  const accountEmail = await seedAccount(admin, account, log);

  await allowlist(fam, [...new Set([accountEmail, ...emails])], log);
  await upsertCategories(fam, profiles, log);

  console.log(lines.map((line) => `  ${line}`).join("\n"));
  console.log("PINs are never seeded — set them from Settings in the app.");
}

main().catch((error) => {
  const message = error instanceof SeedError ? error.message : (error?.stack ?? String(error));
  console.error(`family-seed failed: ${message}`);
  process.exitCode = 1;
});
