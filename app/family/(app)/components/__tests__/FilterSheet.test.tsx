import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilterSheet } from "../FilterSheet";
import { makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

/** FR-033: anyone can hide a profile on this device, without punching in. */
describe("FilterSheet", () => {
  beforeEach(stubDialog);

  const alex = makeCategory({ id: "a", label: "Alex" });
  const kit = makeCategory({ id: "k", label: "Kit", role: "member" });

  it("opens a list of everyone from the Filter pill", () => {
    render(withFamily(makeContext({ categories: [alex, kit] }), <FilterSheet />));
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.getByRole("checkbox", { name: /Alex/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Kit/ })).toBeChecked();
  });

  it("hides a profile when its box is unchecked", () => {
    const setHidden = vi.fn();
    render(withFamily(makeContext({ categories: [alex, kit], setHidden }), <FilterSheet />));

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Kit/ }));

    expect(setHidden).toHaveBeenCalledWith("k", true);
  });

  it("shows a hidden profile as unchecked", () => {
    const context = makeContext({
      categories: [alex, kit],
      hiddenIds: new Set(["k"]),
      visibleProfiles: [alex],
    });
    render(withFamily(context, <FilterSheet />));
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.getByRole("checkbox", { name: /Kit/ })).not.toBeChecked();
  });

  it("restores everyone with Show all", () => {
    const showAll = vi.fn();
    render(withFamily(makeContext({ categories: [alex, kit], showAll }), <FilterSheet />));

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(showAll).toHaveBeenCalled();
  });

  it("says so quietly when the choice cannot be remembered (constitution §VI)", () => {
    const context = makeContext({ categories: [alex], visibilityPersists: false });
    render(withFamily(context, <FilterSheet />));
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.getByText(/won.t be remembered on this device/)).toBeInTheDocument();
  });
});
