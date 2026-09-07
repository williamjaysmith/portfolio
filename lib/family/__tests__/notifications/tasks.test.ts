/**
 * 008 T042/T044/T048: the two chore notifications (FR-818, FR-819, FR-820, R812).
 *
 * **When Due** fires for a chore that carries a TIME and for nothing else. That
 * is the reference's own rule — a notification "will only appear for those
 * chores that are due at a specific time" [VERIFIED](36836043247131) — and it
 * matches the shipped schema exactly: `due_time` is null on an anytime chore,
 * and a routine carries `times_of_day` slots instead.
 *
 * **When Completed** is the one notification anywhere in the reference that
 * names a person [VERIFIED](54930439904923). It is derived here from the
 * resolution rows an open page already holds, because with no push there is
 * nothing to send and nothing to record.
 *
 * The most valuable test in the file is the last group: a completion is keyed by
 * the RESOLUTION ROW, not by (task, date). A routine completed in two slots on
 * one day and an Anytime chore with no date at all are both cases the pair would
 * get wrong, and both are ordinary in this household.
 */

import { describe, expect, it } from "vitest";

import { completionNotices } from "../../notifications/completions";
import { taskReminders } from "../../notifications/due";
import { reminderKeyOf } from "../../notifications/identity";
import { NOTIFICATION_DEFAULTS, type NotificationSettings } from "../../notifications/settings";
import type { BoardOccurrence, TaskResolution } from "../../types";

const CLEO = "cleo-id";
const ANA = "ana-id";
const NAMES: Record<string, string> = { [CLEO]: "Cleo", [ANA]: "Ana" };
const nameOf = (id: string | null) => (id === null ? null : (NAMES[id] ?? null));

function chore(patch: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    taskId: "task-1",
    assigneeId: CLEO,
    scheduledDate: "2026-09-09",
    slot: null,
    cyclePrev: null,
    displayedDate: "2026-09-09",
    isLate: false,
    summary: "Practice piano",
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    dueTime: "17:00",
    dueAt: "2026-09-09T22:00:00.000Z",
    isRepeating: false,
    taskCreatedAt: "2026-09-01T00:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    rewardPoints: null,
    ...patch,
  };
}

function resolution(patch: Partial<TaskResolution> = {}): TaskResolution {
  return {
    id: "resolution-1",
    householdId: "household-1",
    taskId: "task-1",
    occurrenceDate: "2026-09-09",
    occurrenceSlot: null,
    assigneeId: CLEO,
    categoryId: CLEO,
    cyclePrev: null,
    status: "complete",
    resolvedOn: "2026-09-09",
    resolvedAt: "2026-09-09T22:05:00.000Z",
    createdBy: CLEO,
    createdAt: "2026-09-09T22:05:00.000Z",
    ...patch,
  };
}

const summaryOf = (taskId: string) => (taskId === "task-1" ? "Practice piano" : null);
const OFF: NotificationSettings = { ...NOTIFICATION_DEFAULTS, taskDue: false };
const ANNOUNCES: NotificationSettings = { ...NOTIFICATION_DEFAULTS, taskCompleted: true };

describe("When Due", () => {
  it("reminds for a chore that carries a time, and names whose it is", () => {
    const [reminder] = taskReminders([chore()], NOTIFICATION_DEFAULTS, nameOf);
    expect(reminder).toMatchObject({ title: "Practice piano", body: "Cleo — due now" });
    expect(reminder.identity.fireAtMs).toBe(Date.parse("2026-09-09T22:00:00.000Z"));
  });

  it("says nothing for an anytime chore, which has no time to be due at", () => {
    expect(
      taskReminders([chore({ dueTime: null, dueAt: null, scheduledDate: null })], NOTIFICATION_DEFAULTS, nameOf),
    ).toEqual([]);
  });

  it("says nothing for an all-day chore", () => {
    expect(taskReminders([chore({ dueTime: null, dueAt: null })], NOTIFICATION_DEFAULTS, nameOf)).toEqual([]);
  });

  it("says nothing for a routine, whatever slots it has", () => {
    expect(
      taskReminders([chore({ routine: true, slot: "morning" })], NOTIFICATION_DEFAULTS, nameOf),
    ).toEqual([]);
  });

  it("says nothing about a chore that is already done or skipped", () => {
    expect(taskReminders([chore({ state: "complete" })], NOTIFICATION_DEFAULTS, nameOf)).toEqual([]);
    expect(taskReminders([chore({ state: "skipped" })], NOTIFICATION_DEFAULTS, nameOf)).toEqual([]);
  });

  it("names nobody for an up-for-grabs chore rather than inventing an owner", () => {
    const [reminder] = taskReminders([chore({ assigneeId: null, upForGrabs: true })], NOTIFICATION_DEFAULTS, nameOf);
    expect(reminder.body).toBe("Due now");
  });

  it("says nothing at all when the household turned it off", () => {
    expect(taskReminders([chore()], OFF, nameOf)).toEqual([]);
  });

  it("fires a LATE chore at its own due time, not the day it is drawn on", () => {
    // FR-818's "once, not once a day" needs no special case: a chore carried
    // forward keeps yesterday's instant, so the staleness rule drops it.
    const carried = chore({ scheduledDate: "2026-09-08", displayedDate: "2026-09-09", isLate: true });
    const [reminder] = taskReminders([carried], NOTIFICATION_DEFAULTS, nameOf);
    expect(reminder.identity.occurrenceDate).toBe("2026-09-08");
  });
});

