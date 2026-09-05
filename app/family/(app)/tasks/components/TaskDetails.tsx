"use client";

import { useRef, type RefObject } from "react";

import { can } from "@/lib/family/permissions";
import type {
  ActorSession,
  BoardOccurrence,
  Category,
  OccurrenceState,
  TimeFormat,
} from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";
import { SECTION_LABELS } from "./SectionGroup";
import { UP_FOR_GRABS_TITLE } from "./UpForGrabsColumn";
import { DetailRow } from "../../components/DetailRow";

/**
 * The task details view (T045, FR-352, US1-8): opened by a tap on the card
 * **body**, never on its circle — the two are siblings inside the card exactly
 * so this distinction can exist.
 *
 * It shows the title, the emoji, the description (which is deliberately NOT on
 * the card — FR-321), who the task is for, and its schedule; a field the
 * occurrence does not carry simply does not render.
 *
 * **The completion action is always offered.** FR-350 puts the gate on the
 * server "rather than by hiding controls", so a member opening another
 * person's task still reaches the button and still gets FR-351's refusal by
 * name. `permissions.can` is used here for **affordance only**, and only over
 * the parent-only verbs (FR-389): Edit and Delete.
 *
 * Those two also need somewhere to go, and T057 gave them one: the board hands
 * over `onEdit` and `onDelete`, which close this sheet and open the edit form
 * or FR-347's scope question. A control with nowhere to go is still not drawn,
 * which is what "offering only the actions that apply" means.
 *
 * **Skip and Unskip are the "as applicable" half of FR-352.** Skip is drawn on
 * routines and repeating chores only, and only while the occurrence is still
 * outstanding: a one-off has no later occurrence for a skip to make room for
 * (FR-359, US3-7), and one already settled would collide on its own key.
 * Unskip is drawn on a skipped occurrence, and is the same DELETE as
 * un-complete (FR-355, FR-361) — one write, one path, two names.
 *
 * Purely presentational: every write intent leaves through a callback, no
 * action is imported, and the schedule is put into words from the occurrence
 * alone — the repeat RULE stays server-side, as it does on the calendar (R201).
 *
 * Modality is Phase 1's dialog idiom: native `showModal()` for the focus trap,
 * Escape routed through `onCancel`, and the opener refocused on unmount.
 */

