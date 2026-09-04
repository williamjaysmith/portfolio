"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { weekStartOf } from "@/lib/family/calendar/dates";
import type {
  BoardOccurrence,
  Task,
  TaskCursor,
  TaskResolution,
  TimeOfDay,
  WeekStart,
} from "@/lib/family/types";

import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily } from "../../components/FamilyProvider";
import { ProfileColumn } from "./ProfileColumn";
import { occurrenceKeyOf } from "./TaskCard";
import { dayInWords, TaskDetails } from "./TaskDetails";
import { UP_FOR_GRABS_COLUMN_ID, UpForGrabsColumn } from "./UpForGrabsColumn";
import { useBoardGeometry } from "./useBoardGeometry";
import { useBoardOccurrences } from "./useBoardOccurrences";
import { useDayAnchor } from "./useDayAnchor";
import { useSectionToggles } from "./useSectionToggles";
import { resolveVerbOf, useTaskResolve } from "./useTaskResolve";

/**
 * T046: the Tasks board — the FR-301 day of per-profile columns, assembled from
 * the US1 pieces, each of which stays ignorant of the others:
 *
 *   useDayAnchor          {today | pinned} displayed day over the shared clock
 *   useBoardGeometry      measures the mounted board → how many columns fit
 *   useBoardOccurrences   the four reads → expand → the counter branch (R317)
 *   useSectionToggles     the clock's window, with per-column overrides (R322)
 *   useTaskResolve        the one `withActor` commit path (R323)
 *
 * **Up for Grabs comes first**, before every Profile, because it belongs to
 * everyone by belonging to nobody (FR-308); then one column per Profile whose
 * **Show on Tasks tab** switch is on — a Profile switched off has no column on
 * any device (FR-313), which is a different thing from this device's own
 * profile filter (FR-383) that `visibleProfiles` already applies.
 *
 * The column each occurrence is drawn in is `boardColumnsOf`, and it is the one
 * place the board could disagree with the numbers above the cards: it partitions
 * by the SAME rule `columnCountersOf` counts by (R318) — the chain's owner, or
 * the Profile a claim credited (FR-367) — so a claimed up-for-grabs chore joins
 * the crediting column and its ring together or not at all.
 *
 * Nothing here filters: `useBoardOccurrences` returns the board's whole day and
 * the display filters slot in BELOW its counter branch at T068, which is what
 * keeps "filters never move the counters" structural rather than remembered.
 *
 * The two taps are separate by construction (FR-352): the card body opens the
 * details sheet, the circle beside it runs the one commit path. The sheet holds
 * the occurrence's KEY rather than the occurrence, so it re-reads the live
 * expansion on every render — that is how a tick made here repaints the sheet
 * from the refetch, and how a task deleted on another device closes it with a
 * message instead of being recreated (FR-393).
 *
 * Creating is not in this phase's first story: the board registers "Add Task"
 * with the shipped FAB registry so the shell's one create control is named for
 * this tab, and T057 re-points it at the form.
 */

/** What the shell's "+" is called on this tab; T057 gives it the form. */
const FAB_LABEL = "Add Task";

/** Until T057 there is nothing to open, and saying so beats a control that does nothing. */
const NO_CREATE_YET = "Adding tasks comes with the task form.";

/** A failed board read says so once, in the household's words, not the API's. */
const READ_FAILED = "Today's tasks could not be loaded.";

/** FR-393: the sheet's occurrence went away underneath it. */
const GONE_MESSAGE = "That task is no longer here.";

/** Phase 1's top-bar pill (the calendar's idiom) at the FR-397 touch floor. */
const PILL_CLASS =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) items-center justify-center gap-2 " +
  "rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium " +
  "text-(length:--fam-fs-pill) text-(--fam-text-muted)";

/* ------------------------------------------------------------------ pure -- */

/** The day's occurrences split into the columns that draw them. */
export interface BoardColumns {
  /** Belonging to nobody: unassigned AND unclaimed (FR-308, FR-367). */
  upForGrabs: BoardOccurrence[];
  /** Keyed by Profile id — every shown Profile gets an entry, empty or not (FR-316). */
  byProfile: Record<string, BoardOccurrence[]>;
}

/**
 * The membership rule, stated to agree with `columnCountersOf`'s `inColumn`
 * (R318): an occurrence belongs to its chain's owner, or — having none — to the
 * Profile a resolution credited. An occurrence owned by a Profile this board
 * does not show is drawn nowhere, which is FR-313's "no column on any device".
 */
export function boardColumnsOf(
  occurrences: readonly BoardOccurrence[],
  profileIds: readonly string[],
): BoardColumns {
  const byProfile: Record<string, BoardOccurrence[]> = {};
  for (const id of profileIds) byProfile[id] = [];

  const upForGrabs: BoardOccurrence[] = [];
  for (const one of occurrences) {
    const owner = one.assigneeId ?? one.creditedCategoryId;
    if (owner === null) upForGrabs.push(one);
    else byProfile[owner]?.push(one);
  }
  return { upForGrabs, byProfile };
}

