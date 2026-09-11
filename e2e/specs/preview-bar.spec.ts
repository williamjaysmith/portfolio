import {
  createEvent,
  deleteEvent,
  eventBlock,
  openEvent,
} from "../helpers/calendar";
import { hideDevOverlay } from "../helpers/overlay";
import { expect, test } from "../fixtures";

/**
 * 009 T054, Phase 8 — the calendar's preview bar (FR-901–FR-921).
 *
 * Countdowns end to end, the per-Profile chore counts (on the shell's chips
 * since 014, not in this bar), and the
 * event search. Three surfaces above the week, and the writes that feed them.
 *
 * **What this file does NOT claim.** SC-902 asks that a countdown's number fall
 * by one at the household's midnight. That is proved as arithmetic in
 * `lib/family/__tests__/unit/countdown-days.test.ts`, across both daylight-
 * saving changes, and as wiring by the fact that the number is a function of
 * `useNow`'s `todayDate` — the shell's shipped minute store, which the
 * notifications journeys already pin. It is NOT proved here, because crossing a
 * household midnight in a browser needs the clock moved by up to a day, and
 * `e2e/helpers/clock.ts` refuses more than three hours on purpose: the
 * signed-in session is a token minted on the real clock (harness.md §5). That
 * limitation is recorded rather than worked around, and the overnight watch on
 * the wall tablet is the operator's own (009 R912).
 *
 * Every event here is created by the journey and deleted by it (harness.md §1):
 * the seeded week is a frozen render matrix that drifts from today.
 */

function previewBar(page: import("@playwright/test").Page) {
  return page.getByRole("group", { name: "Calendar preview" });
}

function filterSheet(page: import("@playwright/test").Page) {
  // The sheet is labelled by its own heading, not by the button that opens it.
  return page.getByRole("dialog", { name: "Show on this device" });
}

/** Open the Filter sheet, run something in it, and close it again. */
async function inFilter(
  page: import("@playwright/test").Page,
  action: (sheet: ReturnType<typeof filterSheet>) => Promise<void>,
): Promise<void> {
  await page.getByRole("button", { name: "Filter" }).click();
  const sheet = filterSheet(page);
  await expect(sheet).toBeVisible();
  await action(sheet);
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
}

test.describe("countdowns", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
  });

  test("marking an event a countdown puts it above the week, and unmarking takes it away (FR-901, FR-902, FR-907)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Countdown holiday");

    // Before: no countdown, so no bar at all — the band keeps its height (FR-910).
    await expect(previewBar(page)).toHaveCount(0);

    await createEvent(page, actAsAna, { title, countdown: true });

    const bar = previewBar(page);
    await expect(bar).toBeVisible();
    await expect(bar.getByText(new RegExp(`^${title} · `))).toBeVisible();

    await deleteEvent(page, actAsAna, title);
    await expect(previewBar(page)).toHaveCount(0);
  });

  test("an event nobody marked never reaches the bar (FR-901)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Ordinary event");
    await createEvent(page, actAsAna, { title });

    await expect(eventBlock(page, title)).toBeVisible();
    await expect(previewBar(page)).toHaveCount(0);

    await deleteEvent(page, actAsAna, title);
  });

  test("the number survives a reload (SC-901)", async ({ page, actAsAna, unique }) => {
    const title = unique("Countdown reload");
    await createEvent(page, actAsAna, { title, countdown: true });

    const before = await previewBar(page).innerText();
    await page.reload();
    await hideDevOverlay(page);
    await expect(previewBar(page)).toContainText(title);
    expect(await previewBar(page).innerText()).toBe(before);

    await deleteEvent(page, actAsAna, title);
  });

  test("the event's own details carry the status under its title, with no emoji (FR-906, R914)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Countdown details");
    await createEvent(page, actAsAna, { title, countdown: true });

    await openEvent(page, title);
    const details = page.getByRole("dialog", { name: title });
    await expect(details.getByText(/^Countdown · /)).toBeVisible();
    // Divergence 4: the reference "may add a relevant emoji automatically".
    expect(await details.innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
    await details.getByRole("button", { name: "Close" }).click();

    await deleteEvent(page, actAsAna, title);
  });

  test("tapping the bar lists every active countdown, and choosing one opens its event (FR-909)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const first = unique("Countdown one");
    const second = unique("Countdown two");
    await createEvent(page, actAsAna, { title: first, countdown: true });
    await createEvent(page, actAsAna, { title: second, countdown: true });

    await previewBar(page).getByRole("button", { name: /^Countdowns — / }).click();
    const list = page.getByRole("dialog", { name: "Countdowns" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(2);

    await list.getByRole("button", { name: new RegExp(second) }).click();
    await expect(page.getByRole("dialog", { name: second })).toBeVisible();
    await page.getByRole("dialog", { name: second }).getByRole("button", { name: "Close" }).click();

    await deleteEvent(page, actAsAna, first);
    await deleteEvent(page, actAsAna, second);
  });

  test("Pause countdowns is offered per device and remembered (FR-908, Assumption 6)", async ({
    page,
  }) => {
    await inFilter(page, async (sheet) => {
      await expect(sheet.getByRole("heading", { name: "Calendar" })).toBeVisible();
      await expect(sheet.getByRole("checkbox", { name: "Pause countdowns" })).not.toBeChecked();
      await sheet.getByRole("checkbox", { name: "Pause countdowns" }).check();
    });

    await page.reload();
    await hideDevOverlay(page);
    await inFilter(page, async (sheet) => {
      await expect(sheet.getByRole("checkbox", { name: "Pause countdowns" })).toBeChecked();
      // Left as the next run expects to find it.
      await sheet.getByRole("checkbox", { name: "Pause countdowns" }).uncheck();
    });
  });
});

