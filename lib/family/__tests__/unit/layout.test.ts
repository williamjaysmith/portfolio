import { describe, expect, it } from "vitest";
import {
  abreastCapOf,
  layoutWeek,
  minBlockHeightOf,
  TOUCH_FLOOR,
  type LayoutMetrics,
  type WeekLayout,
} from "@/lib/family/calendar/layout";
import { addDays, localDateOf } from "@/lib/family/calendar/dates";
import { datePartsOf, epochDayOf } from "@/lib/family/recurrence/plain-date";
import { wallToInstant } from "@/lib/family/recurrence/zone";
import type { EventTimes, Occurrence } from "@/lib/family/types";
import { MINUTES_PER_DAY } from "@/lib/family/week-geometry";

const CHICAGO = "America/Chicago";

function weekOf(start: string): string[] {
  return Array.from({ length: 7 }, (_, day) => addDays(start, day));
}

// Sun 2026-09-06 … Sat 2026-09-12 — the fixture week (CDT, UTC-5).
const WEEK = weekOf("2026-09-06");

/** ISO instant of a Chicago wall-clock reading. */
function instantAt(date: string, time: string): string {
  const ms = wallToInstant(CHICAGO, {
    ...datePartsOf(epochDayOf(date)),
    hour: Number(time.slice(0, 2)),
    minute: Number(time.slice(3, 5)),
    second: 0,
  });
  return new Date(ms).toISOString();
}

function timedTimes(startDate: string, start: string, endDate: string, end: string): EventTimes {
  return { allDay: false, startsAt: instantAt(startDate, start), endsAt: instantAt(endDate, end) };
}

function allDayTimes(startDate: string, endDate: string): EventTimes {
  return { allDay: true, startDate, endDate };
}

let nextId = 0;

/** Ids are zero-padded so lexicographic tie-breaks follow creation order. */
function occurrenceOf(times: EventTimes, patch: Partial<Occurrence> = {}): Occurrence {
  nextId += 1;
  const id = String(nextId).padStart(3, "0");
  return {
    eventId: `event-${id}`,
    occurrenceDate: times.allDay ? times.startDate : localDateOf(CHICAGO, Date.parse(times.startsAt)),
    isRepeating: false,
    summary: `Event ${id}`,
    description: null,
    location: null,
    categoryIds: [],
    times,
    ...patch,
  };
}

const METRICS: LayoutMetrics = {
  columnWidth: 200, // wide: three abreast (FR-285)
  pxPerMinute: 1, // px equals wall minutes, so positions read directly
  titleLineHeight: 18,
  blockPaddingY: 12, // 18 + 12 = 30 — under the 44 touch floor
};

function layout(
  occurrences: Occurrence[],
  patch: Partial<LayoutMetrics> = {},
  columns: string[] = WEEK,
): WeekLayout {
  return layoutWeek(occurrences, columns, CHICAGO, { ...METRICS, ...patch });
}