/** The four seeds, each offered only to the cache entry it was fetched for. */
export interface BoardSeeds {
  initialTasks: Task[];
  initialResolutions?: TaskResolution[];
  initialCarry?: TaskResolution[];
  initialCursors: TaskCursor[];
}

/**
 * R314's seeding rule. Definitions and cursor tails are unwindowed, so they
 * seed their one key always; the resolutions are keyed by the anchored week and
 * the carry tail by today's date, so each is withheld the moment the board has
 * navigated away from the day the server fetched for — seeding whichever window
 * happens to be mounted would hand it another window's rows for a whole
 * `staleTime`.
 */
export function boardSeedsOf(
  props: TasksBoardProps,
  displayed: { displayedDate: string; todayDate: string },
  startWeekOn: WeekStart,
): BoardSeeds {
  const sameWeek =
    weekStartOf(displayed.displayedDate, startWeekOn) ===
    weekStartOf(props.initialDate, startWeekOn);
  return {
    initialTasks: props.initialTasks,
    initialCursors: props.initialCursors,
    initialResolutions: sameWeek ? props.initialResolutions : undefined,
    initialCarry: displayed.todayDate === props.initialDate ? props.initialCarry : undefined,
  };
}

export interface NoticeInputs {
  error: Error | null;
  /** The open sheet's occurrence has left the board (FR-393). */
  gone: boolean;
  detailsOpen: boolean;
  resolveNotice: string | null;
  /** The board's own message — the create control's, for now. */
  own: string | null;
}

/**
 * The one line under the controls. A refusal raised from inside the sheet is
 * shown IN the sheet, which is modal, so it is not repeated behind it.
 */
export function boardNoticeOf(inputs: NoticeInputs): string | null {
  if (inputs.error !== null) return READ_FAILED;
  if (inputs.gone) return GONE_MESSAGE;
  if (inputs.own !== null) return inputs.own;
  return inputs.detailsOpen ? null : inputs.resolveNotice;
}

/* --------------------------------------------------------------- surfaces -- */

/**
 * The details sheet's state, held as the occurrence's KEY: what it draws is
 * re-read from the live expansion every render, so a resolution made inside it
 * repaints it from the refetch and an occurrence that has left the board takes
 * the sheet with it rather than being recreated from a stale copy (FR-393).
 */
function useDetailsSurface(occurrences: readonly BoardOccurrence[]) {
  const [key, setKey] = useState<string | null>(null);

  const occurrence = useMemo(
    () => occurrences.find((one) => occurrenceKeyOf(one) === key) ?? null,
    [occurrences, key],
  );

  const open = useCallback((one: BoardOccurrence) => setKey(occurrenceKeyOf(one)), []);
  const close = useCallback(() => setKey(null), []);

  return { key, occurrence, gone: key !== null && occurrence === null, open, close };
}

/* ------------------------------------------------------------------ view -- */

function BoardNav({
  date,
  isToday,
  onStep,
  onToday,
}: {
  date: string;
  isToday: boolean;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-(--fam-edge-inset) pt-2">
      <p
        // The date is the only thing that says which day is on screen, so it
        // is what shows the midnight rollover happening (FR-315, SC-314).
        aria-current={isToday ? "date" : undefined}
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {dayInWords(date)}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => onStep(-1)}
          className={PILL_CLASS}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button type="button" onClick={onToday} className={PILL_CLASS}>
          Today
        </button>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => onStep(1)}
          className={PILL_CLASS}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * The columns' own element, and the one the geometry measures. It takes the
 * callback ref as a plain parameter — the shipped `WeekGrid`'s idiom — so the
 * ref is never read off an object mid-render.
 */
function BoardStrip({
  boardRef,
  perRow,
  children,
}: {
  boardRef: (node: HTMLElement | null) => void;
  perRow: number;
  children: ReactNode;
}) {
  return (
    // `.fam-board` is `overflow-x: hidden` (tokens.css): twenty occurrences are
    // reached by scrolling a COLUMN, and the page never scrolls sideways at any
    // width (FR-394, SC-315). The columns share the width in equal tracks —
    // `--fam-task-col-w` is what the fit divides by, never a drawn width.
    <div
      data-board
      ref={boardRef}
      style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}
      className="fam-board grid min-h-0 flex-1 gap-(--fam-task-col-gap) overflow-y-auto px-(--fam-edge-inset) pb-(--fam-edge-inset)"
    >
      {children}
    </div>
  );
}

function Notice({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p
      role="alert"
      className="px-(--fam-edge-inset) py-1 text-(length:--fam-fs-small) text-(--fam-danger)"
    >
      {message}
    </p>
  );
}

export interface TasksBoardProps {
  /** The server-rendered household-local day (R314) — the first paint's date. */
  initialDate: string;
  /** The window the server read the clock in, so the sections do not flip on hydration. */
  initialWindow: TimeOfDay;
  initialTasks: Task[];
  initialResolutions: TaskResolution[];
  initialCarry: TaskResolution[];
  initialCursors: TaskCursor[];
}

