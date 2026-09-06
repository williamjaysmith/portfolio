"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  createDeviceListeners,
  readDeviceJson,
  writeDeviceJson,
} from "../../components/deviceStorage";

import { addDays, weekStartOf } from "@/lib/family/calendar/dates";
import {
  weekCelebrationKey,
  weekVerdictOf,
  type WeekOutcome,
  type WeekVerdict,
} from "@/lib/family/rewards/celebrations";
import { expandTaskDay, scheduledDaysInWeek } from "@/lib/family/tasks/expand";
import type {
  Category,
  OccurrenceState,
  Task,
  TaskResolution,
  WeekStart,
} from "@/lib/family/types";

/**
 * 004 T049 — FR-440's Amazing / Strong Week messages, judged on the board
 * (R408): for every tracked routine × assignee, the PREVIOUS household week
 * is judged with `weekVerdictOf` the first time the board is on screen after
 * it ends, and the earned message shows once per device.
 *
 * **Everything here is derived; nothing is stored but "shown".** The live
 * week is anchored with the shipped `weekStartOf` (the caller's `weekStartDate`
 * is `useDayAnchor`'s today, or the week it starts — both anchor the same);
 * the previous week is seven days before it; its resolutions are the caller's
 * `taskWeek(prevWeekStart)` read, already warmed by `usePrefetchNeighbourWeeks`
 * and passed only once SETTLED (`undefined` while pending judges nothing, so a
 * half-arrived week can never read as a missed one). At midnight on the
 * week's last day the anchor moves, the previous week becomes the one just
 * ended, and the memo below re-judges it with no effect code — the rollover
 * IS the input changing (SC-415's "when the next week's board is first shown").
 *
 * **The denominator is the routine's own scheduled days** — `scheduledDaysInWeek`,
 * reached through `family-tasks-core` and never `ruleDatesIn` directly, because
 * `components` may not import the recurrence zone (`.fallowrc.json`). A day is
 * completed when EVERY occurrence of that routine for that person on it is
 * complete (a two-slot routine with its evening open is a missed day, as the
 * streak rule reads it — FR-373); skipped when any is skipped and none is left
 * open; and a skipped day is NEITHER completed nor missed (SC-415). Untracked
 * routines and chores are never judged: FR-440 says "tracked routine".
 *
 * **One message at a time.** The candidates come Profile-major in household
 * order, and `message` is the first whose key this device has not shown;
 * `dismiss()` — a tap on `WeekMessage`, or its clock — remembers that key, the
 * store emits, and the next candidate surfaces. A key is remembered on dismiss
 * rather than on display, so a reload mid-message shows it again, once, rather
 * than swallowing it. The key is `weekCelebrationKey(routine, profile, week)`,
 * so the same verdict earned next week is a different key.
 *
 * **The per-device store** (`family:week-celebrations:v1`) is the Phase 3
 * filter-store pattern — module state behind `useSyncExternalStore`, loaded
 * from `localStorage` once — holding an ordered list of shown keys, bounded at
 * `MAX_SHOWN_KEYS` with the oldest evicted: only the previous week's keys are
 * ever consulted, so anything older is dead weight. When storage refuses
 * (private mode, quota) the session still remembers in memory and shows each
 * message once, per constitution §VI. Display only: it never leaves the
 * device and changes no household data.
 */

const STORAGE_KEY = "family:week-celebrations:v1";

/**
 * How many shown keys a device keeps. A week writes at most (tracked routines
 * × assignees) keys, and only the previous week's are ever read back, so a
 * few weeks of a busy household fit with room to spare.
 */
const MAX_SHOWN_KEYS = 200;

/** A household week is seven days from its start (`weekStartOf`). */
const WEEK_DAYS = 7;

const NONE: readonly string[] = [];
const NO_CELEBRATIONS: readonly WeekCelebration[] = [];

/* ------------------------------------------------------ the shown store -- */

let shown: readonly string[] = NONE;
let loaded = false;
const listeners = createDeviceListeners();