describe("When Completed", () => {
  it("names who finished what, in the reference's own shape", () => {
    const notices = completionNotices([resolution({ createdBy: ANA })], summaryOf, ANNOUNCES, {
      nameOf,
      actorId: null,
    });
    expect(notices[0].title).toBe("Cleo finished Practice piano");
  });

  it("says nothing when the household did not ask for it", () => {
    expect(
      completionNotices([resolution({ createdBy: ANA })], summaryOf, NOTIFICATION_DEFAULTS, {
        nameOf,
        actorId: null,
      }),
    ).toEqual([]);
  });

  it("says nothing for a skip — a skip is not a completion", () => {
    expect(
      completionNotices([resolution({ status: "skipped", createdBy: ANA })], summaryOf, ANNOUNCES, {
        nameOf,
        actorId: null,
      }),
    ).toEqual([]);
  });

  it("says nothing to the device that performed the tick", () => {
    // That person is looking at the card that just flipped; with no push there
    // is no second surface for the announcement to be useful on.
    expect(
      completionNotices([resolution({ createdBy: CLEO })], summaryOf, ANNOUNCES, {
        nameOf,
        actorId: CLEO,
      }),
    ).toEqual([]);
  });

  it("still tells every OTHER open screen", () => {
    const notices = completionNotices([resolution({ createdBy: CLEO })], summaryOf, ANNOUNCES, {
      nameOf,
      actorId: ANA,
    });
    expect(notices).toHaveLength(1);
  });
});

describe("a completion's identity", () => {
  it("is the resolution row, so two slots of one routine on one day both announce", () => {
    const morning = resolution({ id: "res-morning", occurrenceSlot: "morning", createdBy: ANA });
    const evening = resolution({ id: "res-evening", occurrenceSlot: "evening", createdBy: ANA });

    const notices = completionNotices([morning, evening], summaryOf, ANNOUNCES, {
      nameOf,
      actorId: null,
    });
    const keys = notices.map((notice) => reminderKeyOf(notice.identity));
    expect(new Set(keys).size).toBe(2);
  });

  it("survives an Anytime chore having no date at all", () => {
    const anytime = resolution({ id: "res-anytime", occurrenceDate: null, createdBy: ANA });
    const [notice] = completionNotices([anytime], summaryOf, ANNOUNCES, { nameOf, actorId: null });
    expect(reminderKeyOf(notice.identity)).toBe("task_done:res-anytime");
  });

  it("announces again after an un-tick and a re-tick, because that is a new row", () => {
    const first = resolution({ id: "res-1", createdBy: ANA });
    const again = resolution({ id: "res-2", createdBy: ANA, resolvedAt: "2026-09-09T23:00:00.000Z" });
    const keys = completionNotices([first, again], summaryOf, ANNOUNCES, {
      nameOf,
      actorId: null,
    }).map((notice) => reminderKeyOf(notice.identity));

    expect(new Set(keys).size).toBe(2);
  });
});

describe("the star economy stays silent (FR-820, SC-810)", () => {
  it("has no notification of any kind for stars, redemptions or streaks", () => {
    // Nothing here reads reward_points, the ledger or a streak — and this test
    // exists so that adding one is a deliberate act rather than a slip. No
    // fetched source documents a star notification, and whether redeeming a
    // reward notifies anyone is explicitly UNKNOWN (spec Assumption 14).
    const earned = chore({ rewardPoints: 20, state: "complete" });
    expect(taskReminders([earned], NOTIFICATION_DEFAULTS, nameOf)).toEqual([]);

    const notices = completionNotices([resolution({ createdBy: ANA })], summaryOf, ANNOUNCES, {
      nameOf,
      actorId: null,
    });
    expect(notices.every((notice) => !/star|reward|streak/i.test(notice.title + notice.body))).toBe(
      true,
    );
  });
});
