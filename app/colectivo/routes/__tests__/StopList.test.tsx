import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getRoute, stops } from "@/lib/colectivo";
import { createMemoryBackend } from "@/lib/colectivo-storage";
import { StopList } from "@/app/colectivo/routes/StopList";

// Derive expectations from the real data so these survive any cafe/route edits.
const madison = getRoute("madison")!;
const first = stops[madison.stopIds[0]];
const second = stops[madison.stopIds[1]];

describe("StopList", () => {
  it("renders the route's stops", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    expect(screen.getByText(first.name)).toBeInTheDocument();
    expect(screen.getByText(second.name)).toBeInTheDocument();
  });

  it("hides a stop once its delivery is confirmed in the pop-up", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: `Mark ${first.name} delivered` }));
    fireEvent.click(screen.getByRole("button", { name: `Yes, delivered to ${first.name}` }));
    expect(screen.queryByText(first.name)).toBeNull();
  });

  it("does not deliver until the pop-up is confirmed", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: `Mark ${first.name} delivered` }));
    // Pop-up is open; the stop is still in the list.
    expect(screen.getByText(first.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(first.name)).toBeInTheDocument();
  });

  it("reveals delivered stops when Show delivered is toggled", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: `Mark ${first.name} delivered` }));
    fireEvent.click(screen.getByRole("button", { name: `Yes, delivered to ${first.name}` }));
    expect(screen.queryByText(first.name)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show delivered/i }));
    expect(screen.getByText(first.name)).toBeInTheDocument();
  });

  it("opens the add-stop sheet", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /add stop/i }));
    expect(screen.getByText(new RegExp(`add a stop to ${madison.label}`, "i"))).toBeInTheDocument();
  });
});
