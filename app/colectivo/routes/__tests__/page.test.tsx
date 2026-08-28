import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getRoute, routes, stops } from "@/lib/colectivo";
import ColectivoRoutesPage from "@/app/colectivo/routes/page";

// The first tab (routes[0]) is active by default; derive a stop from it and from Madison.
const firstRoute = routes[0];
const firstRouteStop = stops[firstRoute.stopIds[0]];
const madison = getRoute("madison")!;
const madisonStop = stops[madison.stopIds[0]];

describe("ColectivoRoutesPage", () => {
  beforeEach(() => localStorage.clear());

  it("shows the tabs and the first route's stops by default", () => {
    render(<ColectivoRoutesPage />);
    expect(screen.getByRole("button", { name: firstRoute.short })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(firstRouteStop.name)).toBeInTheDocument();
  });

  it("switches the stop list when another tab is selected", () => {
    render(<ColectivoRoutesPage />);
    fireEvent.click(screen.getByRole("button", { name: madison.short }));
    expect(screen.getByRole("button", { name: madison.short })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(madisonStop.name)).toBeInTheDocument();
    // The first route's (Milwaukee-only) stop is no longer shown.
    expect(screen.queryByText(firstRouteStop.name)).toBeNull();
  });
});
