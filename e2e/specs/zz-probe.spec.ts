import { test, expect } from "../fixtures";

test("probe", async ({ page, actAsAna }) => {
  test.setTimeout(240_000);
  await page.goto("/family/calendar");
  const hour = new Date().getHours();
  await actAsAna(async () => {
    await page.getByRole("button", { name: "Add event" }).click();
    const form = page.getByRole("dialog", { name: "Add an event" });
    await form.getByRole("textbox", { name: "Title" }).fill("Probe timed");
    await form.getByRole("textbox", { name: "Start time" }).fill(`${String(hour).padStart(2, "0")}:00`);
    await form.getByRole("textbox", { name: "End time" }).fill(`${String(hour + 1).padStart(2, "0")}:00`);
    await form.getByRole("button", { name: "Save" }).click();
  });
  const block = page.getByRole("button", { name: /Probe timed/ }).first();
  await expect(block).toBeVisible();
  const box = (await block.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const at = await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px as number, py as number) as HTMLElement | null;
    return el === null ? "none" : `${el.tagName}.${el.className.toString().slice(0, 60)}`;
  }, [x, y]);
  console.log("ELEMENT AT CENTRE:", at);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(800);
  console.log("after mouse down/up, open dialogs:", await page.locator("dialog[open]").count());

  await block.dispatchEvent("click");
  await page.waitForTimeout(600);
  console.log("after dispatch click, open dialogs:", await page.locator("dialog[open]").count());
});
