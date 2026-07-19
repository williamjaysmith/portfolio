import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getRoute } from "@/lib/colectivo";
import { AddStopSheet } from "@/app/colectivo/routes/AddStopSheet";

const madison = getRoute("madison")!;

describe("AddStopSheet", () => {
  it("lists stops not already on the route", () => {
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    // A Milwaukee stop should be offered; a Madison-native stop should not.
    expect(screen.getByText("Colectivo Prospect")).toBeInTheDocument();
    expect(screen.queryByText("Colectivo Hilldale")).toBeNull();
  });

  it("filters by the search box", () => {
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "downer" } });
    expect(screen.getByText("Colectivo Downer")).toBeInTheDocument();
    expect(screen.queryByText("Colectivo Prospect")).toBeNull();
  });

  it("calls onAdd with the chosen stop id", () => {
    const onAdd = vi.fn();
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={onAdd} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /add colectivo prospect/i }));
    expect(onAdd).toHaveBeenCalledWith("prospect");
  });
});
