"use client";

import { usePathname } from "next/navigation";

import { NavItem } from "./NavItem";
import { isActiveTab, NAV_TABS, SETTINGS_TAB } from "./nav";

/**
 * The same nav, rotated: portrait tablets and phones get a bottom bar
 * (FR-028). Settings is pushed to the far right, mirroring the rail's
 * pinned-to-bottom placement.
 */

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      // The same divider as the rail's, on the edge that faces the content.
      className="flex h-(--fam-bottomnav-h) shrink-0 items-stretch gap-1 bg-(--fam-sidebar-bg) p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:landscape:hidden"
    >
      {NAV_TABS.map((tab) => (
        <NavItem
          key={tab.id}
          tab={tab}
          active={isActiveTab(pathname, tab.href)}
          heightClassName="h-full flex-1"
          iconSize={26}
        />
      ))}
      <NavItem
        tab={SETTINGS_TAB}
        active={isActiveTab(pathname, SETTINGS_TAB.href)}
        heightClassName="h-full flex-1"
        iconSize={26}
      />
    </nav>
  );
}
