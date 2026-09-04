import { describe, expect, it } from "vitest";
import {
  expandSeries,
  ruleDatesIn,
  type LocalDateRange,
  type SeriesException,
  type SeriesInput,
} from "@/lib/family/recurrence/expand";
import { parseRule } from "@/lib/family/recurrence/grammar";
import { instantToWall } from "@/lib/family/recurrence/zone";
import type { EventTimes } from "@/lib/family/types";

const CHICAGO = "America/Chicago";
const HOUR = 3_600_000;

function timed(startsAt: string, endsAt: string): EventTimes {
  return { allDay: false, startsAt, endsAt };
}

function allDay(startDate: string, endDate: string): EventTimes {
  return { allDay: true, startDate, endDate };
}

function series(input: Partial<SeriesInput> & Pick<SeriesInput, "rrule" | "times">): SeriesInput {
  return {
    summary: "Series",
    description: null,
    location: null,
    exceptions: [],
    ...input,
  };
}

function exception(
  occurrenceDate: string,
  action: SeriesException["action"],
  patch: Partial<SeriesException> = {},
): SeriesException {
  return {
    occurrenceDate,
    action,
    summary: null,
    description: null,
    location: null,
    times: null,
    ...patch,
  };
}

/** The start instant of a timed occurrence; throws on an all-day shape. */
function startMs(times: EventTimes): number {
  if (times.allDay) throw new Error("expected a timed occurrence");
  return Date.parse(times.startsAt);
}

function endMs(times: EventTimes): number {
  if (times.allDay) throw new Error("expected a timed occurrence");
  return Date.parse(times.endsAt);
}

describe("SC-208: a year-long weekly sweep holds household wall time across both Chicago transitions", () => {
  // Tue 17:00–17:45 CST — 2026-01-06T23:00Z.
  const piano = series({
    rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
    times: timed("2026-01-06T23:00:00.000Z", "2026-01-06T23:45:00.000Z"),
  });
  const year = expandSeries(piano, { start: "2026-01-01", end: "2026-12-31" }, CHICAGO);

  it("emits every Tuesday of 2026 exactly once — no occurrence missing or duplicated", () => {
    expect(year).toHaveLength(52);
    expect(new Set(year.map((occ) => occ.occurrenceDate)).size).toBe(52);
    expect(year[0]?.occurrenceDate).toBe("2026-01-06");
    expect(year[51]?.occurrenceDate).toBe("2026-12-29");
  });

  it("keeps 17:00 on the household wall for every occurrence", () => {
    for (const occ of year) {
      const wall = instantToWall(CHICAGO, startMs(occ.times));
      expect([occ.occurrenceDate, wall.hour, wall.minute]).toEqual([occ.occurrenceDate, 17, 0]);
    }
  });

  it("shifts the UTC instant across the 2026-03-08 spring-forward", () => {
    const before = year.find((occ) => occ.occurrenceDate === "2026-03-03");
    const after = year.find((occ) => occ.occurrenceDate === "2026-03-10");
    expect(before && startMs(before.times)).toBe(Date.UTC(2026, 2, 3, 23));
    expect(after && startMs(after.times)).toBe(Date.UTC(2026, 2, 10, 22));
  });

  it("shifts the UTC instant back across the 2026-11-01 fall-back", () => {
    const before = year.find((occ) => occ.occurrenceDate === "2026-10-27");
    const after = year.find((occ) => occ.occurrenceDate === "2026-11-03");
    expect(before && startMs(before.times)).toBe(Date.UTC(2026, 9, 27, 22));
    expect(after && startMs(after.times)).toBe(Date.UTC(2026, 10, 3, 23));
  });
});

