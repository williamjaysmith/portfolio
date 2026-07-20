import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("hides a stop from the active list once confirmed delivered", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /mark colectivo hilldale delivered/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm colectivo hilldale delivered/i }));
    expect(screen.queryByText("Colectivo Hilldale")).toBeNull();
    expect(screen.getByRole("button", { name: /show delivered \(1\)/i })).toBeInTheDocument();
  });

  it("does not deliver until the confirm is tapped", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /mark colectivo hilldale delivered/i }));
    // Still present — awaiting confirm.
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show delivered \(0\)/i })).toBeInTheDocument();
  });

  it("reveals delivered stops when Show delivered is toggled", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /mark colectivo hilldale delivered/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm colectivo hilldale delivered/i }));
    fireEvent.click(screen.getByRole("button", { name: /show delivered/i }));
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
  });

  it("opens the add-stop sheet", () => {
    render(<StopList route={madison} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /add stop/i }));
    expect(screen.getByText(/add a stop to madison/i)).toBeInTheDocument();
  });
});
