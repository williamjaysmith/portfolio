import { showColumn } from "../helpers/board";
import {
  createEvent,
  deleteEvent,
  eventBlocks,
  openEventAt,
  reminderTextAt,
} from "../helpers/calendar";
import { installClock, nowMs, pinForward, wallTime } from "../helpers/clock";
import { hideDevOverlay } from "../helpers/overlay";
import { expect, test } from "../fixtures";

/**
 * 008 T050, Phase 7 — Family Notifications (FR-801–FR-821, FR-829, FR-832).
 *
 * The household's four reminder choices, one event's own override at each of
 * the three repeat scopes, and the banner the shell draws on whichever
 * `/family` page is open when a reminder's moment comes.
 *
 * **The banner journeys pin the browser's own clock** (`e2e/helpers/clock.ts`)
 * rather than waiting on real minutes to pass. `page.clock` replaces `Date`
 * and the timer functions for the whole browser context, which is exactly
 * what the shell's minute clock (`useNow`, `Clock.tsx`) is built on — so
 * pinning the page's clock pins the app's. Every jump stays inside an hour
 * (harness.md §5): the signed-in session is a token minted on the real clock,
 * and a browser pinned days away decides it has expired.
 *
 * Every event this file creates carries ITS OWN reminder rather than relying
 * on the household's current default: that decouples the banner journeys
 * from whatever an earlier test in this file left the household's lead time
 * at, and is itself half of User Story 3 (FR-808).
 */

function notifications(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "Notifications", exact: true });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("Settings → Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/settings");
  });

  test("shows the four choices and their factory defaults, and says where reminders appear (FR-801–FR-804, FR-807)", async ({
    page,
  }) => {
    const region = notifications(page);
    await expect(region.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(region.getByRole("group", { name: "Calendar", exact: true })).toBeVisible();
    await expect(region.getByRole("group", { name: "Tasks", exact: true })).toBeVisible();

    await expect(region.getByRole("switch", { name: "At time of event" })).not.toBeChecked();
    await expect(region.getByRole("switch", { name: "Before event" })).toBeChecked();
    await expect(region.getByRole("combobox", { name: "Before event" })).toHaveValue("10");
    await expect(region.getByRole("switch", { name: "When Due" })).toBeChecked();
    await expect(region.getByRole("switch", { name: "When Completed" })).not.toBeChecked();

    // Assumption 15, said in the product rather than only in the spec.
    await expect(region.getByText("Reminders appear on screens that have this app open.")).toBeVisible();
  });

  test("keeps a changed setting across a reload (FR-802, harness.md rule 4)", async ({ page, actAsAna }) => {
    const region = notifications(page);
    const atTime = region.getByRole("switch", { name: "At time of event" });
    await expect(atTime).not.toBeChecked();

    await actAsAna(async () => {
      await atTime.check();
      await region.getByRole("button", { name: "Save" }).click();
    });
    await expect(region.getByRole("status")).toHaveText("Saved");

    await page.reload();
    await expect(notifications(page).getByRole("switch", { name: "At time of event" })).toBeChecked();

    // Left as FR-807 found it, so the first test in this file meets the same
    // defaults on the next run with no database reset in between (SC-703).
    await actAsAna(async () => {
      await notifications(page).getByRole("switch", { name: "At time of event" }).uncheck();
      await notifications(page).getByRole("button", { name: "Save" }).click();
    });
    await expect(notifications(page).getByRole("status")).toHaveText("Saved");
  });

  test("a punched-in member finds the household's four read-only, but this device's own two still answer to her (FR-805, FR-815)", async ({
    page,
    actAsCleo,
    unique,
  }) => {
    // A member has no route to the four household choices; punching Cleo in
    // needs a write of her own first, the way the app always asks (harness.md
    // rule 2) — adding to a seeded list is the smallest one.
    await page.goto("/family/lists");
    await showColumn(page, "Grocery List", "Lists");
    const probe = unique("Cleo probe");
    await actAsCleo(async () => {
      await page.getByRole("textbox", { name: "Add item to Grocery List" }).fill(probe);
      await page.keyboard.press("Enter");
    });
    await expect(page.getByRole("checkbox", { name: probe })).toBeVisible();

    await page.goto("/family/settings");
    const region = notifications(page);
    await expect(region.getByText("Parents only")).toBeVisible();
    for (const label of ["At time of event", "Before event", "When Due", "When Completed"]) {
      await expect(region.getByRole("switch", { name: label })).toBeDisabled();
    }

    // "This device"'s two switches are local storage, not a household write —
    // they need no parent (FR-815) and sit outside the disabled <form>.
    const banner = region.getByRole("switch", { name: "Show reminders on this screen" });
    const chime = region.getByRole("switch", { name: "Play a sound with them" });
    await expect(banner).toBeEnabled();
    await expect(banner).toBeChecked();
    await expect(chime).toBeEnabled();
    await expect(chime).not.toBeChecked();
    await chime.check();
    await expect(chime).toBeChecked();

    await page.goto("/family/lists");
    await showColumn(page, "Grocery List", "Lists");
    await actAsCleo(async () => {
      await page.getByRole("button", { name: probe }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    });
    await expect(page.getByRole("checkbox", { name: probe })).toHaveCount(0);
  });

  test("changes the lead time by preset, then by a custom number and unit, both kept across a reload (FR-806)", async ({
    page,
    actAsAna,
  }) => {
    const region = notifications(page);
    const lead = region.getByRole("combobox", { name: "Before event" });

    await actAsAna(async () => {
      await lead.selectOption({ label: "30 minutes" });
      await region.getByRole("button", { name: "Save" }).click();
    });
    await expect(region.getByRole("status")).toHaveText("Saved");

    await page.reload();
    await expect(notifications(page).getByRole("combobox", { name: "Before event" })).toHaveValue("30");

    await actAsAna(async () => {
      await notifications(page).getByRole("combobox", { name: "Before event" }).selectOption({ label: "Custom" });
      await notifications(page).getByRole("spinbutton", { name: "How long" }).fill("2");
      await notifications(page).getByRole("combobox", { name: "Unit" }).selectOption({ label: "Hours" });
      await notifications(page).getByRole("button", { name: "Save" }).click();
    });
    await expect(notifications(page).getByRole("status")).toHaveText("Saved");

    await page.reload();
    // 120 minutes matches no preset, so the field reopens on Custom, reading
    // the stored minutes back in the unit it was chosen in (R810).
    const reopened = notifications(page);
    await expect(reopened.getByRole("combobox", { name: "Before event" })).toHaveValue("custom");
    await expect(reopened.getByRole("spinbutton", { name: "How long" })).toHaveValue("2");
    await expect(reopened.getByRole("combobox", { name: "Unit" })).toHaveValue("hours");

    // Back to FR-807's factory default, for the same reason as the test above.
    await actAsAna(async () => {
      await reopened.getByRole("combobox", { name: "Before event" }).selectOption({ label: "10 minutes" });
      await reopened.getByRole("button", { name: "Save" }).click();
    });
    await expect(reopened.getByRole("status")).toHaveText("Saved");
  });
});

