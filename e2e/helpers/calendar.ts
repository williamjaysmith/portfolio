import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 007 — the Week calendar's own habits (US3).
 *
 * **The grid follows the clock.** Until someone scrolls it themselves, the hour
 * grid keeps the current time in view and will undo a scroll made for it. So
 * these journeys make their events at an hour the grid is already showing, and
 * disengage the following before touching a block.
 *
 * **Events are created here, not read from the seed.** The seeded week is a
 * frozen render matrix (Phase 2's quickstart) that drifts further from today
 * every day, and pinning the browser clock days away breaks the signed-in
 * token. So a journey makes what it needs in the current week and removes it
 * afterwards (harness.md §1).
 */

export interface NewEvent {
  title: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  /** A repeat chosen by the words the form uses. */
  repeats?: "Every day" | "Every week on chosen weekdays" | "Every month on the date";
  profile?: string;
  /**
   * This event's own reminder (008 FR-808). Omit to leave it on "The
   * household's setting" — the form's own default. `"none"` is deliberate
   * silence; a number is "Its own", read as minutes before the event starts
   * (the form's default lead once "Its own" is chosen is 10, which this
   * overwrites when a different value is given).
   */
  reminder?: "none" | { beforeMinutes: number };
  /**
   * 009 FR-901 — mark it a countdown. Omit to leave the switch off, which is
   * the form's own default and means the event is not one.
   */
  countdown?: boolean;
}

/**
 * Stop the grid following the clock, so a scrolled-to block stays where it was
 * put. The app disengages on the grid's own scroll event, whatever moved it —
 * which matters here, because a phone has no wheel to turn.
 */
export async function stopFollowingTheClock(page: Page): Promise<void> {
  try {
    await page.mouse.move(640, 500);
    await page.mouse.wheel(0, 120);
    await page.mouse.wheel(0, -120);
    return;
  } catch {
    // Mobile WebKit: no wheel. Scroll the region itself, which raises the very
    // same event the app listens for.
  }
  const hours = page.getByRole("group", { name: "Hours" });
  await hours.evaluate((node: HTMLElement) => {
    node.scrollBy(0, 120);
    node.scrollBy(0, -120);
  });
}

/** Every block drawn for an event — a repeat draws one per occurrence. */
export function eventBlocks(page: Page, title: string): Locator {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByRole("button", { name: new RegExp(escaped) });
}

export function eventBlock(page: Page, title: string): Locator {
  return eventBlocks(page, title).first();
}

/**
 * An hour the grid is already showing. The grid keeps "now" in view, so an
 * event made at the current hour needs no scrolling — and the hour comes from
 * the app's own clock, in the household's zone, never from this machine's
 * (FR-711).
 */
export async function visibleHours(page: Page): Promise<{ start: string; end: string }> {
  // The shell renders the clock only once the client has ticked; reading before
  // that gives the fallback hour and a journey that asserts on the wrong time.
  const banner = page.getByRole("banner");
  await expect(banner).toHaveText(/\d{1,2}:\d{2}/);
  const clock = await banner.innerText();
  const match = /(\d{1,2}):(\d{2})\s?(AM|PM)?/.exec(clock);
  let hour = Number(match?.[1] ?? "9");
  const meridiem = match?.[3];
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  // Keep both ends inside the day, and off its very last hour.
  const start = Math.min(Math.max(hour, 1), 21);
  const two = (value: number): string => String(value).padStart(2, "0");
  return { start: `${two(start)}:00`, end: `${two(start + 1)}:00` };
}

/**
 * Open one OCCURRENCE of an event from the grid, by its position among that
 * title's blocks — left to right, so 0 is the earliest visible occurrence of
 * a repeat. A one-off has exactly one, at index 0.
 */
export async function openEventAt(page: Page, title: string, index: number): Promise<void> {
  await stopFollowingTheClock(page);
  const block = eventBlocks(page, title).nth(index);
  await block.scrollIntoViewIfNeeded();
  await block.click();
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
}

/** Open one event's details from the grid, the way a tap does. */
export async function openEvent(page: Page, title: string): Promise<void> {
  await openEventAt(page, title, 0);
}

/**
 * The words the details dialog gives for one occurrence's reminder (008
 * FR-811), read from the dialog `openEventAt` opens and then closed again —
 * a caller reads several occurrences in a row without a dialog left over the
 * next one it opens.
 */
export async function reminderTextAt(page: Page, title: string, index: number): Promise<string> {
  await openEventAt(page, title, index);
  const dialog = page.getByRole("dialog", { name: title });
  // By role and name, not by walking the DOM: `DetailRow` labels its value
  // group, so the reminder row is findable the way harness.md §4 rule 1 requires.
  const value = dialog.getByRole("group", { name: "Reminder" });
  const text = (await value.textContent())?.trim() ?? "";
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  return text;
}

/** Fill and save the event form, answering the punch-in sheet through `act`. */
export async function createEvent(
  page: Page,
  act: (action: () => Promise<void>) => Promise<void>,
  event: NewEvent,
): Promise<void> {
  const hours = await visibleHours(page);
  await act(async () => {
    await page.getByRole("button", { name: "Add event" }).click();
    const form = page.getByRole("dialog", { name: "Add an event" });
    await form.getByRole("textbox", { name: "Title" }).fill(event.title);
    if (event.allDay === true) {
      await form.getByRole("switch", { name: "All day" }).click();
    } else {
      await form.getByRole("textbox", { name: "Start time" }).fill(event.startTime ?? hours.start);
      await form.getByRole("textbox", { name: "End time" }).fill(event.endTime ?? hours.end);
    }
    if (event.repeats !== undefined) {
      await form.getByRole("combobox", { name: "Repeats" }).selectOption({ label: event.repeats });
    }
    if (event.profile !== undefined) await form.getByRole("checkbox", { name: event.profile }).check();
    if (event.reminder !== undefined) {
      const reminder = form.getByRole("combobox", { name: "Reminder" });
      if (event.reminder === "none") {
        await reminder.selectOption({ label: "No reminder" });
      } else {
        // "Its own" opens already valid — Before it starts, at 10 minutes
        // (ReminderFieldset's own default) — so only the number needs setting.
        await reminder.selectOption({ label: "Its own" });
        await form.getByRole("spinbutton", { name: "Minutes before" }).fill(String(event.reminder.beforeMinutes));
      }
    }
    if (event.countdown === true) await form.getByRole("switch", { name: "Countdown" }).check();
    await form.getByRole("button", { name: "Save" }).click();
  });
  await expect(eventBlock(page, event.title)).toBeVisible();
}

export type EventScope = "This event" | "This and future events" | "All events";

/**
 * Remove every occurrence of an event this journey made.
 *
 * The order is the app's, not a guess: on a **delete** the scope question comes
 * first and the confirmation second (FR-250); on an **edit** it comes after the
 * form is saved. A one-off is asked neither.
 */
export async function deleteEvent(
  page: Page,
  act: (action: () => Promise<void>) => Promise<void>,
  title: string,
  scope?: EventScope,
): Promise<void> {
  await openEvent(page, title);
  await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Delete" }).click();
  if (scope !== undefined) {
    await expect(page.getByRole("heading", { name: "Delete repeating event" })).toBeVisible();
    await page.getByRole("radio", { name: scope }).check();
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await act(async () => {
    // The confirmation is the topmost dialog: the details it came from is still behind it.
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  });
  await expect(eventBlocks(page, title)).toHaveCount(0);
}
