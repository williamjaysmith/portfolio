"use client";

import { useState } from "react";

import type { OverflowGroup } from "@/lib/family/calendar/layout";
import type { Occurrence, TimeFormat } from "@/lib/family/types";

import { formatTimeRange } from "./EventBlock";

/**
 * FR-285's "+n more" (T031): the events of one time band that layout could
 * not draw abreast, kept reachable. The control announces its count; a tap
 * discloses the collapsed events by title and true time, each row itself a
 * focusable ≥44pt control.
 *
 * The open/closed flag is the component's own — it is pure view disclosure
 * that nothing above needs to know; every fact rendered comes from the
 * `OverflowGroup` prop. A row press opens that occurrence's details exactly
 * as a block's does (FR-256), reported through `onOpen`; the list stays open
 * so the row is still there to take the keyboard back when details close.
 */

export interface MoreOverflowProps {
  group: OverflowGroup;
  /** Household IANA zone (FR-219/284). */
  zone: string;
  timeFormat: TimeFormat;
  /** FR-256: a row press opens that occurrence's details. Absent = read-only. */
  onOpen?: (occurrence: Occurrence) => void;
}

export function MoreOverflow({ group, zone, timeFormat, onOpen }: MoreOverflowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      // Overlaid at the band's top-right corner, above the abreast blocks —
      // the collapsed events share this band's rows, not extra column space.
      className="absolute right-(--fam-event-inset) z-20"
      style={{ top: group.top }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="min-h-(--fam-touch) min-w-(--fam-touch) rounded-full border bg-(--fam-app-bg) px-3 font-medium border-(--fam-control-border) text-(length:--fam-fs-small) text-(--fam-text-primary)"
      >
        +{group.hiddenCount} more
      </button>

      {open ? (
        <ul className="absolute right-0 top-full z-30 mt-1 w-56 rounded-(--fam-radius-card) border bg-(--fam-app-bg) p-1 shadow-lg border-(--fam-hairline)">
          {group.occurrences.map((occurrence) => (
            <li key={`${occurrence.eventId}:${occurrence.occurrenceDate}`}>
              <button
                type="button"
                onClick={() => onOpen?.(occurrence)}
                className="min-h-(--fam-touch) w-full rounded-lg px-3 py-1 text-left"
              >
                <span className="block truncate font-semibold text-(length:--fam-fs-small)">
                  {occurrence.summary}
                </span>
                <span className="block truncate text-(length:--fam-fs-small) text-(--fam-text-secondary) tabular-nums">
                  {formatTimeRange(occurrence.times, zone, timeFormat)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
