import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expandWindow } from "@/lib/family/calendar/expand";
import type { LayoutMetrics } from "@/lib/family/calendar/layout";
import { prefetchWeek, useWeekEvents } from "@/lib/family/queries";
import type { Event } from "@/lib/family/types";

import {
  resetDeviceVisibility,
  useDeviceVisibility,
} from "@/app/family/(app)/components/useDeviceVisibility";
import {
  useWeekOccurrences,
  type UseWeekOccurrencesOptions,
} from "@/app/family/(app)/calendar/components/useWeekOccurrences";

/**
 * T028 / R206: the memo chain is fetch → `expandWindow` (ONCE per mounted
 * window) → visibility (`visibleOccurrences`, T061) → `layoutWeek`, so a
 * metrics change or a filter toggle re-layouts without ever re-expanding. The
 * query is mocked; expansion, filtering and layout run for real, and the
 * hidden set is the real per-device store.
 *
 * The window is the anchored first day plus the measured column count, and it
 * is what is fetched, expanded AND drawn — so a three-column phone reads three
 * days, and the next page's window abuts this one rather than overlapping a
 * seven-day box.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return {
    ...actual,
    useWeekEvents: vi.fn(),
    prefetchWeek: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/lib/family/calendar/expand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/calendar/expand")>();
  return { ...actual, expandWindow: vi.fn(actual.expandWindow) };
});

const HOUSEHOLD_ID = "household-1";
const ZONE = "America/Chicago";
/** The window's first day — a Sunday, with the fixture event on the Monday. */
const ANCHOR_DATE = "2026-09-06";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    householdId: HOUSEHOLD_ID,
    summary: "Dentist",
    description: null,
    location: null,
    // Mon 2026-09-07 09:00–10:00 America/Chicago (CDT, UTC−5).
    times: { allDay: false, startsAt: "2026-09-07T14:00:00.000Z", endsAt: "2026-09-07T15:00:00.000Z" },
    timezone: ZONE,
    rrule: null,
    countdownEnabled: false,
    categoryIds: [],
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const METRICS: LayoutMetrics = {
  columnWidth: 200,
  pxPerMinute: 195 / 60,
  titleLineHeight: 26,
  blockPaddingY: 54,
};

function stubWeekQuery(stub: { data?: Event[]; isPending?: boolean; error?: Error | null }): void {
  vi.mocked(useWeekEvents).mockReturnValue({
    data: stub.data,
    isPending: stub.isPending ?? false,
    error: stub.error ?? null,
  } as unknown as ReturnType<typeof useWeekEvents>);
}

function makeOptions(overrides: Partial<UseWeekOccurrencesOptions> = {}): UseWeekOccurrencesOptions {
  return {
    householdId: HOUSEHOLD_ID,
    anchorDate: ANCHOR_DATE,
    zone: ZONE,
    columns: 3,
    metrics: METRICS,
    ...overrides,
  };
}

function renderWeek(initialOptions: UseWeekOccurrencesOptions) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return {
    queryClient,
    ...renderHook((options: UseWeekOccurrencesOptions) => useWeekOccurrences(options), {
      wrapper,
      initialProps: initialOptions,
    }),
  };
}

/** The hook reads the device's hidden set itself, so the filter case needs both. */
function renderFilteredWeek(initialOptions: UseWeekOccurrencesOptions) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    (options: UseWeekOccurrencesOptions) => ({
      week: useWeekOccurrences(options),
      visibility: useDeviceVisibility(),
    }),
    { wrapper, initialProps: initialOptions },
  );
}

