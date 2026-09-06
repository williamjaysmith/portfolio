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
 * Phase 3 (003-family-tasks): --local also seeds the fixture TASK BOARD (003
 * quickstart §3) — the fourteen named fixtures plus the anytime shelf that
 * carries Cleo's column to twenty occurrences. The hosted seed gains NOTHING
 * this phase: the seventeen Task Box templates are reference product data
 * seeded by migration 020, and real tasks come from the household. Unlike the
 * calendar week's frozen September 2026 dates, every task fixture is ANCHORED
 * TO THE DAY THIS RUNS — "late", "carried forward" and "the streak behind this
 * routine" have no meaning against a fixed date — so re-run the seed after the
 * day rolls over to re-anchor them. The one thing this adds for both modes:
 * a household created HERE rather than by 007 gets family.seed_task_box()
 * called on it, so the Task Box is never empty (FR-382).
 *
 * Phase 4 (004-family-rewards): --local also seeds the STAR ECONOMY's fixtures
 * (004 quickstart §3, R413): star values on five of the tasks above, three
 * rewards with their eligibilities, and one hand adjustment that starts Cleo
 * at 15 stars — so the Rewards tab's scenarios (a bar at 15/20, a Redeem
 * button at 15) hold on a fresh `db reset`. The rewards and the adjustment
 * are idempotent BY EMPTINESS, like family.seed_task_box(): a redeemed or
 * deleted reward is never resurrected and a ledger entry is never written
 * twice. The star values are applied AFTER the fixture resolutions exist —
 * migration 025 credits a task's value the moment a completion is inserted,
 * so a value already on the row would pay Cleo for the eleven days of Brush
 * teeth she "ticked" before stars existed (applyStarValues below). The hosted
 * seed gains NOTHING this phase.
 *
 * Usage
 *   npm run family:seed -- --local     local stack (http://127.0.0.1:55321, the CLI's fixed
 *                                      secret key). Creates the dev account dev@family.local,
 *                                      allowlists it, seeds the fixture profiles/labels
 *                                      unless FAMILY_SEED_PROFILES is set, and seeds the
 *                                      fixture calendar week (002 quickstart §3), the
 *                                      fixture task board (003 quickstart §3) and the
 *                                      star fixtures (004 quickstart §3).
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
import { localStack } from "./local-stack.mjs";

const HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
const HOUSEHOLD_NAME = "Our Family";
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
  // 006 FR-638: one dietary note, so the planning sheets have something to show.
  { label: "Cleo", role: "member", color: "#93D1E6", avatar: "frog", dietary: "no nuts" },
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

/** Fixed ids keep the fixture board idempotent, like the fixture week's above. */
function fixtureTaskId(n) {
  return `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;
}

function fixtureResolutionId(n) {
  return `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`;
}

const MS_PER_DAY = 86400000;
const RULE_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
/** The fourteen named fixtures own ids 1–14; the anytime shelf continues after them. */
const SHELF_FIRST_ID = 15;
/** SC-315: every one of twenty occurrences in one column must stay reachable. */
const CLEO_COLUMN_TARGET = 20;
/**
 * Cleo's named fixtures make seven occurrences on the seed day: Feed the cat,
 * Sort the recycling, the carried-forward Water the plants, Make bed, today's
 * skipped Practice piano, and Brush teeth in two slots. Homework makes an
 * eighth on a weekday only — its rule is Mon–Fri — so the shelf absorbs the
 * difference rather than the count drifting with the day of the week.
 */
const CLEO_NAMED_OCCURRENCES = 7;

/**
 * The household-local date the seed is running on. Every task fixture is
 * anchored to it rather than to a frozen date, because "late", "carried
 * forward" and "the streak behind this routine" have no meaning against one
 * (003 quickstart §3) — so a re-run after the day rolls over re-anchors them.
 */
function todayInZone(zone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const f = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${f.year}-${f.month}-${f.day}`;
}

/**
 * Whole-day steps on UTC midnights: UTC has no transitions, so stepping by
 * days can never cross one (lib/family/recurrence/plain-date.ts's rule).
 */
function addDays(isoDate, days) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function weekdayIndex(isoDate) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function ruleWeekday(isoDate) {
  return RULE_WEEKDAYS[weekdayIndex(isoDate)];
}

function isWeekday(isoDate) {
  const day = weekdayIndex(isoDate);
  return day >= 1 && day <= 5;
}

/** UNTIL's date form: a routine has no clock time for the instant form to carry. */
function untilDate(isoDate) {
  return isoDate.replaceAll("-", "");
}

/**
 * Completions on each of the last `days` days, in every slot — what a streak of
 * that length is made of (FR-373: a day advances the count only when every one
 * of that routine's occurrences for that person is complete).
 */
function dailyCompletions(assignee, slots, days) {
  const rows = [];
  for (let back = days; back >= 1; back -= 1) {
    for (const slot of slots) rows.push({ assignee, dayOffset: -back, slot, status: "complete" });
  }
  return rows;
}

/**
 * The Tasks board fixtures (003 quickstart §3), --local only: one fixture per
 * hand check, each anchored to the seed day by `startsOffset`/`dayOffset`.
 * `slots` is what makes a row a routine (the 016 CHECK pairs them), and rule
 * strings are written by hand HERE only — clients never submit them (R301).
 * `rewardPoints` (004 R413) is NOT written by the task row: applyStarValues()
 * sets it after the resolutions exist, for the reason given there.
 */
