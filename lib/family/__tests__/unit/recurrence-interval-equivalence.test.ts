import { describe, expect, it } from "vitest";
import { dateMatches as matchesOn } from "@/lib/family/recurrence/expand";
import { parseRule, type RecurrenceRule } from "@/lib/family/recurrence/grammar";
import {
  datePartsOf,
  epochDayOf,
  isoOfEpochDay,
  weekdayIndexOf,
} from "@/lib/family/recurrence/plain-date";
import { WEEKDAYS } from "@/lib/family/types";

/**
 * T015 — the proof that widening `INTERVAL` to 1–99 changed NOTHING for the
 * rules the live calendar already stores (R302). The shipped interval-1
 * predicate is inlined below as `legacyMatches`, and the new anchor-relative
 * one is asserted equal to it over the whole reachable domain — every rule
 * shape the old grammar could emit, every day of a three-year window, from
 * three different anchors — rather than over a sample. `x % 1 === 0` holds for
 * every integer, so the collapse is algebraic; the sweep is what turns that
 * argument into a test that fails if it ever stops being true.
 *
 * The new-interval tables below it are the other half: what the widening buys,
 * including the six-month `BYMONTHDAY=31` gap that is recorded, not fixed.
 */

/**
 * The predicate exactly as `recurrence/expand.ts` shipped it in Phase 2 —
 * frozen here on purpose. It must not be "kept in sync" with the new one; it
 * is the thing being compared against.
 */
function legacyMatches(rule: RecurrenceRule, day: number): boolean {
  if (rule.freq === "DAILY") return true;
  if (rule.freq === "WEEKLY") return rule.byDay.includes(WEEKDAYS[weekdayIndexOf(day)]);
  return datePartsOf(day).day === rule.byMonthDay;
}

/**
 * Every shape the shipped emitter could write, at interval 1: the one daily
 * form, each single weekday, two multi-weekday sets (one carrying a WKST that
 * must stay inert, one carrying none), and the three interesting
 * days-of-month. `UNTIL` is absent because the predicate never reads it — the
 * walk's bounds do.
 */
const SHIPPED_SHAPES = [
  "FREQ=DAILY;INTERVAL=1",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=SU",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=MO",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TU",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TH",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR",
  "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=SA",
  "FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,WE,FR",
  "FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU",
  "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1",
  "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15",
  "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
] as const;

const FIRST_DAY = epochDayOf("2025-01-01");
const LAST_DAY = epochDayOf("2027-12-31");

// Three anchors: the first day of the window, a DST Sunday mid-window, and the
// last day — so days both after AND before the anchor are exercised, which is
// where a sign-preserving `%` has to be right.
const ANCHORS = ["2025-01-01", "2026-03-08", "2027-12-31"].map(epochDayOf);

/** Every date in `[from, to]` the predicate matches, given the anchor. */
function matchingDates(text: string, anchorDate: string, from: string, to: string): string[] {
  const rule = parseRule(text);
  const anchorDay = epochDayOf(anchorDate);
  const dates: string[] = [];
  for (let day = epochDayOf(from); day <= epochDayOf(to); day += 1) {
    if (matchesOn(rule, day, anchorDay)) dates.push(isoOfEpochDay(day));
  }
  return dates;
}

describe("the interval-1 collapse (R302): the new predicate IS the shipped one", () => {
  it("agrees on every shipped shape × every day of 2025–2027 × three anchors", () => {
    const divergences: string[] = [];
    let evaluated = 0;
    for (const text of SHIPPED_SHAPES) {
      const rule = parseRule(text);
      for (const anchorDay of ANCHORS) {
        for (let day = FIRST_DAY; day <= LAST_DAY; day += 1) {
          evaluated += 1;
          if (matchesOn(rule, day, anchorDay) === legacyMatches(rule, day)) continue;
          divergences.push(`${text} on ${isoOfEpochDay(day)} from ${isoOfEpochDay(anchorDay)}`);
        }
      }
    }
    expect(divergences).toEqual([]);
    expect(evaluated).toBe(SHIPPED_SHAPES.length * ANCHORS.length * (LAST_DAY - FIRST_DAY + 1));
  });

  it("is not vacuous — every shape matches at least one day of the window", () => {
    const barren = SHIPPED_SHAPES.filter(
      (text) => matchingDates(text, "2025-01-01", "2025-01-01", "2027-12-31").length === 0,
    );
    expect(barren).toEqual([]);
  });

  it("reads WKST as inert at interval 1, whichever week it names", () => {
    const week = { anchor: "2026-01-04", from: "2026-01-01", to: "2026-03-31" };
    const sunday = matchingDates(
      "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TU",
      week.anchor,
      week.from,
      week.to,
    );
    const monday = matchingDates(
      "FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=TU",
      week.anchor,
      week.from,
      week.to,
    );
    expect(sunday).toEqual(monday);
    expect(sunday).toHaveLength(13);
  });
});

