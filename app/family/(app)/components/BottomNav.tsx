"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveTab, NAV_TABS, SETTINGS_TAB, type NavTab } from "./nav";

/**
 * The same nav, rotated: portrait tablets and phones get a bottom bar
 * (FR-028). Settings is pushed to the far right, mirroring the rail's
 * pinned-to-bottom placement.
 */

function NavItem({ tab, active }: { tab: NavTab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-full min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-[14px] transition-colors ${
        active ? "bg-(--fam-sidebar-active) text-(--fam-text-primary)" : "text-(--fam-text-muted)"
      }`}
    >
      <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
      <span className="text-(length:--fam-fs-nav) font-medium">{tab.label}</span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex h-(--fam-bottomnav-h) shrink-0 items-stretch gap-1 bg-(--fam-sidebar-bg) p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:landscape:hidden"
    >
      {NAV_TABS.map((tab) => (
        <NavItem key={tab.id} tab={tab} active={isActiveTab(pathname, tab.href)} />
      ))}
      <NavItem tab={SETTINGS_TAB} active={isActiveTab(pathname, SETTINGS_TAB.href)} />
    </nav>
  );
}
