import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddSectionFooter, SectionHeader } from "../SectionHeader";

/**
 * 005 T040 — a section's header row (FR-530, FR-531, FR-533): the name, the
 * unchecked count in words, the chevron with `aria-expanded`, the `•••`; a row
 * of the sequence that is never a handle. And the placeholder footer (FR-503).
 */
describe("SectionHeader", () => {
  function renderHeader(folded = false) {
    const onToggleFold = vi.fn();
    const onMenu = vi.fn();
    render(
      <ul>
        <SectionHeader section="Bakery" count={2} folded={folded} onToggleFold={onToggleFold} onMenu={onMenu} />
      </ul>,
    );
    return { onToggleFold, onMenu };
  }

  it("draws the name, the count in words, and a chevron that says it is unfolded", () => {
    const { onToggleFold } = renderHeader();
    expect(screen.getByText("Bakery")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    const fold = screen.getByRole("button", { name: "Fold Bakery" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(fold);
    expect(onToggleFold).toHaveBeenCalledTimes(1);
  });

  it("says Unfold when folded, with aria-expanded false", () => {
    renderHeader(true);
    expect(screen.getByRole("button", { name: "Unfold Bakery" })).toHaveAttribute("aria-expanded", "false");
  });

  it("is a row of the sequence, never a handle, and opens its menu from the •••", () => {
    const { onMenu } = renderHeader();
    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-list-row");
    expect(row).toHaveAttribute("data-section-row", "Bakery");
    expect(row).not.toHaveAttribute("data-item-handle");
    fireEvent.click(screen.getByRole("button", { name: "Bakery menu" }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("counts one item in the singular", () => {
    render(
      <ul>
        <SectionHeader section="Deli" count={1} folded={false} onToggleFold={vi.fn()} onMenu={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });
});

describe("AddSectionFooter", () => {
  it("is the header in its placeholder state — Add section, a count of 0 — and begins Add section", () => {
    const onAdd = vi.fn();
    render(<AddSectionFooter onAdd={onAdd} />);
    const footer = screen.getByRole("button", { name: /Add section/ });
    expect(footer).toHaveAttribute("data-add-section");
    expect(footer).toHaveTextContent("0 items");
    fireEvent.click(footer);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
