import { createEvent, deleteEvent, eventBlock, openEvent, stopFollowingTheClock } from "../helpers/calendar";
import { expect, test } from "../fixtures";

/**
 * 007 T027–T035, US3 — the Week calendar (FR-715).
 *
 * The largest surface in the app and the home of its most fragile interaction:
 * a pointer drag that turns a position on screen into a time and then asks a
 * question about a series. None of that survives in a simulated DOM.
 *
 * Every journey makes the events it needs in the current week and removes them
 * (harness.md §1), so none depends on the frozen render-matrix week.
 */

test.describe("the Week calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
  });

  test("creates an event from the shell's control, and it survives a reload @responsive", async ({ page, actAsAna, unique }) => {
    const title = unique("Swimming");
    await createEvent(page, actAsAna, { title, startTime: "14:00", endTime: "15:00", profile: "Cleo" });

    await page.reload();
    await expect(eventBlock(page, title)).toBeVisible();
    await expect(eventBlock(page, title)).toHaveAccessibleName(/2:00 PM – 3:00 PM/);

    await deleteEvent(page, actAsAna, title);
    await page.reload();
    await expect(eventBlock(page, title)).toHaveCount(0);
  });

  test("edits an event's title and time, and the grid follows", async ({ page, actAsAna, unique }) => {
    const title = unique("Dentist");
    const renamed = `${title} moved`;
    await createEvent(page, actAsAna, { title, startTime: "14:00", endTime: "15:00" });

    await openEvent(page, title);
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("dialog", { name: "Edit event" });
    await actAsAna(async () => {
      await form.getByRole("textbox", { name: "Title" }).fill(renamed);
      await form.getByRole("textbox", { name: "Start time" }).fill("16:00");
      await form.getByRole("textbox", { name: "End time" }).fill("17:00");
      await form.getByRole("button", { name: "Save" }).click();
    });

    await page.reload();
    await expect(eventBlock(page, renamed)).toHaveAccessibleName(/4:00 PM – 5:00 PM/);
    await expect(eventBlock(page, title)).toHaveCount(1); // the renamed one; the old title is gone

    await deleteEvent(page, actAsAna, renamed);
  });

  test("draws an all-day event as a bar in the band, not a block in the hour grid", async ({ page, actAsAna, unique }) => {
    const title = unique("Camping");
    await createEvent(page, actAsAna, { title, allDay: true });

    await page.reload();
    const bar = eventBlock(page, title);
    await expect(bar).toBeVisible();
    // The band sits above the hour grid: the bar is drawn before the first hour label.
    const bandBox = await bar.boundingBox();
    const gridBox = await page.getByText("6 AM").first().boundingBox();
    expect(bandBox!.y, "the all-day bar sits above the hour grid").toBeLessThan(gridBox!.y);

    await deleteEvent(page, actAsAna, title);
  });

  test("edits a repeating event at each scope, and the other occurrences follow the rule", async ({ page, actAsAna, unique }) => {
    const title = unique("Standup");
    await createEvent(page, actAsAna, { title, startTime: "14:00", endTime: "15:00", repeats: "Every day" });
    await page.reload();
    const thisWeek = await eventBlock(page, title).count();
    expect(thisWeek, "a daily repeat draws on every remaining day of the week").toBeGreaterThan(1);

    // "This event" touches one occurrence only.
    await openEvent(page, title);
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit repeating event" })).toBeVisible();
    await page.getByRole("radio", { name: "This event" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    const form = page.getByRole("dialog", { name: "Edit event" });
    await actAsAna(async () => {
      await form.getByRole("textbox", { name: "Start time" }).fill("18:00");
      await form.getByRole("textbox", { name: "End time" }).fill("19:00");
      await form.getByRole("button", { name: "Save" }).click();
    });

    await page.reload();
    await expect(page.getByRole("button", { name: new RegExp(`${title}.*6:00 PM`) })).toHaveCount(1);
    await expect(page.getByRole("button", { name: new RegExp(`${title}.*2:00 PM`) })).toHaveCount(thisWeek - 1);

    await deleteEvent(page, actAsAna, title, "All events");
    await page.reload();
    await expect(eventBlock(page, title)).toHaveCount(0);
  });

  test("deletes a repeating event from this occurrence onward, leaving the earlier ones", async ({ page, actAsAna, unique }) => {
    const title = unique("Bins");
    await createEvent(page, actAsAna, { title, startTime: "14:00", endTime: "15:00", repeats: "Every day" });
    await page.reload();
    const before = await eventBlock(page, title).count();
    test.skip(before < 2, "the household's week has no room for two occurrences of a daily repeat");

    // The last occurrence on screen: everything before it must survive.
    const last = page.getByRole("button", { name: new RegExp(title) }).last();
    await stopFollowingTheClock(page);
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete repeating event" })).toBeVisible();
    await actAsAna(async () => {
      await page.getByRole("radio", { name: "This and future events" }).check();
      await page.getByRole("button", { name: "Continue" }).click();
    });

    await page.reload();
    await expect(eventBlock(page, title)).toHaveCount(before - 1);

    await deleteEvent(page, actAsAna, title, "All events");
  });

  test("drags an event to another time, and the new time survives a reload", async ({ page, actAsAna, unique }) => {
    const title = unique("Piano");
    await createEvent(page, actAsAna, { title, startTime: "13:00", endTime: "14:00" });
    await page.reload();

    await stopFollowingTheClock(page);
    const block = eventBlock(page, title);
    await block.scrollIntoViewIfNeeded();
    const box = (await block.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await actAsAna(async () => {
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down();
      // Several steps: one jump is not a drag, and the grid needs the moves.
      for (let step = 1; step <= 8; step += 1) {
        await page.mouse.move(centre.x, centre.y + (box.height * step) / 4, { steps: 2 });
      }
      await page.mouse.up();
    });

    await page.reload();
    await expect(eventBlock(page, title)).not.toHaveAccessibleName(/1:00 PM – 2:00 PM/);
    await deleteEvent(page, actAsAna, title);
  });

  test("hides a Profile's events on this device only, and remembers it", async ({ page, actAsAna, unique }) => {
    const title = unique("Vet");
    await createEvent(page, actAsAna, { title, startTime: "14:00", endTime: "15:00", profile: "Cleo" });

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("dialog").getByRole("checkbox", { name: "Cleo" }).uncheck();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(eventBlock(page, title)).toHaveCount(0);

    await page.reload();
    await expect(eventBlock(page, title)).toHaveCount(0);

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("button", { name: "Show all" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(eventBlock(page, title)).toBeVisible();

    await deleteEvent(page, actAsAna, title);
  });

  test("pages by whole weeks and comes back to today @responsive", async ({ page }) => {
    const dayHeaders = page.getByRole("main").getByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
    await expect(dayHeaders.first()).toBeVisible();

    const before = await page.getByRole("main").innerText();
    await page.getByRole("button", { name: /^Next \d+ days$/ }).click();
    await expect(page.getByRole("main")).not.toHaveText(before);

    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("main")).toHaveText(before);
  });
});
