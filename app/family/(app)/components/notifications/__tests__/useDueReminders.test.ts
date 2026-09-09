/**
 * 008 T029 — what the open page should be showing this minute (FR-816, FR-817,
 * FR-829, R802).
 *
 * The pure due-computation is proved exhaustively next door
 * (`lib/family/__tests__/notifications/due.test.ts`); this file is about the
 * three things only the WIRING can get wrong, and each of them is a way the
 * household would be let down:
 *
 *   - the banner reads its OWN horizon rather than the visible tab's data
 *     (R802/FR-829). The last test here is the whole reason this hook exists:
 *     an event seven days out, with a seven-day lead, reminds while Lists or
 *     Meals is on screen and no calendar window has fetched it. A reader that
 *     borrowed the mounted screen's cache would be silent;
 *   - the clock, not the network, decides. `useNow` is null until the browser
 *     has one, and nothing at all may be computed or drawn before then;
 *   - a dismissed reminder does not come back on the next tick (FR-816), and
 *     the returned `key` — not the count — is what tells a new set from a
 *     re-render of the same one, because the chime hangs off exactly that.
 *
 * The clock is a mock rather than fake timers: `useNow` is a module-level
 * store the shell shares, and moving the minute by hand is both simpler and
 * closer to what this hook actually depends on. The horizon read is mocked too,
 * so no test here touches Supabase — but `reminderHorizonOf` stays real, since
 * the bounds it computes are what decide whether an event is in the read at all.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_STALENESS_MS, type DueReminder } from "@/lib/family/notifications/due";
import type { Event, HouseholdSettings } from "@/lib/family/types";

import { makeContext, makeSettings, withFamily } from "../../__tests__/family-test-utils";
import { resetShownReminders, useDueReminders } from "../useDueReminders";

/** The minute the shell's clock is currently showing; null before hydration. */
let clock: Date | null = null;

const horizonRead =
  vi.fn<(householdId: string, zone: string, nowMs: number | null) => { data: Event[] | undefined }>();

vi.mock("../../Clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../Clock")>();
  return { ...actual, useNow: () => clock };
});

/** What the two task reads were asked for, and whether they were enabled. */
const taskRead = vi.fn<(enabled: boolean) => void>();
const resolutionsRead = vi.fn<(weekStartDate: string, enabled: boolean) => void>();

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return {
    ...actual,
    useReminderHorizon: (householdId: string, zone: string, nowMs: number | null) =>
      horizonRead(householdId, zone, nowMs),
    useTasks: (householdId: string, initialData: unknown, enabled = true) => {
      taskRead(enabled);
      return actual.useTasks(householdId, undefined, false);
    },
    useTaskResolutions: (
      householdId: string,
      weekStartDate: string,
      initialData: unknown,
      enabled = true,
    ) => {
      resolutionsRead(weekStartDate, enabled);
      return actual.useTaskResolutions(householdId, weekStartDate, undefined, false);
    },
  };
});

const ZONE = "America/Chicago";

