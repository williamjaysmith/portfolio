/**
 * T016 — the stored corpus, round-tripped against a schema this phase has not
 * touched. Every distinct `family.events.rrule` in the local database is
 * parsed by the WIDENED grammar, re-emitted, and compared byte-for-byte with
 * what is stored; each must also read back as `interval === 1`, because the
 * calendar's contract never offered an interval (T018).
 *
 * What this test reaches, said plainly (R302): the LOCAL 553xx stack after
 * `supabase db reset` and `npm run family:seed -- --local` — the seeded Phase 2
 * fixtures, never a hosted row. It runs **before migration 022** so the schema
 * it reads is the one that shipped. The family's live rules are covered by the
 * operator's read-only query at T081, and the algebraic argument (`interval: 1`
 * formats in an unmoved slot; `x % 1 === 0`) by T015. Three separate reaches,
 * none of them claiming the others' ground.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { emitRule, parseRule } from "@/lib/family/recurrence/grammar";
import { assertLocalKeys, createPool } from "./helpers";

describe("the stored rrule corpus survives the INTERVAL widening", () => {
  let pool: Pool;
  let corpus: string[];

  beforeAll(async () => {
    assertLocalKeys();
    pool = createPool();
    const { rows } = await pool.query<{ rrule: string }>(
      "select distinct rrule from family.events where rrule is not null order by rrule",
    );
    corpus = rows.map((row) => row.rrule);
  });

  afterAll(async () => {
    await pool?.end();
  });

  // A silently empty corpus would make every assertion below vacuously true.
  it("reads a non-empty corpus out of the seeded local database", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  it("parses every stored rule under the widened grammar", () => {
    const refused = corpus.filter((rrule) => !parses(rrule));
    expect(refused).toEqual([]);
  });

  it("re-emits every stored rule byte-for-byte", () => {
    const moved = corpus.filter((rrule) => emitRule(parseRule(rrule)) !== rrule);
    expect(moved).toEqual([]);
  });

  it("reads every stored rule as interval 1 — the calendar never offered another", () => {
    const wider = corpus.filter((rrule) => parseRule(rrule).interval !== 1);
    expect(wider).toEqual([]);
  });
});

function parses(rrule: string): boolean {
  try {
    parseRule(rrule);
    return true;
  } catch {
    return false;
  }
}