describe("UNTIL inclusivity is a local-date comparison (R201)", () => {
  it("keeps the until-date occurrence of an all-day series", () => {
    const daily = series({
      rrule: "FREQ=DAILY;INTERVAL=1;UNTIL=20260110",
      times: allDay("2026-01-05", "2026-01-05"),
    });
    const out = expandSeries(daily, { start: "2026-01-01", end: "2026-01-31" }, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  it("keeps the until-date evening occurrence under our emitter's household end-of-day instant", () => {
    // 18:30 CST on 2026-01-05 = 2026-01-06T00:30Z — the anchor's LOCAL date is the 5th.
    const daily = series({
      rrule: "FREQ=DAILY;INTERVAL=1;UNTIL=20260111T055959Z",
      times: timed("2026-01-06T00:30:00.000Z", "2026-01-06T01:30:00.000Z"),
    });
    const out = expandSeries(daily, { start: "2026-01-01", end: "2026-01-31" }, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  it("keeps the until-date evening occurrence of a genuine Skylight T235959Z rule", () => {
    // Mon/Tue 18:30 CST; UNTIL=20260106T235959Z is 17:59:59 CST — an instant
    // comparison would drop the 2026-01-06 18:30 occurrence; date comparison keeps it.
    const skylight = series({
      rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU",
      times: timed("2025-12-30T00:30:00.000Z", "2025-12-30T01:00:00.000Z"),
    });
    const out = expandSeries(skylight, { start: "2025-12-28", end: "2026-01-31" }, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2026-01-05",
      "2026-01-06",
    ]);
  });
});

describe("monthly rules skip months without the date (FR-231's 'on the date')", () => {
  it("BYMONTHDAY=31 hits only the seven 31-day months", () => {
    const monthly = series({
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
      times: timed("2026-01-31T15:00:00.000Z", "2026-01-31T16:00:00.000Z"),
    });
    const out = expandSeries(monthly, { start: "2026-01-01", end: "2026-12-31" }, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
      "2026-08-31",
      "2026-10-31",
      "2026-12-31",
    ]);
  });

  it("BYMONTHDAY=30 skips February", () => {
    const monthly = series({
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=30",
      times: timed("2026-01-30T15:00:00.000Z", "2026-01-30T16:00:00.000Z"),
    });
    const out = expandSeries(monthly, { start: "2026-01-01", end: "2026-12-31" }, CHICAGO);
    expect(out).toHaveLength(11);
    expect(out.some((occ) => occ.occurrenceDate.startsWith("2026-02"))).toBe(false);
  });

  it("BYMONTHDAY=29 skips February only in a non-leap year", () => {
    const monthly = series({
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=29",
      times: timed("2027-01-29T15:00:00.000Z", "2027-01-29T16:00:00.000Z"),
    });
    const out = expandSeries(monthly, { start: "2027-01-01", end: "2028-12-31" }, CHICAGO);
    const dates = out.map((occ) => occ.occurrenceDate);
    expect(dates).toHaveLength(23);
    expect(dates).not.toContain("2027-02-29");
    expect(dates).toContain("2028-02-29");
  });
});

describe("daily and multi-weekday walks", () => {
  it("a daily series fills every date from its anchor", () => {
    const daily = series({
      rrule: "FREQ=DAILY;INTERVAL=1",
      times: timed("2026-09-07T14:00:00.000Z", "2026-09-07T15:00:00.000Z"),
    });
    const out = expandSeries(daily, { start: "2026-09-06", end: "2026-09-12" }, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("a weekly rule walks exactly its BYDAY weekdays", () => {
    const weekly = series({
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      times: timed("2026-09-07T14:00:00.000Z", "2026-09-07T15:00:00.000Z"),
    });
    const out = expandSeries(weekly, { start: "2026-09-06", end: "2026-09-19" }, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-09-07",
      "2026-09-09",
      "2026-09-11",
      "2026-09-14",
      "2026-09-16",
      "2026-09-18",
    ]);
  });

  it("a range ending before the series anchor expands to nothing", () => {
    const weekly = series({
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
      times: timed("2026-01-06T23:00:00.000Z", "2026-01-06T23:45:00.000Z"),
    });
    expect(expandSeries(weekly, { start: "2025-12-01", end: "2025-12-31" }, CHICAGO)).toEqual([]);
  });

  it("a multi-day all-day series keeps its span on every occurrence", () => {
    const camping = series({
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      times: allDay("2026-09-07", "2026-09-08"),
    });
    const out = expandSeries(camping, { start: "2026-09-06", end: "2026-09-19" }, CHICAGO);
    expect(out.map((occ) => occ.times)).toEqual([
      allDay("2026-09-07", "2026-09-08"),
      allDay("2026-09-14", "2026-09-15"),
    ]);
  });
});

describe("skips and overrides (FR-239/240)", () => {
  const piano = series({
    rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
    times: timed("2026-01-06T23:00:00.000Z", "2026-01-06T23:45:00.000Z"),
    summary: "Piano",
    location: "Home",
  });
  const january = { start: "2026-01-01", end: "2026-01-31" };

  it("a skip removes exactly its occurrence", () => {
    const out = expandSeries(
      { ...piano, exceptions: [exception("2026-01-13", "skip")] },
      january,
      CHICAGO,
    );
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-01-06",
      "2026-01-20",
      "2026-01-27",
    ]);
  });

  it("an override merges its fields and inherits the rest", () => {
    const out = expandSeries(
      {
        ...piano,
        exceptions: [exception("2026-01-13", "override", { summary: "Recital", location: "Hall" })],
      },
      january,
      CHICAGO,
    );
    const overridden = out.find((occ) => occ.occurrenceDate === "2026-01-13");
    expect(overridden).toMatchObject({ summary: "Recital", location: "Hall", description: null });
    expect(overridden && startMs(overridden.times)).toBe(Date.UTC(2026, 0, 13, 23));
    expect(out.filter((occ) => occ.summary === "Piano")).toHaveLength(3);
  });

  it("a time override replaces the whole pair and keeps the original occurrenceDate", () => {
    const moved = timed("2026-01-15T00:00:00.000Z", "2026-01-15T00:45:00.000Z");
    const out = expandSeries(
      { ...piano, exceptions: [exception("2026-01-13", "override", { times: moved })] },
      january,
      CHICAGO,
    );
    const overridden = out.find((occ) => occ.occurrenceDate === "2026-01-13");
    expect(overridden?.times).toEqual(moved);
  });

  it("an exception on a date the rule never produces is inert", () => {
    const out = expandSeries(
      { ...piano, exceptions: [exception("2026-01-14", "override", { summary: "Phantom" })] },
      january,
      CHICAGO,
    );
    expect(out.map((occ) => occ.occurrenceDate)).toEqual([
      "2026-01-06",
      "2026-01-13",
      "2026-01-20",
      "2026-01-27",
    ]);
    expect(out.some((occ) => occ.summary === "Phantom")).toBe(false);
  });
});

describe("DST placement (FR-235/236) and duration in instant space", () => {
  it("places the 02:30 gap occurrence once, at 03:00 exactly", () => {
    const daily = series({
      rrule: "FREQ=DAILY;INTERVAL=1",
      times: timed("2026-03-06T08:30:00.000Z", "2026-03-06T09:00:00.000Z"),
    });
    const out = expandSeries(daily, { start: "2026-03-06", end: "2026-03-12" }, CHICAGO);
    expect(out).toHaveLength(7);
    const gapDay = out.find((occ) => occ.occurrenceDate === "2026-03-08");
    expect(gapDay && startMs(gapDay.times)).toBe(Date.UTC(2026, 2, 8, 8));
    expect(gapDay && instantToWall(CHICAGO, startMs(gapDay.times))).toMatchObject({
      hour: 3,
      minute: 0,
    });
    const after = out.find((occ) => occ.occurrenceDate === "2026-03-09");
    expect(after && startMs(after.times)).toBe(Date.UTC(2026, 2, 9, 7, 30));
  });

  it("renders the doubled 01:30 once, at the first instant", () => {
    const daily = series({
      rrule: "FREQ=DAILY;INTERVAL=1",
      times: timed("2026-10-30T06:30:00.000Z", "2026-10-30T07:00:00.000Z"),
    });
    const out = expandSeries(daily, { start: "2026-10-30", end: "2026-11-02" }, CHICAGO);
    expect(out).toHaveLength(4);
    const foldDay = out.find((occ) => occ.occurrenceDate === "2026-11-01");
    expect(foldDay && startMs(foldDay.times)).toBe(Date.UTC(2026, 10, 1, 6, 30));
  });

  it("applies duration in instant space, so the fall-back occurrence runs through the repeated hour", () => {
    // 00:30–02:30 CDT: on 2026-11-01 the two elapsed hours end at 01:30 CST.
    const daily = series({
      rrule: "FREQ=DAILY;INTERVAL=1",
      times: timed("2026-10-31T05:30:00.000Z", "2026-10-31T07:30:00.000Z"),
    });
    const out = expandSeries(daily, { start: "2026-10-31", end: "2026-11-01" }, CHICAGO);
    const foldDay = out.find((occ) => occ.occurrenceDate === "2026-11-01");
    expect(foldDay && endMs(foldDay.times) - startMs(foldDay.times)).toBe(2 * HOUR);
    expect(foldDay && instantToWall(CHICAGO, endMs(foldDay.times))).toMatchObject({
      hour: 1,
      minute: 30,
    });
  });
});

/**
 * T017 — `ruleDatesIn` is the date-only walk `expandSeries` is now built on
 * (R304): one rule engine, two consumers. Events keep their times; tasks take
 * the dates, so a routine with no clock time never has a start instant
 * invented for it.
 *
 * Every case below is one of `expandSeries`'s OWN tables above, re-asserted
 * through the primitive — including UNTIL inclusivity by household-local date
 * on a genuine `T235959Z` rule, which is why the walk needs the zone.
 */
describe("ruleDatesIn — one rule walk, two consumers (R304)", () => {
  const datesOf = (
    rrule: string,
    anchorDate: string,
    range: LocalDateRange,
  ): string[] => ruleDatesIn(parseRule(rrule), anchorDate, range, CHICAGO);

  it("walks SC-208's year of Tuesdays", () => {
    const dates = datesOf("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU", "2026-01-06", {
      start: "2026-01-01",
      end: "2026-12-31",
    });
    expect(dates).toHaveLength(52);
    expect(dates[0]).toBe("2026-01-06");
    expect(dates[51]).toBe("2026-12-29");
  });

  it("keeps the until-date occurrence of an all-day series", () => {
    expect(
      datesOf("FREQ=DAILY;INTERVAL=1;UNTIL=20260110", "2026-01-05", {
        start: "2026-01-01",
        end: "2026-01-31",
      }),
    ).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  it("reads an instant UNTIL by its household-local date, not by the instant", () => {
    expect(
      datesOf("FREQ=DAILY;INTERVAL=1;UNTIL=20260111T055959Z", "2026-01-05", {
        start: "2026-01-01",
        end: "2026-01-31",
      }),
    ).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  it("keeps the until-date occurrence of a genuine Skylight T235959Z rule", () => {
    expect(
      datesOf(
        "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU",
        "2025-12-29",
        { start: "2025-12-28", end: "2026-01-31" },
      ),
    ).toEqual(["2025-12-29", "2025-12-30", "2026-01-05", "2026-01-06"]);
  });

  it("skips the months that have no 31st", () => {
    expect(
      datesOf("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31", "2026-01-31", {
        start: "2026-01-01",
        end: "2026-12-31",
      }),
    ).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
      "2026-08-31",
      "2026-10-31",
      "2026-12-31",
    ]);
  });

  it("walks exactly the BYDAY weekdays of a multi-weekday rule", () => {
    expect(
      datesOf("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR", "2026-09-07", {
        start: "2026-09-06",
        end: "2026-09-19",
      }),
    ).toEqual([
      "2026-09-07",
      "2026-09-09",
      "2026-09-11",
      "2026-09-14",
      "2026-09-16",
      "2026-09-18",
    ]);
  });

  it("never emits a date before the anchor, whatever the range asks for", () => {
    expect(
      datesOf("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU", "2026-01-06", {
        start: "2025-12-01",
        end: "2025-12-31",
      }),
    ).toEqual([]);
  });

  it("gives exactly the dates expandSeries reports for the same series", () => {
    const piano = series({
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
      times: timed("2026-01-06T23:00:00.000Z", "2026-01-06T23:45:00.000Z"),
    });
    const range = { start: "2026-01-01", end: "2026-12-31" };
    expect(datesOf(piano.rrule, "2026-01-06", range)).toEqual(
      expandSeries(piano, range, CHICAGO).map((occ) => occ.occurrenceDate),
    );
  });

  it("carries a widened interval into the same walk (FR-345)", () => {
    expect(
      datesOf("FREQ=DAILY;INTERVAL=2", "2026-01-01", {
        start: "2026-01-01",
        end: "2026-01-09",
      }),
    ).toEqual(["2026-01-01", "2026-01-03", "2026-01-05", "2026-01-07", "2026-01-09"]);
  });
});
