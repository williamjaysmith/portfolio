/**
 * 008 T031 — the reminder, on whichever page is open (FR-814–FR-816, §III).
 *
 * The banner is the whole of this feature's delivery surface: no push, no
 * service worker, no server scan. So what it does on screen is the product, and
 * this file pins down the four claims that are easy to lose in a refactor:
 *
 *   - everything due in the same minute is ONE banner naming each item, which is
 *     the reference's own pop-up behaviour (FR-814) — so it gets the clearest
 *     test here;
 *   - it renders NOTHING when there is nothing due, and nothing when this device
 *     has turned banners off (FR-815): no empty container taking up space and
 *     sitting in the accessibility tree on the overwhelming majority of minutes;
 *   - it announces politely and never takes focus, because a reminder arrives on
 *     its own schedule and must not interrupt somebody mid-sentence or mid-word;
 *   - it can be dismissed, by thumb or by keyboard, and each item is a link to
 *     the day it belongs to that dismisses as it crosses (FR-816).
 *
 * `useDueReminders` and `chime` are mocked, so what is under test here is the
 * banner and nothing else: the due-computation has its own unit tests in
 * `lib/family/notifications/**`, and the chime should not make a noise in CI.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DueReminder } from "@/lib/family/notifications/due";
import { reminderKeyOf } from "@/lib/family/notifications/identity";

import type { DueRemindersState } from "../useDueReminders";

const useDueReminders = vi.fn<() => DueRemindersState>();
const playChime = vi.fn<() => void>();
const dismiss = vi.fn<() => void>();

vi.mock("../useDueReminders", () => ({ useDueReminders: () => useDueReminders() }));
vi.mock("../chime", () => ({ playChime: () => playChime() }));

const { ReminderBanner } = await import("../ReminderBanner");
const { resetReminderSwitches } = await import("../reminderSwitches");

const SWITCH_KEY = "family:reminder-switches:v1";

function reminderOf(overrides: Partial<DueReminder> & Pick<DueReminder, "title">): DueReminder {
  return {
    identity: {
      subjectKind: "event",
      subjectId: overrides.title,
      occurrenceDate: "2026-09-07",
      fireAtMs: Date.parse("2026-09-07T16:20:00.000Z"),
      ...overrides.identity,
    },
    body: "in 10 minutes",
    path: "/family/calendar?on=2026-09-07",
    ...overrides,
  };
}

const SWIM = reminderOf({ title: "Swim lesson" });
const DENTIST = reminderOf({ title: "Dentist", body: "Starting now" });
const BINS = reminderOf({
  title: "Bins out",
  body: "in 1 hour",
  path: "/family/calendar?on=2026-09-08",
  identity: {
    subjectKind: "event",
    subjectId: "bins",
    occurrenceDate: "2026-09-08",
    fireAtMs: Date.parse("2026-09-08T07:00:00.000Z"),
  },
});

/** What the hook is handing the banner this minute. */
function showing(reminders: DueReminder[], key?: string): void {
  useDueReminders.mockReturnValue({
    reminders,
    key: key ?? reminders.map((reminder) => reminderKeyOf(reminder.identity)).join("|"),
    dismiss,
  });
}

/** This device's own two choices, as the switch store finds them in storage. */
function deviceChose(switches: { banner: boolean; chime: boolean }): void {
  localStorage.setItem(SWITCH_KEY, JSON.stringify(switches));
  resetReminderSwitches();
}

beforeEach(() => {
  localStorage.clear();
  // The switch store is module-level, so one test's silenced device would
  // otherwise still be silenced in the next.
  resetReminderSwitches();
  useDueReminders.mockReset();
  playChime.mockReset();
  dismiss.mockReset();
  showing([]);
});

