import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActorBadge } from "../ActorBadge";
import { makeActor, makeContext, stubDialog, withFamily } from "./family-test-utils";

/**
 * FR-013 with SC-009: who is punched in has to be *readable*, not merely
 * visible — and a bare "Punch out" never says whom it punches out.
 *
 * **014 turned the badge from a pill into a face.** It was `● Ana  Punch out`
 * on screen at all times; it is now the person's avatar in a circle, and their
 * name and the way out are one tap behind it. So the name lives on the
 * trigger's `aria-label` ("Punched in as Alex") rather than in visible text
 * beside a dot, and "Punch out" is inside the panel where it is already scoped
 * to the person the panel is titled after.
 */
describe("ActorBadge", () => {
  // The panel is a native <dialog>, and jsdom implements neither showModal nor
  // close — without this the dialog never opens and nothing inside it is
  // queryable, which is exactly how this test first failed.
  beforeEach(stubDialog);

  it("renders nothing in the shared, nobody-punched-in state", () => {
    const { container } = render(withFamily(makeContext({ actor: null }), <ActorBadge />));
    expect(container).toBeEmptyDOMElement();
  });

  it("names who is punched in on the control itself", () => {
    const context = makeContext({ actor: makeActor("parent", { label: "Alex" }) });
    render(withFamily(context, <ActorBadge />));

    // The face is `aria-hidden`, so this label is the only thing that says who
    // it is — the same trap `ProfileChip` has.
    expect(screen.getByRole("button", { name: "Punched in as Alex" })).toBeInTheDocument();
  });

  it("punches the named person out from behind the face", () => {
    const punchOut = vi.fn(async () => {});
    const context = makeContext({ actor: makeActor("member", { label: "Kit" }), punchOut });
    render(withFamily(context, <ActorBadge />));

    fireEvent.click(screen.getByRole("button", { name: "Punched in as Kit" }));
    // The panel is titled with the person, so "Punch out" inside it is already
    // scoped to them and needs no name of its own.
    expect(screen.getByRole("heading", { name: "Kit" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Punch out" }));
    expect(punchOut).toHaveBeenCalledTimes(1);
  });
});
