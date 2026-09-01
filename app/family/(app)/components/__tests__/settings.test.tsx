import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AVATAR_IDS, AVATAR_LABELS } from "@/lib/family/avatars";
import { PALETTE, PALETTE_NAMES, type PaletteColor } from "@/lib/family/colors";

import type { FamilyContextValue } from "../FamilyProvider";
import { AvatarPicker } from "../settings/AvatarPicker";
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

  /**
   * SC-009: a radio group is ONE tab stop with the arrows moving inside it.
   * Twenty stops between the name field and Save is not "operable by keyboard".
   */
  describe("the keyboard model", () => {
    const swatch = (index: number) =>
      screen.getByRole("radio", { name: PALETTE_NAMES[PALETTE[index]] });

    function renderPicker(selected = 0) {
      const onChange = vi.fn();
      render(<ColorPicker value={PALETTE[selected]} onChange={onChange} usedBy={[]} />);
      return onChange;
    }

    it("puts a single tab stop on the chosen swatch", () => {
      renderPicker(3);
      const stops = screen.getAllByRole("radio").filter((option) => option.tabIndex === 0);

      expect(stops).toEqual([swatch(3)]);
      expect(swatch(0).tabIndex).toBe(-1);
    });

    /** A colour retired from the palette must still leave a way into the group. */
    it("falls back to the first swatch when the value is not on the palette", () => {
      render(<ColorPicker value={"#123456" as PaletteColor} onChange={vi.fn()} usedBy={[]} />);
      const stops = screen.getAllByRole("radio").filter((option) => option.tabIndex === 0);

      expect(stops).toEqual([swatch(0)]);
    });

    it("moves selection and focus with the arrow keys", () => {
      const onChange = renderPicker(0);
      fireEvent.keyDown(swatch(0), { key: "ArrowRight" });

      expect(onChange).toHaveBeenCalledWith(PALETTE[1]);
      expect(swatch(1)).toHaveFocus();
    });

    it("treats Down as forward and Up as back, like a radio group", () => {
      const onChange = renderPicker(2);
      fireEvent.keyDown(swatch(2), { key: "ArrowDown" });
      expect(onChange).toHaveBeenLastCalledWith(PALETTE[3]);

      fireEvent.keyDown(swatch(2), { key: "ArrowUp" });
      expect(onChange).toHaveBeenLastCalledWith(PALETTE[1]);
    });

    it("wraps around both ends", () => {
      const last = PALETTE.length - 1;
      const onChange = renderPicker(0);
      fireEvent.keyDown(swatch(0), { key: "ArrowLeft" });

      expect(onChange).toHaveBeenCalledWith(PALETTE[last]);
      expect(swatch(last)).toHaveFocus();
    });

    it("jumps to the ends with Home and End", () => {
      const last = PALETTE.length - 1;
      const onChange = renderPicker(5);

      fireEvent.keyDown(swatch(5), { key: "End" });
      expect(onChange).toHaveBeenLastCalledWith(PALETTE[last]);
      expect(swatch(last)).toHaveFocus();

      fireEvent.keyDown(swatch(5), { key: "Home" });
      expect(onChange).toHaveBeenLastCalledWith(PALETTE[0]);
      expect(swatch(0)).toHaveFocus();
    });

    it("leaves keys it does not own alone, so Tab still leaves the group", () => {
      const onChange = renderPicker(0);
      fireEvent.keyDown(swatch(0), { key: "Tab" });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

/** FR-022 + SC-009: the same radio group model for the illustrated avatars. */
describe("AvatarPicker", () => {
  const NO_AVATAR = "No avatar — use initials";
  const face = (id: (typeof AVATAR_IDS)[number]) =>
    screen.getByRole("radio", { name: AVATAR_LABELS[id] });

  it("offers every illustration plus the initials default", () => {
    render(<AvatarPicker value={null} onChange={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(AVATAR_IDS.length + 1);
    expect(screen.getByRole("radio", { name: NO_AVATAR })).toBeChecked();
  });

  it("reports the chosen illustration, and the way back to initials", () => {
    const onChange = vi.fn();
    render(<AvatarPicker value="fox" onChange={onChange} />);

    fireEvent.click(face("bear"));
    expect(onChange).toHaveBeenLastCalledWith("bear");

    fireEvent.click(screen.getByRole("radio", { name: NO_AVATAR }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("puts a single tab stop on the chosen face", () => {
    render(<AvatarPicker value="bunny" onChange={vi.fn()} />);
    const stops = screen.getAllByRole("radio").filter((option) => option.tabIndex === 0);

    expect(stops).toEqual([face("bunny")]);
  });

  it("moves selection and focus with the arrow keys, initials included", () => {
    const onChange = vi.fn();
    render(<AvatarPicker value="fox" onChange={onChange} />);

    fireEvent.keyDown(face("fox"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("bear");
    expect(face("bear")).toHaveFocus();

    fireEvent.keyDown(face("fox"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("radio", { name: NO_AVATAR })).toHaveFocus();
  });

  it("jumps to the ends with Home and End", () => {
    const onChange = vi.fn();
    render(<AvatarPicker value="fox" onChange={onChange} />);

    fireEvent.keyDown(face("fox"), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(AVATAR_IDS[AVATAR_IDS.length - 1]);

    fireEvent.keyDown(face("fox"), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(null);
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

  /**
   * The window closes as soon as it can: once a parent holds a PIN, somebody
   * can punch in to authorise this, so nobody at the always-signed-in tablet
   * gets to reset a parent's PIN without doing so.
   */
  it("goes through the punch-in gate once a parent holds a PIN", async () => {
    const withActor: FamilyContextValue["withActor"] = vi.fn(async (run) => run());
    const parentWithPin = makeCategory({ id: "p1", label: "Alex", role: "parent", hasPin: true });
    const context = makeContext({ categories: [parentWithPin], actor: null, withActor });

    render(withFamily(context, <PinRow profile={parentWithPin} />));
    fireEvent.click(screen.getByRole("button", { name: "Reset PIN" }));
    fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Confirm"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(withActor).toHaveBeenCalled();
    expect(setProfilePin).toHaveBeenCalledWith("p1", "1234");
  });

  it("skips the gate while no parent could punch in yet (SC-010)", () => {
    const withActor: FamilyContextValue["withActor"] = vi.fn(async (run) => run());
    const parentNoPin = makeCategory({ id: "p1", label: "Alex", role: "parent", hasPin: false });
    const context = makeContext({ categories: [parentNoPin], actor: null, withActor });

    render(withFamily(context, <PinRow profile={parentNoPin} />));
    fireEvent.click(screen.getByRole("button", { name: "Set PIN" }));
    fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Confirm"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(withActor).not.toHaveBeenCalled();
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

  /**
   * SC-009: the dialog is unmounted rather than closed, so nothing hands the
   * keyboard back by itself — focus lands on <body> and the next Tab restarts
   * from the top of the document.
   */
  it("gives the keyboard back to the control that opened it", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return withFamily(
        makeContext({ categories: [alex, sam] }),
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Delete
          </button>
          {open ? <DeleteDialog category={alex} onClose={() => setOpen(false)} /> : null}
        </>,
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Delete" });
    opener.focus();
    fireEvent.click(opener);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();

    fireEvent.click(cancel);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("uses label wording for a label", () => {
    const holidays = makeCategory({ id: "h", label: "Holidays", isProfile: false, emoji: "🎉" });
    const context = makeContext({ categories: [alex, holidays] });
    render(withFamily(context, <DeleteDialog category={holidays} onClose={vi.fn()} />));

    expect(screen.getByRole("heading", { name: "Delete the Holidays label?" })).toBeInTheDocument();
  });
});
