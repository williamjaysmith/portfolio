"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useFabAction } from "./FabAction";
import { isActiveTab, NAV_TABS, SETTINGS_TAB } from "./nav";

/**
 * The primary create control, in the same place on every tab (FR-034).
 *
 * A tab that can create registers what the control does (`FabAction.tsx`) —
 * the Week calendar registers its event form (FR-254). A tab that cannot yet
 * is a placeholder, so the control announces which phase brings its creation
 * rather than opening an empty sheet.
 */
export function Fab() {
  const pathname = usePathname();
  const action = useFabAction();
  const [notice, setNotice] = useState<{ path: string; text: string } | null>(null);

  const tab = NAV_TABS.find((entry) => isActiveTab(pathname, entry.href));
  // Settings has its own "Add a Profile" buttons; a floating + would be noise.
  if (!tab || isActiveTab(pathname, SETTINGS_TAB.href)) return null;

  const tabLabel = tab.label;
  const singular = tabLabel.replace(/s$/, "");

  function announcePlaceholder(): void {
    setNotice({
      path: pathname,
      text: `Adding to ${tabLabel} comes with the ${tabLabel} phase.`,
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={action ? action.label : `Add ${singular.toLowerCase()}`}
        onClick={action ? () => action.run() : announcePlaceholder}
        className="absolute right-(--fam-fab-inset) bottom-(--fam-fab-inset) flex h-(--fam-fab-d) w-(--fam-fab-d) min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-(--fam-primary-blue) text-white shadow-md"
      >
        <Plus size={32} strokeWidth={2} aria-hidden="true" />
      </button>
      <p
        role="status"
        className="pointer-events-none absolute right-(--fam-fab-inset) bottom-[calc(var(--fam-fab-d)+var(--fam-fab-inset)+0.5rem)] text-(length:--fam-fs-small) text-(--fam-text-secondary)"
      >
        {/* Tied to the tab it was raised on, so switching tabs clears it
            rather than leaving a message naming the wrong screen. */}
        {notice?.path === pathname ? notice.text : null}
      </p>
    </>
  );
}
