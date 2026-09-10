import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PALETTE } from "@/lib/family/colors";

import { ProfileChip } from "../ProfileChip";
import { ProfileChipRow } from "../ProfileChipRow";
import { makeCategory, makeContext, withFamily } from "./family-test-utils";

/**
 * FR-032/FR-036/FR-039: each chip is the person's face ringed in their own
 * colour. The operator retired the visible name on 2026-09-10 — "we know who it
 * is" — so the name is `sr-only` rather than gone: `Avatar` is `aria-hidden`, so
 * dropping it altogether would leave the row a focus stop announcing nothing
 * (SC-009), and colour would become the only carrier (FR-039).
 */
describe("ProfileChip", () => {
  it("sets the profile colour once, for the ring to derive from", () => {
    const category = makeCategory({ label: "Sam", color: PALETTE[8] });
    const { container } = render(<ProfileChip category={category} />);

    const chip = container.querySelector(".fam-profile");
    expect(chip).toHaveStyle({ "--profile": PALETTE[8] });
    expect(container.querySelector(".fam-ring")).toBeInTheDocument();
  });

  it("names the person for a screen reader without drawing the name", () => {
    const category = makeCategory({ label: "Sam", avatarKind: "illustration", avatarId: "fox" });
    const { container } = render(<ProfileChip category={category} />);

    const name = screen.getByText("Sam");
    expect(name).toBeInTheDocument();
    expect(name.className).toContain("sr-only");
    // Nothing outside that one hidden span carries text: the chip draws a face
    // and a ring, and the count the reference puts here lives on the Tasks tab.
    expect(container.textContent).toBe("Sam");
  });

  it("falls back to initials when there is no avatar", () => {
    render(<ProfileChip category={makeCategory({ label: "Alex Smith" })} />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });
});

describe("ProfileChipRow", () => {
  const alex = makeCategory({ id: "a", label: "Alex" });
  const kit = makeCategory({ id: "k", label: "Kit", role: "member" });

  it("prompts a parent to add the family when nobody exists (spec edge case)", () => {
    render(withFamily(makeContext({ categories: [] }), <ProfileChipRow />));
    expect(screen.getByText(/Nobody.s here yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "add the family in Settings" })).toBeInTheDocument();
  });

  it("renders a chip per profile", () => {
    const context = makeContext({ categories: [alex, kit] });
    render(withFamily(context, <ProfileChipRow />));

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Kit")).toBeInTheDocument();
  });

  /**
   * SC-009: this is the one region in the shell that scrolls sideways. On a
   * phone the people past the right edge can only be reached by scrolling it,
   * so it has to be able to take focus — and to say what it is when it does.
   */
  it("is a named region the keyboard can reach and scroll", () => {
    const context = makeContext({ categories: [alex, kit] });
    render(withFamily(context, <ProfileChipRow />));

    const scroller = screen.getByRole("group", { name: "Family" });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller.className).toContain("overflow-x-auto");
  });

  it("leaves out profiles hidden on this device (FR-033)", () => {
    const context = makeContext({
      categories: [alex, kit],
      hiddenIds: new Set(["k"]),
      visibleProfiles: [alex],
    });
    render(withFamily(context, <ProfileChipRow />));

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.queryByText("Kit")).not.toBeInTheDocument();
  });

  it("does not put labels in the chip row", () => {
    const holidays = makeCategory({ id: "h", label: "Holidays", isProfile: false, emoji: "🎉" });
    const context = makeContext({ categories: [alex, holidays] });
    render(withFamily(context, <ProfileChipRow />));

    expect(screen.queryByText("Holidays")).not.toBeInTheDocument();
  });
});
