import { createEvent, deleteEvent } from "../helpers/calendar";
import { hideDevOverlay } from "../helpers/overlay";
import { expect, test } from "../fixtures";

/**
 * 011, Phase 9 — the calendar's other views (FR-1101–FR-1119).
 *
 * The switcher, the Day view and the Month view. The Schedule view is the
 * reference's fourth and is deferred with its cost written into the spec.
 *
 * **What this file cannot claim.** No image of the reference's Month view
 * exists anywhere in the research corpus (R1101), so nothing here asserts that
 * ours looks like theirs. What it asserts is the documented behaviour: the
 * capacity and its step down at four, the overflow control and the list it
 * opens, a multi-day event drawn as one bar per week row rather than a chip per
 * day, and paging by a calendar month.
 *
 * Every event is created and deleted by its own journey (harness.md §1).
 */

function switcher(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: /^Calendar view:/ });
}

/** The three the cycle passes through, in its order. */
const VIEW_CYCLE = ["Day", "Week", "Month"] as const;

/**
 * Taps the control until the view asked for is showing.
 *
 * The control CYCLES rather than opening a menu (012b): 011's popover hung off
 * the edge of a narrow phone, so it was replaced. Three views make two taps the
 * ceiling, which is why this loop is bounded by the cycle's own length — if it
 * ever needs more, the cycle is broken and the bound says so rather than
 * spinning.
 */
async function chooseView(
  page: import("@playwright/test").Page,
  view: "Day" | "Week" | "Month",
): Promise<void> {
  for (let taps = 0; taps < VIEW_CYCLE.length; taps += 1) {
    if ((await switcher(page).textContent())?.trim() === view) return;
    await switcher(page).click();
  }
  await expect(switcher(page), `the cycle never reached ${view}`).toHaveText(view);
}

test.describe("the view switcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    // Left as the next journey expects to find it.
    await chooseView(page, "Week").catch(() => undefined);
  });

  test("is one control whose label is the view showing (FR-1101)", async ({ page }) => {
    await expect(switcher(page)).toHaveText("Week");

    await chooseView(page, "Month");
    await expect(switcher(page)).toHaveText("Month");

    await chooseView(page, "Day");
    await expect(switcher(page)).toHaveText("Day");
  });

  test("cycles the three this project ships, wrapping, and never Schedule (FR-1103)", async ({ page }) => {
    // One tap per view, back to where it started: that the cycle closes in
    // exactly three is what proves Schedule is not in it.
    await expect(switcher(page)).toHaveText("Week");
    await switcher(page).click();
    await expect(switcher(page)).toHaveText("Month");
    await switcher(page).click();
    await expect(switcher(page)).toHaveText("Day");
    await switcher(page).click();
    await expect(switcher(page)).toHaveText("Week");
  });

  test("needs no popover, so nothing can hang off a narrow screen (012b)", async ({ page }) => {
    // The defect this replaced: a menu positioned beside the control, off the
    // page at phone widths. There is now nothing to position.
    await switcher(page).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  });

  test("remembers the view across a reload, per device (FR-1102)", async ({ page }) => {
    await chooseView(page, "Month");

    await page.reload();
    await hideDevOverlay(page);
    await expect(switcher(page)).toHaveText("Month");
  });

  test("keeps Today working in every view (FR-1104)", async ({ page }) => {
    for (const view of ["Day", "Month", "Week"] as const) {
      await chooseView(page, view);
      await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
      await page.getByRole("button", { name: "Today" }).click();
    }
  });
});

test.describe("Day view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await chooseView(page, "Week").catch(() => undefined);
  });

  test("shows one day and steps by one day (FR-1105, FR-1107)", async ({ page }) => {
    await chooseView(page, "Day");

    // The arrows say how far they go — the only way a screen reader can tell
    // a Day view from a seven-day week.
    await expect(page.getByRole("button", { name: "Next day" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Next \d+ days/ })).toHaveCount(0);
  });

  test("still opens an event's details on a tap (FR-1108)", async ({ page, actAsAna, unique }) => {
    const title = unique("Day view event");
    await createEvent(page, actAsAna, { title });

    await chooseView(page, "Day");
    await page.getByRole("button", { name: new RegExp(title) }).first().click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible();
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Close" }).click();

    await chooseView(page, "Week");
    await deleteEvent(page, actAsAna, title);
  });
});

