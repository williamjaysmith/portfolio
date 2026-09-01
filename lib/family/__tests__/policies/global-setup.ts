/**
 * Global setup for the `policies` Vitest project (runs once per `vitest run`,
 * in the main process, before any policy test file).
 *
 * Creates one fixture household with two allowlisted emails, a long-lived
 * parent profile, and three confirmed auth accounts (members A and B plus a
 * stranger who is on no allowlist), then hands their ids to the test files via
 * `provide()`. Teardown deletes the household (cascades to categories,
 * settings, allowlist rows and PINs — every other household a test file made
 * carries the run tag in its name and is swept the same way) and the accounts.
 *
 * Nothing here is time-based: uniqueness comes from a random tag computed at
 * setup time, so a crashed run never collides with the next one.
 */

import { randomUUID } from "node:crypto";
import type { TestProject } from "vitest/node";
import {
  adminClient,
  createPool,
  createUsers,
  deleteUsers,
  insertCategory,
  insertHousehold,
  testEmail,
  type PolicyFixtures,
} from "./helpers";

let created: PolicyFixtures | null = null;

export async function setup(project: TestProject): Promise<void> {
  const run = randomUUID().slice(0, 8);
  const pool = createPool();
  try {
    const householdId = await insertHousehold(pool, `test-${run}`);
    const emails = {
      a: testEmail("member-a", run),
      b: testEmail("member-b", run),
      stranger: testEmail("stranger", run),
    };
    await pool.query(
      "insert into family.household_users (household_id, email) values ($1, $2), ($1, $3)",
      [householdId, emails.a, emails.b],
    );
    const anchorParentId = await insertCategory(pool, {
      householdId,
      label: `Anchor parent ${run}`,
      color: "#2178AF",
      role: "parent",
    });
    const [a, b, stranger] = await createUsers(adminClient(), [emails.a, emails.b, emails.stranger]);
    if (!a || !b || !stranger) throw new Error("expected three fixture accounts");

    created = { run, householdId, anchorParentId, users: { a, b, stranger } };
    project.provide("familyFixtures", created);
  } finally {
    await pool.end();
  }
}

export async function teardown(): Promise<void> {
  if (!created) return;
  const pool = createPool();
  try {
    await pool.query("delete from family.households where name like $1", [`test-${created.run}%`]);
    await deleteUsers(adminClient(), Object.values(created.users).map((user) => user.id));
  } finally {
    await pool.end();
    created = null;
  }
}
