import { column, showColumn } from "../helpers/board";
import { expect, test } from "../fixtures";

/**
 * 007 T041, US4 — the Rewards tab (FR-717).
 *
 * The star ledger is written by database triggers off the same rows the Tasks
 * board moves, so this tab is where a browser can watch the whole chain: a
 * balance falls when a reward is redeemed, comes back when the redemption is
 * undone, and a reward the balance cannot cover is not offered at all.
 *
 * The seed leaves Cleo fifteen stars and three rewards: Movie night at fifteen,
 * Bake cookies at twenty, Ice cream at twenty-five. Every journey here puts the
 * stars back where it found them.
 */

function balanceOf(page: import("@playwright/test").Page, name: string) {
  return column(page, name).getByRole("paragraph").first();
}

test.describe("the Rewards tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/rewards");
    await showColumn(page, "Cleo");
  });

  test("redeems a reward the balance covers, and undoes it again @responsive", async ({ page, actAsAna }) => {
    const balance = balanceOf(page, "Cleo");
    const before = Number(await balance.innerText());
    expect(before, "the seed leaves Cleo enough stars for Movie night").toBeGreaterThanOrEqual(15);

    await actAsAna(async () => {
      await column(page, "Cleo").getByRole("button", { name: "Redeem Movie night for 15 stars" }).click();
    });

    // The redemption lands with a word about it, and the stars have gone.
    await expect(page.getByRole("heading", { name: /Movie night redeemed/ })).toBeVisible();
    await expect(balance).toHaveText(String(before - 15));

    await page.getByRole("button", { name: "Done" }).click();
    await page.reload();
    await showColumn(page, "Cleo");
    await expect(balanceOf(page, "Cleo")).toHaveText(String(before - 15));

    // Put the household back: with Redeemed shown, the card says when it went
    // and its details carry the undo.
    await page.getByRole("switch", { name: "Redeemed" }).click();
    await column(page, "Cleo").getByRole("button", { name: /Movie night, Redeemed on/ }).click();
    await actAsAna(async () => {
      await page.getByRole("dialog", { name: "Movie night" }).getByRole("button", { name: "Unredeem" }).click();
    });
    // Wait for the stars to come back before reloading: Ana is still punched in
    // from the redemption, so nothing interrupts this write to wait behind.
    await expect(balanceOf(page, "Cleo")).toHaveText(String(before));

    await page.reload();
    await showColumn(page, "Cleo");
    await expect(balanceOf(page, "Cleo")).toHaveText(String(before));
  });

  test("does not offer a reward the balance cannot cover", async ({ page }) => {
    const balance = Number(await balanceOf(page, "Cleo").innerText());

    // Ice cream costs twenty-five: while Cleo is short of it, the card shows
    // the distance and no Redeem control exists to press.
    await expect(column(page, "Cleo").getByRole("button", { name: `Ice cream, ☆ ${balance}/25` })).toBeVisible();
    await expect(column(page, "Cleo").getByRole("button", { name: "Redeem Ice cream for 25 stars" })).toHaveCount(0);
  });

  test("gives stars by hand, and takes them back the same way", async ({ page, actAsAna }) => {
    const balance = balanceOf(page, "Cleo");
    const before = Number(await balance.innerText());

    // Giving stars is a parent's act, so the control appears once one is punched
    // in — and the app punches nobody in until a write asks who is here. This
    // journey asks with a redemption and undoes it in the same breath, leaving
    // the stars exactly as they were.
    await actAsAna(async () => {
      await column(page, "Cleo").getByRole("button", { name: "Redeem Movie night for 15 stars" }).click();
    });
    await page.getByRole("button", { name: "Unredeem" }).click();
    await expect(balance).toHaveText(String(before));

    for (const amount of ["5", "-5"]) {
      await page.getByRole("button", { name: "Give stars" }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await sheet.getByRole("checkbox", { name: "Cleo" }).check();
      await sheet.getByRole("spinbutton", { name: "Stars" }).fill(amount);
      await sheet.getByRole("button", { name: "Confirm" }).click();
      await expect(sheet).toBeHidden();
      await expect(balance).toHaveText(String(amount === "5" ? before + 5 : before));
    }

    await page.reload();
    await showColumn(page, "Cleo");
    await expect(balanceOf(page, "Cleo")).toHaveText(String(before));
  });
});
