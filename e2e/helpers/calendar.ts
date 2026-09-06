import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 007 — the Week calendar's own habits (US3).
 *
 * **The grid follows the clock.** Until someone scrolls it themselves, the hour
 * grid keeps the current time in view and will undo a scroll made for it — so a
 * block above or below "now" cannot simply be clicked: the view slides back
 * first and the click lands on empty grid. A person disengages that by
 * scrolling; so does a journey, once, before it touches a block.
 *
 * **Events are created here, not read from the seed.** The seeded week is a
 * frozen render matrix (Phase 2's quickstart) that drifts further from today
 * every day, and pinning the browser clock days away breaks the signed-in
 * token. So these journeys make what they need in the current week and remove
 * it afterwards (harness.md §1).
 */

export interface NewEvent {
  title: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  /** A repeat chosen by the words the form uses. */
  repeats?: "Every day" | "Every week on chosen weekdays" | "Every month on the date";
  profile?: string;
}

/** Stop the grid following the clock, so a scrolled-to block stays where it was put. */
export async function stopFollowingTheClock(page: Page): Promise<void> {
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, 120);
  await page.mouse.wheel(0, -120);
}

export function eventBlock(page: Page, title: string): Locator {
  return page.getByRole("button", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
}

/** Open one event's details from the grid, the way a tap does. */
export async function openEvent(page: Page, title: string): Promise<void> {
  await stopFollowingTheClock(page);
  const block = eventBlock(page, title);
  await block.scrollIntoViewIfNeeded();
  await block.click();
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
}

/** Fill and save the event form, answering the punch-in sheet through `act`. */
export async function createEvent(
  page: Page,
  act: (action: () => Promise<void>) => Promise<void>,
  event: NewEvent,
): Promise<void> {
  await act(async () => {
    await page.getByRole("button", { name: "Add event" }).click();
    const form = page.getByRole("dialog", { name: "Add an event" });
    await form.getByRole("textbox", { name: "Title" }).fill(event.title);
    if (event.allDay === true) await form.getByRole("switch", { name: "All day" }).click();
    if (event.startTime !== undefined) await form.getByRole("textbox", { name: "Start time" }).fill(event.startTime);
    if (event.endTime !== undefined) await form.getByRole("textbox", { name: "End time" }).fill(event.endTime);
    if (event.repeats !== undefined) await form.getByRole("combobox", { name: "Repeats" }).selectOption({ label: event.repeats });
    if (event.profile !== undefined) await form.getByRole("checkbox", { name: event.profile }).check();
    await form.getByRole("button", { name: "Save" }).click();
  });
  await expect(eventBlock(page, event.title)).toBeVisible();
}

/** Delete every occurrence of an event this journey made, whatever scope it needs. */
export async function deleteEvent(
  page: Page,
  act: (action: () => Promise<void>) => Promise<void>,
  title: string,
  scope?: "This event" | "This and future events" | "All events",
): Promise<void> {
  await openEvent(page, title);
  await act(async () => {
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Delete" }).click();
    if (scope !== undefined) {
      await page.getByRole("radio", { name: scope }).check();
      await page.getByRole("button", { name: "Continue" }).click();
    }
    const confirm = page.getByRole("button", { name: /^Delete/ }).last();
    if (await confirm.isVisible()) await confirm.click();
  });
  await expect(eventBlock(page, title)).toHaveCount(0);
}
