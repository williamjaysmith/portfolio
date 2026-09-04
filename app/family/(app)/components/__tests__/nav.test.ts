import { describe, expect, it } from "vitest";

import { isActiveTab, NAV_TABS, SETTINGS_TAB } from "../nav";

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