describe("midnight segmentation (FR-217)", () => {
  it("splits a Fri 22:00 → Sat 01:00 event into one labelled segment per touched column", () => {
    const bonfire = occurrenceOf(timedTimes("2026-09-11", "22:00", "2026-09-12", "01:00"), {
      summary: "Bonfire",
    });
    const { timed } = layout([bonfire]);
    expect(timed).toHaveLength(2);
    const [friday, saturday] = timed;
    expect(friday.columnIndex).toBe(5);
    expect(friday.date).toBe("2026-09-11");
    expect(friday.startMinutes).toBe(22 * 60);
    expect(friday.endMinutes).toBe(MINUTES_PER_DAY);
    expect(friday.continuesFromPrevious).toBe(false);
    expect(friday.continuesToNext).toBe(true);
    expect(friday.top).toBe(1320);
    expect(friday.height).toBe(120);
    expect(saturday.columnIndex).toBe(6);
    expect(saturday.startMinutes).toBe(0);
    expect(saturday.endMinutes).toBe(60);
    expect(saturday.continuesFromPrevious).toBe(true);
    expect(saturday.continuesToNext).toBe(false);
    // ONE event: both segments carry the SAME occurrence, label included.
    expect(saturday.occurrence).toBe(friday.occurrence);
    expect(friday.occurrence.summary).toBe("Bonfire");
  });

  it("gives a multi-day timed event a full-height segment in each middle column", () => {
    const trek = occurrenceOf(timedTimes("2026-09-08", "20:00", "2026-09-10", "06:00"));
    const { timed } = layout([trek]);
    expect(timed.map((segment) => segment.columnIndex)).toEqual([2, 3, 4]);
    const middle = timed[1];
    expect(middle.startMinutes).toBe(0);
    expect(middle.endMinutes).toBe(MINUTES_PER_DAY);
    expect(middle.continuesFromPrevious).toBe(true);
    expect(middle.continuesToNext).toBe(true);
  });

  it("does not leak a segment into the next day when the event ends exactly at midnight", () => {
    const late = occurrenceOf(timedTimes("2026-09-07", "22:00", "2026-09-08", "00:00"));
    const { timed } = layout([late]);
    expect(timed).toHaveLength(1);
    expect(timed[0].columnIndex).toBe(1);
    expect(timed[0].endMinutes).toBe(MINUTES_PER_DAY);
    expect(timed[0].continuesToNext).toBe(false);
  });

  it("clips segmentation to the visible slice but keeps the continuation flag", () => {
    const slice = ["2026-09-09", "2026-09-10", "2026-09-11"];
    const bonfire = occurrenceOf(timedTimes("2026-09-11", "22:00", "2026-09-12", "01:00"));
    const { timed } = layout([bonfire], {}, slice);
    expect(timed).toHaveLength(1);
    expect(timed[0].columnIndex).toBe(2);
    expect(timed[0].continuesToNext).toBe(true);
  });

  it("places by wall-clock minutes across a DST fall-back, not elapsed time", () => {
    const november = weekOf("2026-11-01"); // DST ends 02:00 that Sunday
    const lunch = occurrenceOf(timedTimes("2026-11-01", "13:00", "2026-11-01", "14:00"));
    const { timed } = layout([lunch], {}, november);
    expect(timed[0].startMinutes).toBe(13 * 60); // NOT the 14 elapsed hours since midnight
    expect(timed[0].top).toBe(13 * 60);
    expect(timed[0].endMinutes).toBe(14 * 60);
  });

  it("ignores a timed occurrence outside the visible columns", () => {
    const elsewhere = occurrenceOf(timedTimes("2026-09-20", "09:00", "2026-09-20", "10:00"));
    const result = layout([elsewhere]);
    expect(result.timed).toHaveLength(0);
    expect(result.overflow).toHaveLength(0);
  });
});

