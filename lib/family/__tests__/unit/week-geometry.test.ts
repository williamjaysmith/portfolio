import { describe, expect, it } from "vitest";
import {
  AUTO_SCROLL_EDGE_PX,
  AUTO_SCROLL_MAX_PX_PER_SECOND,
  DEFAULT_TIMED_MINUTES,
  MINUTES_PER_DAY,
  NO_GRAB,
  SNAP_MINUTES,
  autoScrollVelocity,
  blockOffsets,
  dayCanvasPx,
  minutesToOffsetPx,
  minutesToViewportY,
  offsetPxToMinutes,
  planMove,
  planResize,
  slotFromPoint,
  snapToStep,
  viewportYToMinutes,
  type AllDayPlacement,
  type DragMetrics,
  type GridMetrics,
  type TimedPlacement,
} from "@/lib/family/week-geometry";

/**
 * T023 — the RENDERING half of week-geometry (FR-204: a timed block is placed
 * and sized from its start and end times alone, measured against the hour
 * ruler) — and, from the second block down, T053's DRAG PLANNERS over the
 * same metrics snapshot: the FR-246 snap table, `slotFromPoint` hit-testing,
 * `planMove`/`planResize` invariants including FR-251's band conversions, and
 * `autoScrollVelocity`.
 */

/** The reference grid at 1920×1080 — 195 px/hour, chrome 311 px tall. */
function metrics(overrides: Partial<GridMetrics> = {}): GridMetrics {
  return {
    hourRowPx: 195,
    columnWidthPx: 337,
    columnCount: 5,
    gridLeftPx: 219,
    gridTopPx: 311,
    scrollTopPx: 0,
    ...overrides,
  };
}

describe("GridMetrics content conversions (FR-204)", () => {
  it("maps minutes to a content offset linearly against the hour ruler", () => {
    const m = metrics();
    expect(minutesToOffsetPx(m, 0)).toBe(0);
    expect(minutesToOffsetPx(m, 60)).toBe(195);
    expect(minutesToOffsetPx(m, 90)).toBe(292.5);
    expect(minutesToOffsetPx(m, 9 * 60)).toBe(1755);
    expect(minutesToOffsetPx(m, MINUTES_PER_DAY)).toBe(dayCanvasPx(m));
  });

  it("scales with the measured row height, never a constant", () => {
    const tablet = metrics({ hourRowPx: 119.84 });
    expect(minutesToOffsetPx(tablet, 60)).toBeCloseTo(119.84, 10);
    expect(minutesToOffsetPx(tablet, 30)).toBeCloseTo(59.92, 10);
    const phone = metrics({ hourRowPx: 97.5 });
    expect(minutesToOffsetPx(phone, 120)).toBe(195);
    expect(dayCanvasPx(phone)).toBe(2340);
  });

  it("maps a content offset back to (fractional) minutes", () => {
    const m = metrics();
    expect(offsetPxToMinutes(m, 0)).toBe(0);
    expect(offsetPxToMinutes(m, 195)).toBe(60);
    expect(offsetPxToMinutes(m, 292.5)).toBe(90);
    // Fractional pixels give fractional minutes — snapping is US3's planner.
    expect(offsetPxToMinutes(m, 100)).toBeCloseTo(30.769230769, 6);
  });

  it("round-trips both directions at varying row heights", () => {
    for (const hourRowPx of [195, 119.84, 97.5, 260]) {
      const m = metrics({ hourRowPx });
      for (const minute of [0, 1, 8.25, 61, 719.5, 1439, MINUTES_PER_DAY]) {
        expect(offsetPxToMinutes(m, minutesToOffsetPx(m, minute))).toBeCloseTo(minute, 8);
      }
      for (const px of [0, 0.5, 97, 1755.25, dayCanvasPx(m)]) {
        expect(minutesToOffsetPx(m, offsetPxToMinutes(m, px))).toBeCloseTo(px, 8);
      }
    }
  });

  it("stays unclamped — callers upstream decide what is out of range", () => {
    const m = metrics();
    expect(minutesToOffsetPx(m, -30)).toBe(-97.5);
    expect(offsetPxToMinutes(m, -195)).toBe(-60);
    expect(minutesToOffsetPx(m, MINUTES_PER_DAY + 60)).toBe(dayCanvasPx(m) + 195);
  });
});

