import { column, showColumn } from "../helpers/board";
import { expect, test } from "../fixtures";

/**
 * 007 T056–T057, US7 — two browsers on one household (FR-722, FR-725).
 *
 * Every shipped phase promised that a change made on one device reaches the
 * others within five seconds, and no test has ever checked it: the component
 * tests have one DOM and the policies tests have no browser at all.
 *
 * **A check this environment cannot run is a skip with its reason printed, not
 * a pass.** During Phases 5 and 6 the local stack never registered a browser's
 * live channel — a gap in the stack, not in the app — so the probe asks the
 * database whether any subscription exists once both pages are up, and says so
 * plainly when the answer is no.
 */

const ARRIVES_WITHIN = 5_000;

test.describe("two browsers, one household", () => {
  test("a change on one browser reaches the other, on every tab that writes", async ({
    page,
    secondBrowser,
    actAsAna,
    liveUpdates,
    unique,
  }) => {
    test.setTimeout(180_000);

    // Both browsers on the same tab, so both have mounted the live channel.
    await page.goto("/family/lists");
    await secondBrowser.goto("/family/lists");
    await expect(secondBrowser.getByRole("navigation", { name: "Primary" })).toBeVisible();

    test.skip(!liveUpdates.available, `live updates cannot be proved here: ${liveUpdates.reason}`);

    const item = unique("Live check");
    await showColumn(page, "Grocery List", "Lists");
    await showColumn(secondBrowser, "Grocery List", "Lists");

    await actAsAna(async () => {
      await column(page, "Grocery List")
        .getByRole("textbox", { name: "Add item to Grocery List" })
        .fill(item);
      await page.keyboard.press("Enter");
    });

    // The second browser is never reloaded: it either hears the change or it does not.
    await expect(
      column(secondBrowser, "Grocery List").getByRole("checkbox", { name: item }),
    ).toBeVisible({ timeout: ARRIVES_WITHIN });

    // And back out again, watched from the other side.
    await actAsAna(async () => {
      await column(page, "Grocery List").getByRole("button", { name: item }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    });
    await expect(
      column(secondBrowser, "Grocery List").getByRole("checkbox", { name: item }),
    ).toHaveCount(0, { timeout: ARRIVES_WITHIN });
  });

  test("a meal planned on one browser appears on the other's grid and calendar", async ({
    page,
    secondBrowser,
    actAsAna,
    liveUpdates,
    household,
  }) => {
    test.setTimeout(180_000);

    await page.goto("/family/meals");
    await secondBrowser.goto("/family/calendar");
    await expect(secondBrowser.getByRole("navigation", { name: "Primary" })).toBeVisible();

    test.skip(!liveUpdates.available, `live updates cannot be proved here: ${liveUpdates.reason}`);

    const today = household.todayLabel;
    await actAsAna(async () => {
      await page.getByRole("button", { name: new RegExp(`^${today}.*Snack, empty`) }).click();
      const sheet = page.getByRole("dialog");
      await sheet.locator("label").filter({ has: page.getByRole("radio", { name: "Banana bread", exact: true }) }).click();
      await sheet.getByRole("button", { name: "Save" }).click();
    });

    // The other browser is on the calendar: the meal arrives as a token there.
    await expect(
      secondBrowser.getByRole("list", { name: "Meals" }).getByRole("button", { name: "Snack: Banana bread" }),
    ).toBeVisible({ timeout: ARRIVES_WITHIN });

    await actAsAna(async () => {
      await page
        .getByRole("group", { name: new RegExp(`^${today}.*Snack`) })
        .getByRole("button", { name: "Banana bread" })
        .click();
      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("button", { name: "Delete meal" }).click();
    });
    await expect(
      secondBrowser.getByRole("list", { name: "Meals" }).getByRole("button", { name: "Snack: Banana bread" }),
    ).toHaveCount(0, { timeout: ARRIVES_WITHIN });
  });
});