function timedEvent(id: string, summary: string, startsAt: string, endsAt: string): Event {
  return {
    id,
    householdId: "household-1",
    summary,
    description: null,
    location: null,
    times: { allDay: false, startsAt, endsAt },
    timezone: ZONE,
    rrule: null,
    countdownEnabled: false,
    categoryIds: [],
    reminder: { mode: "inherit" },
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

// Chicago is on CDT (UTC−5) throughout: 16:30 UTC is 11:30 on the wall.
// The household's default lead time is ten minutes (FR-807).
const SWIM = timedEvent("event-swim", "Swim lesson", "2026-09-09T16:30:00.000Z", "2026-09-09T17:30:00.000Z");
const SWIM_FIRES_AT = Date.parse("2026-09-09T16:20:00.000Z");

const PIANO = timedEvent("event-piano", "Piano practice", "2026-09-09T16:50:00.000Z", "2026-09-09T17:20:00.000Z");
const PIANO_FIRES_AT = Date.parse("2026-09-09T16:40:00.000Z");

// 00:05 on the 10th, reminded for at 23:55 on the 9th — the day rolls between
// the reminder and the thing it is about.
const AIRPORT = timedEvent("event-airport", "Airport run", "2026-09-10T05:05:00.000Z", "2026-09-10T06:05:00.000Z");
const AIRPORT_FIRES_AT = Date.parse("2026-09-10T04:55:00.000Z");

// Seven days out, with a seven-day lead: nothing on screen has fetched it.
const LUNCH = timedEvent("event-lunch", "Grandma's birthday lunch", "2026-09-16T16:30:00.000Z", "2026-09-16T18:00:00.000Z");
const LUNCH_FIRES_AT = Date.parse("2026-09-09T16:30:00.000Z");
const SEVEN_DAYS_IN_MINUTES = 7 * 24 * 60;

const A_MINUTE = 60_000;

interface Rendered {
  reminders: () => DueReminder[];
  key: () => string;
  dismiss: () => void;
  tickTo: (atMs: number) => void;
}

function renderReminders(
  events: Event[] | undefined,
  atMs: number | null,
  settings: HouseholdSettings = makeSettings(),
): Rendered {
  horizonRead.mockReturnValue({ data: events });
  clock = atMs === null ? null : new Date(atMs);

  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      withFamily(makeContext({ settings }), children),
    );

  const { result, rerender } = renderHook(() => useDueReminders(), { wrapper });
  return {
    reminders: () => result.current.reminders,
    key: () => result.current.key,
    dismiss: () => act(() => result.current.dismiss()),
    tickTo: (nextMs: number) => {
      clock = new Date(nextMs);
      rerender();
    },
  };
}

/** What a household would actually read off the banner. */
function words(reminders: DueReminder[]): { title: string; body: string; path: string }[] {
  return reminders.map(({ title, body, path }) => ({ title, body, path }));
}

beforeEach(() => {
  // The shown-key set is module-level, so one test's dismissal would otherwise
  // silence the next test's reminder.
  resetShownReminders();
  localStorage.clear();
  horizonRead.mockReset();
  taskRead.mockReset();
  resolutionsRead.mockReset();
  clock = null;
});

describe("before the browser has a clock", () => {
  it("shows nothing at all, however much the household has due", () => {
    const view = renderReminders([SWIM], null);

    expect(view.reminders()).toEqual([]);
    expect(view.key()).toBe("");
  });

  it("asks for no horizon until there is a clock to judge it against", () => {
    renderReminders([SWIM], null);

    // A null instant is what leaves the query disabled, rather than fetching a
    // horizon around the epoch and refetching the real one a moment later.
    expect(horizonRead).toHaveBeenCalledWith("household-1", ZONE, null);
  });

  it("asks for no task rows either, rather than for the week of the epoch (012)", () => {
    renderReminders([SWIM], null);

    // The resolutions read is keyed by the week containing today, and before
    // the clock there is no such week. Left enabled it fetched the week of 1
    // January 1970 on every load of every tab — a round trip whose answer was
    // thrown away the moment the real week arrived.
    expect(taskRead).toHaveBeenCalledWith(false);
    expect(resolutionsRead).toHaveBeenCalledWith("1970-01-01", false);
  });

  it("asks for both the moment the clock publishes, for the week around today", () => {
    renderReminders([SWIM], SWIM_FIRES_AT);

    expect(taskRead).toHaveBeenLastCalledWith(true);
    // 9 September 2026 is a Wednesday; the household's week starts on Sunday.
    expect(resolutionsRead).toHaveBeenLastCalledWith("2026-09-06", true);
  });

  it("shows nothing while the horizon read is still in flight", () => {
    const view = renderReminders(undefined, SWIM_FIRES_AT);

    expect(view.reminders()).toEqual([]);
    expect(view.key()).toBe("");
  });
});

describe("the moment arriving", () => {
  it("says nothing a minute early, and the reminder the minute it is due", () => {
    const view = renderReminders([SWIM], SWIM_FIRES_AT - A_MINUTE);
    expect(view.reminders()).toEqual([]);

    view.tickTo(SWIM_FIRES_AT);

    expect(words(view.reminders())).toEqual([
      { title: "Swim lesson", body: "in 10 minutes", path: "/family/calendar?on=2026-09-09" },
    ]);
  });

  it("names tomorrow when the day rolls between the reminder and the event", () => {
    // 23:55 on the 9th, for five past midnight on the 10th: tapping it must
    // land on the day the event is drawn on, not the day being reminded.
    const view = renderReminders([AIRPORT], AIRPORT_FIRES_AT);

    expect(words(view.reminders())).toEqual([
      { title: "Airport run", body: "in 10 minutes", path: "/family/calendar?on=2026-09-10" },
    ]);
  });
});

describe("a page that was closed or asleep", () => {
  it("still shows a reminder that is exactly at the edge of the look-back", () => {
    const view = renderReminders([SWIM], SWIM_FIRES_AT + MAX_STALENESS_MS);

    expect(words(view.reminders())).toEqual([
      { title: "Swim lesson", body: "in 10 minutes", path: "/family/calendar?on=2026-09-09" },
    ]);
  });

  it("never shows one that went stale more than fifteen minutes ago (FR-817)", () => {
    // A wall tablet waking at nine to a pile of seven o'clock banners is a
    // failure, not a feature: what is long past is dropped, not replayed.
    const view = renderReminders([SWIM], SWIM_FIRES_AT + MAX_STALENESS_MS + A_MINUTE);

    expect(view.reminders()).toEqual([]);
    expect(view.key()).toBe("");
  });
});

describe("dismissing (FR-816)", () => {
  it("does not bring the same reminder back on the next tick", () => {
    const view = renderReminders([SWIM], SWIM_FIRES_AT);
    expect(view.reminders()).toHaveLength(1);

    view.dismiss();
    expect(view.reminders()).toEqual([]);

    view.tickTo(SWIM_FIRES_AT + A_MINUTE);
    expect(view.reminders()).toEqual([]);
    expect(view.key()).toBe("");
  });

  it("dismisses only what was on screen, leaving a later reminder to arrive", () => {
    const view = renderReminders([SWIM, PIANO], SWIM_FIRES_AT);
    view.dismiss();

    view.tickTo(PIANO_FIRES_AT);

    expect(words(view.reminders())).toEqual([
      { title: "Piano practice", body: "in 10 minutes", path: "/family/calendar?on=2026-09-09" },
    ]);
  });
});

describe("the key the chime hangs off", () => {
  it("stays the same across a tick that changes nothing", () => {
    const view = renderReminders([SWIM], SWIM_FIRES_AT);
    const first = view.key();
    expect(first).not.toBe("");

    view.tickTo(SWIM_FIRES_AT + A_MINUTE);

    expect(view.key()).toBe(first);
  });

  it("changes when one reminder replaces another inside the same minute", () => {
    // Both sets hold exactly one reminder, so a `reminders.length` check would
    // see nothing happen and the second reminder would arrive in silence.
    const view = renderReminders([SWIM, PIANO], SWIM_FIRES_AT);
    const swimKey = view.key();

    view.tickTo(PIANO_FIRES_AT);

    expect(view.reminders()).toHaveLength(1);
    expect(view.key()).not.toBe(swimKey);
  });
});

describe("an event no tab is displaying (R802, FR-829)", () => {
  it("reminds seven days ahead, which is why the banner reads its own horizon", () => {
    // The household asked to be reminded a week before. No calendar window
    // holds this event, and on Lists or Meals no calendar window is even
    // mounted — so a hook that borrowed the visible screen's data would say
    // nothing at all here.
    const view = renderReminders([LUNCH], LUNCH_FIRES_AT, makeSettings({
      notifyEventBeforeMinutes: SEVEN_DAYS_IN_MINUTES,
    }));

    expect(words(view.reminders())).toEqual([
      {
        title: "Grandma's birthday lunch",
        body: "in 7 days",
        path: "/family/calendar?on=2026-09-16",
      },
    ]);
  });
});
