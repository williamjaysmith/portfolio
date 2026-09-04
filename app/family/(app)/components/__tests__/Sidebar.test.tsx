import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NAV_TABS, SETTINGS_TAB } from "../nav";
import { Sidebar } from "../Sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/family/calendar" }));

/**
 * FR-028 and FR-035: the landscape rail. Its width is fluid, so between the
 * 1024px landscape breakpoint and the point where the scale unit catches up a
 * tab is narrower than the 44px floor unless the floor is stated outright —
 * the bottom bar already states it.
 */
describe("Sidebar", () => {
  it("keeps every rail tab at the 44x44 touch floor (FR-035)", () => {
    render(<Sidebar />);
    const tabs = screen.getAllByRole("link");

    expect(tabs).toHaveLength(NAV_TABS.length + 1);
    for (const tab of tabs) {
      expect(tab).toHaveClass("min-h-[44px]");
      expect(tab).toHaveClass("min-w-[44px]");
    }

    // And the rail is wide enough to hold one: 44px + its 6px padding a side.
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveClass("min-w-[56px]");
  });

  it("marks the tab you are on, and only that one", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: SETTINGS_TAB.label })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