const FIXTURE_TASKS = [
  // Timed sub-type; weekly on today's weekday from three weeks back, so three
  // missed occurrences carry forward beside today's fresh one (SC-307, FR-341),
  // and Cleo is refused when she tries to tick it (SC-304). Worth 20 stars: the
  // spec's example of a big chore, and Ben's balance when he ticks it (004 US1).
  {
    id: fixtureTaskId(1),
    summary: "Take out trash",
    assignees: ["Ben"],
    startsOffset: -21,
    dueTime: "18:00",
    rule: (today) => `FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=${ruleWeekday(today)}`,
    rewardPoints: 20,
  },
  // INTERVAL=2 end to end (FR-345) and FR-357's bound: anchored four weeks back,
  // the today-28 occurrence is off today's board and the today-14 one is on it.
  {
    id: fixtureTaskId(2),
    summary: "Hoover the stairs",
    assignees: ["Ana"],
    startsOffset: -28,
    dueTime: "09:00",
    rule: (today) => `FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=${ruleWeekday(today)}`,
  },
  // All-day sub-type: a date and no time (FR-327). Worth 10 stars — the chip on
  // the card, and the 10 Cleo earns and un-earns in 004 US1's scenarios.
  { id: fixtureTaskId(3), summary: "Feed the cat", emoji: "🐱", assignees: ["Cleo"], startsOffset: 0, rewardPoints: 10 },
  // Anytime sub-type: neither date nor time, so never late and present every day
  // (FR-328). The description is what SC-320's search match reads.
  {
    id: fixtureTaskId(4),
    summary: "Sort the recycling",
    description: "goes in the blue bin",
    assignees: ["Cleo"],
  },
  // Late is defined off the Timed sub-type, so the time is load-bearing: unresolved
  // two days back, carried onto today (FR-325, SC-308), and one-off, so US3-7's
  // details view offers no Skip.
  {
    id: fixtureTaskId(5),
    summary: "Water the plants",
    assignees: ["Cleo"],
    startsOffset: -2,
    dueTime: "18:00",
  },
  // SC-307's cursor half: one resolution a fortnight back puts a DERIVED open
  // occurrence on today with no stored next date, and its tail lies outside the
  // week window, which is what proves family.task_cursors is read at all.
  {
    id: fixtureTaskId(6),
    summary: "Clean the bathroom",
    assignees: ["Ana"],
    startsOffset: -14,
    renewAfter: { amount: 2, unit: "week" },
    resolutions: [{ assignee: "Ana", dayOffset: -14, status: "complete" }],
    rewardPoints: 15,
  },
  // The chain HEAD case: no resolutions at all, so the open occurrence is
  // max(starts_on, the assignee's chain start) — today, both ways.
  {
    id: fixtureTaskId(7),
    summary: "Descale the kettle",
    assignees: ["Ben"],
    startsOffset: 0,
    renewAfter: { amount: 1, unit: "month" },
  },
  // Up for Grabs: nobody assigned (FR-308/FR-365), one household-wide occurrence
  // for SC-311's double claim and FR-363's skip.
  {
    id: fixtureTaskId(8),
    summary: "Empty the dishwasher",
    assignees: [],
    upForGrabs: true,
    startsOffset: 0,
  },
  // One task, two assignees, two independently completable occurrences (FR-324):
  // Ana's is already complete, Ben's is outstanding (SC-317, and SC-304's
  // parent-credits-another case).
  {
    id: fixtureTaskId(9),
    summary: "Set the table",
    assignees: ["Ana", "Ben"],
    startsOffset: 0,
    resolutions: [{ assignee: "Ana", dayOffset: 0, status: "complete" }],
  },
  // Endless daily 02:30 — the DST pair always holds an occurrence to inspect
  // (AS-2.15, SC-313).
  {
    id: fixtureTaskId(10),
    summary: "Cat medicine",
    assignees: ["Ben"],
    startsOffset: 0,
    dueTime: "02:30",
    rule: () => "FREQ=DAILY;INTERVAL=1",
  },
  // Two slots on one routine, separately completable (FR-335), its own card
  // progress (FR-312), and eleven completed days behind it with none today —
  // so the badge reads eleven and the streak checkpoint stops at yesterday
  // (US4-6, SC-312's starting point).
  {
    id: fixtureTaskId(11),
    summary: "Brush teeth",
    emoji: "🪥",
    assignees: ["Cleo"],
    slots: ["morning", "evening"],
    trackHabit: true,
    startsOffset: -11,
    rule: () => "FREQ=DAILY;INTERVAL=1",
    resolutions: dailyCompletions("Cleo", ["morning", "evening"], 11),
    streak: { count: 11, throughOffset: -1 },
    // Worth 5 a slot, so both slots make 10 (004 US1-5). The eleven seeded days
    // earned nothing: their value is applied after them (applyStarValues).
    rewardPoints: 5,
  },
  // INTERVAL=2 on a routine (SC-313's first half), anchored an even number of
  // days back so today is a matching day.
  {
    id: fixtureTaskId(12),
    summary: "Make bed",
    emoji: "🛏️",
    assignees: ["Cleo"],
    slots: ["morning"],
    startsOffset: -14,
    rule: () => "FREQ=DAILY;INTERVAL=2",
  },
  // SC-309/SC-310's skip: five completed days behind it and today SKIPPED, so
  // the occurrence leaves the denominator and stays invisible until the Skipped
  // filter is on, while the streak holds at five and its checkpoint still
  // advances to today (FR-373 — a fully resolved day is accounted either way).
  {
    id: fixtureTaskId(13),
    summary: "Practice piano",
    emoji: "🎹",
    assignees: ["Cleo"],
    slots: ["evening"],
    trackHabit: true,
    startsOffset: -5,
    rule: () => "FREQ=DAILY;INTERVAL=1",
    resolutions: [
      ...dailyCompletions("Cleo", ["evening"], 5),
      { assignee: "Cleo", dayOffset: 0, slot: "evening", status: "skipped" },
    ],
    streak: { count: 5, throughOffset: 0 },
    // Worth 5, and skipped today: the skip that earns nothing (004 US1-6).
    rewardPoints: 5,
  },
  // FR-346 on a routine: the end date lives inside the rule's own UNTIL
  // (renew_until is cursor-mode only), a fortnight out (US2-10).
  {
    id: fixtureTaskId(14),
    summary: "Homework",
    emoji: "📝",
    assignees: ["Cleo"],
    slots: ["afternoon"],
    startsOffset: 0,
    rule: (today) =>
      `FREQ=WEEKLY;INTERVAL=1;UNTIL=${untilDate(addDays(today, 14))};WKST=SU;BYDAY=MO,TU,WE,TH,FR`,
  },
];

