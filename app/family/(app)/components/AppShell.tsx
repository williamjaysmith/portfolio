"use client";

import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { Fab } from "./Fab";
import { FabActionProvider } from "./FabAction";
import { useFamily } from "./FamilyProvider";
import { ProfileChipRow } from "./ProfileChipRow";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * The Skylight-shaped shell every tab renders inside (US4).
 *
 * Both navs are always in the tree; `tokens.css` breakpoints show the rail in
 * landscape on a large screen and the bottom bar everywhere else, so the
 * layout never depends on measuring the viewport in JavaScript.
 *
 * This is also where the household's text-size rung enters the CSS (FR-038):
 * `tokens.css` derives `--fam-text-scale`, and through it every `--fam-fs-*`,
 * from `[data-text-size]`, and this is the outermost element below the
 * `.family` wrapper that re-renders when the setting changes. Without the
 * attribute the whole type scale is pinned at 1 and the Text size control in
 * Settings saves to the database and changes nothing on screen.
 *
 * `settings.density` has no CSS behind it yet — recorded as a known no-op
 * rather than wired here, because nothing in the shell reads a spacing token
 * it could scale (every gap and pad is a literal Tailwind class).
 *
 * The FAB and the page it floats over share one registry (`FabAction.tsx`):
 * the page registers what "+" creates, the FAB runs it — which is why the
 * provider wraps both and lives here rather than in `FamilyProvider`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { settings } = useFamily();

  return (
    <FabActionProvider>
      <div data-text-size={settings.textSize} className="flex h-dvh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <ProfileChipRow />
          <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
            <Fab />
          </main>
          <BottomNav />
        </div>
      </div>
    </FabActionProvider>
  );
}