test.describe("an event's own reminder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
  });

  test("keeps one event's own lead time and another's silence across a reload (FR-808, FR-809, FR-811)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const withOwn = unique("Dentist");
    const withNone = unique("Standing call");
    await createEvent(page, actAsAna, { title: withOwn, reminder: { beforeMinutes: 120 } });
    await createEvent(page, actAsAna, { title: withNone, reminder: "none" });

    await page.reload();

    expect(await reminderTextAt(page, withOwn, 0)).toBe("2 hours before");
    expect(await reminderTextAt(page, withNone, 0)).toBe("None");

    await deleteEvent(page, actAsAna, withOwn);
    await deleteEvent(page, actAsAna, withNone);
  });

  test("asks which occurrences a repeating event's changed reminder should reach, and leaves the rest alone (FR-810, SC-807)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Piano lesson");
    await createEvent(page, actAsAna, { title, repeats: "Every day" });
    await page.reload();

    const count = await eventBlocks(page, title).count();
    test.skip(count < 3, "the visible week holds too few daily occurrences today to prove a middle one");

    // The middle occurrence is the one that changes; its neighbours either
    // side must still read whatever they read before the edit — captured
    // here rather than assumed, so this does not depend on the household's
    // current default lead time.
    const target = 1;
    const before = await reminderTextAt(page, title, 0);
    const after = await reminderTextAt(page, title, target + 1);

    await openEventAt(page, title, target);
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("dialog", { name: "Edit event" });
    await form.getByRole("combobox", { name: "Reminder" }).selectOption({ label: "No reminder" });
    await actAsAna(async () => {
      await form.getByRole("button", { name: "Save" }).click();
      // FR-237's shipped wording, shared by every scoped edit in this app.
      await expect(page.getByRole("heading", { name: "Edit repeating event" })).toBeVisible();
      await page.getByRole("radio", { name: "This event" }).check();
      await page.getByRole("button", { name: "Continue" }).click();
    });
    await expect(form).toBeHidden();

    await page.reload();
    expect(await reminderTextAt(page, title, target)).toBe("None");
    expect(await reminderTextAt(page, title, 0)).toBe(before);
    expect(await reminderTextAt(page, title, target + 1)).toBe(after);

    await deleteEvent(page, actAsAna, title, "All events");
  });
});