/** The anytime shelf that carries Cleo's column to CLEO_COLUMN_TARGET. */
const SHELF_CHORES = [
  "Tidy the toy box",
  "Fold your laundry",
  "Wipe the table",
  "Sweep the porch",
  "Water the fern",
  "Sort your books",
  "Match the socks",
  "Refill the water jug",
  "Dust the shelf",
  "Tidy the shoe rack",
  "Empty your bin",
  "Put away the board games",
  "Wipe the bathroom mirror",
];

/**
 * How many shelf chores today needs. Twenty occurrences in Cleo's column, one of
 * them (today's Practice piano) skipped, so nineteen are visible until the
 * Skipped filter is on — and Homework's weekday-only rule is why the size is
 * computed rather than fixed.
 */
function shelfSize(today) {
  const named = CLEO_NAMED_OCCURRENCES + (isWeekday(today) ? 1 : 0);
  const wanted = CLEO_COLUMN_TARGET - named;
  if (wanted > SHELF_CHORES.length) {
    throw new SeedError(`the anytime shelf needs ${wanted} chores and only ${SHELF_CHORES.length} are named`);
  }
  return wanted;
}

function shelfFixtures(today) {
  return SHELF_CHORES.slice(0, shelfSize(today)).map((summary, index) => ({
    id: fixtureTaskId(SHELF_FIRST_ID + index),
    summary,
    assignees: ["Cleo"],
  }));
}

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
    ...localStack(env),
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
    // Absent stays absent (not null): toRow only writes the column for a fixture that names a note.
    dietary: typeof spec.dietary === "string" ? spec.dietary : undefined,
  };
}

