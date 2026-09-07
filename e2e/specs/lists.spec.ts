import { showColumn } from "../helpers/board";
import { expect, test } from "../fixtures";

/**
 * 007 T043–T047, US5 — the Lists tab (FR-718).
 *
 * The second press-and-hold surface in the app, and the home of its one
 * visibility promise: a Parents only list is on the board while a parent is
 * punched in and absent while a member is. That promise cannot be checked in a
 * simulated DOM, because it depends on who the session says is here.
 *
 * The seed leaves Grocery List with five items — one of them already checked —
 * a To-Do List, a Packing List, and Party, which is Parents only.
 */

function list(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

/**
 * The tick box a person presses. The checkbox itself is screen-reader only —
 * what is on screen is the styled box inside its label — so a journey presses
 * the label, exactly as a finger does.
 */
function tickBox(page: import("@playwright/test").Page, listName: string, item: string) {
  return list(page, listName)
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name: item }) });
}

test.describe("the Lists tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/lists");
  });

  test("adds an item, checks it off, and clears it with the rest @responsive", async ({ page, actAsAna, unique }) => {
    await showColumn(page, "Grocery List", "Lists");
    const item = unique("Oat milk");
    const card = list(page, "Grocery List");

    await actAsAna(async () => {
      await card.getByRole("textbox", { name: "Add item to Grocery List" }).fill(item);
      await page.keyboard.press("Enter");
    });
    await expect(card.getByRole("checkbox", { name: item })).toBeVisible();

    await page.reload();
    await showColumn(page, "Grocery List", "Lists");
    await expect(list(page, "Grocery List").getByRole("checkbox", { name: item })).toBeVisible();

    await actAsAna(async () => {
      await tickBox(page, "Grocery List", item).click();
    });
    await expect(list(page, "Grocery List").getByRole("checkbox", { name: item })).toBeChecked();

    // Clear Completed asks first — it takes away work nobody can get back.
    await list(page, "Grocery List").getByRole("button", { name: "Grocery List menu" }).click();
    await actAsAna(async () => {
      await page.getByRole("button", { name: /^Clear Completed/ }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: /^Clear \d+ item/ }).click();
    });
    // The card empties when the write lands; reloading first would cancel it.
    await expect(list(page, "Grocery List").getByRole("checkbox", { name: item })).toHaveCount(0);

    await page.reload();
    await showColumn(page, "Grocery List", "Lists");
    await expect(list(page, "Grocery List").getByRole("checkbox", { name: item })).toHaveCount(0);
    // The unchecked items are all still there.
    await expect(list(page, "Grocery List").getByRole("checkbox", { name: "🥚 Eggs" })).toBeVisible();
  });

  test("reorders two items by press and hold, and the order survives a reload", async ({ page, actAsAna }) => {
    await showColumn(page, "Grocery List", "Lists");
    const card = list(page, "Grocery List");
    const order = async (): Promise<string[]> =>
      card.getByRole("checkbox").evaluateAll((boxes) => boxes.map((box) => box.getAttribute("aria-label") ?? ""));

    const before = await order();
    expect(before.length, "the seeded Grocery List has items to move").toBeGreaterThan(1);

    const first = card.getByRole("checkbox", { name: before[0] });
    const second = card.getByRole("checkbox", { name: before[1] });
    const from = (await first.boundingBox())!;
    const to = (await second.boundingBox())!;

    await actAsAna(async () => {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      // The row lifts on a hold and says so; that is the signal to move it,
      // rather than any fixed wait (FR-710).
      await expect(page.getByText(/[Pp]icked up/).first()).toBeVisible();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height + 4, { steps: 10 });
      await page.mouse.up();
    });

    await expect.poll(order).not.toEqual(before);
    const after = await order();

    await page.reload();
    await showColumn(page, "Grocery List", "Lists");
    await expect.poll(async () => (await order()).slice(0, after.length)).toEqual(after);
  });

  test("keeps a Parents only list from a member", async ({ page, actAsAna, actAsCleo, unique }) => {
    const mark = unique("Balloons");
    // Nobody is punched in yet, so a Parents only list is not on the board at
    // all: it appears once a parent answers the question a write raises.
    await expect(page.getByRole("region", { name: "Party" })).toHaveCount(0);

    await showColumn(page, "Grocery List", "Lists");
    await actAsAna(async () => {
      await list(page, "Grocery List").getByRole("textbox", { name: "Add item to Grocery List" }).fill(mark);
      await page.keyboard.press("Enter");
    });
    await expect(page.getByRole("button", { name: "Punch out Ana" })).toBeVisible();

    await showColumn(page, "Party", "Lists");
    await expect(list(page, "Party")).toBeVisible();

    await page.getByRole("button", { name: "Punch out Ana" }).click();

    // With a member punched in instead, it is not on the board and no route the
    // interface offers reaches it.
    await showColumn(page, "Grocery List", "Lists");
    await actAsCleo(async () => {
      await tickBox(page, "Grocery List", mark).click();
    });
    await expect(page.getByRole("button", { name: "Punch out Cleo" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Party" })).toHaveCount(0);

    // Put the seed back: the item this journey made goes with it.
    await page.getByRole("button", { name: "Punch out Cleo" }).click();
    await actAsAna(async () => {
      await list(page, "Grocery List").getByRole("button", { name: mark }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    });
    await expect(list(page, "Grocery List").getByRole("checkbox", { name: mark })).toHaveCount(0);
  });
});
