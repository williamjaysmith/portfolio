import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RouteSelector } from "@/app/colectivo/routes/RouteSelector";

describe("RouteSelector", () => {
  it("renders all four routes", () => {
    render(<RouteSelector onSelect={vi.fn()} />);
    ["Milwaukee", "Madison", "Chicago", "Kegs"].forEach((label) => {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    });
  });

  it("calls onSelect with the chosen route", () => {
    const onSelect = vi.fn();
    render(<RouteSelector onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /madison/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "madison" }));
  });
});
