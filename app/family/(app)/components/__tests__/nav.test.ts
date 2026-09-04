import { describe, expect, it } from "vitest";

import { isActiveTab, NAV_TABS, SETTINGS_TAB, showsChipRow } from "../nav";

describe("nav", () => {
  it("lists the five feature tabs in the reference order", () => {
    expect(NAV_TABS.map((tab) => tab.label)).toEqual([
      "Calendar",
      "Tasks",
      "Rewards",
      "Meals",
      "Lists",
    ]);
  });

  it("keeps Settings out of the main tab set (FR-029)", () => {
    expect(NAV_TABS.some((tab) => tab.id === "settings")).toBe(false);
    expect(SETTINGS_TAB.href).toBe("/family/settings");
  });

  it("points every tab at a /family route", () => {
    for (const tab of [...NAV_TABS, SETTINGS_TAB]) {
      expect(tab.href).toBe(`/family/${tab.id}`);
    }
  });

  it("marks a tab active for its own route and anything nested under it", () => {
    expect(isActiveTab("/family/calendar", "/family/calendar")).toBe(true);
    expect(isActiveTab("/family/calendar/2026-03", "/family/calendar")).toBe(true);
    expect(isActiveTab("/family/tasks", "/family/calendar")).toBe(false);
  });

  it("does not treat a route that merely shares a prefix as active", () => {
    expect(isActiveTab("/family/calendarium", "/family/calendar")).toBe(false);
  });
});

/**
 * FR-314 / R324: the Tasks tab's columns ARE the profiles, so the chip row
 * would repeat them. The flag lives on the tab definition rather than as a
 * route string inside the shell, and the shell reads it from `usePathname()`
 * so the row never paints and then vanishes on hydration.
 */
describe("showsChipRow", () => {
  it("carries the decision on the tab definition, not in the shell", () => {
    expect(NAV_TABS.find((tab) => tab.id === "tasks")?.showsChipRow).toBe(false);
    expect(NAV_TABS.filter((tab) => tab.id !== "tasks").every((tab) => tab.showsChipRow)).toBe(
      true,
    );
  });

  it("keeps the row off the Tasks route and anything nested under it (FR-314)", () => {
    expect(showsChipRow("/family/tasks")).toBe(false);
    expect(showsChipRow("/family/tasks/anything")).toBe(false);
  });

  it("leaves every other route's row exactly as Phase 1 shipped it", () => {
    expect(showsChipRow("/family/calendar")).toBe(true);
    expect(showsChipRow(SETTINGS_TAB.href)).toBe(true);
    // A route no tab claims keeps the row rather than losing it silently.
    expect(showsChipRow("/family")).toBe(true);
  });
});
