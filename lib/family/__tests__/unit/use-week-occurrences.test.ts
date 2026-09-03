import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expandWindow } from "@/lib/family/calendar/expand";
import type { LayoutMetrics } from "@/lib/family/calendar/layout";
import { prefetchWeek, useWeekEvents } from "@/lib/family/queries";
import type { Event } from "@/lib/family/types";

import {
  useWeekOccurrences,
  type UseWeekOccurrencesOptions,
} from "@/app/family/(app)/calendar/components/useWeekOccurrences";

/**
 * T028 / R206: the memo chain is fetch → `expandWindow` (ONCE per mounted
 * week) → visibility (a pass-through seam until T061) → `layoutWeek`, so a
 * metrics change, a slice swipe or — later — a filter toggle re-layouts
 * without ever re-expanding. The query is mocked; expansion and layout run
 * for real.
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
/** Sunday — the household default week start containing Mon 2026-09-07. */
const WEEK_START = "2026-09-06";

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
    weekStart: WEEK_START,
    zone: ZONE,
    sliceStart: 0,
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

describe("useWeekOccurrences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives the anchored week's fetch window and expands it into the slice layout", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result } = renderWeek(makeOptions());

    // The three-branch read gets real instant bounds: Chicago midnight is 05:00Z in September.
    expect(vi.mocked(useWeekEvents)).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      {
        startDate: "2026-09-06",
        endDate: "2026-09-12",
        startsAt: "2026-09-06T05:00:00.000Z",
        endsAt: "2026-09-13T05:00:00.000Z",
      },
      undefined,
    );

    expect(result.current.occurrences).toHaveLength(1);
    expect(result.current.occurrences[0].occurrenceDate).toBe("2026-09-07");
    expect(result.current.columnDates).toEqual(["2026-09-06", "2026-09-07", "2026-09-08"]);
    expect(result.current.layout).not.toBeNull();
    expect(result.current.layout?.timed).toHaveLength(1);
    expect(result.current.layout?.timed[0].columnIndex).toBe(1);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
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

  it("re-layouts on a slice change without re-expanding (R206)", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { result, rerender } = renderWeek(makeOptions());
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    rerender(makeOptions({ sliceStart: 4 }));

    expect(result.current.columnDates).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
    expect(result.current.layout?.timed).toHaveLength(0); // Monday left the slice
    expect(result.current.occurrences).toHaveLength(1); // …but not the week
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);
  });

  it("re-expands when the anchored week itself changes", () => {
    stubWeekQuery({ data: [makeEvent()] });
    const { rerender } = renderWeek(makeOptions());
    expect(vi.mocked(expandWindow)).toHaveBeenCalledTimes(1);

    rerender(makeOptions({ weekStart: "2026-09-13" }));

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

  it("prefetches both neighbour weeks once the anchor settles (R207)", () => {
    vi.useFakeTimers();
    stubWeekQuery({ data: [] });
    const { queryClient } = renderWeek(makeOptions());
    expect(vi.mocked(prefetchWeek)).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const starts = vi
      .mocked(prefetchWeek)
      .mock.calls.map(([, , window]) => window.startDate)
      .sort();
    expect(starts).toEqual(["2026-08-30", "2026-09-13"]);
    for (const [client, householdId] of vi.mocked(prefetchWeek).mock.calls) {
      expect(client).toBe(queryClient);
      expect(householdId).toBe(HOUSEHOLD_ID);
    }
  });

  it("never prefetches for a week abandoned before it settles (R207)", () => {
    vi.useFakeTimers();
    stubWeekQuery({ data: [] });
    const { rerender } = renderWeek(makeOptions());

    act(() => {
      vi.advanceTimersByTime(100); // paged away before the settle delay
    });
    rerender(makeOptions({ weekStart: "2026-09-13" }));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const starts = vi
      .mocked(prefetchWeek)
      .mock.calls.map(([, , window]) => window.startDate)
      .sort();
    expect(starts).toEqual(["2026-09-06", "2026-09-20"]);
  });
});
