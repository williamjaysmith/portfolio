import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

const { Fab } = await import("../Fab");

/**
 * FR-034: one create control, in the same place on every tab. Phase 1 has
 * nothing to create yet, so it explains which phase brings each one.
 */
describe("Fab", () => {
  it("names the thing the current tab creates", () => {
    pathname.mockReturnValue("/family/calendar");
    render(<Fab />);
    expect(screen.getByRole("button", { name: "Add calendar" })).toBeInTheDocument();
  });

  it("uses the singular of the tab it is on", () => {
    pathname.mockReturnValue("/family/tasks");
    render(<Fab />);
    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("stays out of Settings, which has its own Add buttons", () => {
    pathname.mockReturnValue("/family/settings");
    const { container } = render(<Fab />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on a route that is not a tab", () => {
    pathname.mockReturnValue("/family/nowhere");
    const { container } = render(<Fab />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says which phase brings the current tab", () => {
    pathname.mockReturnValue("/family/rewards");
    render(<Fab />);
    fireEvent.click(screen.getByRole("button", { name: "Add reward" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Adding to Rewards comes with the Rewards phase.",
    );
  });

  it("drops the notice when the tab changes, rather than naming the wrong one", () => {
    pathname.mockReturnValue("/family/rewards");
    const { rerender } = render(<Fab />);
    fireEvent.click(screen.getByRole("button", { name: "Add reward" }));
    expect(screen.getByRole("status")).toHaveTextContent("Rewards");

    pathname.mockReturnValue("/family/meals");
    rerender(<Fab />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
