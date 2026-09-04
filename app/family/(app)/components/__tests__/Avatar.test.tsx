import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  INK_DARK,
  INK_LIGHT,
  PALETTE,
  contrastRatio,
  inkOn,
} from "@/lib/family/colors";

import { Avatar } from "../Avatar";
import { makeCategory } from "./family-test-utils";

/**
 * FR-039 / SC-009: the initials fallback is the documented default for a
 * profile with no picture (D24), so it is the element that carries a person's
 * identity most often. Its ink has to be chosen per colour — white initials
 * are 1.50:1 on Sprout and 1.37:1 on Sunshine, i.e. invisible.
 */
describe("Avatar", () => {
  it("draws initials on the profile's own colour when there is no picture", () => {
    const { container } = render(
      <Avatar category={makeCategory({ label: "Alex Smith", color: PALETTE[13] })} />,
    );

    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(container.querySelector(".fam-profile")).toHaveStyle({ "--profile": PALETTE[13] });
  });

  it("inks the initials to clear WCAG AA on every one of the 20 palette colours", () => {
    for (const hex of PALETTE) {
      const view = render(<Avatar category={makeCategory({ label: "Kit", color: hex })} />);
      const ink = inkOn(hex);

      expect(screen.getByText("K")).toHaveStyle({ color: ink });
      expect(contrastRatio(hex, ink)).toBeGreaterThanOrEqual(4.5);
      view.unmount();
    }
  });

  it("does not hard-code white on the pale colours", () => {
    render(<Avatar category={makeCategory({ label: "Sprout", color: "#B6E085" })} />);
    expect(screen.getByText("S")).toHaveStyle({ color: INK_DARK });
  });

  it("still uses white where white is the legible ink", () => {
    render(<Avatar category={makeCategory({ label: "River", color: "#00526D" })} />);
    expect(screen.getByText("R")).toHaveStyle({ color: INK_LIGHT });
  });

  it("inks a Label's emoji the same way", () => {
    render(
      <Avatar
        category={makeCategory({
          isProfile: false,
          role: "member",
          label: "Holidays",
          color: "#FBD97E",
          emoji: "🎉",
        })}
      />,
    );
    expect(screen.getByText("🎉")).toHaveStyle({ color: INK_DARK });
  });

  it("renders the illustration instead of initials when the profile has one", () => {
    render(
      <Avatar
        category={makeCategory({ label: "Alex", avatarKind: "illustration", avatarId: "fox" })}
      />,
    );
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(document.querySelector("img")?.getAttribute("src")).toContain("fox.svg");
  });
});
