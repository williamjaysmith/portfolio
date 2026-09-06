import { PINS, enterPin, punchSheet } from "../helpers/punch";
import { expect, test } from "../fixtures";

/**
 * 007 T024–T025, US2 — the punch-in gate (FR-714).
 *
 * Signing in opens the household's pages; it does not let anyone write. Every
 * write asks who is doing it, and the app asks at the moment of the write
 * rather than at the door — so these journeys start a write and answer the
 * question, which is exactly how the tab is used.
 */

test.describe("the punch-in gate", () => {
  test("asks who is here before a write, and lets it through once a PIN is entered @responsive", async ({ page }) => {
    await page.goto("/family/lists");

    // Any write will do; adding an item to a seeded list is the smallest.
    await page.getByRole("textbox", { name: "Add item to Grocery List" }).fill("Punch-in probe");
    await page.keyboard.press("Enter");

    await expect(punchSheet(page)).toBeVisible();
    await enterPin(page, "Ana", PINS.Ana);

    // The interrupted write finishes on its own.
    await expect(page.getByRole("button", { name: "Punch out Ana" })).toBeVisible();
    await expect(page.getByText("Punch-in probe")).toBeVisible();

    // Clean up after ourselves: this journey owns that row.
    await page.getByRole("button", { name: /Punch-in probe/ }).first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Punch out Ana" }).click();
  });

  test("refuses a wrong PIN and punches nobody in", async ({ page }) => {
    await page.goto("/family/lists");
    await page.getByRole("textbox", { name: "Add item to Grocery List" }).fill("Never saved");
    await page.keyboard.press("Enter");

    await expect(punchSheet(page)).toBeVisible();
    await punchSheet(page).getByRole("button", { name: "Ana", exact: true }).click();
    const pad = page.getByRole("dialog", { name: "Ana" });
    for (const digit of "9999") await pad.getByRole("button", { name: digit, exact: true }).click();

    await expect(page.getByText("That PIN isn't right.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Punch out/ })).toHaveCount(0);
  });

  test("offers only the Profiles that have a PIN, and says so about the rest", async ({ page }) => {
    await page.goto("/family/lists");
    await page.getByRole("textbox", { name: "Add item to Grocery List" }).fill("Never saved");
    await page.keyboard.press("Enter");

    const sheet = punchSheet(page);
    await expect(sheet.getByRole("button", { name: "Ana", exact: true })).toBeEnabled();
    await expect(sheet.getByRole("button", { name: "Cleo", exact: true })).toBeEnabled();
    // The seed sets no others; the sheet says why each cannot be chosen.
    await expect(sheet.getByRole("button", { name: "Alex no PIN" })).toBeDisabled();
    await expect(sheet.getByRole("button", { name: "Ben no PIN" })).toBeDisabled();
  });

  test("punches out, and the next write asks again", async ({ page, actAsAna }) => {
    await page.goto("/family/lists");

    await actAsAna(async () => {
      await page.getByRole("textbox", { name: "Add item to Grocery List" }).fill("Second probe");
      await page.keyboard.press("Enter");
    });
    await expect(page.getByText("Second probe")).toBeVisible();

    await page.getByRole("button", { name: "Punch out Ana" }).click();
    await expect(page.getByRole("button", { name: /^Punch out/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Second probe/ }).first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(punchSheet(page)).toBeVisible();

    // Finish the delete so the journey leaves nothing behind.
    await enterPin(page, "Ana", PINS.Ana);
    await expect(page.getByText("Second probe")).toHaveCount(0);
  });
});
