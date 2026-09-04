import type { CSSProperties } from "react";

/**
 * The day-header line of the FR-201 grid (T029): one serif "Wed 18" per
 * visible column, with today's numeral inside the filled coral circle
 * (FR-209 — the circle REPLACES the plain numeral; the weekday abbreviation
 * stays un-badged). Purely presentational: the dates arrive as the window's
 * `columnDates` and today arrives as `todayDate` from the anchor above —
 * `null` until the client clock's first publish, when no badge is drawn.
 *
 * The leading spacer column mirrors the grid's hour gutter so the header
 * cells sit exactly over their day columns; T033 stacks this line and the
 * all-day band inside the `--fam-dayheader-h` region.
 */

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** `YYYY-MM-DD` → 0 (Sunday) … 6 — a plain-date fact, no zone involved. */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The grid template every header-band row shares: hour gutter + N days. */
export function headerGridTemplate(columnCount: number): CSSProperties {
  return {
    gridTemplateColumns: `var(--fam-hour-gutter-w) repeat(${columnCount}, minmax(0, 1fr))`,
  };
}

export interface WeekHeaderProps {
  /** The displayed window's consecutive household-local dates. */
  columnDates: readonly string[];
  /** Household-local today; `null` before the clock's first publish. */
  todayDate: string | null;
}

export function WeekHeader({ columnDates, todayDate }: WeekHeaderProps) {
  return (
    <div className="grid" style={headerGridTemplate(columnDates.length)}>
      <div aria-hidden="true" />
      {columnDates.map((date) => {
        const isToday = date === todayDate;
        const numeral = Number(date.slice(8, 10));
        return (
          <div
            key={date}
            aria-current={isToday ? "date" : undefined}
            className="flex items-center justify-center gap-2 py-1 font-(family-name:--fam-font-serif) text-(length:--fam-fs-day-header) text-(--fam-text-primary)"
          >
            <span>{WEEKDAY_NAMES[weekdayOf(date)]}</span>
            {isToday ? (
              <span
                // FR-209's circle is [VERIFIED] coral; the DIGIT ink is ours:
                // inkOn(Coral) picks the dark ink (5.86:1) — the photographed
                // white digits are 2.98:1 and fail AA (visual brief §13).
                className="flex size-(--fam-today-badge) items-center justify-center rounded-full bg-(--fam-accent-coral) font-(family-name:--fam-font-sans) font-semibold text-(length:--fam-fs-today-badge) text-(--fam-text-primary)"
              >
                {numeral}
              </span>
            ) : (
              <span>{numeral}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