describe("viewport conversions through the scroll offset", () => {
  it("places a minute on screen through gridTop and scrollTop", () => {
    const rest = metrics();
    expect(minutesToViewportY(rest, 0)).toBe(311);
    expect(minutesToViewportY(rest, 60)).toBe(311 + 195);

    // Scrolled two hours down: 02:00 sits exactly at the viewport top.
    const scrolled = metrics({ scrollTopPx: 390 });
    expect(minutesToViewportY(scrolled, 120)).toBe(311);
    expect(minutesToViewportY(scrolled, 0)).toBe(311 - 390);
    expect(minutesToViewportY(scrolled, 180)).toBe(311 + 195);
  });

  it("reads minutes back from a viewport y at the same scroll offset", () => {
    const scrolled = metrics({ scrollTopPx: 390 });
    expect(viewportYToMinutes(scrolled, 311)).toBe(120);
    expect(viewportYToMinutes(scrolled, 311 + 97.5)).toBe(150);
    // A point above the grid while scrolled still lands ON the ruler.
    expect(viewportYToMinutes(scrolled, 311 - 195)).toBe(60);
  });

  it("round-trips both directions at varying scroll offsets and row heights", () => {
    for (const hourRowPx of [195, 119.84]) {
      for (const scrollTopPx of [0, 97.5, 390, 2000]) {
        const m = metrics({ hourRowPx, scrollTopPx, gridTopPx: 191.14 });
        for (const minute of [0, 42.5, 480, 1439]) {
          expect(viewportYToMinutes(m, minutesToViewportY(m, minute))).toBeCloseTo(minute, 8);
        }
        for (const y of [0, 191.14, 500.75, 820]) {
          expect(minutesToViewportY(m, viewportYToMinutes(m, y))).toBeCloseTo(y, 8);
        }
      }
    }
  });
});

describe("blockOffsets — placement from times alone (FR-204)", () => {
  it("derives top and height from start/end minutes and nothing else", () => {
    const m = metrics();
    expect(blockOffsets(m, 9 * 60, 10 * 60 + 30)).toEqual({ topPx: 1755, heightPx: 292.5 });
    expect(blockOffsets(m, 0, 15)).toEqual({ topPx: 0, heightPx: 48.75 });
  });

  it("keeps raw geometry raw — the FR-218 minimum height is layout's job", () => {
    const m = metrics();
    expect(blockOffsets(m, 600, 600)).toEqual({ topPx: 1950, heightPx: 0 });
    expect(blockOffsets(m, 600, 605).heightPx).toBeCloseTo(16.25, 10);
  });

  it("scales with the measured row height", () => {
    const m = metrics({ hourRowPx: 119.84 });
    expect(blockOffsets(m, 60, 120)).toEqual({ topPx: 119.84, heightPx: 119.84 });
  });
});

