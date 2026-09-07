import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../AppShell";
import { makeCategory, makeContext, withFamily } from "./family-test-utils";

/**
 * FR-314 / Assumption 18 / R324 — the profile chip row does not render on the
 * Tasks tab, because that tab's columns ARE the profiles.
 *
 * The decision is taken from `usePathname()`, which the App Router supplies on
 * the server render as well as in the browser, so the row never paints and
 * then vanishes on hydration — the flicker a wall tablet is least forgiving
 * of. A `FabAction`-style registry, where the page tells the shell after it
 * mounts, would do exactly that.
 */

const route = vi.hoisted(() => ({ pathname: "/family/calendar" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

const CHIP_ROW = "Family";

function renderAt(pathname: string) {
  route.pathname = pathname;
  // The shell mounts the reminder banner, which reads (008 R802), so it needs
  // a client here exactly as it has one in the app.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      {withFamily(
      makeContext({ categories: [makeCategory({ id: "profile-ana", label: "Ana" })] }),
      <AppShell>
        <p>tab content</p>
      </AppShell>,
      )}
    </QueryClientProvider>,
  );
}

describe("AppShell — the chip row (FR-314)", () => {
  it("renders the chip row on every tab that shipped with one", () => {
    renderAt("/family/calendar");
    expect(screen.getByRole("group", { name: CHIP_ROW })).toBeInTheDocument();
  });

  it("does not render it on the Tasks tab", () => {
    renderAt("/family/tasks");
    expect(screen.queryByRole("group", { name: CHIP_ROW })).not.toBeInTheDocument();
    // The rest of the shell is untouched — this is a row that is absent, not a
    // tab that renders differently.
    expect(screen.getByText("tab content")).toBeInTheDocument();
  });

  it("does not render it on the Rewards tab either (004 FR-422, R409)", () => {
    renderAt("/family/rewards");
    expect(screen.queryByRole("group", { name: CHIP_ROW })).not.toBeInTheDocument();
    expect(screen.getByText("tab content")).toBeInTheDocument();
  });
});