describe("overlap clustering (FR-205, FR-285)", () => {
  it("draws two overlapping events side by side at half width", () => {
    const first = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "10:00"));
    const second = occurrenceOf(timedTimes("2026-09-07", "09:30", "2026-09-07", "10:30"));
    const { timed, overflow, allDay } = layout([first, second]);
    expect(overflow).toHaveLength(0);
    expect(allDay.bars).toHaveLength(0);
    expect(timed.map((segment) => segment.widthFraction)).toEqual([0.5, 0.5]);
    expect(timed.map((segment) => segment.leftFraction)).toEqual([0, 0.5]);
  });

  it("keeps non-overlapping events at full width", () => {
    const morning = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "10:00"));
    const noon = occurrenceOf(timedTimes("2026-09-07", "12:00", "2026-09-07", "13:00"));
    const { timed } = layout([morning, noon]);
    expect(timed.map((segment) => segment.widthFraction)).toEqual([1, 1]);
    expect(timed.map((segment) => segment.leftFraction)).toEqual([0, 0]);
  });

  it("draws three abreast in a wide column with no overflow", () => {
    const standup = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "11:00"));
    const review = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "10:00"));
    const dentist = occurrenceOf(timedTimes("2026-09-07", "09:30", "2026-09-07", "10:30"));
    const { timed, overflow } = layout([standup, review, dentist]);
    expect(overflow).toHaveLength(0);
    expect(timed.map((segment) => segment.widthFraction)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(timed.map((segment) => segment.leftFraction)).toEqual([0, 1 / 3, 2 / 3]);
  });

  it("caps a narrow column at two abreast and collapses the rest into +n more", () => {
    const standup = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "11:00"), {
      summary: "Standup",
    });
    const review = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "10:00"), {
      summary: "Review",
    });
    const dentist = occurrenceOf(timedTimes("2026-09-07", "09:30", "2026-09-07", "10:30"), {
      summary: "Dentist",
    });
    const { timed, overflow } = layout([standup, review, dentist], { columnWidth: 160 });
    expect(timed.map((segment) => segment.occurrence.summary)).toEqual(["Standup", "Review"]);
    expect(timed.map((segment) => segment.widthFraction)).toEqual([0.5, 0.5]);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].columnIndex).toBe(1);
    expect(overflow[0].date).toBe("2026-09-07");
    expect(overflow[0].hiddenCount).toBe(1);
    expect(overflow[0].occurrences.map((entry) => entry.summary)).toEqual(["Dentist"]);
    expect(overflow[0].startMinutes).toBe(570);
    expect(overflow[0].endMinutes).toBe(630);
    expect(overflow[0].top).toBe(570);
    expect(overflow[0].height).toBe(60);
  });

  it("caps a wide column at three abreast, hiding the fourth", () => {
    const band = ["A", "B", "C", "D"].map((summary) =>
      occurrenceOf(timedTimes("2026-09-08", "09:00", "2026-09-08", "10:00"), { summary }),
    );
    const { timed, overflow } = layout(band);
    expect(timed.map((segment) => segment.occurrence.summary)).toEqual(["A", "B", "C"]);
    expect(timed.map((segment) => segment.widthFraction)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].hiddenCount).toBe(1);
    expect(overflow[0].occurrences.map((entry) => entry.summary)).toEqual(["D"]);
  });

  it("collapses each simultaneous time band into its own +n more group", () => {
    const nineOclock = ["A", "B", "C"].map((summary) =>
      occurrenceOf(timedTimes("2026-09-09", "09:00", "2026-09-09", "10:00"), { summary }),
    );
    const onePm = ["D", "E", "F"].map((summary) =>
      occurrenceOf(timedTimes("2026-09-09", "13:00", "2026-09-09", "14:00"), { summary }),
    );
    const { overflow } = layout([...nineOclock, ...onePm], { columnWidth: 160 });
    expect(overflow).toHaveLength(2);
    expect(overflow.map((group) => group.top)).toEqual([540, 780]);
    expect(overflow.map((group) => group.hiddenCount)).toEqual([1, 1]);
    expect(overflow[0].occurrences.map((entry) => entry.summary)).toEqual(["C"]);
    expect(overflow[1].occurrences.map((entry) => entry.summary)).toEqual(["F"]);
  });

  it("lists every collapsed event of one band in start order", () => {
    const band = ["A", "B", "C", "D"].map((summary) =>
      occurrenceOf(timedTimes("2026-09-10", "09:00", "2026-09-10", "10:00"), { summary }),
    );
    const { overflow } = layout(band, { columnWidth: 160 });
    expect(overflow).toHaveLength(1);
    expect(overflow[0].hiddenCount).toBe(2);
    expect(overflow[0].occurrences.map((entry) => entry.summary)).toEqual(["C", "D"]);
  });

  it("treats min-height-inflated blocks as overlapping so short events still sit side by side", () => {
    const first = occurrenceOf(timedTimes("2026-09-07", "09:00", "2026-09-07", "09:15"));
    const second = occurrenceOf(timedTimes("2026-09-07", "09:30", "2026-09-07", "09:45"));
    const { timed } = layout([first, second], { pxPerMinute: 0.2 });
    expect(timed.map((segment) => segment.height)).toEqual([44, 44]);
    expect(timed.map((segment) => segment.top)).toEqual([108, 114]);
    expect(timed.map((segment) => segment.widthFraction)).toEqual([0.5, 0.5]);
  });

  it("switches the abreast cap exactly at the 180 column width", () => {
    expect(abreastCapOf(180)).toBe(3);
    expect(abreastCapOf(179)).toBe(2);
  });
});