/** The stored list, or nothing — a corrupt value never crashes the board. */
function parse(stored: unknown): readonly string[] {
  if (!Array.isArray(stored)) return NONE;
  return stored.filter((one): one is string => typeof one === "string").slice(-MAX_SHOWN_KEYS);
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const stored = readDeviceJson(STORAGE_KEY);
    if (stored !== undefined) shown = parse(stored);
  } catch {
    // Unreadable, corrupt, or storage refused: nothing is provably shown, and
    // the session remembers in memory from here (constitution §VI).
  }
}

/** Storage refusing the write is fine: the in-memory list still holds the key. */
function save(): void {
  writeDeviceJson(STORAGE_KEY, shown);
}

/** Remember one key, newest last, evicting the oldest past the bound. */
function rememberShown(key: string): void {
  load();
  if (shown.includes(key)) return;
  shown = [...shown, key].slice(-MAX_SHOWN_KEYS);
  save();
  listeners.emit();
}

function subscribe(listener: () => void): () => void {
  load();
  return listeners.add(listener);
}

function getSnapshot(): readonly string[] {
  load();
  return shown;
}

/** The server cannot know this device's memory; it has shown nothing. */
function getServerSnapshot(): readonly string[] {
  return NONE;
}

/** Test seam: forget the session's memory and read storage again on the next call. */
export function resetWeekCelebrations(): void {
  shown = NONE;
  loaded = false;
  listeners.emit();
}

/* --------------------------------------------------------- the judgement -- */

/** What the board needs to name a Profile — `Category` satisfies it. */
export type WeekProfile = Pick<Category, "id" | "label" | "isProfile">;

/** One earned message (FR-440), as `WeekMessage` renders it. */
export interface WeekCelebration {
  /** `weekCelebrationKey(routineId, profileId, weekStart)` — the once-per-device identity. */
  key: string;
  verdict: Exclude<WeekVerdict, null>;
  profileName: string;
  /** The routine's summary. */
  routineName: string;
  /** The judged week's household-local start. */
  weekStart: string;
}

interface WeekJudgement {
  zone: string;
  /** The judged (previous) week's start. */
  weekStart: string;
  /** That week's resolutions, settled. */
  resolutions: readonly TaskResolution[];
}

/** FR-440's three readings of a scheduled day; `skipped` is SC-415's "neither". */
type DayReading = "completed" | "skipped" | "missed";

/**
 * A day left partly open is missed; a day every occurrence of which is
 * complete is completed; anything else — a skip beside completions, a skip
 * alone, or nothing at all to do — is neither. The empty case cannot arise
 * from `scheduledDaysInWeek` (it walks the same generator), and if it ever
 * did, "nothing to do" must not read as a miss.
 */
function dayReadingOf(states: readonly OccurrenceState[]): DayReading {
  if (states.some((state) => state === "unresolved")) return "missed";
  if (states.length > 0 && states.every((state) => state === "complete")) return "completed";
  return "skipped";
}

/** The states of every occurrence of one routine for one person on one day, as the board draws them. */
function dayStatesOf(
  task: Task,
  profileId: string,
  day: string,
  judgement: WeekJudgement,
): OccurrenceState[] {
  const options = { displayedDate: day, todayDate: day, zone: judgement.zone };
  return expandTaskDay([task], judgement.resolutions, [], options)
    .filter((one) => one.assigneeId === profileId)
    .map((one) => one.state);
}

function outcomeOf(task: Task, profileId: string, judgement: WeekJudgement): WeekOutcome {
  const scheduledDays = scheduledDaysInWeek(task, judgement.weekStart, judgement.zone);
  const readings = scheduledDays.map(
    (day) => [day, dayReadingOf(dayStatesOf(task, profileId, day, judgement))] as const,
  );
  return {
    scheduledDays,
    completedDays: readings.filter(([, reading]) => reading === "completed").map(([day]) => day),
    skippedDays: readings.filter(([, reading]) => reading === "skipped").map(([day]) => day),
  };
}