function toRow(spec) {
  return {
    label: spec.label,
    color: spec.color,
    is_profile: spec.isProfile,
    role: spec.role,
    // Only a fixture that names a note carries the column, so a re-seed never clears a note set in the app.
    ...(spec.dietary === undefined ? {} : { dietary_prefs: spec.dietary }),
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

/**
 * Migration 020 calls this for the household 007 commits, so a stack that has
 * that row already carries the seventeen templates and the call returns 0 —
 * it is idempotent by emptiness, never by conflict, so a deleted template is
 * never resurrected (FR-381). A household created HERE instead has an empty
 * box until this runs, which is the whole reason the call lives on the
 * creation path (FR-382, 003 quickstart §3).
 */
async function seedTaskBox(fam, log) {
  const seeded = unwrap(
    await fam.rpc("seed_task_box", { p_household_id: HOUSEHOLD_ID }),
    "seed the task box",
  );
  log(`task box    ${seeded} template${seeded === 1 ? "" : "s"}  (seeded)`);
}

/**
 * The two default lists (005 FR-513, R511): "Grocery List" and "To-Do List", made
 * ONCE by family.seed_default_lists() — idempotent by emptiness, so a household
 * that renamed or deleted a default never gets it back. Unlike the Task Box this
 * runs on EVERY seed, both modes: the hosted household already existed when 028
 * landed, and this is how it gets its two lists (005 quickstart §4 step 4).
 */
async function seedDefaultLists(fam, log) {
  const seeded = unwrap(
    await fam.rpc("seed_default_lists", { p_household_id: HOUSEHOLD_ID }),
    "seed the default lists",
  );
  log(
    seeded === 0
      ? "lists       (the household already has lists; the defaults are not re-made)"
      : `lists       ${seeded} default list${seeded === 1 ? "" : "s"}  (seeded)`,
  );
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
    await seedTaskBox(fam, log);
  }
  await seedDefaultLists(fam, log);
  await seedDefaultMealCategories(fam, log);
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
async function fixtureCategoryIds(fam, wanted) {
  const labels = [...new Set(wanted)];
  const rows = unwrap(
    await fam.from("categories").select("id, label").eq("household_id", HOUSEHOLD_ID).in("label", labels),
    "read fixture categories",
  );
  const byLabel = new Map(rows.map((row) => [row.label, row.id]));
  for (const label of labels) {
    if (!byLabel.has(label)) {
      throw new SeedError(
        `the fixtures need the category "${label}" — include it in FAMILY_SEED_PROFILES or unset it`,
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
  const categoryIds = await fixtureCategoryIds(fam, FIXTURE_WEEK.flatMap((spec) => spec.categories));
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

/**
 * One task row. `slots` decides `routine` on its own: 016's CHECK pairs them, so
 * a fixture that carries slots IS a routine and one that does not is a chore.
 * reward_points is written as NULL here, on purpose, and set by applyStarValues()
 * once the resolutions are in — an explicit null rather than an absent key, so a
 * re-run's re-anchored resolutions never land on a task that still carries last
 * run's value and earn eleven days of stars.
 */
/** An undated anytime chore has no first day; everything else counts from today. */
function taskStartsOn(spec, today) {
  return spec.startsOffset === undefined ? null : addDays(today, spec.startsOffset);
}

/** When the task first appears, and what it repeats on. */
function taskSchedule(spec, today) {
  return {
    starts_on: taskStartsOn(spec, today),
    due_time: spec.dueTime ?? null,
    times_of_day: spec.slots ?? [],
    rrule: spec.rule ? spec.rule(today) : null,
  };
}

/** Completed Date's delay, or nulls for every other mode. */
function taskRenewal({ renewAfter }) {
  if (!renewAfter) {
    return { renew_after_amount: null, renew_after_unit: null, renew_until: null };
  }
  return { renew_after_amount: renewAfter.amount, renew_after_unit: renewAfter.unit, renew_until: null };
}

function taskRow(spec, today) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    summary: spec.summary,
    description: spec.description ?? null,
    emoji: spec.emoji ?? null,
    routine: Boolean(spec.slots),
    up_for_grabs: Boolean(spec.upForGrabs),
    track_habit: Boolean(spec.trackHabit),
    reward_points: null,
    ...taskSchedule(spec, today),
    ...taskRenewal(spec),
  };
}

/**
 * FR-371: the lightning badge reads a STORED count, so a seeded streak carries
 * the checkpoint the resolve action would have left — `streak_through` advances
 * on any fully resolved day, the count only on a fully completed one (FR-373).
 */
function streakColumns(spec, today) {
  if (!spec.streak) return { streak_count: 0, streak_through: null };
  return { streak_count: spec.streak.count, streak_through: addDays(today, spec.streak.throughOffset) };
}

/** Zero rows for an up-for-grabs task is what makes it up for grabs (FR-365). */
function assigneeRows(specs, categoryIds, today) {
  const nextOrder = new Map();
  return specs.flatMap((spec) =>
    spec.assignees.map((label) => {
      const sortOrder = (nextOrder.get(label) ?? 0) + SORT_GAP;
      nextOrder.set(label, sortOrder);
      return {
        household_id: HOUSEHOLD_ID,
        task_id: spec.id,
        category_id: categoryIds.get(label),
        sort_order: sortOrder,
        ...streakColumns(spec, today),
      };
    }),
  );
}

/**
 * One resolved occurrence, keyed by the SCHEDULED date (FR-353). Every seeded
 * resolution was ticked on the day it was due, so resolved_on is that same date;
 * cycle_prev stays null, which is a chain head in cursor mode and the only legal
 * value in every other mode.
 */
function resolutionRow(spec, entry, ordinal, categoryIds, today) {
  const date = addDays(today, entry.dayOffset);
  const profileId = categoryIds.get(entry.assignee);
  return {
    id: fixtureResolutionId(ordinal),
    household_id: HOUSEHOLD_ID,
    task_id: spec.id,
    occurrence_date: date,
    occurrence_slot: entry.slot ?? null,
    assignee_id: profileId,
    category_id: profileId,
    cycle_prev: null,
    status: entry.status,
    resolved_on: date,
  };
}

/** Ordinals come from the fixture order above, so the ids are stable per re-run. */
function resolutionRows(specs, categoryIds, today) {
  const rows = [];
  for (const spec of specs) {
    for (const entry of spec.resolutions ?? []) {
      rows.push(resolutionRow(spec, entry, rows.length + 1, categoryIds, today));
    }
  }
  return rows;
}

/**
 * Resolutions are replaced, not upserted: re-anchoring shifts every occurrence
 * date by the same number of days, and the occurrence key is unique and not
 * deferrable, so an in-place update would collide with the row it is shifting
 * onto. Delete then insert has no such intermediate state.
 */
async function replaceFixtureResolutions(fam, specs, categoryIds, today) {
  unwrap(
    await fam
      .from("task_resolutions")
      .delete()
      .eq("household_id", HOUSEHOLD_ID)
      .in("task_id", specs.map((spec) => spec.id)),
    "clear fixture resolutions",
  );
  const rows = resolutionRows(specs, categoryIds, today);
  if (rows.length === 0) return;
  unwrap(await fam.from("task_resolutions").insert(rows), "insert fixture resolutions");
}

/**
 * A weekday and a weekend seed want different shelf sizes, so a re-run after the
 * day rolls over must drop what it no longer wants — otherwise Cleo's column
 * creeps past CLEO_COLUMN_TARGET and SC-315 stops being a hand check.
 */
async function dropSurplusShelf(fam, keep) {
  const surplus = SHELF_CHORES.slice(keep).map((_, index) => fixtureTaskId(SHELF_FIRST_ID + keep + index));
  if (surplus.length === 0) return;
  unwrap(
    await fam.from("tasks").delete().eq("household_id", HOUSEHOLD_ID).in("id", surplus),
    "drop surplus shelf chores",
  );
}

function taskKind(spec) {
  if (spec.slots) return "routine";
  return spec.upForGrabs ? "grabs" : "chore";
}

function taskLine(spec, today) {
  const when = spec.startsOffset === undefined ? "anytime" : addDays(today, spec.startsOffset);
  const time = spec.dueTime ? ` ${spec.dueTime}` : "";
  return `${taskKind(spec).padEnd(11)} ${spec.summary}  ${when}${time}  (upserted)`;
}

/**
 * R413's star values, applied only AFTER the fixture resolutions are in place.
 * Migration 025's credit_task_resolution() credits a task's value the moment a
 * completion is inserted, so a value carried by the task row itself would pay
 * Cleo 110 stars for the eleven seeded days of Brush teeth and 25 more for
 * Practice piano — history "ticked" before any value existed — instead of the
 * 15 that 004 US2's scenarios read. So taskRow() writes reward_points as null
 * (a re-run's re-anchored resolutions earn nothing either) and this pass sets
 * the five values afterwards: exactly what happens to a household that gives
 * its chores stars today, whose past completions stay worth what they were.
 */
async function applyStarValues(fam, specs, log) {
  for (const spec of specs.filter((s) => s.rewardPoints !== undefined)) {
    unwrap(
      await fam
        .from("tasks")
        .update({ reward_points: spec.rewardPoints })
        .eq("id", spec.id)
        .eq("household_id", HOUSEHOLD_ID),
      `give "${spec.summary}" its star value`,
    );
    log(`stars       ${spec.summary}  ${spec.rewardPoints}  (applied)`);
  }
}

/** --local only. Hosted task data comes from the household, never from fixtures. */
async function seedFixtureTasks(fam, zone, log) {
  const today = todayInZone(zone);
  const specs = [...FIXTURE_TASKS, ...shelfFixtures(today)];
  const categoryIds = await fixtureCategoryIds(fam, specs.flatMap((spec) => spec.assignees));
  await dropSurplusShelf(fam, shelfSize(today));
  unwrap(
    await fam.from("tasks").upsert(specs.map((spec) => taskRow(spec, today))),
    "upsert fixture tasks",
  );
  unwrap(
    await fam
      .from("task_assignees")
      .upsert(assigneeRows(specs, categoryIds, today), { onConflict: "task_id,category_id" }),
    "assign fixture tasks",
  );
  await replaceFixtureResolutions(fam, specs, categoryIds, today);
  for (const spec of specs) log(taskLine(spec, today));
  await applyStarValues(fam, specs, log);
  log(`anchored    ${today}  (re-run the seed after the day rolls over)`);
}

/** Fixed ids keep the fixture rewards addressable by hand checks, like the tasks'. */
function fixtureRewardId(n) {
  return `00000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`;
}

/** Every Profile in the household, whoever FAMILY_SEED_PROFILES made them. */
const EVERY_PROFILE = "everyone";

/**
 * The Rewards tab fixtures (004 quickstart §3, R413), --local only: one per hand
 * check on US2/US3 — a renewing reward Cleo is five short of (a bar at 15/20), a
 * one-time reward she can afford exactly (a Redeem button at 15), and a one-time
 * reward every Profile is eligible for, each with their own progress (FR-417).
 */
const FIXTURE_REWARDS = [
  { id: fixtureRewardId(1), name: "Bake cookies", emoji: "🍪", pointValue: 20, renews: true, eligible: ["Cleo"] },
  { id: fixtureRewardId(2), name: "Movie night", emoji: "🍿", pointValue: 15, renews: false, eligible: ["Cleo", "Ben"] },
  { id: fixtureRewardId(3), name: "Ice cream", emoji: "🍨", pointValue: 25, renews: false, eligible: EVERY_PROFILE },
];

/** Cleo's starting balance (R413): one hand adjustment by Ana, on the anchor day. */
const STARTING_BALANCE = { profile: "Cleo", amount: 15, by: "Ana" };

function rewardRow(spec) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    name: spec.name,
    emoji: spec.emoji,
    point_value: spec.pointValue,
    respawn_on_redemption: spec.renews,
  };
}

async function householdProfileIds(fam) {
  const rows = unwrap(
    await fam.from("categories").select("id").eq("household_id", HOUSEHOLD_ID).eq("is_profile", true),
    "read household profiles",
  );
  return rows.map((row) => row.id);
}

/** One row per eligible Profile; 024's trigger refuses a Label, so none is offered. */
function eligibilityRows(spec, categoryIds, profileIds) {
  const ids = spec.eligible === EVERY_PROFILE ? profileIds : spec.eligible.map((label) => categoryIds.get(label));
  return ids.map((categoryId) => ({ household_id: HOUSEHOLD_ID, reward_id: spec.id, category_id: categoryId }));
}

function rewardLine(spec, outcome) {
  const who = spec.eligible === EVERY_PROFILE ? "everyone" : spec.eligible.join(", ");
  const kind = spec.renews ? "renews" : "one-time";
  return `reward      ${spec.name} ${spec.emoji}  ${spec.pointValue}  ${kind}  ${who}  (${outcome})`;
}

/**
 * --local only. Idempotent by EMPTINESS, as family.seed_task_box() is: a household
 * that has any reward keeps exactly what it has, so a redeemed or deleted fixture
 * is never resurrected and a re-run after playing with the tab changes nothing.
 */
async function seedFixtureRewards(fam, log) {
  const existing = unwrap(
    await fam.from("rewards").select("id").eq("household_id", HOUSEHOLD_ID).limit(1),
    "read rewards",
  );
  if (existing.length > 0) {
    log("reward      (the household already has rewards; the fixtures are not re-seeded)");
    return;
  }
  const named = FIXTURE_REWARDS.flatMap((spec) => (spec.eligible === EVERY_PROFILE ? [] : spec.eligible));
  const categoryIds = await fixtureCategoryIds(fam, named);
  const profileIds = await householdProfileIds(fam);
  unwrap(await fam.from("rewards").insert(FIXTURE_REWARDS.map(rewardRow)), "insert fixture rewards");
  unwrap(
    await fam
      .from("reward_eligibilities")
      .insert(FIXTURE_REWARDS.flatMap((spec) => eligibilityRows(spec, categoryIds, profileIds))),
    "make fixture rewards eligible",
  );
  for (const spec of FIXTURE_REWARDS) log(rewardLine(spec, "created"));
}

/**
 * --local only. Cleo's 15 stars, and why it is a ledger ENTRY rather than a number
 * on her row: a balance is a sum (FR-412), so a starting balance is one hand
 * adjustment — a parent's, on the household day of the seed (FR-434, FR-436);
 * 025's assert_star_adjustment() checks it like any other. Idempotent by
 * emptiness: once Cleo has any entry at all, hers is the ledger the family
 * made, and a re-run leaves it alone.
 */
async function seedStartingBalance(fam, zone, log) {
  const categoryIds = await fixtureCategoryIds(fam, [STARTING_BALANCE.profile, STARTING_BALANCE.by]);
  const profileId = categoryIds.get(STARTING_BALANCE.profile);
  const existing = unwrap(
    await fam
      .from("star_entries")
      .select("id")
      .eq("household_id", HOUSEHOLD_ID)
      .eq("category_id", profileId)
      .limit(1),
    "read star entries",
  );
  const line = `adjustment  ${STARTING_BALANCE.profile}  +${STARTING_BALANCE.amount}  by ${STARTING_BALANCE.by}`;
  if (existing.length > 0) {
    log(`${line}  (kept — ${STARTING_BALANCE.profile} already has ledger entries)`);
    return;
  }
  unwrap(
    await fam.from("star_entries").insert({
      household_id: HOUSEHOLD_ID,
      category_id: profileId,
      amount: STARTING_BALANCE.amount,
      kind: "adjustment",
      created_by: categoryIds.get(STARTING_BALANCE.by),
      entered_on: todayInZone(zone),
    }),
    "give the starting balance",
  );
  log(`${line}  (created)`);
}

/** Fixed ids keep the fixture lists and items addressable by hand checks, like the tasks'. */
function fixtureListId(n) {
  return `00000000-0000-4000-8000-0000000005${String(n).padStart(2, "0")}`;
}

function fixtureListItemId(n) {
  return `00000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`;
}

/** The two defaults are seed_default_lists()'s rows, found by name; these two are the fixtures' own. */
const DEFAULT_GROCERY = "Grocery List";
const DEFAULT_TO_DO = "To-Do List";

/**
 * The Lists tab fixtures (005 quickstart §3, R511), --local only: the spec's own
 * scenarios, so every hand check runs on a fresh reset without typing — items on
 * the two defaults (three ungrouped, one under Bakery, one checked under Dairy),
 * a third list of another type, and a Parents only list that must be absent from
 * the wall until a parent punches in (FR-514).
 */
const FIXTURE_LISTS = [
  { id: fixtureListId(1), name: "Packing List", kind: "other", color: "#FBA994", parentsOnly: false, sortOrder: 3000 },
  { id: fixtureListId(2), name: "Party", kind: "other", color: "#D5B6EC", parentsOnly: true, sortOrder: 4000 },
];

/** `list` is a default list's name or a fixture list's id; `checkedBy` a Profile label. */
const FIXTURE_LIST_ITEMS = [
  { id: fixtureListItemId(1), list: DEFAULT_GROCERY, text: "🥚 Eggs", section: null, sortOrder: 1000 },
  { id: fixtureListItemId(2), list: DEFAULT_GROCERY, text: "🥛 Milk", section: null, sortOrder: 2000 },
  { id: fixtureListItemId(3), list: DEFAULT_GROCERY, text: "🍞 Bread", section: null, sortOrder: 3000 },
  { id: fixtureListItemId(4), list: DEFAULT_GROCERY, text: "Bagels", section: "Bakery", sortOrder: 4000 },
  { id: fixtureListItemId(5), list: DEFAULT_GROCERY, text: "Yoghurt", section: "Dairy", sortOrder: 5000, checkedBy: "Ben" },
  { id: fixtureListItemId(6), list: DEFAULT_TO_DO, text: "Pack for trip", section: null, sortOrder: 1000 },
  { id: fixtureListItemId(7), list: DEFAULT_TO_DO, text: "Pet sitter (Allie?)", section: null, sortOrder: 2000 },
  { id: fixtureListItemId(8), list: DEFAULT_TO_DO, text: "Stop mail", section: null, sortOrder: 3000 },
  { id: fixtureListItemId(9), list: fixtureListId(1), text: "Shirts x5", section: null, sortOrder: 1000 },
  { id: fixtureListItemId(10), list: fixtureListId(1), text: "Jeans x2", section: null, sortOrder: 2000 },
  { id: fixtureListItemId(11), list: fixtureListId(1), text: "Undies x7", section: null, sortOrder: 3000 },
  { id: fixtureListItemId(12), list: fixtureListId(2), text: "Cake", section: null, sortOrder: 1000 },
  { id: fixtureListItemId(13), list: fixtureListId(2), text: "Balloons", section: null, sortOrder: 2000 },
];

function listRow(spec) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    name: spec.name,
    kind: spec.kind,
    color: spec.color,
    parents_only: spec.parentsOnly,
    sort_order: spec.sortOrder,
  };
}

