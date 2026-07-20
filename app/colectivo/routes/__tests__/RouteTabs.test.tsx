import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { routes } from "@/lib/colectivo";
import { RouteTabs } from "@/app/colectivo/routes/RouteTabs";

describe("RouteTabs", () => {
  it("renders a tab per route using its short label", () => {
    render(<RouteTabs routes={routes} activeId="milwaukee" onSelect={vi.fn()} />);
    ["MIL", "MAD", "CHI"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("marks only the active route's tab with aria-current", () => {
    render(<RouteTabs routes={routes} activeId="madison" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "MAD" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "MIL" })).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect with the route id when a tab is clicked", () => {
    const onSelect = vi.fn();
    render(<RouteTabs routes={routes} activeId="milwaukee" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "CHI" }));
    expect(onSelect).toHaveBeenCalledWith("chicago");
  });
});