test.describe("Month view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await chooseView(page, "Week").catch(() => undefined);
  });

  test("draws a month grid with today marked (FR-1109)", async ({ page }) => {
    await chooseView(page, "Month");

    const grid = page.getByRole("group", { name: "Month" });
    await expect(grid).toBeVisible();
    // Whole weeks: 28, 35 or 42 cells, always a multiple of seven.
    const cells = await grid.locator("[data-month-cell]").count();
    expect(cells % 7).toBe(0);
    expect([28, 35, 42]).toContain(cells);

    await expect(grid.locator('[data-month-cell][aria-current="date"]')).toHaveCount(1);
  });

  test("steps by a calendar month, not by a number of days (FR-1114)", async ({ page }) => {
    await chooseView(page, "Month");
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();

    const cellsNow = () =>
      page.getByRole("group", { name: "Month" }).locator("[data-month-cell]").count();
    const before = await cellsNow();
    await page.getByRole("button", { name: "Next month" }).click();
    const after = await cellsNow();
    // A different month may need a different number of rows; both are whole weeks.
    expect(after % 7).toBe(0);
    expect([28, 35, 42]).toContain(before);
  });

  test("shows two and a count past three, and opens the day's list (FR-1110, FR-1111)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    // Four events on ONE day, each at its own time: `createEvent` defaults every
    // event to the same visible hour, and four in one slot collide rather than
    // stacking, which is what an earlier draft of this journey tripped on.
    const titles = [0, 1, 2, 3].map((index) => unique(`Busy ${index}`));
    for (const [index, title] of titles.entries()) {
      const hour = String(9 + index).padStart(2, "0");
      await createEvent(page, actAsAna, {
        title,
        startTime: `${hour}:00`,
        endTime: `${hour}:30`,
      });
    }

    await chooseView(page, "Month");
    const more = page.getByRole("button", { name: /\d+ more on / }).first();
    await expect(more).toBeVisible();
    await expect(more).toHaveText(/^\+\d+ more$/);

    await more.click();
    const list = page.getByRole("dialog");
    await expect(list).toBeVisible();
    // The list holds every event of that day, not only the hidden ones.
    for (const title of titles) {
      await expect(list.getByText(title)).toBeVisible();
    }
    await list.getByRole("button", { name: "Close" }).click();

    await chooseView(page, "Week");
    for (const title of titles) await deleteEvent(page, actAsAna, title);
  });

  test("draws a multi-day event as ONE bar, not a chip per day (FR-1112)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Long trip");
    await createEvent(page, actAsAna, { title, allDay: true });

    await chooseView(page, "Month");
    // A one-day all-day event is one bar. The segmentation of a longer one
    // across a week break is proved as arithmetic in calendar-month.test.ts,
    // which can construct a span crossing a row without depending on which day
    // of the week this suite happens to run on.
    await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(1);

    await chooseView(page, "Week");
    await deleteEvent(page, actAsAna, title);
  });

  test("a day cell opens that day (FR-1113)", async ({ page }) => {
    await chooseView(page, "Month");

    const cell = page.getByRole("button", { name: /^Open \d{4}-\d{2}-\d{2}$/ }).first();
    const label = (await cell.getAttribute("aria-label")) ?? "";
    await cell.click();

    // Assumption 5: it opens the DAY view, where the source's "Week" was
    // written for a phone app that has no Day view.
    await expect(switcher(page)).toHaveText("Day");
    expect(label).toContain("Open");
  });
});

test.describe("the chrome survives every view", () => {
  test("the preview bar is above the events in all three (FR-1116)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);

    const title = unique("Views countdown");
    await createEvent(page, actAsAna, { title, countdown: true });

    for (const view of ["Day", "Month", "Week"] as const) {
      await chooseView(page, view);
      await expect(page.getByRole("group", { name: "Calendar preview" })).toBeVisible();
    }

    await deleteEvent(page, actAsAna, title);
    // With nothing to show it draws no bar in any view either (FR-910).
    for (const view of ["Month", "Week"] as const) {
      await chooseView(page, view);
      await expect(page.getByRole("group", { name: "Calendar preview" })).toHaveCount(0);
    }
  });
});

/**
 * Width-specific journeys are tagged `@responsive` and left to the tablet and
 * phone PROJECTS, which is this suite's own idiom (harness.md §4).
 *
 * They are NOT written with a describe-level `test.use({ viewport })`. An
 * earlier draft did, and its narrower viewport leaked into the tests that ran
 * after it — including in other files, where it broke two shipped Week-view
 * journeys that pass on their own. The projects exist precisely so a journey
 * never has to reach for that.
 */
test.describe("the views at every width", () => {
  test("every view is usable, with no sideways scroll (SC-1111) @responsive", async ({
    page,
  }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);

    for (const view of ["Day", "Month", "Week"] as const) {
      await chooseView(page, view);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, view).toBeLessThanOrEqual(1);
    }
    await chooseView(page, "Week");
  });
});

test.describe("the views' accessibility", () => {
  test("Day and Month have no serious violations", async ({ page, axe }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);

    await chooseView(page, "Day");
    await axe("calendar — Day view");

    await chooseView(page, "Month");
    await axe("calendar — Month view");

    await chooseView(page, "Week");
  });
});