describe("metrics validation", () => {
  it("refuses a zero, negative or non-finite row height", () => {
    for (const hourRowPx of [0, -195, Number.NaN, Number.POSITIVE_INFINITY]) {
      const m = metrics({ hourRowPx });
      expect(() => minutesToOffsetPx(m, 60)).toThrow(/hourRowPx/);
      expect(() => offsetPxToMinutes(m, 195)).toThrow(/hourRowPx/);
      expect(() => minutesToViewportY(m, 60)).toThrow(/hourRowPx/);
      expect(() => viewportYToMinutes(m, 311)).toThrow(/hourRowPx/);
      expect(() => blockOffsets(m, 60, 120)).toThrow(/hourRowPx/);
      expect(() => dayCanvasPx(m)).toThrow(/hourRowPx/);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * T053 — the drag planners (US3). Everything below is pure arithmetic over
 * the same measured snapshot: no DOM, no pointer, no clock.
 * ------------------------------------------------------------------------- */

/**
 * The reference grid plus what a drag needs. The chrome it describes, top to
 * bottom: top bar 0–140, day headers 140–200, all-day band 200–288, the
 * hairline under it 288–311, hour viewport 311–1011. The day canvas is
 * 4680 px tall, so the scroll bottoms out at 3980.
 */
function dragMetrics(overrides: Partial<DragMetrics> = {}): DragMetrics {
  return {
    ...metrics(),
    bandTopPx: 200,
    bandHeightPx: 88,
    viewportHeightPx: 700,
    ...overrides,
  };
}

/** Viewport x inside day column `index` — mid-column unless told otherwise. */
function columnX(index: number, offsetPx = 168): number {
  return 219 + index * 337 + offsetPx;
}

/** Metrics scrolled so 09:00 sits exactly at the hour viewport's top. */
const NINE_AT_TOP = dragMetrics({ scrollTopPx: 1755 });

/** Viewport y of a wall minute in `NINE_AT_TOP`. */
function yAt(minutes: number): number {
  return minutesToViewportY(NINE_AT_TOP, minutes);
}

const TIMED: TimedPlacement = {
  allDay: false,
  columnIndex: 2,
  startMinutes: 9 * 60,
  endMinutes: 10 * 60 + 30,
};

const SPANNING: AllDayPlacement = { allDay: true, startColumnIndex: 1, endColumnIndex: 3 };

describe("snapToStep — the FR-246 table", () => {
  it("snaps to the nearest 15-minute step", () => {
    expect(SNAP_MINUTES).toBe(15);
    // The requirement's own examples: 09:07 → 09:00, 09:23 → 09:30.
    expect(snapToStep(9 * 60 + 7)).toBe(9 * 60);
    expect(snapToStep(9 * 60 + 23)).toBe(9 * 60 + 30);
  });

  it("covers the whole step, boundary to boundary", () => {
    expect(snapToStep(0)).toBe(0);
    expect(snapToStep(7)).toBe(0);
    expect(snapToStep(7.49)).toBe(0);
    expect(snapToStep(8)).toBe(15);
    expect(snapToStep(15)).toBe(15);
    expect(snapToStep(22)).toBe(15);
    expect(snapToStep(23)).toBe(30);
    expect(snapToStep(540)).toBe(540);
    // Late in the last quarter hour snaps onto midnight, not back off it.
    expect(snapToStep(1439)).toBe(MINUTES_PER_DAY);
  });

  it("rounds a tie up, and never yields negative zero", () => {
    expect(snapToStep(7.5)).toBe(15);
    expect(snapToStep(547.5)).toBe(555);
    expect(snapToStep(-7)).toBe(0);
    expect(snapToStep(-7.5)).toBe(0);
    expect(Object.is(snapToStep(-7), 0)).toBe(true);
    expect(snapToStep(-8)).toBe(-15);
  });

  it("keeps minutes past midnight and before it — clamping is the caller's", () => {
    expect(snapToStep(MINUTES_PER_DAY + 8)).toBe(MINUTES_PER_DAY + 15);
    expect(snapToStep(-53)).toBe(-60);
  });

  it("takes another step size for callers that need one", () => {
    expect(snapToStep(547, 30)).toBe(540);
    expect(snapToStep(555, 30)).toBe(570);
    expect(snapToStep(547, 5)).toBe(545);
  });

  it("refuses a step that is not a positive finite number of minutes", () => {
    for (const step of [0, -15, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => snapToStep(540, step)).toThrow(/step/);
    }
  });
});

describe("slotFromPoint — what is under the pointer", () => {
  it("reads the 15-minute slot in the day column it lands in", () => {
    expect(slotFromPoint(NINE_AT_TOP, { x: columnX(0), y: yAt(540) })).toEqual({
      kind: "grid",
      columnIndex: 0,
      minutes: 540,
    });
    // The FR-246 table again, this time through the hit-test.
    expect(slotFromPoint(NINE_AT_TOP, { x: columnX(2), y: yAt(547) })).toEqual({
      kind: "grid",
      columnIndex: 2,
      minutes: 540,
    });
    expect(slotFromPoint(NINE_AT_TOP, { x: columnX(2), y: yAt(563) })).toEqual({
      kind: "grid",
      columnIndex: 2,
      minutes: 570,
    });
  });

  it("resolves the column from x, edge to edge", () => {
    const y = yAt(600);
    const columnOf = (x: number) => slotFromPoint(NINE_AT_TOP, { x, y });
    expect(columnOf(219)).toMatchObject({ columnIndex: 0 });
    expect(columnOf(219 + 336.9)).toMatchObject({ columnIndex: 0 });
    expect(columnOf(219 + 337)).toMatchObject({ columnIndex: 1 });
    expect(columnOf(columnX(4))).toMatchObject({ columnIndex: 4 });
    // Past the last of five columns — nothing to drop onto.
    expect(columnOf(219 + 5 * 337)).toBeNull();
  });

  it("answers the all-day band as its own target, with no clock time", () => {
    expect(slotFromPoint(NINE_AT_TOP, { x: columnX(3), y: 200 })).toEqual({
      kind: "band",
      columnIndex: 3,
    });
    expect(slotFromPoint(NINE_AT_TOP, { x: columnX(0), y: 287.9 })).toEqual({
      kind: "band",
      columnIndex: 0,
    });
  });

  it("refuses every target that is not a slot (FR-249)", () => {
    const x = columnX(1);
    // The shell's top bar and the day-header band above the all-day band.
    expect(slotFromPoint(NINE_AT_TOP, { x, y: 40 })).toBeNull();
    expect(slotFromPoint(NINE_AT_TOP, { x, y: 199.9 })).toBeNull();
    // The hairline between the band and the hour viewport.
    expect(slotFromPoint(NINE_AT_TOP, { x, y: 288 })).toBeNull();
    expect(slotFromPoint(NINE_AT_TOP, { x, y: 310 })).toBeNull();
    // Below the hour viewport.
    expect(slotFromPoint(NINE_AT_TOP, { x, y: 1011 })).toBeNull();
    expect(slotFromPoint(NINE_AT_TOP, { x, y: 2000 })).toBeNull();
    // The hour rail, at the band's height and at the grid's.
    expect(slotFromPoint(NINE_AT_TOP, { x: 218.9, y: yAt(600) })).toBeNull();
    expect(slotFromPoint(NINE_AT_TOP, { x: 40, y: 250 })).toBeNull();
    expect(slotFromPoint(NINE_AT_TOP, { x: -10, y: yAt(600) })).toBeNull();
  });

  it("keeps a slot inside the day the column stands for", () => {
    // Rubber-band overscroll puts the top of the canvas below the viewport top.
    const bounced = dragMetrics({ scrollTopPx: -40 });
    expect(slotFromPoint(bounced, { x: columnX(0), y: 311 })).toEqual({
      kind: "grid",
      columnIndex: 0,
      minutes: 0,
    });
    // Scrolled past the bottom, the last pixel row still reads as midnight.
    const overscrolled = dragMetrics({ scrollTopPx: 4000 });
    expect(slotFromPoint(overscrolled, { x: columnX(0), y: 1010 })).toEqual({
      kind: "grid",
      columnIndex: 0,
      minutes: MINUTES_PER_DAY,
    });
  });

  it("refuses metrics it cannot measure against", () => {
    const point = { x: columnX(1), y: yAt(600) };
    expect(() => slotFromPoint(dragMetrics({ hourRowPx: 0 }), point)).toThrow(/hourRowPx/);
    expect(() => slotFromPoint(dragMetrics({ columnWidthPx: 0 }), point)).toThrow(/columnWidthPx/);
    expect(() => slotFromPoint(dragMetrics({ columnWidthPx: Number.NaN }), point)).toThrow(
      /columnWidthPx/,
    );
  });
});

describe("planMove — duration survives the move (FR-244/247)", () => {
  it("moves within the day, keeping the duration exactly", () => {
    expect(planMove(TIMED, { kind: "grid", columnIndex: 2, minutes: 840 }, NO_GRAB)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 840,
      endMinutes: 930,
    });
  });

  it("moves to another day, keeping the time and the duration", () => {
    expect(planMove(TIMED, { kind: "grid", columnIndex: 4, minutes: 540 }, NO_GRAB)).toEqual({
      allDay: false,
      columnIndex: 4,
      startMinutes: 540,
      endMinutes: 630,
    });
  });

  it("holds the block under the point it was grabbed by, snapped", () => {
    const grabbed = planMove(
      TIMED,
      { kind: "grid", columnIndex: 2, minutes: 840 },
      { offsetMinutes: 30, offsetDays: 0 },
    );
    expect(grabbed).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 810,
      endMinutes: 900,
    });
    // A grab offset off the step grid still lands the block on it (FR-246).
    const target = { kind: "grid", columnIndex: 2, minutes: 840 } as const;
    expect(planMove(TIMED, target, { offsetMinutes: 22, offsetDays: 0 })).toMatchObject({
      startMinutes: 825,
      endMinutes: 915,
    });
  });

  it("snaps a target that arrived off the grid (the keyboard's)", () => {
    expect(
      planMove(TIMED, { kind: "grid", columnIndex: 2, minutes: 547 }, NO_GRAB),
    ).toMatchObject({ startMinutes: 540, endMinutes: 630 });
  });

  it("keeps a midnight-crossing event one event (FR-217)", () => {
    const crosser: TimedPlacement = {
      allDay: false,
      columnIndex: 3,
      startMinutes: 1380,
      endMinutes: 1500,
    };
    expect(planMove(crosser, { kind: "grid", columnIndex: 0, minutes: 1350 }, NO_GRAB)).toEqual({
      allDay: false,
      columnIndex: 0,
      startMinutes: 1350,
      endMinutes: 1470,
    });
  });

  it("converts a timed block dropped in the band into one all-day day (FR-251)", () => {
    expect(planMove(TIMED, { kind: "band", columnIndex: 4 }, NO_GRAB)).toEqual({
      allDay: true,
      startColumnIndex: 4,
      endColumnIndex: 4,
    });
  });

  it("converts an all-day bar dropped in the grid into a one-hour block (FR-251)", () => {
    expect(DEFAULT_TIMED_MINUTES).toBe(60);
    expect(planMove(SPANNING, { kind: "grid", columnIndex: 6, minutes: 780 }, NO_GRAB)).toEqual({
      allDay: false,
      columnIndex: 6,
      startMinutes: 780,
      endMinutes: 840,
    });
  });

  it("ignores the grab offsets on a conversion — the source has no clock times", () => {
    const grabbed = { offsetMinutes: 45, offsetDays: 2 };
    expect(planMove(SPANNING, { kind: "grid", columnIndex: 6, minutes: 780 }, grabbed)).toEqual(
      planMove(SPANNING, { kind: "grid", columnIndex: 6, minutes: 780 }, NO_GRAB),
    );
  });

  it("moves an all-day bar by whole days, keeping its span", () => {
    expect(planMove(SPANNING, { kind: "band", columnIndex: 4 }, NO_GRAB)).toEqual({
      allDay: true,
      startColumnIndex: 4,
      endColumnIndex: 6,
    });
    // Grabbed by its third day, it stays grabbed by its third day.
    expect(
      planMove(SPANNING, { kind: "band", columnIndex: 4 }, { offsetMinutes: 0, offsetDays: 2 }),
    ).toEqual({ allDay: true, startColumnIndex: 2, endColumnIndex: 4 });
  });
});

describe("planResize — only the dragged edge moves (FR-245/247)", () => {
  it("drags the end edge later, leaving the start alone", () => {
    expect(planResize(TIMED, "end", { kind: "grid", columnIndex: 2, minutes: 705 })).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 540,
      endMinutes: 705,
    });
  });

  it("drags the start edge earlier, leaving the end alone", () => {
    expect(planResize(TIMED, "start", { kind: "grid", columnIndex: 2, minutes: 465 })).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 465,
      endMinutes: 630,
    });
  });

  it("snaps the edge it moves", () => {
    expect(planResize(TIMED, "end", { kind: "grid", columnIndex: 2, minutes: 707 })).toMatchObject({
      endMinutes: 705,
    });
    expect(
      planResize(TIMED, "start", { kind: "grid", columnIndex: 2, minutes: 458 }),
    ).toMatchObject({ startMinutes: 465 });
  });

  it("stops one step short of collapse rather than inverting", () => {
    expect(planResize(TIMED, "end", { kind: "grid", columnIndex: 2, minutes: 540 })).toMatchObject({
      startMinutes: 540,
      endMinutes: 555,
    });
    expect(planResize(TIMED, "end", { kind: "grid", columnIndex: 2, minutes: 60 })).toMatchObject({
      startMinutes: 540,
      endMinutes: 555,
    });
    expect(
      planResize(TIMED, "start", { kind: "grid", columnIndex: 2, minutes: 630 }),
    ).toMatchObject({ startMinutes: 615, endMinutes: 630 });
    expect(
      planResize(TIMED, "start", { kind: "grid", columnIndex: 2, minutes: 1380 }),
    ).toMatchObject({ startMinutes: 615, endMinutes: 630 });
  });

  it("never inverts, wherever in the day the edge is dropped", () => {
    for (let minutes = 0; minutes <= MINUTES_PER_DAY; minutes += 15) {
      for (const edge of ["start", "end"] as const) {
        const plan = planResize(TIMED, edge, { kind: "grid", columnIndex: 2, minutes });
        expect(plan).not.toBeNull();
        if (plan === null) continue;
        expect(plan.endMinutes - plan.startMinutes).toBeGreaterThanOrEqual(SNAP_MINUTES);
        expect(plan.columnIndex).toBe(2);
        if (edge === "end") expect(plan.startMinutes).toBe(540);
        else expect(plan.endMinutes).toBe(630);
      }
    }
  });

  it("reads an edge dragged into the next column as time past midnight", () => {
    expect(planResize(TIMED, "end", { kind: "grid", columnIndex: 3, minutes: 60 })).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 540,
      endMinutes: 1500,
    });
    expect(planResize(TIMED, "start", { kind: "grid", columnIndex: 1, minutes: 1380 })).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: -60,
      endMinutes: 630,
    });
  });

  it("has no meaning in the all-day band — that conversion is a move (FR-251)", () => {
    expect(planResize(TIMED, "end", { kind: "band", columnIndex: 2 })).toBeNull();
    expect(planResize(TIMED, "start", { kind: "band", columnIndex: 2 })).toBeNull();
  });
});

