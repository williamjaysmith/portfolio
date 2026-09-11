"use client";

import Link from "next/link";

import type { NavTab } from "./nav";

/**
 * One tab, in either nav (FR-028, FR-035).
 *
 * **014 extracted it because the two copies converged.** The rail's and the
 * bottom bar's items had always been near-twins, and giving them one ink pair
 * (`--fam-nav-ink` / `--fam-nav-ink-active`) made them identical — fallow
 * caught it as a 57-line clone group across `Sidebar.tsx` and `BottomNav.tsx`,
 * which is the duplication gate doing exactly its job. Two shapes of the same
 * control is how the ‹ Today › cluster ended up with three different looks.
 *
 * What genuinely differs between them is passed in, and it is only two things:
 * how tall the tab is (the rail gives each one a fixed pitch, the bottom bar
 * fills its bar's height) and how big the glyph is.
 *
 * The 44px floors stay here rather than in the callers: the rail's width is
 * fluid, so between the landscape breakpoint and the point where the scale unit
 * catches up a tab would drop under the touch floor unless it is stated
 * outright (FR-035).
 */
export interface NavItemProps {
  tab: NavTab;
  active: boolean;
  /** The rail's fixed pitch, or the bottom bar's full height. */
  heightClassName: string;
  iconSize: number;
}

export function NavItem({ tab, active, heightClassName, iconSize }: NavItemProps) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`${heightClassName} flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-[14px] transition-colors ${
        active ? "bg-(--fam-sidebar-active) text-(--fam-nav-ink-active)" : "text-(--fam-nav-ink)"
      }`}
    >
      <Icon size={iconSize} strokeWidth={1.5} aria-hidden="true" />
      <span className="text-(length:--fam-fs-nav) font-medium">{tab.label}</span>
    </Link>
  );
}