test.describe("the reminder banner", () => {
  test("names a due event on an open page, then does not return once dismissed (FR-814–FR-817, SC-802, SC-804, SC-805)", async ({
    page,
    actAsAna,
    unique,
    household,
  }) => {
    await installClock(page);
    await page.goto("/family/calendar");

    const title = unique("Swim lesson");
    const anchor = await nowMs(page);
    const startAt = anchor + 12 * 60_000;
    const leadMinutes = 5;
    await createEvent(page, actAsAna, {
      title,
      startTime: wallTime(startAt, household.timezone),
      endTime: wallTime(startAt + 30 * 60_000, household.timezone),
      reminder: { beforeMinutes: leadMinutes },
    });

    const banner = page.getByRole("status", { name: "Reminders" });
    await expect(banner).toHaveCount(0);

    // Reload before trusting the banner's own read (harness.md rule 4): its
    // query is not the calendar's, and this local stack is not known to
    // deliver a live update to refresh it on its own (Phase 5).
    await page.reload();
    const justBefore = await nowMs(page);
    // The reminder's moment is start − lead; land 30s past it, well inside
    // the fifteen-minute staleness window (FR-817).
    await pinForward(page, startAt - leadMinutes * 60_000 - justBefore + 30_000);

    const item = banner.getByRole("link", {
      name: new RegExp(`${escapeRegExp(title)}.*in ${leadMinutes} minutes`, "s"),
    });
    await expect(item).toBeVisible();

    await banner.getByRole("button", { name: "Dismiss reminders" }).click();
    await expect(banner).toHaveCount(0);

    // Further on, still inside the same fifteen-minute window: gone for good,
    // because this device has already shown it (FR-816).
    await pinForward(page, 60_000);
    await expect(banner).toHaveCount(0);

    await deleteEvent(page, actAsAna, title);
  });

  test("draws its own banner on a second tab, and dismissing one leaves the other showing (FR-816's honest limit)", async ({
    page,
    actAsAna,
    unique,
    household,
  }) => {
    await installClock(page);
    await page.goto("/family/calendar");

    const title = unique("Recital");
    const anchor = await nowMs(page);
    const startAt = anchor + 12 * 60_000;
    const leadMinutes = 4;
    await createEvent(page, actAsAna, {
      title,
      startTime: wallTime(startAt, household.timezone),
      endTime: wallTime(startAt + 30 * 60_000, household.timezone),
      reminder: { beforeMinutes: leadMinutes },
    });
    await page.reload();

    // A second TAB of the SAME browser: it shares local storage and, because
    // Playwright installs the clock for the whole context, the same pinned
    // time — unlike `secondBrowser` (fixtures.ts), which is a separate
    // profile with storage of its own. FR-816 names both limits explicitly:
    // a second profile can show a reminder again from a clean slate; two tabs
    // of one profile each show and dismiss their own, because the "shown"
    // memory is an in-page listener with no cross-tab storage event
    // (`useDueReminders.ts`'s own comment). This is that honest degradation,
    // not a defect, and this journey asserts it rather than hiding it.
    const second = await page.context().newPage();
    await hideDevOverlay(second);
    // The tab showing is not the calendar — the banner reads for itself
    // regardless of what tab happens to be on screen (FR-829, Edge Cases).
    await second.goto("/family/lists");

    const justBefore = await nowMs(page);
    await pinForward(page, startAt - leadMinutes * 60_000 - justBefore + 30_000);

    const bannerA = page.getByRole("status", { name: "Reminders" });
    const bannerB = second.getByRole("status", { name: "Reminders" });
    await expect(bannerA).toBeVisible();
    await expect(bannerB).toBeVisible();

    await bannerA.getByRole("button", { name: "Dismiss reminders" }).click();
    await expect(bannerA).toHaveCount(0);
    await expect(bannerB).toBeVisible();

    // Tapping the reminder on the tab that was not the calendar both
    // dismisses it and crosses to the day it names (FR-816, US2 Acceptance
    // Scenario 7).
    await bannerB.getByRole("link", { name: new RegExp(escapeRegExp(title)) }).click();
    await expect(bannerB).toHaveCount(0);
    await expect(second).toHaveURL(/\/family\/calendar\?on=/);

    await second.close();
    await deleteEvent(page, actAsAna, title);
  });
});
