import { showColumn, strip, swipeBoard } from "../helpers/board";
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

  test("reaches every list on a narrow screen, one card at a time @responsive", async ({ page }) => {
    // 005 FR-502/FR-543. On a phone one card fills the width and the rest are
    // reached by paging — which means the pager must actually BE there. The
    // household reported seeing Grocery List on an iPhone with no way to get to
    // To-Do List at all, and no journey had ever paged this board: the only
    // @responsive journey here adds an item and clears it, which one card is
    // enough for.
    await expect(list(page, "Grocery List")).toBeVisible();

    // Whatever the width, every list the household owns must be reachable.
    for (const name of ["To-Do List", "Packing List"]) {
      await showColumn(page, name, "Lists");
      await expect(list(page, name)).toBeVisible();
    }

    // And back again, so paging is not one-way.
    await showColumn(page, "Grocery List", "Lists");
    await expect(list(page, "Grocery List")).toBeVisible();
  });

  test("pages by a finger, not only by the arrow keys @responsive", async ({ page }, testInfo) => {
    // `showColumn` pages with ArrowRight, so every earlier journey proved the
    // pager existed while a real iPhone could not move at all. This one uses the
    // pan handlers.
    //
    // BE CLEAR ABOUT WHAT IT CANNOT DO: it passes with and without the
    // `touch-action` fix, because Playwright's synthetic pointer events are not
    // subject to the browser's touch-action arbitration at all. The assertion
    // in the journey below is what actually guards the regression.
    //
    // **And on a TOUCH project it cannot do even that (012).** `swipeBoard`
    // drives `page.mouse`, and on the two WebKit touch profiles — `iPhone 13`
    // and `Desktop Safari` with `hasTouch` — those synthetic mouse pans never
    // reach framer's `onPan`, so this journey failed 3/3 on `phone` while
    // passing on `wall`. CDP touch injection would fix it and is Chromium-only,
    // which these profiles are not.
    //
    // So it is SKIPPED there, with the reason printed, rather than left red or
    // quietly deleted. What it would have proved is covered three other ways,
    // and one of them is the bug that actually hit the household's iPhone:
    //
    //   - `lib/family/__tests__/unit/swipe.test.ts` — the axis lock and the
    //     48px commit threshold, nine cases;
    //   - the next journey in this file — `touch-action: pan-y` asserted
    //     directly, which is the property iOS Safari breaks;
    //   - every other lists journey — the keyboard equivalent, on every project.
    //
    // This is a skip with a named tool limitation behind it. 012 removed a
    // DIFFERENT kind of skip — one that claimed an environment could not do
    // something it could — and the difference is that this reason is checkable.
    test.skip(
      testInfo.project.use.hasTouch === true,
      "Playwright's synthetic mouse pans do not reach framer's onPan on a WebKit " +
        "touch profile; the gesture's logic is unit-tested and touch-action is asserted next door",
    );

    await expect(list(page, "Grocery List")).toBeVisible();
    if ((await strip(page, "Lists").count()) === 0) return; // every list fits: nothing to page

    await swipeBoard(page, 1, "Lists");
    await expect(list(page, "To-Do List")).toBeVisible();

    await swipeBoard(page, -1, "Lists");
    await expect(list(page, "Grocery List")).toBeVisible();
  });

  test("leaves the horizontal gesture to the app on a touch screen @responsive", async ({ page }) => {
    // The one assertion in this suite that reads a computed STYLE rather than a
    // role and a name, and it is deliberate: on iOS Safari `touch-action` IS the
    // behaviour. Without `pan-y` the browser claims a horizontal drag for its own
    // scroll and overscroll gestures and framer's `onPan` never fires, so the
    // Lists tab — which has no arrows to fall back on — cannot be paged by a
    // finger at all. That is what the household hit on an iPhone.
    //
    // No gesture-driven journey can catch it, because a synthetic pointer event
    // bypasses that arbitration. So the property is asserted directly.
    if ((await strip(page, "Lists").count()) === 0) return;

    const touchAction = await strip(page, "Lists").evaluate(
      (node) => getComputedStyle(node).touchAction,
    );
    expect(touchAction, "the pager must leave horizontal pans to the app").toBe("pan-y");
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