/** The household's list ids by name — the two defaults are addressed this way. */
async function householdListIds(fam) {
  const rows = unwrap(
    await fam.from("lists").select("id, name").eq("household_id", HOUSEHOLD_ID),
    "read household lists",
  );
  return new Map(rows.map((row) => [row.name, row.id]));
}

/** A default list is named; a fixture list is its own fixed id (never a list's name). */
function fixtureListIdOf(spec, listIds) {
  const byName = listIds.get(spec.list);
  if (byName) return byName;
  if (FIXTURE_LISTS.some((one) => one.id === spec.list)) return spec.list;
  throw new SeedError(`fixture item "${spec.text}" names a list that does not exist: ${spec.list}`);
}

/** Checked while checked_at is set, by the named Profile (028's list_item_checked_shape). */
function checkedColumnsOf(spec, categoryIds) {
  if (spec.checkedBy === undefined) return { checked_at: null, checked_by: null };
  return { checked_at: new Date().toISOString(), checked_by: categoryIds.get(spec.checkedBy) };
}

function listItemRow(spec, listIds, categoryIds) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    list_id: fixtureListIdOf(spec, listIds),
    text: spec.text,
    section: spec.section,
    sort_order: spec.sortOrder,
    ...checkedColumnsOf(spec, categoryIds),
  };
}

