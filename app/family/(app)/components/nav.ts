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
}

export const NAV_TABS: readonly NavTab[] = [
  { id: "calendar", label: "Calendar", href: "/family/calendar", icon: Calendar },
  { id: "tasks", label: "Tasks", href: "/family/tasks", icon: Check },
  { id: "rewards", label: "Rewards", href: "/family/rewards", icon: Star },
  { id: "meals", label: "Meals", href: "/family/meals", icon: Utensils },
  { id: "lists", label: "Lists", href: "/family/lists", icon: ListTodo },
];

export const SETTINGS_TAB: NavTab = {
  id: "settings",
  label: "Settings",
  href: "/family/settings",
  icon: Settings,
};

/** A tab is active for its own route and anything nested under it. */
export function isActiveTab(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