describe("useWeekOccurrences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetDeviceVisibility();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches exactly the days it draws and expands them into the layout", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result } = renderWeek(makeOptions());

    // Three columns → a three-day window, not a seven-day box the view then
    // slices. The three-branch read gets real instant bounds: Chicago midnight
    // is 05:00Z in September.
    expect(vi.mocked(useWeekEvents)).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      {
        startDate: "2026-09-06",
        endDate: "2026-09-08",
        startsAt: "2026-09-06T05:00:00.000Z",
        endsAt: "2026-09-09T05:00:00.000Z",
      },
      undefined,
    );

    expect(result.current.window).toMatchObject({
      startDate: "2026-09-06",
      endDate: "2026-09-08",
    });
    expect(result.current.occurrences).toHaveLength(1);
    expect(result.current.occurrences[0].occurrenceDate).toBe("2026-09-07");
    expect(result.current.columnDates).toEqual(["2026-09-06", "2026-09-07", "2026-09-08"]);
    expect(result.current.layout).not.toBeNull();
    expect(result.current.layout?.timed).toHaveLength(1);
    expect(result.current.layout?.timed[0].columnIndex).toBe(1);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("widens the fetch with the column count, so a rotation never draws a short read", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result, rerender } = renderWeek(makeOptions());

    rerender(makeOptions({ columns: 7 }));

    expect(vi.mocked(useWeekEvents)).toHaveBeenLastCalledWith(
      HOUSEHOLD_ID,
      expect.objectContaining({ startDate: "2026-09-06", endDate: "2026-09-12" }),
      undefined,
    );
    expect(result.current.columnDates).toHaveLength(7);
    expect(result.current.columnDates[6]).toBe("2026-09-12");
  });

  it("re-layouts on a metrics change without re-expanding (R206)", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result, rerender } = renderWeek(makeOptions());
    const firstLayout = result.current.layout;
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    rerender(makeOptions({ metrics: { ...METRICS, columnWidth: 170 } }));

    expect(result.current.layout).not.toBe(firstLayout);
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);
  });

  it("draws the paged-to window's own days, expanded for that window (R206)", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result, rerender } = renderWeek(makeOptions());
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    // One page later at three columns: the anchor moves three days, and the
    // days drawn are the three that FOLLOW the ones just shown.
    rerender(makeOptions({ anchorDate: "2026-09-09" }));

    expect(result.current.columnDates).toEqual(["2026-09-09", "2026-09-10", "2026-09-11"]);
    expect(result.current.layout?.timed).toHaveLength(0); // Monday is behind us
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(2); // a new window is a new expansion
  });

  it("re-filters on a filter toggle without re-expanding (FR-265, R206)", () => {
    stubWeekQuery({
      data: [
        makeEvent({ id: "cleo-only", categoryIds: ["profile-cleo"] }),
        makeEvent({ id: "cleo-and-ana", categoryIds: ["profile-cleo", "profile-ana"] }),
      ],
    });
    const { result } = renderFilteredWeek(makeOptions());
    expect(result.current.week.occurrences).toHaveLength(2);
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.visibility.setHidden("profile-cleo", true);
    });

    // Ana keeps the shared event on the grid; the Cleo-only one goes (US4 scenario 7).
    expect(result.current.week.occurrences.map((o) => o.eventId)).toEqual(["cleo-and-ana"]);
    expect(result.current.week.layout?.timed).toHaveLength(1);
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.visibility.showAll();
    });

    expect(result.current.week.occurrences).toHaveLength(2);
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);
  });

  it("re-expands when the window itself changes", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { rerender } = renderWeek(makeOptions());
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    rerender(makeOptions({ anchorDate: "2026-09-13" }));

    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(2);
  });

  it("holds layout at null until the grid has measured, an empty grid otherwise", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result, rerender } = renderWeek(makeOptions({ metrics: null }));

    expect(result.current.layout).toBeNull();
    expect(result.current.occurrences).toHaveLength(1); // expansion never waits on geometry

    stubWeekQuery({ data: [] });
    rerender(makeOptions());
    expect(result.current.layout?.timed).toHaveLength(0);
  });

  it("passes the pending first fetch through with no occurrences", () => {
    stubWeekQuery({ data: undefined, isPending: true });
    const { result } = renderWeek(makeOptions());

    expect(result.current.isPending).toBe(true);
    expect(result.current.occurrences).toEqual([]);
    expect(result.current.layout?.timed).toHaveLength(0);
  });

  it("prefetches the page either side — one window's width away (R207)", () => {
    vi.useFakeTimers();
    stubWeekQuery({ data: [] });
    const { queryClient } = renderWeek(makeOptions());
    expect(vi.mocked(prefetchWeek)).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Three columns → the neighbours are three days out, and each is itself
    // three days wide: exactly what the next page will ask for.
    const windows = vi
      .mocked(prefetchWeek)
      .mock.calls.map(([, , window]) => [window.startDate, window.endDate])
      .sort();
    expect(windows).toEqual([
      ["2026-09-03", "2026-09-05"],
      ["2026-09-09", "2026-09-11"],
    ]);
    for (const [client, householdId] of vi.mocked(prefetchWeek).mock.calls) {
      expect(client).toBe(queryClient);
      expect(householdId).toBe(HOUSEHOLD_ID);
    }
  });

  it("prefetches a seven-column view's neighbours a week out (R207)", () => {
    vi.useFakeTimers();
    stubWeekQuery({ data: [] });
    renderWeek(makeOptions({ columns: 7 }));

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const starts = vi
      .mocked(prefetchWeek)
      .mock.calls.map(([, , window]) => window.startDate)
      .sort();
    expect(starts).toEqual(["2026-08-30", "2026-09-13"]);
  });

  it("never prefetches for a window abandoned before it settles (R207)", () => {
    vi.useFakeTimers();
    stubWeekQuery({ data: [] });
    const { rerender } = renderWeek(makeOptions());

    act(() => {
      vi.advanceTimersByTime(100); // paged away before the settle delay
    });
    rerender(makeOptions({ anchorDate: "2026-09-09" }));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const starts = vi
      .mocked(prefetchWeek)
      .mock.calls.map(([, , window]) => window.startDate)
      .sort();
    expect(starts).toEqual(["2026-09-06", "2026-09-12"]);
  });
});
