"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isActiveTab, NAV_TABS, SETTINGS_TAB } from "./nav";

/**
 * The primary create control, in the same place on every tab (FR-034).
 *
 * Phase 1 has nothing to create from here yet — the tabs it belongs to are
 * placeholders — so it announces which phase brings each one rather than
 * opening an empty sheet.
 */
export function Fab() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ path: string; text: string } | null>(null);

  const tab = NAV_TABS.find((entry) => isActiveTab(pathname, entry.href));
  // Settings has its own "Add a Profile" buttons; a floating + would be noise.
  if (!tab || isActiveTab(pathname, SETTINGS_TAB.href)) return null;

  const singular = tab.label.replace(/s$/, "");

  return (
    <>
      <button
        type="button"
        aria-label={`Add ${singular.toLowerCase()}`}
        onClick={() =>
          setNotice({
            path: pathname,
            text: `Adding to ${tab.label} comes with the ${tab.label} phase.`,
          })
        }
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