describe("autoScrollVelocity — the drag's vertical pull", () => {
  it("stands still away from either edge", () => {
    const m = dragMetrics({ scrollTopPx: 1755 });
    expect(autoScrollVelocity(m, 311 + 350)).toBe(0);
    expect(autoScrollVelocity(m, 311 + AUTO_SCROLL_EDGE_PX)).toBe(0);
    expect(autoScrollVelocity(m, 1011 - AUTO_SCROLL_EDGE_PX)).toBe(0);
  });

  it("ramps up towards the top edge and beyond it", () => {
    const m = dragMetrics({ scrollTopPx: 1755 });
    expect(autoScrollVelocity(m, 311)).toBe(-AUTO_SCROLL_MAX_PX_PER_SECOND);
    expect(autoScrollVelocity(m, 200)).toBe(-AUTO_SCROLL_MAX_PX_PER_SECOND);
    expect(autoScrollVelocity(m, 311 + AUTO_SCROLL_EDGE_PX / 2)).toBeCloseTo(
      -AUTO_SCROLL_MAX_PX_PER_SECOND / 2,
      10,
    );
  });

  it("ramps up towards the bottom edge and beyond it", () => {
    const m = dragMetrics({ scrollTopPx: 1755 });
    expect(autoScrollVelocity(m, 1011)).toBe(AUTO_SCROLL_MAX_PX_PER_SECOND);
    expect(autoScrollVelocity(m, 1400)).toBe(AUTO_SCROLL_MAX_PX_PER_SECOND);
    expect(autoScrollVelocity(m, 1011 - AUTO_SCROLL_EDGE_PX / 2)).toBeCloseTo(
      AUTO_SCROLL_MAX_PX_PER_SECOND / 2,
      10,
    );
  });

  it("pulls nowhere the canvas cannot follow", () => {
    const atTop = dragMetrics({ scrollTopPx: 0 });
    expect(autoScrollVelocity(atTop, 311)).toBe(0);
    expect(autoScrollVelocity(atTop, 1011)).toBe(AUTO_SCROLL_MAX_PX_PER_SECOND);

    // 4680 px of canvas in a 700 px viewport bottoms out at 3980.
    const atBottom = dragMetrics({ scrollTopPx: 3980 });
    expect(autoScrollVelocity(atBottom, 1011)).toBe(0);
    expect(autoScrollVelocity(atBottom, 311)).toBe(-AUTO_SCROLL_MAX_PX_PER_SECOND);

    // A viewport that holds the whole day never auto-scrolls at all.
    const whole = dragMetrics({ viewportHeightPx: 5000, scrollTopPx: 0 });
    expect(autoScrollVelocity(whole, 311)).toBe(0);
    expect(autoScrollVelocity(whole, 5311)).toBe(0);
  });

  it("refuses metrics it cannot measure against", () => {
    expect(() => autoScrollVelocity(dragMetrics({ hourRowPx: 0 }), 1011)).toThrow(/hourRowPx/);
  });
});
