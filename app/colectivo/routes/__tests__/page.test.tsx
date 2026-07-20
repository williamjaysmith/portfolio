import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ColectivoRoutesPage from "@/app/colectivo/routes/page";

describe("ColectivoRoutesPage", () => {
  beforeEach(() => localStorage.clear());

  it("shows the tabs and the first route's stops by default", () => {
    render(<ColectivoRoutesPage />);
    expect(screen.getByRole("button", { name: "MIL" })).toHaveAttribute("aria-current", "page");
    // Milwaukee stop is visible by default.
    expect(screen.getByText("Colectivo Prospect")).toBeInTheDocument();
  });

  it("switches the stop list when another tab is selected", () => {
    render(<ColectivoRoutesPage />);
    fireEvent.click(screen.getByRole("button", { name: "MAD" }));
    expect(screen.getByRole("button", { name: "MAD" })).toHaveAttribute("aria-current", "page");
    // Madison stop appears; the Milwaukee-only stop is gone.
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    expect(screen.queryByText("Colectivo Prospect")).toBeNull();
  });
});
