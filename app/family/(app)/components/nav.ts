import { Calendar, Check, ListTodo, Settings, Star, Utensils, type LucideIcon } from "lucide-react";

/**
 * One nav definition for both presentations (FR-028): a left rail in
 * landscape, a bottom bar otherwise. Order is the reference product's:
 * Calendar · Tasks · Rewards · Meals · Lists, with Settings separated.
 */

export type NavTabId = "calendar" | "tasks" | "rewards" | "meals" | "lists" | "settings";

export interface NavTab {
  id: NavTabId;
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Whether the shell's profile chip row belongs above this tab (FR-314). It
   * lives on the tab definition rather than as a route string inside
   * `AppShell`, so the one tab that suppresses it says so where every other
   * fact about it is written.
   */
  showsChipRow: boolean;
}

export const NAV_TABS: readonly NavTab[] = [
  { id: "calendar", label: "Calendar", href: "/family/calendar", icon: Calendar, showsChipRow: true },
  // The Tasks board's columns ARE the profiles, so the chip row would repeat
  // them in a thinner form (FR-314).
  { id: "tasks", label: "Tasks", href: "/family/tasks", icon: Check, showsChipRow: false },
  // The Rewards tab is the same board of people — one column per Profile — and
  // declines the row for the same reason (004 FR-422, R409).
  { id: "rewards", label: "Rewards", href: "/family/rewards", icon: Star, showsChipRow: false },
  { id: "meals", label: "Meals", href: "/family/meals", icon: Utensils, showsChipRow: false },
  // The Lists tab's cards are lists, not people: the chips would count nothing,
  // and the photographed screen goes from the top bar straight into the cards
  // (005 FR-506, Assumption 12).
  { id: "lists", label: "Lists", href: "/family/lists", icon: ListTodo, showsChipRow: false },
];

export const SETTINGS_TAB: NavTab = {
  id: "settings",
  label: "Settings",
  href: "/family/settings",
  icon: Settings,
  showsChipRow: true,
};

/** A tab is active for its own route and anything nested under it. */
export function isActiveTab(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Whether the chip row renders on the route being drawn (FR-314). A route no
 * tab claims keeps the row Phase 1 shipped, so a new screen never loses it by
 * omission.
 */
export function showsChipRow(pathname: string): boolean {
  const tab = [...NAV_TABS, SETTINGS_TAB].find((entry) => isActiveTab(pathname, entry.href));
  return tab?.showsChipRow ?? true;
}
