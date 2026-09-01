import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { Fab } from "./Fab";
import { ProfileChipRow } from "./ProfileChipRow";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * The Skylight-shaped shell every tab renders inside (US4).
 *
 * Both navs are always in the tree; `tokens.css` breakpoints show the rail in
 * landscape on a large screen and the bottom bar everywhere else, so the
 * layout never depends on measuring the viewport in JavaScript.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
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
  );
}
