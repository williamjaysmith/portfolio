"use client";

import { useMemo, useState } from "react";

import { searchResultsOf, type EventSearchResult } from "@/lib/family/calendar/search";
import { MIN_SEARCH_LENGTH, normaliseSearchTerm, useEventSearch as useEventSearchQuery } from "@/lib/family/queries";
import type { Event } from "@/lib/family/types";

import type { EditTarget } from "./event-drafts";
import { occurrenceOnDay } from "./occurrence-on-day";

/**
 * The calendar search's model (009 FR-915–FR-918, R908).
 *
 * The term is COMPONENT STATE, never a device store: it is a question being
 * asked, not a preference, and it should die with the view. That is the same
 * call 003 R319 made for the Tasks board's search, and the opposite of the two
 * preview switches beside it.
 *
 * The shaping is `lib/family/calendar/search.ts`'s, so which day a result
 * points at is decided once and shares the countdown's bounded walk.
 */

const NO_EVENTS: Event[] = [];
const NO_RESULTS: EventSearchResult[] = [];

export interface UseCalendarSearchOptions {
  householdId: string;
  /** Household-local today; `null` before the clock's first publish. */
  todayDate: string | null;
  zone: string;
}

export interface CalendarSearch {
  term: string;
  setTerm: (next: string) => void;
  results: EventSearchResult[];
  /** True once a term long enough to ask has an answer back. */
  answered: boolean;
  /** FR-916: the chosen result as a details target on its own day, or null. */
  targetFor: (result: EventSearchResult) => EditTarget | null;
}

export function useCalendarSearch({
  householdId,
  todayDate,
  zone,
}: UseCalendarSearchOptions): CalendarSearch {
  const [term, setTerm] = useState("");
  const query = useEventSearchQuery(householdId, term);
  const rows = query.data ?? NO_EVENTS;

  const results = useMemo(
    () => (todayDate === null ? NO_RESULTS : searchResultsOf(rows, todayDate, zone)),
    [rows, todayDate, zone],
  );

  return {
    term,
    setTerm,
    results,
    answered:
      normaliseSearchTerm(term).length >= MIN_SEARCH_LENGTH && query.data !== undefined,
    // The same reason the countdown list builds its own target: the result's
    // day is, by definition, one the displayed window may not contain, so the
    // editor cannot look the occurrence up (009 R909).
    targetFor: (result) => occurrenceOnDay(rows, result.eventId, result.onDate, zone),
  };
}
