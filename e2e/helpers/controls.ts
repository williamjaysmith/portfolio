import type { Locator, Page } from "@playwright/test";

/**
 * 007 — the controls a person presses, where the control a screen reader hears
 * is a different element.
 *
 * Several surfaces in this app draw a chip, a pill or a tick box and put the
 * real `input` behind it, screen-reader only. Both are right: the input carries
 * the name, role and state; the label carries the paint. A journey has to press
 * what a finger presses, so it asks for the label around the named input.
 */

/** The pressable label around a screen-reader-only radio or checkbox. */
export function optionLabel(page: Page, scope: Locator, name: string, role: "radio" | "checkbox" = "radio"): Locator {
  return scope.locator("label").filter({ has: page.getByRole(role, { name, exact: true }) });
}
