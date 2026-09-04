import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

const { Fab } = await import("../Fab");
const { FabActionProvider, useRegisterFabAction } = await import("../FabAction");

/**
 * FR-034: one create control, in the same place on every tab. A tab that can
 * create registers what "+" does; a tab that cannot yet explains which phase
 * brings its creation.
 */
describe("Fab", () => {
  it("runs the action the current tab registered, under that action's name (FR-254)", () => {
    pathname.mockReturnValue("/family/calendar");
    const run = vi.fn();
    function Registrar() {
      useRegisterFabAction("Add event", run);
      return null;
    }
    render(
      <FabActionProvider>
        <Registrar />
        <Fab />
      </FabActionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add event" }));

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("runs the latest handler even when the page hands over a fresh one each render", () => {
    pathname.mockReturnValue("/family/calendar");
    const runs: (() => void)[] = [];
    function Registrar() {
      // A fresh function per render must neither loop the registry nor go stale.
      const run = vi.fn();
      runs.push(run);
      useRegisterFabAction("Add event", run);
      return null;
    }
    render(
      <FabActionProvider>
        <Registrar />
        <Fab />
      </FabActionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add event" }));

    expect(runs.length).toBeGreaterThan(0);
    expect(runs[runs.length - 1]).toHaveBeenCalledTimes(1);
  });

  it("falls back to the placeholder once the registering tab unmounts", () => {
    pathname.mockReturnValue("/family/calendar");
    function Registrar() {
      useRegisterFabAction("Add event", vi.fn());
      return null;
    }
    const { rerender } = render(
      <FabActionProvider>
        <Registrar />
        <Fab />
      </FabActionProvider>,
    );
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();

    rerender(
      <FabActionProvider>
        <Fab />
      </FabActionProvider>,
    );

    expect(screen.getByRole("button", { name: "Add calendar" })).toBeInTheDocument();
  });

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