describe("what a minute's reminders look like", () => {
  it("gathers everything due in the same minute into one banner that names each item", () => {
    showing([SWIM, DENTIST, BINS]);
    render(<ReminderBanner />);

    // One region, not three: `getByRole` would throw on a second.
    const banner = screen.getByRole("status", { name: "Reminders" });
    expect(screen.getAllByRole("status")).toHaveLength(1);

    expect(within(banner).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Swim lesson — in 10 minutes",
      "Dentist — Starting now",
      "Bins out — in 1 hour",
    ]);
  });

  it("draws nothing at all when nothing is due, rather than an empty container", () => {
    showing([]);
    const { container } = render(<ReminderBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("draws nothing on a device that has turned banners off, however much is due", () => {
    deviceChose({ banner: false, chime: false });
    showing([SWIM, DENTIST]);
    const { container } = render(<ReminderBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Swim lesson")).toBeNull();
  });
});

describe("arriving without interrupting anybody", () => {
  it("announces politely, as a status and never as an alert", () => {
    // `role="alert"` is assertive: it cuts across whatever a screen reader is
    // saying. "Swim lesson in 10 minutes" is information arriving on its own
    // schedule, so it waits its turn — hence status + aria-live="polite".
    showing([SWIM]);
    render(<ReminderBanner />);

    const banner = screen.getByRole("status", { name: "Reminders" });
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaves the focus where the person put it, mid-typing", () => {
    function Page({ reminding }: { reminding: boolean }) {
      return (
        <>
          <input aria-label="Event title" />
          {reminding ? <ReminderBanner /> : null}
        </>
      );
    }

    showing([SWIM]);
    const { rerender } = render(<Page reminding={false} />);
    const title = screen.getByRole("textbox", { name: "Event title" });
    title.focus();

    rerender(<Page reminding />);

    expect(screen.getByRole("status", { name: "Reminders" })).toBeInTheDocument();
    expect(title).toHaveFocus();
  });
});

describe("getting rid of it", () => {
  it("offers a Dismiss control that says what it does", async () => {
    const user = userEvent.setup();
    showing([SWIM]);
    render(<ReminderBanner />);

    await user.click(screen.getByRole("button", { name: "Dismiss reminders" }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("puts Dismiss on the keyboard path, for somebody with no thumb on the glass", async () => {
    const user = userEvent.setup();
    showing([SWIM]);
    render(<ReminderBanner />);

    await user.tab(); // the reminder itself
    await user.tab(); // Dismiss
    const button = screen.getByRole("button", { name: "Dismiss reminders" });
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe("crossing to the day it names", () => {
  // A real anchor with a real href, followed for real, is what jsdom cannot do:
  // it would log "navigation to another Document". Cancelling the default at the
  // document — after the banner's own handler has already run on the way up —
  // keeps the run quiet without stubbing the link out.
  const swallowNavigation = (event: MouseEvent) => event.preventDefault();
  beforeEach(() => {
    document.addEventListener("click", swallowNavigation);
    return () => document.removeEventListener("click", swallowNavigation);
  });

  it("makes each reminder a link to its own day", () => {
    showing([SWIM, BINS]);
    render(<ReminderBanner />);

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/family/calendar?on=2026-09-07",
      "/family/calendar?on=2026-09-08",
    ]);
    expect(screen.getByRole("link", { name: /Swim lesson/ })).toBeInTheDocument();
  });

  it("dismisses as it goes, so the banner is not waiting on the calendar", async () => {
    const user = userEvent.setup();
    showing([SWIM, BINS]);
    render(<ReminderBanner />);

    await user.click(screen.getByRole("link", { name: /Bins out/ }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe("the sound, on a device that asked for one", () => {
  it("rings once for a new set, and not again while the same set is on screen", () => {
    deviceChose({ banner: true, chime: true });
    showing([SWIM], "swim");
    const { rerender } = render(<ReminderBanner />);
    expect(playChime).toHaveBeenCalledTimes(1);

    rerender(<ReminderBanner />);
    expect(playChime).toHaveBeenCalledTimes(1);

    // One reminder replacing another inside the same minute is a NEW set — the
    // count has not changed, which is why the key and not the count decides.
    showing([DENTIST], "dentist");
    rerender(<ReminderBanner />);
    expect(playChime).toHaveBeenCalledTimes(2);
  });

  it("shows the banner in silence on a device that did not ask for one", () => {
    // Sound is off by default: Phase 1 chose a silent display.
    showing([SWIM]);
    render(<ReminderBanner />);

    expect(screen.getByRole("status", { name: "Reminders" })).toBeInTheDocument();
    expect(playChime).not.toHaveBeenCalled();
  });

  it("stays silent on a device showing no banners, whatever its sound switch says", () => {
    deviceChose({ banner: false, chime: true });
    showing([SWIM]);
    render(<ReminderBanner />);

    expect(playChime).not.toHaveBeenCalled();
  });
});
