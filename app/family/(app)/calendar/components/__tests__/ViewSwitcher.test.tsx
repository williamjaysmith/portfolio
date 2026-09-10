import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { nextView, ViewSwitcher } from "../ViewSwitcher";

/**
 * 011 FR-1101 — one control whose LABEL is the view currently showing
 * [VERIFIED](44738510847259). That is the part the reference actually
 * specifies; whether it cycles or opens a picker is `[UNKNOWN]` and was
 * 011's Assumption 1.
 *
 * **It cycles.** 011 chose a list, and shipped, that choice lost to a phone: the
 * popover sat off the edge of a small screen, so the control was unusable on the
 * device it matters most on. These tests pin the cycle's two properties that a
 * household would actually notice if they broke — the order, and the wrap.
 */

function renderSwitcher(view: "day" | "week" | "month" = "week") {
  const onChange = vi.fn();
  render(<ViewSwitcher view={view} onChange={onChange} />);
  return { onChange };
}

describe("ViewSwitcher", () => {
  it("is ONE control, labelled with the view showing", () => {
    renderSwitcher("week");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Week");
  });

  it("changes its label with the view", () => {
    renderSwitcher("month");
    expect(screen.getByRole("button")).toHaveTextContent("Month");
  });

  it("opens nothing at all — there is no menu to fall off a narrow screen", () => {
    renderSwitcher("week");
    fireEvent.click(screen.getByRole("button"));

    // The failure this replaces: a popover positioned beside the control, which
    // at 320px hung off the edge of the page.
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("cycles Day → Week → Month and wraps back to Day", () => {
    expect(nextView("day")).toBe("week");
    expect(nextView("week")).toBe("month");
    // The wrap is the whole reason two taps is the ceiling rather than the floor.
    expect(nextView("month")).toBe("day");
  });

  it("asks for the next view on a tap, never for the one showing", () => {
    const { onChange } = renderSwitcher("week");
    fireEvent.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("wraps from Month round to Day on a tap", () => {
    const { onChange } = renderSwitcher("month");
    fireEvent.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledWith("day");
  });

  /**
   * With no menu to open, the button is the only place a household can learn
   * what the tap will do — so its accessible name has to say both things. A
   * screen-reader user tapping a control named only "Week" would have no way to
   * know a second view exists.
   */
  it("says what is showing AND what a tap will do", () => {
    renderSwitcher("day");
    expect(
      screen.getByRole("button", { name: "Calendar view: Day. Tap for Week." }),
    ).toBeInTheDocument();
  });

  it("never offers Schedule, which this project has not built", () => {
    renderSwitcher("month");
    // Month wraps to Day. If a fourth view were ever added to CALENDAR_VIEWS
    // without a view to render, this is where the cycle would reveal it.
    expect(nextView("month")).toBe("day");
    expect(screen.getByRole("button")).not.toHaveTextContent(/Schedule/i);
  });
});