/** A plain household-local date in words. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  // Formatted in UTC on purpose: a plain date has no zone, and running it
  // through the household's would shift it across midnight.
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function dayInWords(date: string): string {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

/** A stored `HH:MM` household wall clock in the household's own format. */
function clockInWords(time: string, timeFormat: TimeFormat): string {
  const [hours, minutes] = time.split(":");
  if (timeFormat === "24h") return `${hours}:${minutes}`;
  const hour24 = Number(hours);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${hour24 < 12 ? "AM" : "PM"}`;
}

/**
 * The occurrence's own place in the day: a routine's slot, a timed chore's
 * clock, an all-day chore's date, or an Anytime chore's absence of one
 * (FR-325, FR-328, FR-336).
 */
function whenInWords(occurrence: BoardOccurrence, timeFormat: TimeFormat): string {
  if (occurrence.scheduledDate === null) return "Anytime";
  const day = dayInWords(occurrence.scheduledDate);
  if (occurrence.slot !== null) return `${SECTION_LABELS[occurrence.slot]} · ${day}`;
  if (occurrence.dueTime === null) return `${day} · All day`;
  return `${day} at ${clockInWords(occurrence.dueTime, timeFormat)}`;
}

/**
 * The schedule as one line. A late occurrence names its OWN due date and not
 * the day it is drawn on (FR-358), because the date is its identity.
 */
export function scheduleInWords(occurrence: BoardOccurrence, timeFormat: TimeFormat): string {
  const parts = [whenInWords(occurrence, timeFormat)];
  if (occurrence.isLate) parts.push("Late");
  if (occurrence.isRepeating) parts.push("Repeats");
  return parts.join(" · ");
}

/** FR-352's action list, as the three verbs this phase can actually write. */
const ACTIONS: Record<OccurrenceState, string> = {
  unresolved: "Mark as Complete",
  complete: "Mark as Incomplete",
  skipped: "Unskip",
};

/**
 * Whose task this is on screen: the Profile a resolution credited, else the
 * chain's owner, else nobody at all — which is the Up for Grabs column
 * (FR-367, FR-308).
 */
function creditedProfileOf(
  occurrence: BoardOccurrence,
  categories: readonly Category[],
): Category | null {
  const id = occurrence.creditedCategoryId ?? occurrence.assigneeId;
  if (id === null) return null;
  return categories.find((category) => category.id === id) ?? null;
}


const BUTTON_CLASS =
  "min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 " +
  "text-(length:--fam-fs-body) font-medium";

/** The task's title, with its emoji beside it (FR-320) rather than in its name. */
function DetailsTitle({ emoji, summary }: { emoji: string | null; summary: string }) {
  return (
    <h2
      id="task-details-title"
      className="flex items-center gap-3 font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
    >
      {emoji === null ? null : (
        <span aria-hidden="true" className="text-(length:--fam-task-emoji) leading-none">
          {emoji}
        </span>
      )}
      {summary}
    </h2>
  );
}

/** Whose it is: a Profile in its own colour, or the column that belongs to nobody. */
function AssignedTo({ profile }: { profile: Category | null }) {
  if (profile === null) return <>{UP_FOR_GRABS_TITLE}</>;
  return (
    <span className="flex min-h-(--fam-touch) w-fit items-center gap-2">
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: profile.color }}
      />
      {profile.label}
    </span>
  );
}

interface DetailsActionsProps {
  action: string;
  busy: boolean;
  /** FR-389's affordance: the two parent-only controls, once they have a surface. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** FR-359: present only where a skip is a thing this occurrence can be. */
  onSkip?: () => void;
  onResolve: () => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
}

/**
 * FR-352's action list. The resolve control is last and always present; Edit
 * and Delete are drawn only when the caller both may and can — a member never
 * sees them, and neither does anyone before T057 wires them to a form.
 */
function DetailsActions({
  action,
  busy,
  onEdit,
  onDelete,
  onSkip,
  onResolve,
  onClose,
  closeRef,
}: DetailsActionsProps) {
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button ref={closeRef} type="button" onClick={onClose} className={BUTTON_CLASS}>
        Close
      </button>
      {onDelete === undefined ? null : (
        <button type="button" onClick={onDelete} className={`${BUTTON_CLASS} text-(--fam-danger)`}>
          Delete
        </button>
      )}
      {onEdit === undefined ? null : (
        <button type="button" onClick={onEdit} className={BUTTON_CLASS}>
          Edit
        </button>
      )}
      {onSkip === undefined ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className={BUTTON_CLASS}
        >
          Skip
        </button>
      )}
      <button
        type="button"
        aria-busy={busy ? "true" : undefined}
        disabled={busy}
        onClick={onResolve}
        className="min-h-(--fam-touch) rounded-full bg-(--fam-text-primary) px-5 text-(length:--fam-fs-body) font-medium text-(--fam-app-bg)"
      >
        {action}
      </button>
    </div>
  );
}

/** A parent-only control the board has given somewhere to go (FR-389). */
function affordance(handler: (() => void) | undefined, mayManage: boolean) {
  return mayManage ? handler : undefined;
}

/**
 * FR-359 as a rendering rule. A routine always carries a rule, so `isRepeating`
 * covers both halves of "routines and repeating chores"; the state test is what
 * keeps Skip off a card that has already been settled one way or the other.
 * The SERVER refuses the same row either way (FR-350 forbids the control being
 * the gate) — this only stops offering an action that cannot mean anything.
 */
function skippable(occurrence: BoardOccurrence): boolean {
  return occurrence.state === "unresolved" && occurrence.isRepeating;
}

export interface TaskDetailsProps {
  occurrence: BoardOccurrence;
  /** The household's categories, to name who the task is for by name and colour. */
  categories: readonly Category[];
  /** Who is punched in — the affordance's input, never the gate (FR-350, R323). */
  actor: ActorSession | null;
  timeFormat: TimeFormat;
  /** FR-393: this occurrence's write is in flight. */
  busy?: boolean;
  /** FR-351's refusal, shown where the tap happened rather than behind the sheet. */
  notice?: string | null;
  /** The one commit path (T044); the board picks the verb from the drawn state. */
  onResolve: () => void;
  /** FR-359's Skip, through that same path; drawn only where it applies. */
  onSkip: () => void;
  /** Parent-only (FR-389), and absent until T057 gives them a surface to open. */
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function TaskDetails({
  occurrence,
  categories,
  actor,
  timeFormat,
  busy = false,
  notice = null,
  onResolve,
  onSkip,
  onEdit,
  onDelete,
  onClose,
}: TaskDetailsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, closeRef);

  const householdHasParent = categories.some(
    (category) => category.isProfile && category.role === "parent",
  );
  const mayManage = can(actor, "manage_tasks", { householdHasParent }).allowed;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <DetailsTitle emoji={occurrence.emoji} summary={occurrence.summary} />

      <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary) tabular-nums">
        {scheduleInWords(occurrence, timeFormat)}
      </p>

      <DetailRow label="For">
        <AssignedTo profile={creditedProfileOf(occurrence, categories)} />
      </DetailRow>

      {occurrence.description === null ? null : (
        <DetailRow label="Notes">
          <span className="whitespace-pre-wrap">{occurrence.description}</span>
        </DetailRow>
      )}

      {notice === null ? null : (
        <p role="alert" className="mt-3 text-(length:--fam-fs-small) text-(--fam-danger)">
          {notice}
        </p>
      )}

      <DetailsActions
        action={ACTIONS[occurrence.state]}
        busy={busy}
        onEdit={affordance(onEdit, mayManage)}
        onDelete={affordance(onDelete, mayManage)}
        onSkip={skippable(occurrence) ? onSkip : undefined}
        onResolve={onResolve}
        onClose={onClose}
        closeRef={closeRef}
      />
    </dialog>
  );
}