/**
 * --local only. Idempotent by EMPTINESS, as the rewards are: a household whose
 * two default lists carry any item, or that has any list beyond the defaults,
 * keeps exactly what it has — a cleared, moved or deleted fixture is never put
 * back, and a re-run after playing with the tab changes nothing.
 */
async function seedFixtureLists(fam, log) {
  const existingItems = unwrap(
    await fam.from("list_items").select("id").eq("household_id", HOUSEHOLD_ID).limit(1),
    "read list items",
  );
  if (existingItems.length > 0) {
    log("list        (the household already has list items; the fixtures are not re-seeded)");
    return;
  }
  unwrap(await fam.from("lists").upsert(FIXTURE_LISTS.map(listRow), { onConflict: "id" }), "insert fixture lists");
  const listIds = await householdListIds(fam);
  const checkers = FIXTURE_LIST_ITEMS.flatMap((spec) => (spec.checkedBy === undefined ? [] : [spec.checkedBy]));
  const categoryIds = await fixtureCategoryIds(fam, checkers);
  unwrap(
    await fam.from("list_items").insert(FIXTURE_LIST_ITEMS.map((spec) => listItemRow(spec, listIds, categoryIds))),
    "insert fixture list items",
  );
  for (const spec of FIXTURE_LISTS) {
    log(`list        ${spec.name}  ${spec.kind}${spec.parentsOnly ? "  parents only" : ""}  (created)`);
  }
  log(`list items  ${FIXTURE_LIST_ITEMS.length} across the two defaults and the two fixtures  (created)`);
}

