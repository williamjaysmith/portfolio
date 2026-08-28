import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getRoute, stops } from "@/lib/colectivo";
import { AddStopSheet } from "@/app/colectivo/routes/AddStopSheet";

// Data-derived: a stop from another route (a valid candidate to add to Madison),
// a second such candidate, and a stop already on Madison (should not be offered).
const madison = getRoute("madison")!;
const otherRoute = getRoute("milwaukee")!;
const candidate = stops[otherRoute.stopIds[0]];
const candidate2 = stops[otherRoute.stopIds[1]];
const onRoute = stops[madison.stopIds[0]];

describe("AddStopSheet", () => {
  it("lists stops not already on the route", () => {
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(candidate.name)).toBeInTheDocument();
    expect(screen.queryByText(onRoute.name)).toBeNull();
  });

  it("filters by the search box", () => {
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: candidate.name } });
    expect(screen.getByText(candidate.name)).toBeInTheDocument();
    expect(screen.queryByText(candidate2.name)).toBeNull();
  });

  it("calls onAdd with the chosen stop id", () => {
    const onAdd = vi.fn();
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={onAdd} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: `Add ${candidate.name}` }));
    expect(onAdd).toHaveBeenCalledWith(candidate.id);
  });
});
