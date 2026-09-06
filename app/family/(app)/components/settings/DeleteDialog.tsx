"use client";

import { useRef, useState } from "react";

import { deleteCategory } from "@/lib/family/actions/categories";
import { canDelete } from "@/lib/family/permissions";
import {
  useCategoryEventCount,
  useCategoryTaskCounts,
  type CategoryTaskCounts,
} from "@/lib/family/queries";
import type { Category } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";
import { useModalDialog } from "../useModalDialog";

/**
 * Deleting is confirmed, and the dialog says exactly what goes and what stays
 * (FR-026, constitution §VI). The only parent cannot be deleted at all — the
 * database refuses it too, so this is an explanation, not the enforcement.
 *
 * Phase 2 amends what "stays" with a number (002 FR-274, Assumption 24): the
 * events carrying this Profile or Label survive its deletion, rendered
 * without it, and the confirmation says how many — an RLS read through
 * `useCategoryEventCount`, counted afresh for the dialog, never an action.
 *
 * Phase 3 amends it a second time, and the dialog now carries **two opposite
 * promises at once** (003 FR-391, SC-317): no event is destroyed by deleting a
 * Profile, while a task left with nobody to do it **is** deleted with it —
 * because a chore becomes up-for-grabs by an explicit choice and never by
 * attrition. Both are said in the same breath, because a household that read
 * only one of them would be surprised by the other.
 *
 * Phase 4 adds a third sentence (004 FR-443, SC-419): the Profile's stars go
 * with them, so the dialog states how many they forfeit. The balance is a sum
 * of entries and may sit below zero (Assumption 5), and a debt is worded as a
 * debt the deletion clears — never "forfeits −20 stars". Nothing is said at
 * zero, and a Label has no balance to speak of (FR-414).
 */

export interface DeleteDialogProps {
  category: Category;
  onClose: () => void;
}

/** Tasks somebody else is also assigned to: they survive without this Profile. */
function sharedTasksSentence(count: number, label: string): string {
  if (count === 0) return "";
  if (count === 1) return `1 task is shared with someone else — it stays, just without ${label}.`;
  return `${count} tasks are shared with someone else — they stay, just without ${label}.`;
}

/** FR-391's other half, and the opposite promise: nobody left to do it, so it goes. */
function orphanedTasksSentence(count: number, label: string): string {
  if (count === 0) return "";
  const subject = count === 1 ? "1 task is" : `${count} tasks are`;
  return `${subject} ${label}'s alone — a task with nobody left to do it is deleted too.`;
}

/** "1 star" or "N stars". */
function starsPhrase(count: number): string {
  return count === 1 ? "1 star" : `${count} stars`;
}

/**
 * FR-443's sentence, from the SIGNED balance: forfeited above zero, a debt
 * cleared below it (Assumption 5), nothing at zero.
 */
function forfeitedStarsSentence(balance: number, label: string): string {
  if (balance > 0) return `${label} forfeits ${starsPhrase(balance)}.`;
  if (balance < 0) return `Deleting ${label} clears a debt of ${starsPhrase(-balance)}.`;
  return "";
}

/** FR-391's line — and, from Phase 4, FR-443's sentence after it. */
function affectedTasksLine(
  count: { data?: CategoryTaskCounts; isError: boolean },
  label: string,
): string {
  if (count.isError) return "Couldn't count the tasks this affects.";
  if (count.data === undefined) return "Counting the tasks this affects…";
  const tasks = [
    sharedTasksSentence(count.data.losingAnAssignee, label),
    orphanedTasksSentence(count.data.deleted, label),
  ].filter((sentence) => sentence !== "");
  const taskLine = tasks.length === 0 ? `No tasks are assigned to ${label}.` : tasks.join(" ");
  const stars = forfeitedStarsSentence(count.data.starsForfeited, label);
  return stars === "" ? taskLine : `${taskLine} ${stars}`;
}

/** FR-274's line: how many events this touches, and that they stay. */
function affectedEventsLine(
  count: { data?: number; isError: boolean },
  category: Pick<Category, "label" | "isProfile">,
): string {
  if (count.isError) return "Couldn't count the events this affects.";
  if (count.data === undefined) return "Counting the events this affects…";
  const carrying = category.isProfile ? `assigned to ${category.label}` : `tagged ${category.label}`;
  if (count.data === 0) return `No events are ${carrying}.`;
  if (count.data === 1) {
    return `1 event is ${carrying} — it stays on the calendar, just without ${category.label}.`;
  }
  return `${count.data} events are ${carrying} — they stay on the calendar, just without ${category.label}.`;
}

export function DeleteDialog({ category, onClose }: DeleteDialogProps) {
  const { householdId, profiles, actor, withActor } = useFamily();
  const affected = useCategoryEventCount(householdId, category.id);
  const affectedTasks = useCategoryTaskCounts(householdId, category.id);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, cancelRef);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const lastParent = category.isProfile && !canDelete(category, profiles).allowed;
  const isSelf = actor?.profileId === category.id;

  async function confirm(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await withActor(() => deleteCategory(category.id, { confirm: true }));
    setPending(false);
    if (result.ok) {
      onClose();
      return;
    }
    setMessage(result.message);
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="delete-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="delete-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {category.isProfile ? `Delete ${category.label}?` : `Delete the ${category.label} label?`}
      </h2>

      <p className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        {category.isProfile
          ? `This removes ${category.label}'s profile, colour, avatar and PIN. Anything assigned to ${category.label} in the future would be left unassigned. This can't be undone.`
          : `Items tagged only with ${category.label} would become untagged. This can't be undone.`}
      </p>

      <div role="status" className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        <p>{affectedEventsLine(affected, category)}</p>
        {/* FR-323: a task is never given to a Label, so there is no number to state. */}
        {category.isProfile ? (
          <p className="mt-2">{affectedTasksLine(affectedTasks, category.label)}</p>
        ) : null}
      </div>

      {isSelf ? (
        <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          You&rsquo;re punched in as {category.label} — you&rsquo;ll be punched out.
        </p>
      ) : null}

      {lastParent ? (
        <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-primary)">
          You can&rsquo;t delete the only parent. Make someone else a parent first.
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="mt-2 text-(length:--fam-fs-body)">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || lastParent}
          className="min-h-[44px] rounded-full bg-(--fam-danger) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-50"
        >
          Delete {category.label}
        </button>
      </div>
    </dialog>
  );
}
