import { TABS } from "../helpers/auth";
import { expect, test } from "../fixtures";

/**
 * 007 T058–T059, US7 — the shell's two standing promises (FR-723, FR-726).
 *
 * The constitution's §III says every control carries a name, a role and a state
 * a screen reader can announce, and Phase 1 shipped an installable app. Both
 * have been true by construction and checked by eye; here they are checked.
 *
 * The accessibility gate is the serious and critical bands — the ones that stop
 * somebody using the app. Minor and moderate findings are attached to the run
 * so they are known, without turning the gate into a wish list.
 */

test.describe("the shell", () => {
  // Scan a still page. The celebration banner lifts in over a third of a
  // second, and a scan that catches it mid-entrance measures its half-faded
  // ink rather than its colour. The app honours reduced motion by skipping the
  // entrance, so this is what a person who asks for less motion actually sees.
  test.use({ reducedMotion: "reduce" });

  for (const tab of TABS) {
    test(`${tab} has no serious or critical accessibility violations`, async ({ page, axe }) => {
      await page.goto(`/family/${tab}`);
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
      await axe(tab);
    });
  }

  test("serves a manifest an install can use", async ({ page, request }) => {
    await page.goto("/family/calendar");

    const response = await request.get("/family/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name?: string;
      short_name?: string;
      display?: string;
      start_url?: string;
      icons?: { sizes?: string; src?: string; purpose?: string }[];
    };

    expect(manifest.name, "an installed app needs a name").toBeTruthy();
    expect(manifest.short_name, "and a short one for the home screen").toBeTruthy();
    expect(manifest.display, "installed, it is not a browser tab").toBe("standalone");
    expect(manifest.start_url, "it opens where the family lives").toContain("/family");

    const sizes = (manifest.icons ?? []).map((icon) => icon.sizes ?? "");
    expect(sizes.some((size) => size.includes("512")), `the icons are ${sizes.join(", ") || "missing"}`).toBe(true);
  });
});
