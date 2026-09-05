"use client";

import { useState } from "react";

import type { FieldErrors } from "@/lib/family/errors";
import {
  WEEKDAYS,
  type Category,
  type EventInput,
  type EventTimes,
  type RepeatChoice,
  type Weekday,
} from "@/lib/family/types";
import { validateEventInput } from "@/lib/family/validation";

import {
  settleSubmit,
  toggled,
  useSubmission,
  type Settled,
  type SubmitOutcome,
} from "../../components/formSubmit";

/**
 * Draft state + submit machinery for the event form (T046).
 *
 * The draft speaks the form's vocabulary — separate date and time boxes, a
 * repeat kind with its options laid flat — and `draftToInput` translates it
 * into the contract's `EventInput` exactly once, at submit. The rrule string
 * never appears here: the client sends the structured `RepeatChoice` and the
 * server-side emitter is the sole producer of rule text (R201).
 *
 * Validation is the SAME module the actions run (`validateEventInput`), so a
 * refusal the server would give lands against its field before the network is
 * ever touched, and the two layers cannot disagree (FR-262).
 */

export type RepeatKind = RepeatChoice["kind"];

/**
 * What the caller's commit hands back. A result is shown or closed on as
 * usual; `null` means there is nothing for the form to show — the pipeline
 * was abandoned before any write (a dismissed scope question, FR-249) or the
 * caller already took the outcome over (FR-288's "no longer exists" closes
 * the form itself) — and the form stays exactly as it is, saying nothing.
 */
export type { SubmitOutcome };

export interface EventDraft {
  summary: string;
  allDay: boolean;
  /** `YYYY-MM-DD`. Both shapes use the date pair; only timed uses the times. */
  startDate: string;
  /** `HH:MM`, the device's wall clock. */
  startTime: string;
  /** The end's OWN date (FR-222) — defaults to the start's, so it rarely needs touching. */
  endDate: string;
  endTime: string;
  repeatKind: RepeatKind;
  /** Weekly only; ordered at submit, not here. */
  weekdays: Weekday[];
  /** `YYYY-MM-DD`; `""` = the series never ends (FR-232). */
  until: string;
  /** The picked ids; the submitted order comes from the household's draw order (FR-227). */
  categoryIds: string[];
  location: string;
  notes: string;
}

/** Prefill — a tapped slot's times (T050), or the occurrence being edited (T047). */
export type EventFormSeed = Partial<EventDraft>;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** The device-local calendar date — the natural default for a bare "add". */
function deviceToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function blankDraft(): EventDraft {
  const startDate = deviceToday();
  return {
    summary: "",
    allDay: false,
    startDate,
    startTime: "09:00",
    endDate: startDate,
    endTime: "10:00",
    repeatKind: "never",
    weekdays: [],
    until: "",
    categoryIds: [],
    location: "",
    notes: "",
  };
}

function initialDraft(seed: EventFormSeed | undefined): EventDraft {
  const merged = { ...blankDraft(), ...seed };
  // A seeded start without a seeded end keeps the end on the start's date.
  if (seed?.startDate !== undefined && seed.endDate === undefined) {
    merged.endDate = merged.startDate;
  }
  return merged;
}

/**
 * Device wall-clock date + time → ISO instant. The device's zone interprets
 * the wall time; the instant is absolute, so it renders identically in the
 * household zone (FR-223). Malformed fields yield `""`, which the validation
 * module refuses against the field rather than throwing mid-build.
 */
