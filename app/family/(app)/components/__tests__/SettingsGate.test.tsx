import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsGate } from "../settings/SettingsGate";
import { makeActor, makeCategory, makeContext, withFamily } from "./family-test-utils";

/**
 * The Settings door (the operator's ask: *"i feel like my daughter doesnt need
 * to get into the settings tab — so maybe that could be gated prior to getting
 * in, rather than on a selection"*).
 *
 * **What this suite does NOT claim.** It does not test that a child cannot
 * reach the household's settings data — nothing in the browser could, and the
 * server has always been what enforces that. It tests the affordance: who is
 * shown the screen, who is shown the door, and that the door opens.
 */

const INSIDE = "Household name";

const PARENT = makeCategory({ id: "p1", label: "Alex", role: "parent", hasPin: true });

function renderGate(
  actor: ReturnType<typeof makeActor> | null,
  { openPunchIn = vi.fn(), categories = [PARENT] } = {},
) {
  render(
    withFamily(
      makeContext({ actor, categories, openPunchIn: openPunchIn as never }),
      <SettingsGate>
        <p>{INSIDE}</p>
      </SettingsGate>,
    ),
  );
  return { openPunchIn };
}

describe("SettingsGate", () => {
  it("lets a punched-in parent straight through", () => {
    renderGate(makeActor("parent"));
    expect(screen.getByText(INSIDE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Punch in" })).toBeNull();
  });

  it("shows the door, not the screen, when nobody is punched in", () => {
    renderGate(null);
    expect(screen.queryByText(INSIDE)).toBeNull();
    expect(screen.getByRole("heading", { name: "Settings is for parents" })).toBeInTheDocument();
  });

  /** The case the ask is actually about: a child is in, and Settings is not theirs. */
  it("shows the door to a punched-in MEMBER, and names them", () => {
    renderGate(makeActor("member", { label: "Cleo" }));
    expect(screen.queryByText(INSIDE)).toBeNull();
    expect(screen.getByText(/Cleo is punched in/)).toBeInTheDocument();
  });

  /**
   * And it must still OPEN for them — a parent standing beside their child takes
   * the device and taps once, rather than having to punch the child out first.
   */
  it("opens the punch-in sheet from the door, even with a member already in", () => {
    const { openPunchIn } = renderGate(makeActor("member", { label: "Cleo" }));
    fireEvent.click(screen.getByRole("button", { name: "Punch in" }));
    expect(openPunchIn).toHaveBeenCalledTimes(1);
  });

  /**
   * **The no-lockout rule, and the reason this gate is not a one-way door.**
   * PINs are set inside Settings and punching in needs one, so asking for a
   * parent before any parent HAS a PIN would shut the household out of its own
   * settings for good — which is the state every fresh household and every
   * `db reset` begins in. `setProfilePin` draws the same line server-side.
   */
  it("stands aside entirely until a parent actually holds a PIN", () => {
    const noPins = [makeCategory({ id: "p1", label: "Alex", role: "parent", hasPin: false })];
    renderGate(null, { categories: noPins });
    expect(screen.getByText(INSIDE)).toBeInTheDocument();
  });

  it("closes as soon as one parent has a PIN, even if others do not", () => {
    renderGate(null, {
      categories: [
        PARENT,
        makeCategory({ id: "p2", label: "Sam", role: "parent", hasPin: false }),
      ],
    });
    expect(screen.queryByText(INSIDE)).toBeNull();
  });

  /**
   * **The bug the browser pass found, on the household's own setup path.**
   * Setting the first PIN is what makes the no-lockout condition false, so a
   * live check ejected the person from Settings at the moment they used it:
   * they saved a PIN, `has_pin` flipped, and the form they were standing in was
   * replaced by a door they could not open — they had just created the first
   * PIN and were not punched in.
   */
  it("does not slam shut on the person who just set the first PIN", () => {
    const before = [makeCategory({ id: "p1", label: "Alex", role: "parent", hasPin: false })];
    const { rerender } = render(
      withFamily(
        makeContext({ actor: null, categories: before }),
        <SettingsGate>
          <p>{INSIDE}</p>
        </SettingsGate>,
      ),
    );
    expect(screen.getByText(INSIDE)).toBeInTheDocument();

    // The PIN lands; the household now has a parent who holds one.
    rerender(
      withFamily(
        makeContext({ actor: null, categories: [PARENT] }),
        <SettingsGate>
          <p>{INSIDE}</p>
        </SettingsGate>,
      ),
    );
    expect(screen.getByText(INSIDE)).toBeInTheDocument();
  });

  /**
   * **The hole the first latch left, and the reason it latches on the first
   * KNOWN answer instead of the first render.** On a full page load the
   * household's profiles have not arrived yet, so an empty list makes "no
   * parent has a PIN" vacuously true — and a mount-time latch then held the
   * gate open for the whole session, letting a punched-in member into the
   * entire screen. The browser pass caught it: Cleo, a member, was standing in
   * Household settings.
   */
  it("does not latch open on an empty household it has not loaded yet", () => {
    const { rerender } = render(
      withFamily(
        makeContext({ actor: null, categories: [] }),
        <SettingsGate>
          <p>{INSIDE}</p>
        </SettingsGate>,
      ),
    );
    // Unknown is treated as closed — the safe direction to be wrong in.
    expect(screen.queryByText(INSIDE)).toBeNull();

    rerender(
      withFamily(
        makeContext({ actor: makeActor("member", { label: "Cleo" }), categories: [PARENT] }),
        <SettingsGate>
          <p>{INSIDE}</p>
        </SettingsGate>,
      ),
    );
    expect(screen.queryByText(INSIDE)).toBeNull();
    expect(screen.getByText(/Cleo is punched in/)).toBeInTheDocument();
  });

  it("is not opened by a MEMBER holding a PIN — only a parent counts", () => {
    renderGate(null, {
      categories: [makeCategory({ id: "c1", label: "Cleo", role: "member", hasPin: true })],
    });
    // No parent has a PIN, so the no-lockout rule still applies: a household
    // where only the child can punch in must not be locked out of Settings.
    expect(screen.getByText(INSIDE)).toBeInTheDocument();
  });
});