/** The message one routine earned one Profile that week, if any. */
function celebrationOf(
  task: Task,
  profile: WeekProfile,
  judgement: WeekJudgement,
): WeekCelebration[] {
  const verdict = weekVerdictOf(outcomeOf(task, profile.id, judgement));
  if (verdict === null) return [];
  return [
    {
      key: weekCelebrationKey(task.id, profile.id, judgement.weekStart),
      verdict,
      profileName: profile.label,
      routineName: task.summary,
      weekStart: judgement.weekStart,
    },
  ];
}

/**
 * Every message the week earned, Profile-major in household order (one
 * person's messages together), then in the routines' order. Only Profiles
 * are named — a Label assignee, or one deleted since, earns nothing.
 */
function celebrationsOf(
  judgement: WeekJudgement,
  tasks: readonly Task[],
  categories: readonly WeekProfile[],
): WeekCelebration[] {
  const tracked = tasks.filter((task) => task.routine && task.trackHabit);
  return categories
    .filter((category) => category.isProfile)
    .flatMap((profile) =>
      tracked
        .filter((task) => task.assignees.some((one) => one.categoryId === profile.id))
        .flatMap((task) => celebrationOf(task, profile, judgement)),
    );
}

/* --------------------------------------------------------------- the hook -- */

/**
 * The start of the household week before the one holding `date` — the week
 * this hook judges, and so the week the board must have read: the caller
 * passes `useTaskResolutions(householdId, prevWeekStartOf(todayDate,
 * startWeekOn)).data` as `prevWeekResolutions`. One formula for both, so
 * the read and the judgement can never name different weeks.
 */
export function prevWeekStartOf(date: string, startWeekOn: WeekStart): string {
  return addDays(weekStartOf(date, startWeekOn), -WEEK_DAYS);
}

export interface UseWeekCelebrationsOptions {
  /** Household IANA zone — the week rolls on ITS midnight. */
  zone: string;
  /**
   * The live household week: its start, or any day inside it (`useDayAnchor`'s
   * `todayDate`). Anchored with `weekStartOf(_, startWeekOn)` either way.
   */
  weekStartDate: string;
  startWeekOn: WeekStart;
  /**
   * The previous week's `taskWeek` read — `useTaskResolutions(householdId,
   * prevWeekStartOf(weekStartDate, startWeekOn)).data` — and `undefined`
   * while it is pending: nothing is judged until it has settled.
   */
  prevWeekResolutions: readonly TaskResolution[] | undefined;
  /** The household's tasks with their assignees (`useTasks`). */
  tasks: readonly Task[];
  /** The household's categories — Profiles are named, Labels are skipped. */
  categories: readonly WeekProfile[];
}

export interface WeekCelebrationsState {
  /** The message to show now, or nothing. */
  message: WeekCelebration | null;
  /** The message was seen (a tap, or `WeekMessage`'s clock): remember it and surface the next. */
  dismiss: () => void;
}

export function useWeekCelebrations(options: UseWeekCelebrationsOptions): WeekCelebrationsState {
  const { zone, weekStartDate, startWeekOn, prevWeekResolutions, tasks, categories } = options;
  const shownKeys = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const prevWeekStart = useMemo(
    () => prevWeekStartOf(weekStartDate, startWeekOn),
    [weekStartDate, startWeekOn],
  );

  // Re-judged when the week rolls over, when the read settles, or when the
  // tasks change — never by a clock of its own.
  const earned = useMemo(
    () =>
      prevWeekResolutions === undefined
        ? NO_CELEBRATIONS
        : celebrationsOf(
            { zone, weekStart: prevWeekStart, resolutions: prevWeekResolutions },
            tasks,
            categories,
          ),
    [zone, prevWeekStart, prevWeekResolutions, tasks, categories],
  );

  const message = useMemo(
    () => earned.find((one) => !shownKeys.includes(one.key)) ?? null,
    [earned, shownKeys],
  );

  const dismiss = useCallback(() => {
    if (message !== null) rememberShown(message.key);
  }, [message]);

  return { message, dismiss };
}
