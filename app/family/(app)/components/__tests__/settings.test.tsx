import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PALETTE, PALETTE_NAMES } from "@/lib/family/colors";

import { ColorPicker } from "../settings/ColorPicker";
import { makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

const setProfilePin = vi.fn();
const clearProfilePin = vi.fn();
vi.mock("@/lib/family/actions/pins", () => ({
  setProfilePin: (...args: unknown[]) => setProfilePin(...args),
  clearProfilePin: (...args: unknown[]) => clearProfilePin(...args),
}));

const { PinRow } = await import("../settings/PinRow");
const { DeleteDialog } = await import("../settings/DeleteDialog");

/** FR-021: only the 20 sanctioned colours, with a warning before a clash. */
describe("ColorPicker", () => {
  it("offers exactly the sanctioned palette", () => {
    render(<ColorPicker value={PALETTE[0]} onChange={vi.fn()} usedBy={[]} />);
    expect(screen.getAllByRole("radio")).toHaveLength(PALETTE.length);
    expect(screen.getByRole("radio", { name: PALETTE_NAMES[PALETTE[0]] })).toBeChecked();
  });

  it("warns that a colour is taken without blocking it (spec edge case)", () => {
    const sam = makeCategory({ id: "s", label: "Sam", color: PALETTE[5] });
    render(<ColorPicker value={PALETTE[5]} onChange={vi.fn()} usedBy={[sam]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Sam already uses this colour. You can still pick it",
    );
  });

  it("does not treat a category as clashing with itself", () => {
    const sam = makeCategory({ id: "s", label: "Sam", color: PALETTE[5] });
    render(<ColorPicker value={PALETTE[5]} onChange={vi.fn()} usedBy={[sam]} excludeId="s" />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("reports the chosen colour", () => {
    const onChange = vi.fn();
    render(<ColorPicker value={PALETTE[0]} onChange={onChange} usedBy={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: PALETTE_NAMES[PALETTE[3]] }));

    expect(onChange).toHaveBeenCalledWith(PALETTE[3]);
  });
});

/** FR-018 / D5: setting a PIN needs a session, not an actor — but never a child. */
describe("PinRow", () => {
  beforeEach(() => {
    setProfilePin.mockReset().mockResolvedValue({ ok: true, data: null });
    clearProfilePin.mockReset().mockResolvedValue({ ok: true, data: null });
  });

  const profile = makeCategory({ id: "p1", label: "Alex" });

  it("sets a PIN with nobody punched in, so a household cannot lock itself out", () => {
    render(withFamily(makeContext({ actor: null }), <PinRow profile={profile} />));
    fireEvent.click(screen.getByRole("button", { name: "Set PIN" }));

    fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Confirm"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(setProfilePin).toHaveBeenCalledWith("p1", "1234");
  });

  it("refuses to submit two different PINs", () => {
    render(withFamily(makeContext({ actor: null }), <PinRow profile={profile} />));
    fireEvent.click(screen.getByRole("button", { name: "Set PIN" }));

    fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Confirm"), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(setProfilePin).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Those PINs don't match.");
  });

  it("is disabled, not hidden, for a punched-in child (FR-015)", () => {
    const context = makeContext({ actor: { ...makeContext().actor!, role: "member" } as never });
    render(
      withFamily(
        makeContext({ actor: { profileId: "c1", label: "Kit", color: PALETTE[0], role: "member", expiresAt: "", ttlSeconds: 180 } }),
        <PinRow profile={profile} />,
      ),
    );
    void context;

    expect(screen.getByRole("button", { name: "Set PIN" })).toBeDisabled();
    expect(screen.getByText("Parents only")).toBeInTheDocument();
  });

  it("offers to remove an existing PIN", () => {
    render(
      withFamily(makeContext({ actor: null }), <PinRow profile={{ ...profile, hasPin: true }} />),
    );
    expect(screen.getByRole("button", { name: "Reset PIN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove PIN" })).toBeInTheDocument();
  });
});

/** FR-026: say exactly what will be lost, and never orphan the household. */
describe("DeleteDialog", () => {
  beforeEach(stubDialog);

  const alex = makeCategory({ id: "a", label: "Alex", role: "parent" });
  const sam = makeCategory({ id: "s", label: "Sam", role: "parent" });

  it("spells out what deleting a person removes", () => {
    const context = makeContext({ categories: [alex, sam] });
    render(withFamily(context, <DeleteDialog category={alex} onClose={vi.fn()} />));

    expect(screen.getByRole("heading", { name: "Delete Alex?" })).toBeInTheDocument();
    expect(screen.getByText(/removes Alex's profile, colour, avatar and PIN/)).toBeInTheDocument();
  });

  it("refuses to delete the only parent, and says why", () => {
    const context = makeContext({ categories: [alex] });
    render(withFamily(context, <DeleteDialog category={alex} onClose={vi.fn()} />));

    expect(screen.getByRole("button", { name: "Delete Alex" })).toBeDisabled();
    expect(screen.getByText(/can.t delete the only parent/)).toBeInTheDocument();
  });

  it("warns you that deleting yourself punches you out", () => {
    const context = makeContext({
      categories: [alex, sam],
      actor: { profileId: "a", label: "Alex", color: alex.color, role: "parent", expiresAt: "", ttlSeconds: 180 },
    });
    render(withFamily(context, <DeleteDialog category={alex} onClose={vi.fn()} />));

    expect(screen.getByText(/you.ll be punched out/)).toBeInTheDocument();
  });

  it("uses label wording for a label", () => {
    const holidays = makeCategory({ id: "h", label: "Holidays", isProfile: false, emoji: "🎉" });
    const context = makeContext({ categories: [alex, holidays] });
    render(withFamily(context, <DeleteDialog category={holidays} onClose={vi.fn()} />));

    expect(screen.getByRole("heading", { name: "Delete the Holidays label?" })).toBeInTheDocument();
  });
});