describe("what the widening buys (FR-345)", () => {
  it("every 2 days walks alternate dates from the anchor", () => {
    expect(
      matchingDates("FREQ=DAILY;INTERVAL=2", "2026-01-01", "2026-01-01", "2026-01-10"),
    ).toEqual(["2026-01-01", "2026-01-03", "2026-01-05", "2026-01-07", "2026-01-09"]);
  });

  it("every 3 weeks lands in the anchor's week and every third week after", () => {
    expect(
      matchingDates(
        "FREQ=WEEKLY;INTERVAL=3;WKST=SU;BYDAY=MO",
        "2026-01-05",
        "2026-01-01",
        "2026-03-15",
      ),
    ).toEqual(["2026-01-05", "2026-01-26", "2026-02-16", "2026-03-09"]);
  });

  it("every 2 months keeps the day-of-month and skips the odd months", () => {
    expect(
      matchingDates(
        "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15",
        "2026-01-15",
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual([
      "2026-01-15",
      "2026-03-15",
      "2026-05-15",
      "2026-07-15",
      "2026-09-15",
      "2026-11-15",
    ]);
  });

  // RECORDED, NOT FIXED (R303): April has no 31st, so the April tick simply
  // produces nothing and the visible gap is six months. Clamping to the month
  // end was refused — it would change shipped interval-1 behaviour.
  it("leaves a six-month gap for BYMONTHDAY=31 at INTERVAL=3", () => {
    expect(
      matchingDates(
        "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=31",
        "2026-01-31",
        "2026-01-01",
        "2027-12-31",
      ),
    ).toEqual([
      "2026-01-31",
      "2026-07-31",
      "2026-10-31",
      "2027-01-31",
      "2027-07-31",
      "2027-10-31",
    ]);
  });
});

describe("WKST is load-bearing above interval 1 (R303)", () => {
  // Anchored on a Sunday, "every 2 weeks on Tue and Thu" falls in different
  // weeks depending on where the week begins — the silent wrong answer the
  // grammar's mandatory WKST exists to prevent.
  const ANCHOR = "2026-01-04"; // Sunday

  it("counts weeks from the anchor's Sunday under WKST=SU", () => {
    expect(
      matchingDates("FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU,TH", ANCHOR, ANCHOR, "2026-01-31"),
    ).toEqual(["2026-01-06", "2026-01-08", "2026-01-20", "2026-01-22"]);
  });

  it("counts weeks from the anchor's Monday under WKST=MO, giving different dates", () => {
    expect(
      matchingDates("FREQ=WEEKLY;INTERVAL=2;WKST=MO;BYDAY=TU,TH", ANCHOR, ANCHOR, "2026-01-31"),
    ).toEqual(["2026-01-13", "2026-01-15", "2026-01-27", "2026-01-29"]);
  });
});

describe("the predicate is sign-correct before its anchor", () => {
  it("treats a day two before the anchor as on-parity for every 2 days", () => {
    const rule = parseRule("FREQ=DAILY;INTERVAL=2");
    const anchorDay = epochDayOf("2026-01-10");
    expect(matchesOn(rule, anchorDay - 2, anchorDay)).toBe(true);
    expect(matchesOn(rule, anchorDay - 1, anchorDay)).toBe(false);
  });

  it("treats a month before the anchor as on-parity for every 2 months", () => {
    const rule = parseRule("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15");
    const anchorDay = epochDayOf("2026-05-15");
    expect(matchesOn(rule, epochDayOf("2026-03-15"), anchorDay)).toBe(true);
    expect(matchesOn(rule, epochDayOf("2026-04-15"), anchorDay)).toBe(false);
  });

  it("treats an earlier week as on-parity for every 2 weeks", () => {
    const rule = parseRule("FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU");
    const anchorDay = epochDayOf("2026-01-20");
    expect(matchesOn(rule, epochDayOf("2026-01-06"), anchorDay)).toBe(true);
    expect(matchesOn(rule, epochDayOf("2026-01-13"), anchorDay)).toBe(false);
  });
});
