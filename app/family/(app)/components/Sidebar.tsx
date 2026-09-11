"use client";

import { usePathname } from "next/navigation";

import { NavItem } from "./NavItem";
import { isActiveTab, NAV_TABS, SETTINGS_TAB } from "./nav";

/**
 * The landscape left rail (FR-028). The active tab is marked with a white
 * pill on the pale blue rail — no border, no shadow, no accent bar.
 *
 * Both navs are always rendered; CSS decides which is visible, so there is no
 * viewport measurement to get wrong during hydration.
 */

export function Sidebar() {
  const pathname = usePathname();

  return (
    // The floor is set by the LABEL, not the touch target. It was min-w-[56px]
    // — a 44px tab plus 6px of padding either side, which holds the touch floor
    // (FR-035) but not the word inside it: at tablet size "Calendar" measures
    // 51px against a 44px tab, so the active pill stopped 7px short of its own
    // text. 64px with 4px of side padding gives a 56px tab, which clears the
    // longest label with room to spare and still reads as inset from the rail.
    <nav
      aria-label="Primary"
      // The hairline is the app's one divider (the calendar grid, the meals
      // rules, every dialog edge). Border-box keeps the rail's width exactly
      // --fam-rail-w, so the 1px comes out of the tab's 5px of slack, not out
      // of the content beside it.
      className="hidden w-(--fam-rail-w) min-w-[64px] shrink-0 flex-col bg-(--fam-sidebar-bg) px-1 py-1.5 lg:landscape:flex"
    >
      {/*
       * Reserves the top-bar row so the first tab lines up with the content.
       * It used to carry a serif "F" mark; removed 2026-09-10 on the operator's
       * report ("in certain sizes im seeing a giant F in the top left corner").
       * It was decorative (`aria-hidden`) and scaled with --fam-fs-title, so on
       * a short landscape window it read as a stray letter rather than a logo.
       * The SPACER stays — without it the tabs ride up and stop lining up with
       * the content beside them.
       */}
      <div aria-hidden="true" className="h-(--fam-topbar-h) shrink-0" />
      <div className="flex flex-col gap-1">
        {NAV_TABS.map((tab) => (
          <NavItem
            key={tab.id}
            tab={tab}
            active={isActiveTab(pathname, tab.href)}
            heightClassName="relative h-(--fam-nav-pitch)"
            iconSize={28}
          />
        ))}
      </div>
      <div className="mt-auto pb-1.5">
        <NavItem
          tab={SETTINGS_TAB}
          active={isActiveTab(pathname, SETTINGS_TAB.href)}
          heightClassName="relative h-(--fam-nav-pitch)"
          iconSize={28}
        />
      </div>
    </nav>
  );
}
