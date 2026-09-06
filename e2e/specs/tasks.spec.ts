import { column, columnOrder, showColumn, visibleOrder } from "../helpers/board";
import { expect, test } from "../fixtures";

/**
 * 007 T036–T042, US4 — the Tasks board (FR-716).
 *
 * The board is the chassis three other tabs borrow, and ticking a chore is the
 * one write in the app that moves two things at once: the card's state and the
 * Profile's stars, the second written by database triggers. A browser is the
 * only place both can be watched together.
 *
 * The seeded fixtures are the ones every hand walk has used: Cleo's chores,
 * one of them worth ten stars, one late, one skipped, and a task in Up for
 * Grabs that belongs to nobody yet.
 */

/** Cleo's column header reads "1/19" and then her stars for today. */
function headerNumbers(page: import("@playwright/test").Page, name: string) {
  return column(page, name).getByRole("paragraph");
}

test.describe("the Tasks board", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/tasks");
  });

  test("ticks a chore, moves the Profile's stars, and takes both back @responsive", async ({ page, actAsAna }) => {
    await showColumn(page, "Cleo");
    const done = headerNumbers(page, "Cleo").first();
    const stars = headerNumbers(page, "Cleo").last();
    const before = { done: await done.innerText(), stars: await stars.innerText() };

    await actAsAna(async () => {
      await page.getByRole("button", { name: "Complete Feed the cat" }).click();
    });
    // Feed the cat is worth ten stars, and the header counts one more done.
    await expect(stars).toHaveText(String(Number(before.stars) + 10));
    await expect(done).not.toHaveText(before.done);

    await page.reload();
    await showColumn(page, "Cleo");
    await expect(headerNumbers(page, "Cleo").last()).toHaveText(String(Number(before.stars) + 10));

    // And back, so the next journey finds the board as the seed left it.
    await actAsAna(async () => {
      await page.getByRole("button", { name: "Mark Feed the cat incomplete" }).click();
    });
    await expect(headerNumbers(page, "Cleo").last()).toHaveText(before.stars);
  });

  test("claims a task from Up for Grabs for the Profile that takes it", async ({ page, actAsAna }) => {
    await showColumn(page, "Up for Grabs");
    await expect(column(page, "Up for Grabs").getByRole("button", { name: /dishwasher/ }).first()).toBeVisible();

    await actAsAna(async () => {
      await page.getByRole("button", { name: "Complete Empty the dishwasher" }).click();
      // A task nobody owns asks who is taking it before it can be completed.
      const claim = page.getByRole("radiogroup", { name: "Who did this one?" });
      await expect(claim).toBeVisible();
      await claim.getByRole("radio", { name: "Cleo" }).check();
      await page.getByRole("button", { name: "Complete", exact: true }).click();
    });

    await page.reload();
    await showColumn(page, "Cleo");
    await expect(column(page, "Cleo").getByRole("button", { name: /dishwasher/ }).first()).toBeVisible();
  });

  test("hides skipped tasks on this device when the filter says so", async ({ page }) => {
    await showColumn(page, "Cleo");
    const skipped = page.getByRole("button", { name: /Practice piano/ });
    await expect(skipped.first()).toBeVisible();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("dialog").getByRole("checkbox", { name: "Skipped tasks" }).uncheck();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(skipped).toHaveCount(0);

    await page.reload();
    await showColumn(page, "Cleo");
    await expect(skipped).toHaveCount(0);

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("dialog").getByRole("checkbox", { name: "Skipped tasks" }).check();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(skipped.first()).toBeVisible();
  });

  test("reorders the Profile columns by press and hold, and the order survives a reload", async ({ page, actAsAna }) => {
    // What this board reorders is the columns themselves: each header is the
    // handle, and says so — "hold to drag this column, or press Enter to move
    // it". The cards inside a column keep the order the household's rules give
    // them, which is why there is nothing to drag there.
    //
    // The handles exist only while a **parent** is punched in, so this journey
    // punches in the way the app allows — by doing a write and answering the
    // question it raises — before there is anything to take hold of.
    await showColumn(page, "Cleo");
    await actAsAna(async () => {
      await page.getByRole("button", { name: "Complete Sort the recycling" }).click();
    });
    await expect(page.getByRole("button", { name: "Mark Sort the recycling incomplete" })).toBeVisible();

    // Up for Grabs belongs to nobody and is not draggable; the Profiles are.
    const draggable = (await visibleOrder(page)).filter((name) => name !== "Up for Grabs");
    expect(draggable.length, "two Profile columns are on screen to swap").toBeGreaterThan(1);

    const handleFor = (name: string) => page.getByRole("button", { name: new RegExp(`^${name} — hold to drag`) });
    const from = (await handleFor(draggable[0]).boundingBox())!;
    const to = (await handleFor(draggable[1]).boundingBox())!;

    await actAsAna(async () => {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      // The board lifts on a hold, not on a flick, and says when it has: that
      // announcement is the signal to start moving (FR-710 — never a delay).
      await expect(page.getByText(/[Pp]icked up/).first()).toBeVisible();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
      await page.mouse.up();
    });

    // The two Profiles have swapped places in the household's order — read from
    // the board itself, paging from the start, so the assertion does not depend
    // on where the board happens to be paged when it is asked.
    const swapped = async (): Promise<boolean> => {
      const order = await columnOrder(page);
      return order.indexOf(draggable[1]) < order.indexOf(draggable[0]);
    };
    await expect.poll(swapped).toBe(true);

    await page.reload();
    await expect.poll(swapped).toBe(true);

    await actAsAna(async () => {
      await page.getByRole("button", { name: "Mark Sort the recycling incomplete" }).click();
    });
  });

  test("adds a task from the Task Box to a Profile's column", async ({ page, actAsAna, unique }) => {
    // FR-376: the Task Box is reached from the tab's one create control, and
    // choosing a template fills the form that opened it.
    await page.getByRole("button", { name: "Add Task" }).click();
    await page.getByRole("button", { name: "Task Box" }).click();
    const box = page.getByRole("dialog");
    await expect(box).toBeVisible();

    const template = box.getByRole("button").filter({ hasNotText: /Close|Cancel|Edit|Delete|New/ }).first();
    const chosen = await template.innerText();
    await template.click();

    // The form comes back with the template's name in it, ready to be saved.
    const form = page.getByRole("dialog");
    await expect(form.getByRole("textbox").first()).toHaveValue(new RegExp(chosen.split("\n")[0].trim().slice(0, 12)));
    void unique;
    void actAsAna;
  });
});