/**
 * --local only, in dependency order: the tasks need the profiles, the rewards'
 * eligibilities and the starting balance need the profiles and, for the value
 * ordering applyStarValues() explains, the resolutions; the list items need the
 * default lists ensureHousehold() already made. Hosted data comes from the
 * household, never from fixtures.
 */
async function seedLocalFixtures(fam, zone, log) {
  await seedFixtureWeek(fam, zone, log);
  await seedFixtureTasks(fam, zone, log);
  await seedFixtureRewards(fam, log);
  await seedStartingBalance(fam, zone, log);
  await seedFixtureLists(fam, log);
  await seedFixtureMeals(fam, zone, log);
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
  if (flags.local) await seedLocalFixtures(fam, zone, log);

  console.log(lines.map((line) => `  ${line}`).join("\n"));
  console.log("PINs are never seeded — set them from Settings in the app.");
}

main().catch((error) => {
  const message = error instanceof SeedError ? error.message : (error?.stack ?? String(error));
  console.error(`family-seed failed: ${message}`);
  process.exitCode = 1;
});

/* ──────────────────────────────────────────────────────────────────────────
 * Meals (006 FR-608, R613) — the four default mealtimes on every seed, and the
 * --local fixtures: seven recipes (one removed), a week of meals across the
 * mealtimes, a weekly "🍕 Pizza" with a skipped and a moved occurrence, and a
 * meal that still references the removed recipe.
 * ────────────────────────────────────────────────────────────────────────── */

function fixtureRecipeId(n) {
  return `00000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`;
}

function fixtureMealId(n) {
  return `00000000-0000-4000-8000-0000000008${String(n).padStart(2, "0")}`;
}

function fixtureMealExceptionId(n) {
  return `00000000-0000-4000-8000-0000000009${String(n).padStart(2, "0")}`;
}

/**
 * The four default mealtimes (006 FR-608, R613): Breakfast, Lunch, Dinner,
 * Snack in the live API's colours, made ONCE by
 * family.seed_default_meal_categories() — idempotent by emptiness, so a
 * household that renamed one never gets the original back. Runs on EVERY seed,
 * both modes, as the default lists do: the hosted household already exists when
 * 030 lands, and this is how it gets its mealtimes (006 quickstart §4 step 4).
 */
async function seedDefaultMealCategories(fam, log) {
  const seeded = unwrap(
    await fam.rpc("seed_default_meal_categories", { p_household_id: HOUSEHOLD_ID }),
    "seed the default mealtimes",
  );
  log(
    seeded === 0
      ? "mealtimes   (the household already has mealtimes; the defaults are not re-made)"
      : `mealtimes   ${seeded} default mealtime${seeded === 1 ? "" : "s"}  (seeded)`,
  );
}

