import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { getRoute } from "@/lib/colectivo";
import { createMemoryBackend } from "@/lib/colectivo-storage";
import { StopList } from "@/app/colectivo/routes/StopList";

const madison = getRoute("madison")!;

describe("StopList", () => {
  it("renders the route's stops", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    expect(screen.getByText("Colectivo Monroe")).toBeInTheDocument();
  });

  it("hides a stop from the active list once marked delivered", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    const row = screen.getByText("Colectivo Hilldale").closest("div")!;
    fireEvent.click(within(row.parentElement!.parentElement!).getByRole("button", { name: /mark delivered/i }));
    expect(screen.queryByText("Colectivo Hilldale")).toBeNull();
    expect(screen.getByRole("button", { name: /show delivered \(1\)/i })).toBeInTheDocument();
  });

  it("reveals delivered stops when Show delivered is toggled", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    const marks = screen.getAllByRole("button", { name: /mark delivered/i });
    fireEvent.click(marks[0]);
    fireEvent.click(screen.getByRole("button", { name: /show delivered/i }));
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
  });

  it("opens the add-stop sheet", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /add stop/i }));
    expect(screen.getByText(/add a stop to madison/i)).toBeInTheDocument();
  });
});
