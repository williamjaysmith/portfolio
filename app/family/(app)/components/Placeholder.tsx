import { NAV_TABS, SETTINGS_TAB, type NavTabId } from "./nav";

/**
 * Tabs whose features arrive in later phases still exist in the navigation, so
 * the shell is complete and testable from Phase 1 onward (FR-029).
 */

export interface PlaceholderProps {
  tab: NavTabId;
}

export function Placeholder({ tab }: PlaceholderProps) {
  const definition = [...NAV_TABS, SETTINGS_TAB].find((entry) => entry.id === tab) ?? NAV_TABS[0];
  const Icon = definition.icon;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-(--fam-edge-inset) text-center">
      <Icon size={64} strokeWidth={1.5} aria-hidden="true" className="text-(--fam-text-muted)" />
      <h1 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        {definition.label}
      </h1>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">Coming soon</p>
    </div>
  );
}
