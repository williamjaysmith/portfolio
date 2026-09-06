import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 007 — the board chassis the Tasks, Rewards, Lists and Meals tabs share (US4–US6).
 *
 * **A board shows as many whole columns as fit and pages the rest.** At the wall
 * size four columns fit, so a journey that wants Cleo's must page to it first —
 * the way a person does, with the strip's own arrow keys.
 *
 * **A board renders every column until it has measured itself**, then only the
 * slice on screen. So a journey that reads the board in its first moments sees
 * columns that are about to be removed; every helper here waits for the
 * measurement before believing anything.
 */

const PAGES_AT_MOST = 8;
const MEASURED_WITHIN_MS = 10_000;

/** The strip a measured, paging board wraps its columns in. */
export function strip(page: Page, label = "Profile columns"): Locator {
  return page.getByRole("group", { name: label });
}

/** What the board says it is showing — screen-reader only, so read it, never look for it. */
export function showing(page: Page): Locator {
  return page.getByText(/^Showing /);
}

/** One column on a board. Only the columns on screen are in the page at all. */
export function column(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

/** True once the board has measured itself and decided whether to page. */
async function paged(page: Page, label: string): Promise<boolean> {
  try {
    await expect(strip(page, label)).toBeAttached({ timeout: MEASURED_WITHIN_MS });
    return true;
  } catch {
    return false;
  }
}

/**
 * Page the board until `column` is on screen, and say what the board was
 * showing instead if it never arrives.
 */
export async function showColumn(page: Page, name: string, label = "Profile columns"): Promise<void> {
  const target = column(page, name);
  if (!(await paged(page, label))) {
    // Every column fits: there is nothing to page.
    await expect(target).toBeVisible();
    return;
  }
  // Right first, then back: a board already paged away from the start cannot
  // reach an earlier column by going forward.
  for (const key of ["ArrowRight", "ArrowLeft"] as const) {
    for (let step = 0; step < PAGES_AT_MOST; step += 1) {
      if ((await target.count()) > 0) {
        await expect(target).toBeVisible();
        return;
      }
      await strip(page, label).press(key);
    }
  }
  const shown = (await showing(page).count()) > 0 ? await showing(page).innerText() : "nothing";
  expect(shown, `${name}'s column never came into view`).toContain(name);
}

/** The names in the window the board is showing, in the order it shows them. */
export async function visibleOrder(page: Page): Promise<string[]> {
  if ((await showing(page).count()) === 0) {
    return page.getByRole("region").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  }
  return (await showing(page).innerText()).replace(/^Showing /, "").split(/, | and /);
}

/**
 * The household's whole column order, read the way a person would: page to the
 * start, then walk right, collecting each window's names.
 */
export async function columnOrder(page: Page, label = "Profile columns"): Promise<string[]> {
  if (!(await paged(page, label))) return visibleOrder(page);
  for (let step = 0; step < PAGES_AT_MOST; step += 1) await strip(page, label).press("ArrowLeft");
  const seen: string[] = [];
  for (let step = 0; step < PAGES_AT_MOST; step += 1) {
    for (const name of await visibleOrder(page)) if (!seen.includes(name)) seen.push(name);
    await strip(page, label).press("ArrowRight");
  }
  return seen;
}
