import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ViewSwitcher } from "../ViewSwitcher";

/**
 * 011 FR-1101 — one control whose LABEL is the view currently showing
 * [VERIFIED](44738510847259). That is the part the reference actually
 * specifies; that it opens a list rather than cycling is spec Assumption 1.
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

  it("says what it does as well as what is showing", () => {
    renderSwitcher("day");
    expect(
      screen.getByRole("button", { name: "Change view — currently Day" }),
    ).toBeInTheDocument();
  });

  it("shows nothing until it is opened", () => {
    renderSwitcher();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers all three views, marking the one showing", () => {
    renderSwitcher("week");
    fireEvent.click(screen.getByRole("button", { name: /Change view/ }));

    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Day", "Week", "Month"]);
    expect(screen.getByRole("menuitemradio", { name: "Week" })).toBeChecked();
    expect(screen.getByRole("menuitemradio", { name: "Day" })).not.toBeChecked();
  });

  it("does NOT offer Schedule — the reference's fourth is out of scope (FR-1103)", () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /Change view/ }));
    expect(screen.queryByRole("menuitemradio", { name: /Schedule/i })).toBeNull();
  });

  it("reports the chosen view and closes", () => {
    const { onChange } = renderSwitcher("week");
    fireEvent.click(screen.getByRole("button", { name: /Change view/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Month" }));

    expect(onChange).toHaveBeenCalledWith("month");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes when its own control is tapped again", () => {
    // The button must sit ABOVE the outside-tap overlay: without that the
    // overlay covers it while the menu is open and a second tap does nothing,
    // which is what a household hits first when it changes its mind.
    renderSwitcher();
    const control = screen.getByRole("button", { name: /Change view/ });
    fireEvent.click(control);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(control);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes without choosing when the outside is tapped", () => {
    const { onChange } = renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /Change view/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close the view menu" }));

    expect(screen.queryByRole("menu")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
