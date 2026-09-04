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
 * Phase 2 (002-family-week-calendar): every run also writes the household's IANA
 * timezone to household_settings.timezone (FR-284 — migration 013's 'UTC' backfill
 * is a loud placeholder that renders every event hours off until replaced), and
 * --local additionally seeds the fixture week the US1 hand checks read
 * (002 quickstart §3). Hosted mode gains ONLY the timezone write.
 *
 * Usage
 *   npm run family:seed -- --local     local stack (http://127.0.0.1:55321, the CLI's fixed
 *                                      secret key). Creates the dev account dev@family.local,
 *                                      allowlists it, seeds the fixture profiles/labels
 *                                      unless FAMILY_SEED_PROFILES is set, and seeds the
 *                                      fixture calendar week (002 quickstart §3).
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
 *   FAMILY_SEED_PROFILES       optional JSON array of categories to create/update:
 *                              [{ "label": "Alex", "role": "parent", "color": "#2178AF",
 *                                 "avatar": "fox", "birthday": "2001-02-03" },
 *                               { "label": "Holidays", "color": "#FDC36D", "emoji": "🎉",
 *                                 "isProfile": false }]
 *                              role defaults to "member", isProfile to true; avatar is an id
 *                              from lib/family/avatars.ts; colour must be a palette hex.
 *   FAMILY_SEED_TIMEZONE       optional IANA zone written to household_settings.timezone,
 *                              both modes (default: this machine's resolved zone). The
 *                              operator's household is America/Chicago.
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
  // 002's example household (spec: Ana/Ben parents, Cleo child, Label "Bin day").
  { label: "Ana", role: "parent", color: "#915EA1", avatar: "cat" },
  { label: "Ben", role: "parent", color: "#2D8086", avatar: "owl" },
  { label: "Cleo", role: "member", color: "#93D1E6", avatar: "frog" },
  { label: "Holidays", color: "#FDC36D", emoji: "🎉", isProfile: false },
  { label: "Bin day", color: "#408257", emoji: "🗑️", isProfile: false },
];

