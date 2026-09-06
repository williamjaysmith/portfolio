import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RepeatFieldset, repeatKindOf, type RepeatDraft } from "../RepeatFieldset";

/**
 * 006 T007 — the shared repeat control (002 FR-231/232, 006 FR-627): the four
 * choices in the reference's words, weekday boxes for weekly only, the until
 * date for every repeating kind, the one `repeat` refusal shown once. It reads
 * a `RepeatDraft`, so the event form and the meal form mount the same thing.
 */
function renderFieldset(overrides: Partial<RepeatDraft["draft"]> = {}, errors: RepeatDraft["errors"] = {}) {
  const form: RepeatDraft = {
    draft: { repeatKind: "never", weekdays: [], until: "", ...overrides },
    setRepeatKind: vi.fn(),
    toggleWeekday: vi.fn(),
    set: vi.fn(),
    errors,
  };
  render(<RepeatFieldset form={form} />);
  return form;
}

describe("RepeatFieldset", () => {
  it("offers exactly Never / Every day / Every week on chosen weekdays / Every month on the date", () => {
    renderFieldset();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Never",
      "Every day",
      "Every week on chosen weekdays",
      "Every month on the date",
    ]);
    expect(screen.queryByLabelText(/Repeats until/)).toBeNull();
  });

  it("shows the seven weekday boxes for weekly only, and the until date for every repeating kind", () => {
    const form = renderFieldset({ repeatKind: "weekly", weekdays: ["FR"] });
    expect(screen.getByRole("checkbox", { name: "Friday" })).toBeChecked();
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    fireEvent.click(screen.getByRole("checkbox", { name: "Monday" }));
    expect(form.toggleWeekday).toHaveBeenCalledWith("MO");
    fireEvent.change(screen.getByLabelText(/Repeats until/), { target: { value: "2026-12-31" } });
    expect(form.set).toHaveBeenCalledWith("until", "2026-12-31");
  });

  it("changes the kind through the caller, and maps an unknown value to Never", () => {
    const form = renderFieldset();
    fireEvent.change(screen.getByRole("combobox", { name: "Repeats" }), { target: { value: "daily" } });
    expect(form.setRepeatKind).toHaveBeenCalledWith("daily");
    expect(repeatKindOf("monthly")).toBe("monthly");
    expect(repeatKindOf("yearly")).toBe("never");
  });

  it("shows the repeat refusal once", () => {
    renderFieldset({ repeatKind: "weekly" }, { repeat: ["Choose at least one weekday."] });
    expect(screen.getByText("Choose at least one weekday.")).toBeInTheDocument();
  });
});