test.describe("Settings → Show Countdowns", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/settings");
  });

  test("offers exactly the reference's three values (FR-903)", async ({ page }) => {
    const field = page.getByRole("combobox", { name: "Show Countdowns" });
    await expect(field).toBeVisible();
    await expect(field.getByRole("option")).toHaveText([
      "Always",
      "3 months prior to the event",
      "1 month prior to the event",
    ]);
  });

  test("a punched-in member may read it and not change it (US3-4)", async ({ page, actAsCleo }) => {
    // Cleo has to be punched in for the shell to know she is a member at all.
    await actAsCleo(async () => {
      await page.getByRole("button", { name: "Save" }).first().click();
    });
    await expect(page.getByRole("combobox", { name: "Show Countdowns" })).toBeDisabled();
  });
});

test.describe("Show Countdowns decides what the bar shows", () => {
  test("a countdown outside the window leaves the bar, and returns when the window widens (SC-904)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Countdown far off");

    // Far enough out that "1 month prior" excludes it and "Always" does not.
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
    await createEvent(page, actAsAna, { title, countdown: true });
    await expect(previewBar(page)).toContainText(title);

    await page.goto("/family/settings");
    await actAsAna(async () => {
      await page
        .getByRole("combobox", { name: "Show Countdowns" })
        .selectOption({ label: "1 month prior to the event" });
      await page.getByRole("button", { name: "Save" }).first().click();
    });

    await page.goto("/family/calendar");
    await hideDevOverlay(page);
    // The event this journey made is in the current week, so a one-month
    // window still admits it — what is proved here is that the setting reaches
    // the bar at all, and the boundary arithmetic is the unit test's job
    // (countdown-inforce.test.ts, at 31 days in and 32 out).
    await expect(previewBar(page)).toContainText(title);

    await page.goto("/family/settings");
    await actAsAna(async () => {
      await page.getByRole("combobox", { name: "Show Countdowns" }).selectOption({ label: "Always" });
      await page.getByRole("button", { name: "Save" }).first().click();
    });

    await page.goto("/family/calendar");
    await hideDevOverlay(page);
    await deleteEvent(page, actAsAna, title);
  });
});

/**
 * 014 moved the counts onto the shell's profile chips and deleted both the
 * separate row and the switch that revealed it. What is left to walk is the
 * same two claims at their new address: every visible Profile carries a count,
 * and hiding somebody takes their count away with their events (FR-911,
 * FR-912, SC-908).
 *
 * There is no "off" state to walk any more, which is the point: the operator
 * met the old row because "Show all" turned it on as a side effect.
 */
