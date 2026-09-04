import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";

import { FilterSheet } from "../FilterSheet";
import { makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

/**
 * FR-033: anyone can hide a profile on this device, without punching in.
 *
 * T062 adds the Labels section (FR-264): the same rows with a colour swatch in
 * place of the avatar, the same `setHidden`, and the one Show all clearing both
 * kinds — because the store underneath was always keyed by category id (R212).
 */
describe("FilterSheet", () => {
  beforeEach(stubDialog);

  const alex = makeCategory({ id: "a", label: "Alex" });
  const kit = makeCategory({ id: "k", label: "Kit", role: "member" });
  const binDay = makeCategory({
    id: "bin",
    label: "Bin day",
    isProfile: false,
    role: "member",
    emoji: "🗑️",
    color: PALETTE[17],
  });

  function openSheet(): void {
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  }

  it("opens a list of everyone from the Filter pill", () => {
    render(withFamily(makeContext({ categories: [alex, kit] }), <FilterSheet />));
    openSheet();

    expect(screen.getByRole("checkbox", { name: /Alex/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Kit/ })).toBeChecked();
  });

  it("hides a profile when its box is unchecked", () => {
    const setHidden = vi.fn();
    render(withFamily(makeContext({ categories: [alex, kit], setHidden }), <FilterSheet />));

    openSheet();
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
    openSheet();

    expect(screen.getByRole("checkbox", { name: /Kit/ })).not.toBeChecked();
  });

  it("restores everyone with Show all", () => {
    const showAll = vi.fn();
    render(withFamily(makeContext({ categories: [alex, kit], showAll }), <FilterSheet />));

    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(showAll).toHaveBeenCalled();
  });

  it("says so quietly when the choice cannot be remembered (constitution §VI)", () => {
    const context = makeContext({ categories: [alex], visibilityPersists: false });
    render(withFamily(context, <FilterSheet />));
    openSheet();

    expect(screen.getByText(/won.t be remembered on this device/)).toBeInTheDocument();
  });

  it("lists Labels in their own section beside Profiles (FR-264)", () => {
    render(withFamily(makeContext({ categories: [alex, binDay] }), <FilterSheet />));
    openSheet();

    expect(screen.getByRole("heading", { name: "Profiles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Labels" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Bin day/ })).toBeChecked();
  });

  it("hides a label through the same setHidden as a profile (FR-266, R212)", () => {
    const setHidden = vi.fn();
    render(withFamily(makeContext({ categories: [alex, binDay], setHidden }), <FilterSheet />));

    openSheet();
    fireEvent.click(screen.getByRole("checkbox", { name: /Bin day/ }));

    expect(setHidden).toHaveBeenCalledWith("bin", true);
  });

  it("shows a hidden label as unchecked", () => {
    const context = makeContext({ categories: [alex, binDay], hiddenIds: new Set(["bin"]) });
    render(withFamily(context, <FilterSheet />));
    openSheet();

    expect(screen.getByRole("checkbox", { name: /Bin day/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Alex/ })).toBeChecked();
  });

  it("wears the label's own colour as its swatch", () => {
    render(withFamily(makeContext({ categories: [binDay] }), <FilterSheet />));
    openSheet();

    const row = screen.getByRole("checkbox", { name: /Bin day/ }).closest("label");
    expect(row?.querySelector("span[aria-hidden='true']")).toHaveStyle({
      backgroundColor: PALETTE[17],
    });
  });

  it("offers one Show all for both kinds, hidden or not (FR-264, US4-9)", () => {
    const showAll = vi.fn();
    const context = makeContext({
      categories: [alex, binDay],
      hiddenIds: new Set(["a", "bin"]),
      visibleProfiles: [],
      showAll,
    });
    render(withFamily(context, <FilterSheet />));
    openSheet();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(showAll).toHaveBeenCalledTimes(1);
  });

  it("leaves the Labels section out of a household with no labels", () => {
    render(withFamily(makeContext({ categories: [alex] }), <FilterSheet />));
    openSheet();

    expect(screen.queryByRole("heading", { name: "Labels" })).not.toBeInTheDocument();
  });
});
