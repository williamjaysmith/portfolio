"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveTab, NAV_TABS, SETTINGS_TAB, type NavTab } from "./nav";

/**
 * The landscape left rail (FR-028). The active tab is marked with a white
 * pill on the pale blue rail — no border, no shadow, no accent bar.
 *
 * Both navs are always rendered; CSS decides which is visible, so there is no
 * viewport measurement to get wrong during hydration.
 */

function NavItem({ tab, active }: { tab: NavTab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-(--fam-nav-pitch) min-h-[44px] flex-col items-center justify-center gap-1 rounded-[14px] transition-colors ${
        active ? "bg-(--fam-sidebar-active) text-(--fam-text-primary)" : "text-(--fam-text-muted)"
      }`}
    >
      <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
      <span className="text-(length:--fam-fs-nav) font-medium">{tab.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="hidden w-(--fam-rail-w) shrink-0 flex-col bg-(--fam-sidebar-bg) p-1.5 lg:landscape:flex"
    >
      {/* Reserves the top-bar row so the first tab lines up with the content. */}
      <div className="flex h-(--fam-topbar-h) items-center justify-center">
        <span
          aria-hidden="true"
          className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-primary-blue)"
        >
          F
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {NAV_TABS.map((tab) => (
          <NavItem key={tab.id} tab={tab} active={isActiveTab(pathname, tab.href)} />
        ))}
      </div>
      <div className="mt-auto pb-1.5">
        <NavItem tab={SETTINGS_TAB} active={isActiveTab(pathname, SETTINGS_TAB.href)} />
      </div>
    </nav>
  );
}
