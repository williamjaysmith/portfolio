import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "./action-result";
import { makeCategory, stubDialog } from "./family-test-utils";

const punchIn = vi.fn();
vi.mock("@/lib/family/actions/punch-in", () => ({
  punchIn: (...args: unknown[]) => punchIn(...args),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const { PunchInSheet } = await import("../PunchInSheet");

/**
 * US2: viewing is free, acting needs a PIN — and the picker never reveals more
 * than it must.
 */
describe("PunchInSheet", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    stubDialog();
    punchIn.mockReset();
    replace.mockReset();
    queryClient = new QueryClient();
  });

  const parent = makeCategory({ id: "p1", label: "Alex", hasPin: true });
  const child = makeCategory({ id: "c1", label: "Kit", role: "member", hasPin: false });

  function renderSheet(profiles = [parent, child], onResolve = vi.fn()) {
    render(<PunchInSheet open profiles={profiles} avatarUrls={{}} onResolve={onResolve} />, {
      // The sheet runs inside the shell, which owns the household's cache.
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    return onResolve;
  }

  /** Choose Alex and tap four digits — the pad submits on the fourth. */
  function enterPin(digits = ["1", "2", "3", "4"]): void {
    fireEvent.click(screen.getByRole("button", { name: /Alex/ }));
    for (const digit of digits) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
  }

  it("asks who is here", () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "Who's here?" })).toBeInTheDocument();
  });

  it("points at Settings when nobody exists yet", () => {
    renderSheet([]);
    expect(screen.getByText("Nobody's set up yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up the family" })).toBeInTheDocument();
  });

  it("explains when no one has a PIN yet (SC-010 dead end avoided)", () => {
    renderSheet([child]);
    expect(
      screen.getByText("No one has a PIN yet. A parent can set one in Settings."),
    ).toBeInTheDocument();
  });

  it("shows a PIN-less profile but refuses to select it (US2-9)", () => {
    renderSheet();
    const kit = screen.getByRole("button", { name: /Kit/ });

    expect(kit).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(kit);

    expect(screen.getByRole("status")).toHaveTextContent("Kit doesn't have a PIN yet.");
    expect(screen.getByRole("heading", { name: "Who's here?" })).toBeInTheDocument();
  });

  it("takes a PIN for a profile that has one, and reports success", async () => {
    const session = { profileId: "p1", label: "Alex", color: parent.color, role: "parent" as const, expiresAt: "", ttlSeconds: 180 };
    punchIn.mockResolvedValue(ok(session));
    const onResolve = renderSheet();

    enterPin();

    await waitFor(() => expect(punchIn).toHaveBeenCalledWith("p1", "1234"));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith(session));
  });

  it("says a PIN is wrong without hinting how close it was", async () => {
    punchIn.mockResolvedValue(fail("BAD_PIN"));
    renderSheet();

    enterPin(["0", "0", "0", "0"]);

    expect(await screen.findByRole("alert")).toHaveTextContent("That PIN isn't right.");
    expect(screen.getByRole("alert").textContent).not.toMatch(/attempt|remaining|close/i);
  });

  it("stops accepting digits once the profile is locked out (FR-012)", async () => {
    punchIn.mockResolvedValue(fail("PIN_LOCKED"));
    renderSheet();

    enterPin(["0", "0", "0", "0"]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries.");
    expect(screen.getByRole("button", { name: "1" })).toBeDisabled();
  });

  it("resolves with nobody when cancelled", () => {
    const onResolve = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onResolve).toHaveBeenCalledWith(null);
  });

  // The offline edge case: the action does not answer at all. A greyed-out pad
  // with no message can only be escaped by cancelling and starting again.
  it("says it can't reach the house when the request fails outright", async () => {
    punchIn.mockRejectedValue(new Error("Failed to fetch"));
    renderSheet();

    enterPin();

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the house right now.");
    expect(screen.getByRole("button", { name: "1" })).toBeEnabled();
  });

  it("hands a signed-out session back to the shell instead of asking for a PIN", async () => {
    punchIn.mockResolvedValue(fail("NOT_AUTHENTICATED"));
    const onResolve = renderSheet();

    enterPin();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/family/sign-in"));
    expect(onResolve).toHaveBeenCalledWith(null);
  });
});
