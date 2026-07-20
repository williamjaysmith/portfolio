import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColectivoLogo } from "@/app/colectivo/routes/ColectivoLogo";

describe("ColectivoLogo", () => {
  it("renders an accessible Colectivo wordmark as an svg", () => {
    render(<ColectivoLogo className="w-56" />);
    const logo = screen.getByRole("img", { name: "Colectivo Routes" });
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo).toHaveClass("w-56");
  });
});
