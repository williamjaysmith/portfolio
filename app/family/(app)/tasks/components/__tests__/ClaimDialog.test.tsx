import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { ActorSession, Category } from "@/lib/family/types";

import { makeActor, makeCategory, stubDialog } from "../../../components/__tests__/family-test-utils";
import { ClaimDialog } from "../ClaimDialog";

/**
 * T062 — FR-367's claim: open an Up for Grabs card, choose the Profile to
 * credit, complete it. Nothing moves and nothing is reassigned; the stored
 * credit is the whole of it.
 *
 * Who is OFFERED whom is affordance only (FR-350, R323) — a member sees only
 * themselves, a parent sees everybody, and with nobody punched in everybody is
 * offered, because the punch-in arrives at the moment of the tap and refusing
 * here would make the sheet unusable before it. The server is the gate in every
 * one of those cases, and US3-13's refusal is proved against it in the policies
 * tier, not here.
 */

const ANA = makeCategory({ id: "ana", label: "Ana", role: "parent", color: PALETTE[13] });
const BEN = makeCategory({ id: "ben", label: "Ben", role: "member", color: PALETTE[4] });
const CLEO = makeCategory({ id: "cleo", label: "Cleo", role: "member", color: PALETTE[8] });
const BIN_DAY = makeCategory({ id: "bin", label: "Bin day", isProfile: false });

const PROFILES: Category[] = [ANA, BEN, CLEO, BIN_DAY];

function renderDialog(actor: ActorSession | null, overrides: { notice?: string | null } = {}) {
  const onClaim = vi.fn();
  const onCancel = vi.fn();
  render(
    <ClaimDialog
      summary="Empty the dishwasher"
      profiles={PROFILES}
      actor={actor}
      notice={overrides.notice ?? null}
      onClaim={onClaim}
      onCancel={onCancel}
    />,
  );
  return { onClaim, onCancel };
}

function offered(): string[] {
  return screen.getAllByRole("radio").map((input) => input.getAttribute("value") ?? "");
}

describe("ClaimDialog (FR-367, FR-370, US3-9, US3-13)", () => {
  beforeEach(() => {
    stubDialog();
  });

  it("names the chore it is about", () => {
    renderDialog(makeActor("parent", { profileId: ANA.id, label: "Ana" }));
    expect(screen.getByText(/Empty the dishwasher/)).toBeInTheDocument();
  });

  it("offers a parent every Profile, and never a Label (FR-323)", () => {
    renderDialog(makeActor("parent", { profileId: ANA.id, label: "Ana" }));
    expect(offered()).toEqual([ANA.id, BEN.id, CLEO.id]);
  });

  it("offers a member only themselves (US3-13)", () => {
    renderDialog(makeActor("member", { profileId: CLEO.id, label: "Cleo" }));
    expect(offered()).toEqual([CLEO.id]);
  });

  it("offers everybody when nobody is punched in — the punch-in arrives with the write (FR-350)", () => {
    renderDialog(null);
    expect(offered()).toEqual([ANA.id, BEN.id, CLEO.id]);
  });

  it("starts on the punched-in Profile's own face, which is the common case", () => {
    renderDialog(makeActor("parent", { profileId: BEN.id, label: "Ben" }));
    expect(screen.getByRole("radio", { name: "Ben" })).toBeChecked();
  });

  it("credits the chosen Profile and completes in one step (US3-9)", () => {
    const { onClaim } = renderDialog(makeActor("parent", { profileId: ANA.id, label: "Ana" }));
    fireEvent.click(screen.getByRole("radio", { name: "Cleo" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(onClaim).toHaveBeenCalledWith(CLEO.id);
  });

  it("shows the lost race in the server's own words, naming who got there first (FR-370)", () => {
    renderDialog(makeActor("member", { profileId: CLEO.id, label: "Cleo" }), {
      notice: "Ben already did that one.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Ben already did that one.");
  });

  it("cancels without claiming", () => {
    const { onClaim, onCancel } = renderDialog(makeActor("parent", { profileId: ANA.id }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onClaim).not.toHaveBeenCalled();
  });
});