/** `category` is a default mealtime's name; `removed` marks FR-616's first delete choice. */
const FIXTURE_RECIPES = [
  { id: fixtureRecipeId(1), name: "Pancakes", category: "Breakfast", text: "2 cups flour\n2 eggs\n1½ cups milk\n\nWhisk, rest 10 min, fry." },
  { id: fixtureRecipeId(2), name: "Sandwiches", category: "Lunch", text: "" },
  {
    id: fixtureRecipeId(3),
    name: "🍝 Spaghetti",
    category: "Dinner",
    text: "500 g spaghetti\n1 onion\n2 cloves garlic\n400 g tomatoes\nolive oil\nparmesan\n\nSoften the onion and garlic.\nAdd the tomatoes, simmer 20 min.\nToss with the pasta.",
  },
  { id: fixtureRecipeId(4), name: "Garlic bread", category: "Dinner", text: "1 baguette\n50 g butter\n2 cloves garlic" },
  { id: fixtureRecipeId(5), name: "🍕 Pizza", category: "Dinner", text: "Dough\nPassata\nMozzarella\n\nBake 12 min at 250°C." },
  { id: fixtureRecipeId(6), name: "Banana bread", category: "Snack", text: "3 ripe bananas\n100 g sugar\n1 egg\n200 g flour\n\nMash, mix, bake 55 min." },
  { id: fixtureRecipeId(7), name: "Old stew", category: "Dinner", text: "", removed: true },
];

/**
 * The household's week (start day Sunday, the seeded default) around today —
 * `offset` is days from that Sunday. Pizza repeats weekly on Friday for eight
 * weeks with the second Friday skipped and the third moved to its Saturday.
 */
function fixtureMealsOf(today) {
  const sunday = addDays(today, -weekdayIndex(today));
  const friday = addDays(sunday, 5);
  return [
    { id: fixtureMealId(1), date: sunday, category: "Breakfast", recipe: fixtureRecipeId(1) },
    { id: fixtureMealId(2), date: addDays(sunday, 3), category: "Lunch", recipe: fixtureRecipeId(2) },
    { id: fixtureMealId(3), date: addDays(sunday, 3), category: "Dinner", recipe: fixtureRecipeId(3), note: "Ben cooks" },
    { id: fixtureMealId(4), date: addDays(sunday, 3), category: "Dinner", recipe: fixtureRecipeId(4) },
    { id: fixtureMealId(5), date: addDays(sunday, 6), category: "Snack", recipe: fixtureRecipeId(6) },
    {
      id: fixtureMealId(6),
      date: friday,
      category: "Dinner",
      recipe: fixtureRecipeId(5),
      rrule: `FREQ=WEEKLY;INTERVAL=1;UNTIL=${untilDate(addDays(friday, 56))};WKST=SU;BYDAY=FR`,
      exceptions: [
        { id: fixtureMealExceptionId(1), occurrenceDate: addDays(friday, 7), action: "skip" },
        { id: fixtureMealExceptionId(2), occurrenceDate: addDays(friday, 14), action: "override", date: addDays(friday, 15) },
      ],
    },
    { id: fixtureMealId(7), date: addDays(today, -1), category: "Dinner", recipe: fixtureRecipeId(7) },
  ];
}

/** The household's mealtime ids by name — the defaults are addressed this way. */
async function householdMealtimeIds(fam) {
  const rows = unwrap(
    await fam.from("meal_categories").select("id, name").eq("household_id", HOUSEHOLD_ID),
    "read household mealtimes",
  );
  return new Map(rows.map((row) => [row.name, row.id]));
}

function mealtimeIdOf(name, mealtimeIds) {
  const id = mealtimeIds.get(name);
  if (!id) throw new SeedError(`the meals fixtures need the mealtime "${name}", which this household no longer has`);
  return id;
}

function recipeRow(spec, mealtimeIds) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    name: spec.name,
    category_id: mealtimeIdOf(spec.category, mealtimeIds),
    text: spec.text,
    removed_at: spec.removed ? new Date().toISOString() : null,
  };
}

function mealRow(spec, mealtimeIds) {
  return {
    id: spec.id,
    household_id: HOUSEHOLD_ID,
    date: spec.date,
    category_id: mealtimeIdOf(spec.category, mealtimeIds),
    recipe_id: spec.recipe,
    note: spec.note ?? null,
    rrule: spec.rrule ?? null,
  };
}

function mealExceptionRows(spec) {
  return (spec.exceptions ?? []).map((one) => ({
    id: one.id,
    household_id: HOUSEHOLD_ID,
    meal_id: spec.id,
    occurrence_date: one.occurrenceDate,
    action: one.action,
    date: one.date ?? null,
    category_id: null,
    note: null,
  }));
}

/**
 * --local only. Idempotent by EMPTINESS of meals: a household that has planned
 * anything keeps exactly what it has — a deleted or moved fixture is never put
 * back, and a re-run after playing with the tab changes nothing.
 */
async function seedFixtureMeals(fam, zone, log) {
  const existing = unwrap(
    await fam.from("meals").select("id").eq("household_id", HOUSEHOLD_ID).limit(1),
    "read meals",
  );
  if (existing.length > 0) {
    log("meals       (the household already has meals; the fixtures are not re-seeded)");
    return;
  }
  const mealtimeIds = await householdMealtimeIds(fam);
  unwrap(
    await fam.from("recipes").upsert(FIXTURE_RECIPES.map((spec) => recipeRow(spec, mealtimeIds)), { onConflict: "id" }),
    "insert fixture recipes",
  );
  const meals = fixtureMealsOf(todayInZone(zone));
  unwrap(await fam.from("meals").upsert(meals.map((spec) => mealRow(spec, mealtimeIds)), { onConflict: "id" }), "insert fixture meals");
  const exceptions = meals.flatMap(mealExceptionRows);
  unwrap(await fam.from("meal_exceptions").insert(exceptions), "insert fixture meal exceptions");
  log(`recipes     ${FIXTURE_RECIPES.length} (one removed, still planned)  (created)`);
  log(`meals       ${meals.length} this week, the Friday pizza weekly with a skip and a move  (created)`);
}
