"use client";

import { Search, X } from "lucide-react";
import { useRef } from "react";

import type { EventSearchResult } from "@/lib/family/calendar/search";

const SHELL =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full bg-(--fam-pill-btn-bg) " +
  "pl-4 pr-1 text-(--fam-text-muted)";

const INPUT =
  "min-h-(--fam-touch) w-32 min-w-0 bg-transparent text-(length:--fam-fs-pill) " +
  "text-(--fam-text-primary) placeholder:text-(--fam-text-muted) sm:w-44";

const CLEAR =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) shrink-0 items-center justify-center " +
  "rounded-full text-(--fam-text-muted)";

const RESULT =
  "flex min-h-(--fam-touch) w-full items-center justify-between gap-3 rounded-(--fam-radius-pill) " +
  "px-3 text-left text-(length:--fam-fs-body) text-(--fam-text-primary)";

/**
 * The calendar's event search (009 FR-915–FR-918).
 *
 * A **Search** control sits on the reference's calendar toolbar beside
 * Previous / Today / Next / the view toggle / Filter
 * [VERIFIED](45755784991131). What it searches is `[INFERRED]` and what its
 * results look like is `[UNKNOWN]`, so the shape below is spec Assumptions 8
 * and 9.
 *
 * **It is a FINDER, not a filter — and that is a deliberate divergence from the
 * Tasks tab.** `TaskSearch` narrows the board where it stands, because the
 * board shows the whole day and the answer is on it. The calendar shows three
 * to seven days and the answer usually is not, so narrowing would hide
 * everything and find nothing. Choosing a result therefore navigates
 * (divergence 6).
 *
 * It owns NOTHING — not even whether its results are showing. The term is the
 * caller's state, the results are handed in already shaped and ordered by
 * `lib/family/calendar/search.ts`, and the panel is open exactly when there is
 * a term and an answer for it. An internal `open` flag was tried and removed:
 * it could disagree with the term (React fires no change event when a value is
 * re-set to itself), which is a whole class of bug this component now cannot
 * have.
 */

export interface EventSearchProps {
  /** The typed term — this control's only source of truth. */
  value: string;
  onChange: (next: string) => void;
  /** Shaped results for the current term; empty until the term is long enough. */
  results: readonly EventSearchResult[];
  /** True once a term has been asked and its answer has arrived. */
  answered: boolean;
  /** FR-916: go to that day and open the event. */
  onChoose: (result: EventSearchResult) => void;
  /** How a date is written for this household — the details view's own words. */
  formatDate: (date: string) => string;
}

export function EventSearch({
  value,
  onChange,
  results,
  answered,
  onChoose,
  formatDate,
}: EventSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Open exactly when there is something to answer and an answer to show.
  const showing = value.trim() !== "" && answered;

  return (
    <div className="relative">
      <div data-event-search className={SHELL}>
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search events"
          placeholder="Search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT}
        />
        {/* Absent rather than disabled while the box is empty: a permanent ×
            on an empty search box is a control that never does anything. */}
        {value === "" ? null : (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className={CLEAR}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {showing ? (
        <div className="absolute right-0 top-full z-10 mt-1 w-[min(80vw,20rem)] rounded-(--fam-radius-modal) border border-(--fam-hairline) bg-(--fam-app-bg) p-2 shadow-lg">
          {results.length === 0 ? (
            // FR-917: say so, rather than showing an empty box.
            <p className="px-3 py-2 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
              No events match that.
            </p>
          ) : (
            <ul aria-label="Search results" className="flex flex-col gap-1">
              {results.map((result) => (
                <li key={result.eventId}>
                  <button
                    type="button"
                    onClick={() => onChoose(result)}
                    className={RESULT}
                  >
                    <span className="min-w-0 truncate">{result.summary}</span>
                    <span className="shrink-0 text-(length:--fam-fs-small) text-(--fam-text-secondary) tabular-nums">
                      {formatDate(result.onDate)}
                      {result.isRepeating ? " ·  repeats" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