/** Fixed ids keep the fixture week idempotent, like HOUSEHOLD_ID above. */
function fixtureEventId(n) {
  return `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
}

/**
 * The US1 render matrix (002 quickstart §3), --local only: the spec's example
 * week around Sun 2026-09-13, one fixture per hand check. Times are wall-clock
 * in the seed timezone; instants are derived at insert. rrule strings are
 * written by hand HERE only — clients never submit rule strings (FR-233).
 */
const FIXTURE_WEEK = [
  // A timed block placed by its stored times (US1-1).
  { id: fixtureEventId(1), summary: "Swim lesson", date: "2026-09-16", start: "16:30", end: "17:15", categories: ["Cleo"] },
  // Three-day all-day bar, end date INCLUSIVE (FR-206/FR-225).
  { id: fixtureEventId(2), summary: "Camping trip", allDay: true, startDate: "2026-09-18", endDate: "2026-09-20", categories: ["Ana"] },
  // Five at 09:00 — the FR-285 side-by-side cap and "+n more".
  { id: fixtureEventId(3), summary: "Dentist", date: "2026-09-14", start: "09:00", end: "10:00", categories: ["Ana"] },
  { id: fixtureEventId(4), summary: "Standup", date: "2026-09-14", start: "09:00", end: "10:00", categories: ["Ben"] },
  { id: fixtureEventId(5), summary: "Vet", date: "2026-09-14", start: "09:00", end: "10:00", categories: ["Cleo"] },
  { id: fixtureEventId(6), summary: "Grocery run", date: "2026-09-14", start: "09:00", end: "10:00", categories: ["Ana"] },
  { id: fixtureEventId(7), summary: "Call plumber", date: "2026-09-14", start: "09:00", end: "10:00", categories: ["Ben"] },
  // Two profiles — hiding Cleo keeps it visible through Ana (SC-213).
  { id: fixtureEventId(8), summary: "Library run", date: "2026-09-17", start: "15:00", end: "16:00", categories: ["Cleo", "Ana"] },
  // Label-only colour source, same mechanism as a profile (US1-9).
  { id: fixtureEventId(9), summary: "Bins out", date: "2026-09-17", start: "07:00", end: "07:30", categories: ["Bin day"] },
  // No categories → neutral fill (FR-213).
  { id: fixtureEventId(10), summary: "Window cleaner", date: "2026-09-16", start: "10:00", end: "11:00", categories: [] },
  // Fri 22:00 → Sat 01:00: one event, one segment per touched column (FR-217).
  { id: fixtureEventId(11), summary: "Movie night", date: "2026-09-18", start: "22:00", end: "01:00", endDate: "2026-09-19", categories: ["Ben"] },
  // Weekly Piano, UNTIL mid-December in the observed Skylight shape (FR-233),
  // carrying the saved this-occurrence time change (SC-207's precondition, US2-19).
  {
    id: fixtureEventId(12),
    summary: "Piano",
    date: "2026-09-15",
    start: "17:00",
    end: "17:45",
    categories: ["Cleo"],
    rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215T235959Z;WKST=SU;BYDAY=TU",
    override: { occurrenceDate: "2026-10-06", start: "18:00", end: "18:45" },
  },
  // Endless daily 02:30 — the DST dates always hold an occurrence to inspect
  // (FR-235 gap → 03:00 exactly; FR-236 fold → first instant).
  { id: fixtureEventId(13), summary: "Night meds", date: "2026-09-14", start: "02:30", end: "03:00", categories: ["Ben"], rrule: "FREQ=DAILY;INTERVAL=1" },
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

/** Validated before it can reach the settings trigger's 22023. */
function resolveTimezone(env) {
  const zone = env.FAMILY_SEED_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    throw new SeedError(`FAMILY_SEED_TIMEZONE is not an IANA timezone: "${zone}"`);
  }
}

/**
 * Both modes, idempotent: migration 013 backfills 'UTC' as a loud placeholder
 * (every event renders hours off); the real zone must come from here, never
 * from committed SQL (FR-284, constitution §VII).
 */
async function seedTimezone(fam, zone, log) {
  unwrap(
    await fam.from("household_settings").update({ timezone: zone }).eq("household_id", HOUSEHOLD_ID),
    "write household timezone",
  );
  log(`timezone    ${zone}  (applied)`);
}

/** The zone's UTC offset at one instant, from Intl — no dependency allowed here. */
function zoneOffsetMs(zone, utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const f = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour, +f.minute, +f.second) - utcMs;
}

/**
 * A wall-clock time in `zone` as a UTC instant. Two offset passes converge for
 * every fixed or DST offset; the fixture times sit away from any transition.
 */
function wallToInstant(zone, isoDate, hhmm) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wallUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  const firstGuess = wallUtc - zoneOffsetMs(zone, wallUtc);
  return new Date(wallUtc - zoneOffsetMs(zone, firstGuess)).toISOString();
}

/** Exactly one time shape per row, switched by all_day (FR-222/223). */
function timeColumns(spec, zone) {
  if (spec.allDay) {
    return { all_day: true, starts_at: null, ends_at: null, start_date: spec.startDate, end_date: spec.endDate };
  }
  return {
    all_day: false,
    starts_at: wallToInstant(zone, spec.date, spec.start),
    ends_at: wallToInstant(zone, spec.endDate ?? spec.date, spec.end),
    start_date: null,
    end_date: null,
  };
}

function eventRow(spec, zone) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    summary: spec.summary,
    // Provenance only (FR-224); rendering reads household_settings.timezone.
    timezone: zone,
    rrule: spec.rrule ?? null,
    ...timeColumns(spec, zone),
  };
}

/** position is the draw order on a striped block (FR-227), 0-based. */
function linkRows(spec, categoryIds) {
  return spec.categories.map((label, position) => ({
    household_id: HOUSEHOLD_ID,
    event_id: spec.id,
    category_id: categoryIds.get(label),
    position,
  }));
}

/**
 * Keyed by the occurrence's ORIGINAL household-local date, never an instant
 * (R204). Explicit nulls make the upsert authoritative: a re-run restores the
 * documented time-only override whatever a dev wrote on that row meanwhile.
 */
function overrideRow(spec, zone) {
  const o = spec.override;
  return {
    household_id: HOUSEHOLD_ID,
    event_id: spec.id,
    occurrence_date: o.occurrenceDate,
    action: "override",
    summary: null,
    description: null,
    location: null,
    starts_at: wallToInstant(zone, o.occurrenceDate, o.start),
    ends_at: wallToInstant(zone, o.occurrenceDate, o.end),
    start_date: null,
    end_date: null,
  };
}

/** The links need real category ids; a FAMILY_SEED_PROFILES override may lack them. */
async function fixtureCategoryIds(fam) {
  const labels = [...new Set(FIXTURE_WEEK.flatMap((spec) => spec.categories))];
  const rows = unwrap(
    await fam.from("categories").select("id, label").eq("household_id", HOUSEHOLD_ID).in("label", labels),
    "read fixture categories",
  );
  const byLabel = new Map(rows.map((row) => [row.label, row.id]));
  for (const label of labels) {
    if (!byLabel.has(label)) {
      throw new SeedError(
        `the fixture week needs the category "${label}" — include it in FAMILY_SEED_PROFILES or unset it`,
      );
    }
  }
  return byLabel;
}

function eventLine(spec) {
  const kind = spec.rrule ? "series" : spec.allDay ? "all-day" : "event";
  const when = spec.allDay ? `${spec.startDate}…${spec.endDate}` : `${spec.date} ${spec.start}`;
  return `${kind.padEnd(11)} ${spec.summary}  ${when}  (upserted)`;
}

/** --local only. Hosted data comes from the household, never from fixtures. */
async function seedFixtureWeek(fam, zone, log) {
  const categoryIds = await fixtureCategoryIds(fam);
  unwrap(
    await fam.from("events").upsert(FIXTURE_WEEK.map((spec) => eventRow(spec, zone))),
    "upsert fixture events",
  );
  const links = FIXTURE_WEEK.flatMap((spec) => linkRows(spec, categoryIds));
  unwrap(
    await fam.from("event_categories").upsert(links, { onConflict: "event_id,category_id" }),
    "link fixture events",
  );
  const overrides = FIXTURE_WEEK.filter((spec) => spec.override).map((spec) => overrideRow(spec, zone));
  unwrap(
    await fam.from("event_exceptions").upsert(overrides, { onConflict: "event_id,occurrence_date" }),
    "upsert fixture overrides",
  );
  for (const spec of FIXTURE_WEEK) log(eventLine(spec));
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
  const profiles = resolveProfiles(flags, env);
  const zone = resolveTimezone(env);

  const lines = [];
  const log = (line) => lines.push(line);
  const admin = createClient(target.url, target.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const fam = admin.schema("family");

  console.log(`family-seed → ${target.url}${flags.local ? " (local)" : ""}`);
  await ensureHousehold(fam, log);
  await seedTimezone(fam, zone, log);

  const accountEmail = await seedAccount(admin, account, log);

  await allowlist(fam, [accountEmail], log);
  await upsertCategories(fam, profiles, log);
  if (flags.local) await seedFixtureWeek(fam, zone, log);

  console.log(lines.map((line) => `  ${line}`).join("\n"));
  console.log("PINs are never seeded — set them from Settings in the app.");
}

main().catch((error) => {
  const message = error instanceof SeedError ? error.message : (error?.stack ?? String(error));
  console.error(`family-seed failed: ${message}`);
  process.exitCode = 1;
});
