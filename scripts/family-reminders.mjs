#!/usr/bin/env node
/**
 * family-reminders — trigger one reminder scan by hand.
 *
 * On the hosted project the scan is fired every minute by `pg_cron`, which uses
 * `pg_net` to POST to /api/family/reminders/run with the shared secret (008
 * R803). This repository's LOCAL Supabase stack has no `pg_cron`, so there is
 * no scheduler and nothing runs on its own — this script is the local trigger.
 *
 * It is a trigger and nothing else. Every decision about what is due, what is
 * claimed and what is too old lives in the route and in
 * lib/family/notifications/**, so running this twice in a row exercises the
 * exactly-once constraint rather than a second implementation of it. Doing
 * exactly that is how the quickstart verifies SC-804.
 *
 * Deliberately kept to a handful of branches: nothing here is unit-tested, so
 * every path it grows is an untested path (see .claude/rules/quality-bars.md on
 * CRAP). If this needs a decision, the decision belongs in the route.
 *
 * Usage
 *   npm run family:reminders -- --local            the dev server on 127.0.0.1:3000
 *   npm run family:reminders -- --url=https://…    any deployment you hold the secret for
 *
 * Environment (loaded from .env.local by the npm script)
 *   FAMILY_REMINDERS_SECRET   required; the same value the target deployment holds.
 *                             Never printed, never committed.
 */

const LOCAL_URL = "http://127.0.0.1:3000";
const PATH = "/api/family/reminders/run";
const COUNTS = ["considered", "claimed", "sent", "pruned", "expired"];

const USAGE = "Say where to scan: --local for the dev server, or --url=<origin>.";
const NO_SECRET =
  "Missing FAMILY_REMINDERS_SECRET.\n" +
  "  Generate one with `openssl rand -base64 32` and put it in .env.local,\n" +
  "  then give the same value to the deployment you are scanning.";

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function targetFrom(argv) {
  if (argv.includes("--local")) return LOCAL_URL;
  const flag = argv.find((arg) => arg.startsWith("--url="));
  return flag ? flag.slice("--url=".length).replace(/\/+$/, "") : die(USAGE);
}

async function post(target, secret) {
  const response = await fetch(`${target}${PATH}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  }).catch((cause) => die(`Could not reach ${target} — is the server running?\n  ${cause.message}`));

  if (response.status === 401) {
    die("The deployment refused the secret (401).\n  .env.local and the target hold different values.");
  }
  return response.ok
    ? response.json().catch(() => ({}))
    : die(`The scan failed: ${response.status} ${response.statusText}`);
}

/** The run route answers with counts and nothing household-identifying. */
function report(target, counts) {
  const line = COUNTS.filter((key) => key in counts).map((key) => `${key} ${counts[key]}`);
  console.log(`\n  ${target}${PATH}`);
  console.log(`  ${line.join(" · ") || JSON.stringify(counts)}\n`);
}

const secret = process.env.FAMILY_REMINDERS_SECRET || die(NO_SECRET);
const target = targetFrom(process.argv.slice(2));
report(target, await post(target, secret));
