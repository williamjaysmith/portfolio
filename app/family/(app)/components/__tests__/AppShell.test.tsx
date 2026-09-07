import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TextSize } from "@/lib/family/types";

import { AppShell } from "../AppShell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { makeContext, makeSettings, withFamily } from "./family-test-utils";

// The navs read the current route to mark the active tab; nothing here is
// about routing, and jsdom has no App Router to read it from.
vi.mock("next/navigation", () => ({
  usePathname: () => "/family/calendar",
}));

function renderShell(textSize: TextSize) {
  // The shell mounts the reminder banner, which reads (008 R802), so it needs
  // a client here exactly as it has one in the app.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      {withFamily(
      makeContext({ settings: makeSettings({ textSize }) }),
      <AppShell>
        <p>tab content</p>
      </AppShell>,
      )}
    </QueryClientProvider>,
  );
}

/**
 * FR-038: text and spacing scale from a single root. `tokens.css` keys
 * `--fam-text-scale` off `[data-text-size]`, so the shell has to render the
 * attribute from the loaded setting — otherwise the Text size control writes
 * to the database and changes nothing on screen.
 */
describe("AppShell", () => {
  it("carries the household's text-size rung on its root element", () => {
    const { container } = renderShell("large");
    expect(container.firstElementChild).toHaveAttribute("data-text-size", "large");
  });

  it("renders whichever rung is stored, not a fixed one", () => {
    for (const rung of ["small", "medium", "large"] as const) {
      const view = renderShell(rung);
      expect(view.container.firstElementChild).toHaveAttribute("data-text-size", rung);
      view.unmount();
    }
  });

  it("still renders the tab content inside the shell", () => {
    const { getByText } = renderShell("medium");
    expect(getByText("tab content")).toBeInTheDocument();
  });
});