/**
 * Every hook the board needs, assembled once. Kept out of the component so the
 * rendering below is a rendering of a value rather than a wiring of hooks.
 */
function useTasksBoardModel(props: TasksBoardProps) {
  const { householdId, settings, categories, visibleProfiles, avatarUrls, actor } = useFamily();
  const zone = settings.timezone;

  const anchor = useDayAnchor({ zone, initialDate: props.initialDate });
  const profiles = useMemo(
    () => visibleProfiles.filter((profile) => profile.showOnTasks),
    [visibleProfiles],
  );
  const toggles = useSectionToggles({ zone, initialWindow: props.initialWindow });
  const geometry = useBoardGeometry(profiles.length + 1);

  const board = useBoardOccurrences({
    householdId,
    displayedDate: anchor.displayedDate,
    todayDate: anchor.todayDate,
    zone,
    startWeekOn: settings.startWeekOn,
    ...boardSeedsOf(props, anchor, settings.startWeekOn),
  });

  const columns = useMemo(
    () => boardColumnsOf(board.occurrences, profiles.map((profile) => profile.id)),
    [board.occurrences, profiles],
  );

  const resolve = useTaskResolve();
  const details = useDetailsSurface(board.occurrences);
  const [own, setOwn] = useState<string | null>(null);

  const openDetails = details.open;
  const closeDetails = details.close;
  const runResolve = resolve.resolve;
  const clearNotice = resolve.clearNotice;

  const onOpen = useCallback(
    (occurrence: BoardOccurrence) => {
      setOwn(null);
      // A refusal belongs to the tap that earned it: opening another card must
      // not show it the last card's answer.
      clearNotice();
      openDetails(occurrence);
    },
    [openDetails, clearNotice],
  );

  const onResolve = useCallback(
    async (occurrence: BoardOccurrence) => {
      setOwn(null);
      const outcome = await runResolve({
        occurrence,
        verb: resolveVerbOf(occurrence.state),
      });
      // FR-393: another device removed it first — the sheet closes and says so
      // rather than recreating what is no longer there.
      if (outcome !== null && !outcome.ok && outcome.error === "NOT_FOUND") closeDetails();
    },
    [runResolve, closeDetails],
  );

  // The shell's one create control, named for this tab while the board is
  // mounted; T057 re-points it at the form and this message goes.
  const announceCreate = useCallback(() => setOwn(NO_CREATE_YET), []);
  useRegisterFabAction(FAB_LABEL, announceCreate);

  return {
    anchor,
    profiles,
    categories,
    avatarUrls,
    actor,
    timeFormat: settings.timeFormat,
    layout: geometry.layout,
    boardRef: geometry.boardRef,
    occurrences: board.occurrences,
    columns,
    toggles,
    resolve,
    details,
    onOpen,
    onResolve,
    notice: boardNoticeOf({
      error: board.error,
      gone: details.gone,
      detailsOpen: details.occurrence !== null,
      resolveNotice: resolve.notice,
      own,
    }),
  };
}

export function TasksBoard(props: TasksBoardProps) {
  const m = useTasksBoardModel(props);
  const open = m.details.occurrence;

  return (
    <div className="flex h-full min-h-0 flex-col gap-(--fam-task-col-gap)">
      <BoardNav
        date={m.anchor.displayedDate}
        isToday={m.anchor.isToday}
        onStep={m.anchor.step}
        onToday={m.anchor.goToToday}
      />

      <Notice message={m.notice} />

      <BoardStrip boardRef={m.boardRef} perRow={m.layout.perRow}>
        <UpForGrabsColumn
          allOccurrences={m.occurrences}
          occurrences={m.columns.upForGrabs}
          toggles={m.toggles.sectionsFor(UP_FOR_GRABS_COLUMN_ID)}
          onToggleSection={(section) => m.toggles.toggleSection(UP_FOR_GRABS_COLUMN_ID, section)}
          busyKey={m.resolve.busyKey}
          onOpen={m.onOpen}
          onResolve={m.onResolve}
        />
        {m.profiles.map((profile) => (
          <ProfileColumn
            key={profile.id}
            category={profile}
            allOccurrences={m.occurrences}
            occurrences={m.columns.byProfile[profile.id] ?? []}
            toggles={m.toggles.sectionsFor(profile.id)}
            onToggleSection={(section) => m.toggles.toggleSection(profile.id, section)}
            photoUrl={m.avatarUrls[profile.id]}
            busyKey={m.resolve.busyKey}
            onOpen={m.onOpen}
            onResolve={m.onResolve}
          />
        ))}
      </BoardStrip>

      {open === null ? null : (
        <TaskDetails
          occurrence={open}
          categories={m.categories}
          actor={m.actor}
          timeFormat={m.timeFormat}
          busy={m.resolve.busyKey === m.details.key}
          notice={m.resolve.notice}
          onResolve={() => void m.onResolve(open)}
          onClose={m.details.close}
        />
      )}
    </div>
  );
}