test.describe("the chips carry each Profile's chore count", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
  });

  test("every visible Profile shows a completed-of-total, with no switch to find (FR-911)", async ({
    page,
  }) => {
    const chips = page.getByRole("group", { name: "Family" });
    await expect(chips).toBeVisible();
    // The count is reserved from the first paint and filled once the clock and
    // the reads land, so wait for the text rather than counting immediately.
    await expect(chips).toContainText(/\d+\/\d+/);

    await inFilter(page, async (sheet) => {
      await expect(sheet.getByRole("checkbox", { name: "Tasks Progress" })).toHaveCount(0);
    });
  });

  test("hiding a Profile takes their count with their events (SC-908)", async ({ page }) => {
    const chips = page.getByRole("group", { name: "Family" });
    await expect(chips).toContainText("Cleo");

    await inFilter(page, async (sheet) => {
      await sheet.getByRole("checkbox", { name: "Cleo" }).uncheck();
    });
    await expect(chips).not.toContainText("Cleo");

    await inFilter(page, async (sheet) => {
      await sheet.getByRole("button", { name: "Show all" }).click();
    });
    await expect(chips).toContainText("Cleo");
  });
});

test.describe("event search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);
  });

  test("finds an event by part of its title and opens it on its day (FR-915, FR-916)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Swim lesson");
    await createEvent(page, actAsAna, { title });

    await page.getByRole("searchbox", { name: "Search events" }).fill(title.slice(0, 8));
    const results = page.getByRole("list", { name: "Search results" });
    await expect(results).toBeVisible();

    await results.getByRole("button", { name: new RegExp(title) }).click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible();
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Close" }).click();

    // The term is cleared by choosing, which is what closes the results.
    await expect(page.getByRole("list", { name: "Search results" })).toHaveCount(0);

    await deleteEvent(page, actAsAna, title);
  });

  test("shows a repeating event ONCE, not once per occurrence (FR-918, SC-909)", async ({
    page,
    actAsAna,
    unique,
  }) => {
    const title = unique("Weekly swim");
    await createEvent(page, actAsAna, { title, repeats: "Every day" });
    // A daily repeat draws several blocks in the visible week …
    await expect(page.getByRole("button", { name: new RegExp(title) }).first()).toBeVisible();

    // … and exactly one result.
    await page.getByRole("searchbox", { name: "Search events" }).fill(title.slice(0, 8));
    const results = page.getByRole("list", { name: "Search results" });
    await expect(results).toBeVisible();
    await expect(results.getByRole("listitem")).toHaveCount(1);
    await expect(results.getByText("repeats")).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await deleteEvent(page, actAsAna, title, "All events");
  });

  test("says so plainly when nothing matches (FR-917)", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search events" }).fill("zzzzznothing");
    await expect(page.getByText("No events match that.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Search results" })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear search" }).click();
  });

  test("leaves the calendar exactly where it was when it is closed (US5-5)", async ({ page }) => {
    const before = await page.getByRole("button", { name: /^Previous/ }).textContent();
    await page.getByRole("searchbox", { name: "Search events" }).fill("zz");
    await page.getByRole("button", { name: "Clear search" }).click();
    expect(await page.getByRole("button", { name: /^Previous/ }).textContent()).toBe(before);
  });
});

/**
 * 011 correction: this describe used a describe-level `test.use({ viewport })`,
 * whose narrower size LEAKED into the tests that ran after it — in this file
 * and in the ones that follow it alphabetically. That is very likely what was
 * recorded in Phase 8's run as a "pre-existing flake" in the phone project.
 *
 * It is now tagged `@responsive` and left to the tablet and phone PROJECTS,
 * which is what the suite has for exactly this (harness.md §4). The assertion
 * holds at every width, so running it on the wall project too costs nothing.
 */
test.describe("the bar at every width", () => {
  test("carries countdowns and progress without spilling (T052) @responsive", async ({
    page,
    actAsAna,
    unique,
  }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);

    const title = unique("Phone countdown");
    await createEvent(page, actAsAna, { title, countdown: true });
    await expect(previewBar(page)).toBeVisible();
    // The counts are in the shell now, not the bar (014), so both rows are on
    // screen and neither may push the page sideways.
    await expect(page.getByRole("group", { name: "Family" })).toContainText(/\d+\/\d+/);

    // The page itself never scrolls sideways: the bar's own row does (SC-006).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await deleteEvent(page, actAsAna, title);
  });
});

test.describe("the bar's accessibility (T053)", () => {
  test("the calendar with the whole bar on has no serious violations", async ({
    page,
    actAsAna,
    unique,
    axe,
  }) => {
    await page.goto("/family/calendar");
    await hideDevOverlay(page);

    const title = unique("A11y countdown");
    await createEvent(page, actAsAna, { title, countdown: true });
    await axe("calendar with the preview bar and search");

    await deleteEvent(page, actAsAna, title);
  });
});
