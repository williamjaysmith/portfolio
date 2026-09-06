import {
  createEvent,
  deleteEvent,
  eventBlock,
  eventBlocks,
  openEvent,
  stopFollowingTheClock,
  visibleHours,
} from "../helpers/calendar";
import { expect, test } from "../fixtures";

/**
 * 007 T027–T035, US3 — the Week calendar (FR-715).
 *
 * The largest surface in the app and the home of its most fragile interaction:
 * a pointer drag that turns a position on screen into a time and then asks a
 * question about a series. None of that survives in a simulated DOM — this
 * suite's first run proved as much, by finding that a tap on an event had not
 * opened its details since Phase 2.
 *
 * Every journey makes the events it needs in the current week and removes them
 * (harness.md §1), so none depends on the frozen render-matrix week.
 */

/** "5:00" — the hour the block will show, in the household's own clock format. */
function shownHour(twentyFour: string): string {
  const hour = Number(twentyFour.slice(0, 2));
  return `${hour % 12 || 12}:00`;
}

test.describe("the Week calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/calendar");
  });

  test("creates an event from the shell's control, and it survives a reload @responsive", async ({ page, actAsAna, unique }) => {
    const title = unique("Swimming");
    const hours = await visibleHours(page);
    await createEvent(page, actAsAna, { title, profile: "Cleo" });

    await page.reload();
    const block = eventBlock(page, title);
    await expect(block).toBeVisible();
    await expect(block).toHaveText(new RegExp(shownHour(hours.start)));

    await deleteEvent(page, actAsAna, title);
    await page.reload();
    await expect(eventBlocks(page, title)).toHaveCount(0);
  });

  test("edits an event's title and time, and the grid follows", async ({ page, actAsAna, unique }) => {
    const title = unique("Dentist");
    const renamed = `${title} moved`;
    await createEvent(page, actAsAna, { title });

    await openEvent(page, title);
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("dialog", { name: "Edit event" });
    await actAsAna(async () => {
      await form.getByRole("textbox", { name: "Title" }).fill(renamed);
      await form.getByRole("textbox", { name: "Start time" }).fill("16:00");
      await form.getByRole("textbox", { name: "End time" }).fill("17:00");
      await form.getByRole("button", { name: "Save" }).click();
    });
    // The form closes when the write lands; reloading before that cancels it.
    await expect(form).toBeHidden();

    await page.reload();
    await expect(eventBlock(page, renamed)).toHaveText(/4:00 PM/);
    // One block only: the old title is a prefix of the new one.
    await expect(eventBlocks(page, title)).toHaveCount(1);

    await deleteEvent(page, actAsAna, renamed);
  });

  test("draws an all-day event as a bar in the band, not a block in the hour grid", async ({ page, actAsAna, unique }) => {
    const title = unique("Camping");
    await createEvent(page, actAsAna, { title, allDay: true });

    await page.reload();
    const bar = eventBlock(page, title);
    await expect(bar).toBeVisible();
    // A band bar is named by the event alone; a block in the hour grid carries
    // its times too. That is the difference a person hears, and it is a truer
    // assertion than a pixel comparison against a grid that scrolls itself.
    await expect(bar).toHaveAccessibleName(title);

    await deleteEvent(page, actAsAna, title);
  });

  test("edits one occurrence of a repeat, and leaves the rest of the series alone", async ({ page, actAsAna, unique }) => {
    const title = unique("Standup");
    const hours = await visibleHours(page);
    await createEvent(page, actAsAna, { title, repeats: "Every day" });
    await page.reload();
    const occurrences = await eventBlocks(page, title).count();
    expect(occurrences, "a daily repeat draws on every remaining day of the visible week").toBeGreaterThan(1);

    // FR-250's order on an edit: the form first, the scope question on saving.
    // The one occurrence is renamed rather than re-timed, so what changed can
    // never be confused with what the clock happened to say when it ran.
    const once = `${title} only`;
    await openEvent(page, title);
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("dialog", { name: "Edit event" });
    await form.getByRole("textbox", { name: "Title" }).fill(once);
    await actAsAna(async () => {
      await form.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("heading", { name: "Edit repeating event" })).toBeVisible();
      await page.getByRole("radio", { name: "This event" }).check();
      await page.getByRole("button", { name: "Continue" }).click();
    });
    await expect(form).toBeHidden();

    await page.reload();
    // Exactly one occurrence carries the new name; the series is otherwise
    // untouched — same number of occurrences, still at the hour it was given.
    await expect(eventBlocks(page, once)).toHaveCount(1);
    await expect(eventBlocks(page, title)).toHaveCount(occurrences);
    await expect(eventBlock(page, title)).toHaveText(new RegExp(shownHour(hours.start)));

    await deleteEvent(page, actAsAna, title, "All events");
    await page.reload();
    await expect(eventBlocks(page, title)).toHaveCount(0);
  });

  test("deletes a repeat from one occurrence onward, leaving the earlier ones", async ({ page, actAsAna, unique }) => {
    const title = unique("Bins");
    await createEvent(page, actAsAna, { title, repeats: "Every day" });
    await page.reload();
    const before = await eventBlocks(page, title).count();
    test.skip(before < 2, "the visible week holds only one occurrence of a daily repeat today");

    // The last occurrence on screen: everything before it must survive.
    await stopFollowingTheClock(page);
    const last = eventBlocks(page, title).last();
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete repeating event" })).toBeVisible();
    await page.getByRole("radio", { name: "This and future events" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await actAsAna(async () => {
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    });
    await expect(page.getByRole("alertdialog")).toBeHidden();

    await page.reload();
    await expect(eventBlocks(page, title)).toHaveCount(before - 1);

    await deleteEvent(page, actAsAna, title, "All events");
  });

  test("drags an event to another time, and the new time survives a reload", async ({ page, actAsAna, unique }) => {
    const title = unique("Piano");
    await createEvent(page, actAsAna, { title });
    await page.reload();

    await stopFollowingTheClock(page);
    const block = eventBlock(page, title);
    await block.scrollIntoViewIfNeeded();
    const box = (await block.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const wasAt = await block.innerText();

    // The grid works on animation frames, so the gesture is driven by the app's
    // own running commentary rather than by waiting a fixed time (FR-710): move,
    // wait until it says it is moving somewhere, move again, then let go.
    const announcement = page.getByRole("status").first();
    await actAsAna(async () => {
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down();
      await page.mouse.move(centre.x, centre.y + 24, { steps: 4 });
      await expect(announcement).toHaveText(/Moving to/);
      // Wait for the commentary to CHANGE, not merely to exist: that is the
      // proof the grid has taken the second move, and it is what makes the drop
      // land somewhere new (FR-710 — a condition, never a delay).
      const firstStop = await announcement.innerText();
      await page.mouse.move(centre.x, centre.y + box.height, { steps: 8 });
      await expect(announcement).not.toHaveText(firstStop);
      await page.mouse.up();
    });
    // Wait for the write itself, not for a dialog: the block is redrawn at its
    // new hour once the drop has landed, and a reload before that would cancel
    // it in flight. `wasAt` is the whole label, so "5:00 PM – 6:00 PM" cannot
    // be mistaken for a move that only shifted the end.
    await expect(eventBlock(page, title)).not.toHaveText(wasAt);

    await page.reload();
    await expect(eventBlock(page, title)).not.toHaveText(wasAt);
    await expect(eventBlock(page, title)).toBeVisible();
    await deleteEvent(page, actAsAna, title);
  });

  test("hides a Profile's events on this device only, and remembers it", async ({ page, actAsAna, unique }) => {
    const title = unique("Vet");
    await createEvent(page, actAsAna, { title, profile: "Cleo" });

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("dialog").getByRole("checkbox", { name: "Cleo" }).uncheck();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(eventBlocks(page, title)).toHaveCount(0);

    await page.reload();
    await expect(eventBlocks(page, title)).toHaveCount(0);

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("button", { name: "Show all" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(eventBlock(page, title)).toBeVisible();

    await deleteEvent(page, actAsAna, title);
  });

  test("pages by whole weeks and comes back to today @responsive", async ({ page }) => {
    // Today is marked in the day headers; a week paged away from it carries no
    // marker at all, which is the honest signal that the window really moved.
    const todayMarker = page.getByRole("main").locator('[aria-current="date"]');
    await expect(todayMarker).toHaveCount(1);

    await page.getByRole("button", { name: /^Next \d+ days$/ }).click();
    await expect(todayMarker).toHaveCount(0);

    await page.getByRole("button", { name: /^Previous \d+ days$/ }).click();
    await expect(todayMarker).toHaveCount(1);

    await page.getByRole("button", { name: /^Next \d+ days$/ }).click();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(todayMarker).toHaveCount(1);
  });
});
