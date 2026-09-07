import { optionLabel } from "../helpers/controls";
import { expect, test } from "../fixtures";

/**
 * 007 T048–T055, US6 — the Meals tab and its tokens on the calendar
 * (FR-719, FR-720).
 *
 * The newest code in the app, and the only surfaces mounted by two different
 * pages: the popover a meal chip opens on the grid is the same popover a token
 * opens on the Week calendar. A browser is the only place that claim can be
 * checked.
 *
 * The seed leaves four mealtimes, seven recipes (one removed from the library
 * but still planned) and this week's meals, including a Friday pizza that
 * repeats weekly.
 */

/**
 * One day's slot. Empty it is a button — "Sunday 6 September, Lunch, empty" —
 * and filled it is a group of the meals in it, named the same way. Journeys
 * always work inside a slot: several days can hold the same recipe, and the
 * seed plans Banana bread on the Saturday.
 */
function emptyCell(page: import("@playwright/test").Page, day: string, mealtime: string) {
  return page.getByRole("button", { name: new RegExp(`^${day}.*${mealtime}, empty`) });
}

function filledCell(page: import("@playwright/test").Page, day: string, mealtime: string) {
  return page.getByRole("group", { name: new RegExp(`^${day}.*${mealtime}`) });
}

test.describe("the Meals tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/meals");
  });

  test("plans a meal from a saved recipe, and it survives a reload @responsive", async ({ page, actAsAna, household }) => {
    const today = household.todayLabel;
    expect(today, "the grid marks one day as today").not.toBe("");

    await actAsAna(async () => {
      await emptyCell(page, today, "Lunch").click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      // The chips and rows are painted labels over screen-reader-only radios.
      await optionLabel(page, sheet, "All").click();
      await optionLabel(page, sheet, "Banana bread").click();
      await sheet.getByRole("button", { name: "Save" }).click();
    });

    const slot = filledCell(page, today, "Lunch");
    await expect(slot.getByRole("button", { name: "Banana bread" })).toBeVisible();

    await page.reload();
    await expect(filledCell(page, today, "Lunch").getByRole("button", { name: "Banana bread" })).toBeVisible();

    // Take it back off the plan, from the popover this journey also proves.
    await actAsAna(async () => {
      await filledCell(page, today, "Lunch").getByRole("button", { name: "Banana bread" }).click();
      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("button", { name: "Delete meal" }).click();
    });
    // The slot is a button again once the write lands; reloading first would
    // cancel it. The Saturday's seeded Banana bread is untouched throughout.
    await expect(emptyCell(page, today, "Lunch")).toBeVisible();

    await page.reload();
    await expect(emptyCell(page, today, "Lunch")).toBeVisible();
  });

  test("opens a meal's popover and reaches its recipe from there", async ({ page }) => {
    await page.getByRole("button", { name: "🍝 Spaghetti" }).first().click();
    const popover = page.getByRole("dialog", { name: "🍝 Spaghetti" });
    await expect(popover).toBeVisible();
    for (const action of ["Open Recipe", "Add to List", "Edit", "Delete"]) {
      await expect(popover.getByRole("button", { name: action })).toBeVisible();
    }

    await popover.getByRole("button", { name: "Open Recipe" }).click();
    const detail = page.getByRole("article", { name: "🍝 Spaghetti" });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("parmesan");
  });

  test("filters and searches the recipes pane", async ({ page }) => {
    await page.getByRole("button", { name: "Recipes" }).click();
    const pane = page.getByRole("dialog", { name: "Recipes" });
    const listed = pane.getByRole("list", { name: "Recipes" }).getByRole("button");

    await expect(listed).not.toHaveCount(0);
    await optionLabel(page, pane, "Breakfast").click();
    await expect(listed.first()).toContainText("Pancakes");

    await optionLabel(page, pane, "All").click();
    await pane.getByRole("searchbox", { name: "Search recipes" }).fill("parmesan");
    await expect(listed).toHaveCount(1);
    await expect(listed.first()).toContainText("Spaghetti");

    // A recipe removed from the library is not offered, though meals keep it.
    await pane.getByRole("searchbox", { name: "Search recipes" }).fill("stew");
    await expect(pane.getByText("No recipes match.")).toBeVisible();
  });

  test("pushes a recipe's chosen lines onto a list, and the Lists tab has them", async ({ page, actAsAna }) => {
    await page.getByRole("button", { name: "🍝 Spaghetti" }).first().click();
    await page.getByRole("button", { name: "Add to List" }).click();

    const sheet = page.getByRole("dialog", { name: /Add 🍝 Spaghetti to a list/ });
    await expect(sheet).toBeVisible();
    // The instructions are unticked; only the ingredients travel.
    for (const line of ["Soften the onion and garlic.", "Add the tomatoes, simmer 20 min.", "Toss with the pasta."]) {
      await sheet.getByRole("checkbox", { name: line }).uncheck();
    }
    await sheet.getByRole("combobox", { name: "List" }).selectOption({ label: "Grocery List" });

    await actAsAna(async () => {
      await sheet.getByRole("button", { name: "Save" }).click();
    });
    await expect(page.getByText(/items added to Grocery List/)).toBeVisible();

    await page.goto("/family/lists");
    const grocery = page.getByRole("region", { name: "Grocery List", exact: true });
    await expect(grocery.getByRole("checkbox", { name: "500 g spaghetti" })).toBeVisible();
    await expect(grocery.getByRole("checkbox", { name: "parmesan" })).toBeVisible();
    await expect(grocery.getByRole("checkbox", { name: "Toss with the pasta." })).toHaveCount(0);
  });

  test("asks the scope before changing a repeating meal, and keeps the rest of the series", async ({ page, actAsAna }) => {
    const pizza = page.getByRole("button", { name: "🍕 Pizza" });
    await expect(pizza.first()).toBeVisible();

    await pizza.first().click();
    await page.getByRole("dialog", { name: "🍕 Pizza" }).getByRole("button", { name: "Edit" }).click();

    // A repeating meal asks first, in its own words.
    await expect(page.getByRole("heading", { name: "Edit repeating meal" })).toBeVisible();
    await page.getByRole("radio", { name: "This meal" }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    const sheet = page.getByRole("dialog", { name: "Edit meal" });
    await actAsAna(async () => {
      await sheet.getByRole("textbox", { name: /Note/ }).fill("Only this Friday");
      await sheet.getByRole("button", { name: "Save" }).click();
    });
    await expect(sheet).toBeHidden();

    await page.reload();
    // The note lands on that one occurrence and on no other. Next week's Pizza
    // is the seed's skipped one, so the week after is where the series shows
    // again — moved to its Saturday by the seeded exception.
    await expect(page.getByRole("button", { name: "🍕 Pizza" }).first()).toHaveAttribute("title", "Only this Friday");
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("button", { name: "🍕 Pizza" })).toHaveCount(0);
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("button", { name: "🍕 Pizza" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "🍕 Pizza" }).first()).not.toHaveAttribute("title", "Only this Friday");
  });

  test("shows the week's meals on the calendar, and hides them on this device @responsive", async ({ page }) => {
    await page.goto("/family/calendar");
    const tokens = page.getByRole("list", { name: "Meals" });
    await expect(tokens).toBeVisible();
    // A token is named by its mealtime and its meal, and opens the same popover.
    await tokens.getByRole("button", { name: "Dinner: 🍝 Spaghetti" }).click();
    await expect(page.getByRole("dialog", { name: "🍝 Spaghetti" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("dialog").getByRole("checkbox", { name: "Show Meals on the calendar" }).uncheck();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("list", { name: "Meals" })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("list", { name: "Meals" })).toHaveCount(0);

    // The Meals tab itself is untouched by a switch that belongs to this device.
    await page.goto("/family/meals");
    await expect(page.getByRole("button", { name: "🍝 Spaghetti" }).first()).toBeVisible();

    await page.goto("/family/calendar");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("button", { name: "Show all" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("list", { name: "Meals" })).toBeVisible();
  });
});
