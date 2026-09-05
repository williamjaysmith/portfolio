"use client";

import { Search, X } from "lucide-react";

/**
 * FR-386's search control (T069), in the tab's own chrome beside Previous /
 * Today / Next — where the reference puts it (Assumption 27).
 *
 * **It is a filter, not a view.** Typing narrows the board in place, across
 * every column including Up for Grabs, rather than opening a result list; and
 * clearing it restores every card. That is not enforced here at all: the query
 * is handed to `useBoardOccurrences`, which passes it to
 * `visibleTaskOccurrences` **below** the counter branch (R317, R319), so no
 * keystroke can reach a ring or a count and SC-320's "no counter moves at any
 * point" is a property of the memo graph rather than a promise this component
 * keeps.
 *
 * **It owns nothing.** The string lives in `TasksBoard` as component state,
 * dies with the view and is never persisted — the opposite of the four
 * per-device switches, which is exactly why they are a store and this is not
 * (R319). So the box is controlled: it reports each keystroke and draws
 * whatever comes back, and its clear reports the empty string rather than
 * emptying itself behind the board's back.
 *
 * It is a **different control** from the Task Box's own template filter
 * (FR-376), which searches templates rather than tasks.
 *
 * The pill is the top bar's shipped idiom at FR-397's touch floor, and the
 * input keeps the platform focus ring: a search box that cannot be seen to
 * have focus is one a keyboard cannot be driven through.
 */

/** The tab's chrome idiom — the same pill Previous / Today / Next are drawn as. */
const SHELL =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full bg-(--fam-pill-btn-bg) " +
  "pl-4 pr-1 text-(--fam-text-muted)";

/** Narrow enough to sit beside three pills on a phone, wide enough to read. */
const INPUT =
  "min-h-(--fam-touch) w-32 min-w-0 bg-transparent text-(length:--fam-fs-pill) " +
  "text-(--fam-text-primary) placeholder:text-(--fam-text-muted) sm:w-44";

const CLEAR =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) shrink-0 items-center justify-center " +
  "rounded-full text-(--fam-text-muted)";

export interface TaskSearchProps {
  /** The board's query string — this control's only source of truth. */
  value: string;
  /** Every keystroke, and the empty string the clear sends. */
  onChange: (next: string) => void;
}

export function TaskSearch({ value, onChange }: TaskSearchProps) {
  return (
    <div data-task-search className={SHELL}>
      <Search size={18} aria-hidden="true" className="shrink-0" />
      <input
        type="search"
        aria-label="Search tasks"
        placeholder="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
      />
      {/* Absent rather than disabled while the box is empty: a permanent × on
          an empty search box is a control that never does anything. */}
      {value === "" ? null : (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={CLEAR}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