function toInstant(date: string, time: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return "";
  const value = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

/** Blank optional text means "not set", stored as NULL. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Sunday-first, matching `WKST=SU` — a stable order however the boxes were ticked. */
function sortedWeekdays(days: Weekday[]): Weekday[] {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

function repeatOf(draft: EventDraft): RepeatChoice {
  const until = draft.until === "" ? null : draft.until;
  switch (draft.repeatKind) {
    case "never":
      return { kind: "never" };
    case "daily":
      return { kind: "daily", until };
    case "weekly":
      return { kind: "weekly", weekdays: sortedWeekdays(draft.weekdays), until };
    case "monthly":
      return { kind: "monthly", until };
  }
}

function timesOf(draft: EventDraft): EventTimes {
  if (draft.allDay) {
    return { allDay: true, startDate: draft.startDate, endDate: draft.endDate };
  }
  return {
    allDay: false,
    startsAt: toInstant(draft.startDate, draft.startTime),
    endsAt: toInstant(draft.endDate, draft.endTime),
  };
}

/**
 * The draft as `createEvent` expects it. `timezone` comes from the device —
 * provenance only, no picker (FR-224). `orderedCategoryIds` is the selection
 * re-ordered by the household's draw order (FR-227).
 */
function draftToEventInput(draft: EventDraft, orderedCategoryIds: string[]): EventInput {
  return {
    ...timesOf(draft),
    summary: draft.summary,
    description: orNull(draft.notes),
    location: orNull(draft.location),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    repeat: repeatOf(draft),
    categoryIds: orderedCategoryIds,
  };
}

/**
 * The start date's weekday — the obvious default when weekly is chosen bare.
 * A plain-date fact read in UTC (no zone shifts a `YYYY-MM-DD`); a malformed
 * date falls back to Sunday rather than throwing mid-keystroke.
 */
function startWeekday(startDate: string): Weekday {
  const index = new Date(`${startDate}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[index] ?? WEEKDAYS[0];
}

/**
 * Validate locally with the actions' own module, then hand the parsed input
 * to the caller (`settleSubmit`). A refusal is what the form must show,
 * leaving every other entry exactly as typed (FR-262).
 */
function validateAndSubmit(draft: EventDraft, options: UseEventFormOptions): Promise<Settled> {
  const orderedIds = options.categories
    .filter((category) => draft.categoryIds.includes(category.id))
    .map((category) => category.id);
  return settleSubmit(
    () => validateEventInput(draftToEventInput(draft, orderedIds), options.householdTimezone),
    options.onSubmit,
  );
}

export interface UseEventFormOptions {
  seed?: EventFormSeed;
  /** The household's categories in draw order — the picker's listing AND the submitted id order. */
  categories: readonly Category[];
  /** The zone the repeat-until rule is compared in (`validateEventInput`). */
  householdTimezone: string;
  /**
   * The commit — `useCalendarEditor` routes it through `withActor(...)` to
   * the real action so punch-in arrives at the moment of the write
   * (FR-248/270/275); tests drive a mock.
   */
  onSubmit: (input: EventInput) => Promise<SubmitOutcome>;
  onClose: () => void;
}

export interface EventFormState {
  draft: EventDraft;
  set: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
  setStartDate: (value: string) => void;
  setRepeatKind: (kind: RepeatKind) => void;
  toggleWeekday: (day: Weekday) => void;
  toggleCategory: (id: string) => void;
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  submit: () => Promise<void>;
}

export function useEventForm(options: UseEventFormOptions): EventFormState {
  const [draft, setDraft] = useState<EventDraft>(() => initialDraft(options.seed));
  const { errors, message, pending, submit: run } = useSubmission(options.onClose);

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** The end's date follows the start's until the person sets it apart (FR-222). */
  function setStartDate(value: string): void {
    setDraft((current) => ({
      ...current,
      startDate: value,
      endDate: current.endDate === current.startDate ? value : current.endDate,
    }));
  }

  function setRepeatKind(kind: RepeatKind): void {
    setDraft((current) => ({
      ...current,
      repeatKind: kind,
      weekdays:
        kind === "weekly" && current.weekdays.length === 0
          ? [startWeekday(current.startDate)]
          : current.weekdays,
    }));
  }

  function toggleWeekday(day: Weekday): void {
    setDraft((current) => ({ ...current, weekdays: toggled(current.weekdays, day) }));
  }

  function toggleCategory(id: string): void {
    setDraft((current) => ({ ...current, categoryIds: toggled(current.categoryIds, id) }));
  }

  const submit = (): Promise<void> => run(() => validateAndSubmit(draft, options));

  return {
    draft,
    set,
    setStartDate,
    setRepeatKind,
    toggleWeekday,
    toggleCategory,
    errors,
    message,
    pending,
    submit,
  };
}
