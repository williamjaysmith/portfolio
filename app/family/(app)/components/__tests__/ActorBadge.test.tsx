import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActorBadge } from "../ActorBadge";
import { makeActor, makeContext, withFamily } from "./family-test-utils";

/**
 * FR-013 with SC-009: who is punched in has to be *readable*, not merely
 * visible. An `aria-label` on a plain <div> is discarded — the element has no
 * role to carry it — and a bare "Punch out" never says whom it punches out.
 */
describe("ActorBadge", () => {
  it("renders nothing in the shared, nobody-punched-in state", () => {
    const { container } = render(withFamily(makeContext({ actor: null }), <ActorBadge />));
    expect(container).toBeEmptyDOMElement();
  });

  it("says who is punched in, in text a screen reader reaches", () => {
    const context = makeContext({ actor: makeActor("parent", { label: "Alex" }) });
    render(withFamily(context, <ActorBadge />));

    const punchOut = screen.getByRole("button", { name: "Punch out Alex" });
    expect(punchOut.parentElement).toHaveTextContent("Punched in as Alex");
  });

  it("punches the named person out", () => {
    const punchOut = vi.fn(async () => {});
    const context = makeContext({ actor: makeActor("member", { label: "Kit" }), punchOut });
    render(withFamily(context, <ActorBadge />));

    fireEvent.click(screen.getByRole("button", { name: "Punch out Kit" }));
    expect(punchOut).toHaveBeenCalledTimes(1);
  });
});