describe("all-day lanes (FR-206, FR-207)", () => {
  it("renders a single-day all-day event as one bar in lane 0, out of the hour grid", () => {
    const holiday = occurrenceOf(allDayTimes("2026-09-08", "2026-09-08"));
    const result = layout([holiday]);
    expect(result.timed).toHaveLength(0);
    expect(result.allDay.bars).toHaveLength(1);
    expect(result.allDay.bars[0]).toMatchObject({
      startColumn: 2,
      endColumn: 2,
      lane: 0,
      clippedStart: false,
      clippedEnd: false,
    });
    expect(result.allDay.laneCount).toBe(1);
  });

  it("spans a multi-day all-day event as ONE bar across every day it covers", () => {
    const camping = occurrenceOf(allDayTimes("2026-09-08", "2026-09-10"));
    const { allDay } = layout([camping]);
    expect(allDay.bars).toHaveLength(1);
    expect(allDay.bars[0].startColumn).toBe(2);
    expect(allDay.bars[0].endColumn).toBe(4);
  });

  it("clips a bar entering from before the slice and flags the clipped edge", () => {
    const trip = occurrenceOf(allDayTimes("2026-09-04", "2026-09-07"));
    const { allDay } = layout([trip]);
    expect(allDay.bars[0]).toMatchObject({
      startColumn: 0,
      endColumn: 1,
      clippedStart: true,
      clippedEnd: false,
    });
  });

  it("clips a bar running past the slice's end and flags it", () => {
    const fair = occurrenceOf(allDayTimes("2026-09-10", "2026-09-15"));
    const { allDay } = layout([fair]);
    expect(allDay.bars[0]).toMatchObject({
      startColumn: 4,
      endColumn: 6,
      clippedStart: false,
      clippedEnd: true,
    });
  });

  it("stacks a second all-day event on the same day into the next lane", () => {
    const first = occurrenceOf(allDayTimes("2026-09-08", "2026-09-08"));
    const second = occurrenceOf(allDayTimes("2026-09-08", "2026-09-08"));
    const { allDay } = layout([first, second]);
    expect(allDay.bars.map((bar) => bar.lane)).toEqual([0, 1]);
    expect(allDay.laneCount).toBe(2);
  });

  it("reuses lane 0 once the earlier bar has ended", () => {
    const camping = occurrenceOf(allDayTimes("2026-09-07", "2026-09-09"), { summary: "Camping" });
    const birthday = occurrenceOf(allDayTimes("2026-09-08", "2026-09-08"), { summary: "Birthday" });
    const picnic = occurrenceOf(allDayTimes("2026-09-11", "2026-09-11"), { summary: "Picnic" });
    const { allDay } = layout([camping, birthday, picnic]);
    const lanes = new Map(allDay.bars.map((bar) => [bar.occurrence.summary, bar.lane]));
    expect(lanes.get("Camping")).toBe(0);
    expect(lanes.get("Birthday")).toBe(1);
    expect(lanes.get("Picnic")).toBe(0);
    expect(allDay.laneCount).toBe(2);
  });

  it("drops an all-day event that never touches the slice", () => {
    const past = occurrenceOf(allDayTimes("2026-08-20", "2026-08-22"));
    const { allDay } = layout([past]);
    expect(allDay.bars).toHaveLength(0);
    expect(allDay.laneCount).toBe(0);
  });
});

describe("minimum block height (FR-218)", () => {
  it("floors a 15-minute block at the touch floor without touching its times", () => {
    const espresso = occurrenceOf(timedTimes("2026-09-09", "09:00", "2026-09-09", "09:15"));
    const result = layout([espresso]);
    expect(result.minBlockHeight).toBe(TOUCH_FLOOR);
    expect(result.timed[0].height).toBe(44);
    expect(result.timed[0].top).toBe(540);
    expect(result.timed[0].startMinutes).toBe(540);
    expect(result.timed[0].endMinutes).toBe(555);
  });

  it("uses title line plus padding when that exceeds the touch floor", () => {
    const espresso = occurrenceOf(timedTimes("2026-09-09", "09:00", "2026-09-09", "09:15"));
    const result = layout([espresso], { titleLineHeight: 40, blockPaddingY: 16 });
    expect(result.minBlockHeight).toBe(56);
    expect(result.timed[0].height).toBe(56);
    expect(minBlockHeightOf({ ...METRICS, titleLineHeight: 40, blockPaddingY: 16 })).toBe(56);
    expect(minBlockHeightOf(METRICS)).toBe(TOUCH_FLOOR);
  });

  it("leaves an ordinary block's height to its duration", () => {
    const practice = occurrenceOf(timedTimes("2026-09-09", "15:00", "2026-09-09", "17:00"));
    const { timed } = layout([practice]);
    expect(timed[0].height).toBe(120);
  });

  it("keeps a floored block near midnight inside its column", () => {
    const nightcap = occurrenceOf(timedTimes("2026-09-09", "23:50", "2026-09-09", "23:59"));
    const { timed } = layout([nightcap]);
    expect(timed[0].startMinutes).toBe(1430);
    expect(timed[0].endMinutes).toBe(1439);
    expect(timed[0].height).toBe(44);
    expect(timed[0].top).toBe(1440 - 44);
  });
});

describe("guards", () => {
  it("rejects non-consecutive column dates", () => {
    expect(() => layout([], {}, ["2026-09-06", "2026-09-08"])).toThrow(/consecutive/);
  });

  it("rejects an empty column list", () => {
    expect(() => layout([], {}, [])).toThrow(/at least one/);
  });

  it("rejects a non-positive vertical scale", () => {
    expect(() => layout([], { pxPerMinute: 0 })).toThrow(/pxPerMinute/);
  });
});
