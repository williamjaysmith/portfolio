"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import {
  createTaskBoxItem,
  deleteTaskBoxItem,
  updateTaskBoxItem,
} from "@/lib/family/actions/task-box";
import type { ActionResult } from "@/lib/family/errors";
import { can } from "@/lib/family/permissions";
import { useTaskBox } from "@/lib/family/queries";
import type { TaskBoxItem } from "@/lib/family/types";

import { useFamily, type FamilyContextValue } from "../../components/FamilyProvider";
import { FIELD, LABEL } from "../../components/settings/CategoryFields";
import { useModalDialog } from "../../components/useModalDialog";
import { StarsField } from "./TaskForm";
import { starsOf, starsTextOf, type TaskFormSeed } from "./useTaskForm";

/**
 * T072 — the Task Box (FR-376…FR-381), reached from the tab's create control:
 * the Add form carries a **Task Box** button, which is the reference's own
 * Add → Task Box.
 *
 * The templates are fetched **lazily**: this component is mounted only while
 * the sheet is open, so `useTaskBox` runs then and at no other time — R314's
 * fifth read, off the critical path, the shipped `useCategoryTaskCounts` shape.
 *
 * Three things this sheet is, and one it is not:
 *
 *   - **Two sections and its own search.** Chores and Routines are listed
 *     apart, and the box at the top filters *templates by title* as it is
 *     typed. That is a different control from the board's task search (FR-386),
 *     which filters occurrences by title or description; the two never meet.
 *   - **Choosing one is not an action** (FR-378). It hands the board a
 *     `TaskFormSeed` carrying the template's four values — title, emoji, type
 *     and star value (004 FR-404) — and the ordinary create form opens
 *     pre-filled, with the assignment and the schedule empty and still
 *     required, because a template cannot hold either (FR-377). The save is
 *     `createTask` like any other, which is what keeps SC-318's "asks only for
 *     the assignment and the schedule" true by construction.
 *   - **Editing offers exactly four fields** — title, emoji, type, and the
 *     star value that is the reference's fourth editable field (FR-380,
 *     004 FR-401) — and deleting warns first that it cannot be undone, and
 *     that tasks already made from the template are unaffected (FR-381,
 *     US4-11/12). The star field is the task form's own `StarsField`, so the
 *     two surfaces cannot drift (FR-402's rules, once).
 *
 * **New template** is here for the same reason, on the same form: FR-389 makes
 * "managing Task Box templates" a parent's verb and the contract gives the box
 * three actions, of which `createTaskBoxItem` is one — FR-379's *Save to task
 * box* is a flag on `createTask` and so is not its caller. A template that can
 * be edited and deleted here can be made here, with the same four fields and
 * no fifth.
 *
 * And what it is not: the gate. Edit and Delete are drawn for a parent only as
 * an affordance (FR-389); `lib/family/actions/task-box.ts` refuses a member's
 * request whether or not the control was ever rendered.
 */

export interface TaskBoxSheetProps {
  /** FR-378 / 004 FR-404: the chosen template's four values, for the ordinary create form. */
  onChoose: (seed: TaskFormSeed) => void;
  /** Back to where the sheet was opened from — the create form (FR-376). */
  onClose: () => void;
}

const BUTTON = "min-h-(--fam-touch) rounded-full px-5 text-(length:--fam-fs-body) font-medium";
const ICON_BUTTON =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) items-center justify-center rounded-full " +
  "text-(--fam-text-muted)";
const NOTE = "mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)";
const SWITCH_ROW = "flex min-h-(--fam-touch) items-center gap-3 text-(length:--fam-fs-body)";

/* ------------------------------------------------------------------ pure -- */

/**
 * The sheet's own filter (FR-376): a case-insensitive match on the **title**,
 * which is the only text a template has. A blank or all-space box filters
 * nothing.
 */
export function matchingTemplates(
  items: readonly TaskBoxItem[],
  query: string,
): TaskBoxItem[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...items];
  return items.filter((item) => item.summary.toLowerCase().includes(needle));
}

/**
 * FR-378's prefill, and the whole of it: a title, an emoji, a type and the
 * star value (004 FR-404). Every other field of the draft is left at its blank
 * default, so the assignment and the schedule are asked for exactly as they
 * are on an empty form (US4-10).
 */
function templateSeedOf(item: TaskBoxItem): TaskFormSeed {
  return {
    summary: item.summary,
    emoji: item.emoji ?? "",
    type: item.routine ? "routine" : "chore",
    rewardPoints: starsTextOf(item.rewardPoints),
  };
}

/** FR-377's fields, plus 004's fourth, as the edit form hands them back. */
interface TemplateFields {
  summary: string;
  emoji: string | null;
  routine: boolean;
  /** 004 FR-401/FR-402: a number 0–500, or null for none; never the typed text. */
  rewardPoints: number | null;
}

/** What a brand-new template starts as: a chore with no title, no emoji and no stars. */
const BLANK_TEMPLATE: TemplateFields = {
  summary: "",
  emoji: null,
  routine: false,
  rewardPoints: null,
};

/* ----------------------------------------------------------- the writes -- */

/** Which of the three parent-only surfaces is open, and over which template. */
type OpenSurface =
  | { kind: "new" }
  | { kind: "edit"; id: string }
  | { kind: "delete"; id: string };

interface TemplateWrites {
  open: OpenSurface | null;
  pending: boolean;
  /** A refusal, shown in the sheet the tap happened in (FR-393). */
  notice: string | null;
  add: () => void;
  edit: (id: string) => void;
  remove: (id: string) => void;
  cancel: () => void;
  create: (fields: TemplateFields) => Promise<void>;
  save: (id: string, fields: TemplateFields) => Promise<void>;
  destroy: (id: string) => Promise<void>;
}

/**
 * Both writes through the shipped `withActor` interceptor, so a punch-in
 * arrives at the moment of the tap and the query cache is swept on success —
 * the sheet redraws from the refetch and nothing is written to the cache by
 * hand (FR-393).
 */
function useTemplateWrites(withActor: FamilyContextValue["withActor"]): TemplateWrites {
  const [open, setOpen] = useState<OpenSurface | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function commit(run: () => Promise<ActionResult<unknown>>): Promise<void> {
    if (pending) return;
    setPending(true);
    setNotice(null);
    const result = await withActor(run);
    setPending(false);
    // A refusal keeps the surface open, carrying the server's own words.
    if (result.ok) setOpen(null);
    else setNotice(result.message);
  }

  function openAs(next: OpenSurface): void {
    setNotice(null);
    setOpen(next);
  }

  return {
    open,
    pending,
    notice,
    add: () => openAs({ kind: "new" }),
    edit: (id) => openAs({ kind: "edit", id }),
    remove: (id) => openAs({ kind: "delete", id }),
    cancel: () => {
      setNotice(null);
      setOpen(null);
    },
    create: (fields) => commit(() => createTaskBoxItem(fields)),
    save: (id, fields) => commit(() => updateTaskBoxItem({ id, patch: fields })),
    destroy: (id) => commit(() => deleteTaskBoxItem({ id, confirm: true })),
  };
}

/* ---------------------------------------------------------------- rows -- */

interface RowHandlers {
  /** FR-389's affordance only — never the gate (FR-350's rule, kept here too). */
  mayManage: boolean;
  writes: TemplateWrites;
  onChoose: (item: TaskBoxItem) => void;
}

function TemplateRow({
  item,
  handlers,
}: {
  item: TaskBoxItem;
  handlers: RowHandlers;
}) {
  const { writes } = handlers;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handlers.onChoose(item)}
        className="flex min-h-(--fam-touch) flex-1 items-center gap-2 rounded-xl px-2 text-left text-(length:--fam-fs-body)"
      >
        {item.emoji === null ? null : (
          <span aria-hidden="true" className="text-(length:--fam-fs-body)">
            {item.emoji}
          </span>
        )}
        {item.summary}
      </button>
      {handlers.mayManage ? (
        <>
          <button
            type="button"
            aria-label={`Edit ${item.summary}`}
            onClick={() => writes.edit(item.id)}
            className={ICON_BUTTON}
          >
            <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${item.summary}`}
            onClick={() => writes.remove(item.id)}
            className={ICON_BUTTON}
          >
            <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  );
}

/**
 * FR-380's three fields and 004 FR-401's fourth, the star value, on the task
 * form's own `StarsField`. A refusal is the sheet's notice (FR-393), so the
 * field carries no error slot of its own here.
 */
function TemplateEditor({
  title,
  initial,
  pending,
  onSave,
  onCancel,
}: {
  /** The form's own name — "New template", or "Edit <title>". */
  title: string;
  initial: TemplateFields;
  pending: boolean;
  onSave: (fields: TemplateFields) => void;
  onCancel: () => void;
}) {
  const [summary, setSummary] = useState(initial.summary);
  const [emoji, setEmoji] = useState(initial.emoji ?? "");
  const [routine, setRoutine] = useState(initial.routine);
  const [stars, setStars] = useState(starsTextOf(initial.rewardPoints));

  function submit(): void {
    const trimmed = emoji.trim();
    onSave({
      summary: summary.trim(),
      emoji: trimmed === "" ? null : trimmed,
      routine,
      rewardPoints: starsOf(stars),
    });
  }

  return (
    <form
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 rounded-xl border border-(--fam-hairline) p-3"
    >
      <label className={LABEL}>
        Title
        <input
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={120}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Emoji
        <input
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          maxLength={16}
          className={FIELD}
        />
      </label>
      <label className={SWITCH_ROW}>
        <input
          type="checkbox"
          checked={routine}
          onChange={(event) => setRoutine(event.target.checked)}
          className="size-5 accent-(--fam-primary-blue)"
        />
        Routine
      </label>
      <StarsField value={stars} onChange={setStars} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border border-(--fam-hairline)`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON} bg-(--fam-primary-blue) text-white`}
        >
          Save
        </button>
      </div>
    </form>
  );
}

/**
 * FR-381's warning, carrying both halves: the deletion is permanent, and the
 * tasks already made from the template are untouched — which is true
 * structurally (nothing references a template), and is said here because a
 * parent about to delete "Homework" will otherwise assume the opposite.
 */
function DeleteWarning({
  item,
  pending,
  onConfirm,
  onCancel,
}: {
  item: TaskBoxItem;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-(--fam-hairline) p-3">
      <p className="text-(length:--fam-fs-body)">
        Delete &ldquo;{item.summary}&rdquo; from the Task Box? This can&rsquo;t be undone. Tasks
        already made from it aren&rsquo;t affected.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border border-(--fam-hairline)`}
        >
          Keep it
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={`${BUTTON} bg-(--fam-danger) text-white`}
        >
          Delete for good
        </button>
      </div>
    </div>
  );
}

/** FR-377's fields and 004's fourth, read off a stored template. */
function fieldsOf(item: TaskBoxItem): TemplateFields {
  return {
    summary: item.summary,
    emoji: item.emoji,
    routine: item.routine,
    rewardPoints: item.rewardPoints,
  };
}

/** What a template surface is open over — `null` when this row is at rest. */
function openKindOf(open: OpenSurface | null, id: string): OpenSurface["kind"] | null {
  if (open === null || open.kind === "new") return null;
  return open.id === id ? open.kind : null;
}

/** One row, in whichever of its three states this template is currently in. */
function TemplateEntry({ item, handlers }: { item: TaskBoxItem; handlers: RowHandlers }) {
  const { writes } = handlers;
  const open = openKindOf(writes.open, item.id);

  if (open === "edit") {
    return (
      <TemplateEditor
        title={`Edit ${item.summary}`}
        initial={fieldsOf(item)}
        pending={writes.pending}
        onSave={(fields) => void writes.save(item.id, fields)}
        onCancel={writes.cancel}
      />
    );
  }
  if (open === "delete") {
    return (
      <DeleteWarning
        item={item}
        pending={writes.pending}
        onConfirm={() => void writes.destroy(item.id)}
        onCancel={writes.cancel}
      />
    );
  }
  return <TemplateRow item={item} handlers={handlers} />;
}

/** FR-376's two sections. An empty one still renders, so the pair is stable. */
function TemplateSection({
  title,
  headingId,
  items,
  handlers,
}: {
  title: string;
  headingId: string;
  items: readonly TaskBoxItem[];
  handlers: RowHandlers;
}) {
  return (
    <section aria-labelledby={headingId} className="mt-4">
      <h3
        id={headingId}
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-(length:--fam-fs-small) text-(--fam-text-secondary)">None here.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <TemplateEntry item={item} handlers={handlers} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The box's own create path (FR-389): a control until it is tapped, then the
 * very form an edit uses, with the same four fields.
 */
function NewTemplate({ writes }: { writes: TemplateWrites }) {
  if (writes.open?.kind === "new") {
    return (
      <div className="mt-4">
        <TemplateEditor
          title="New template"
          initial={BLANK_TEMPLATE}
          pending={writes.pending}
          onSave={(fields) => void writes.create(fields)}
          onCancel={writes.cancel}
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={writes.add}
      className={`${BUTTON} mt-4 border border-(--fam-hairline)`}
    >
      New template
    </button>
  );
}

interface BodyProps {
  isPending: boolean;
  isError: boolean;
  items: readonly TaskBoxItem[];
  query: string;
  handlers: RowHandlers;
}

/** The four things the sheet can be showing, in the order they can be true. */
function TaskBoxBody({ isPending, isError, items, query, handlers }: BodyProps): ReactNode {
  if (isPending) return <p className={NOTE}>Loading the Task Box&hellip;</p>;
  if (isError) {
    return (
      <p role="alert" className={NOTE}>
        The Task Box couldn&rsquo;t be loaded.
      </p>
    );
  }
  if (items.length === 0) return <p className={NOTE}>There&rsquo;s nothing in the Task Box yet.</p>;

  const shown = matchingTemplates(items, query);
  if (shown.length === 0) return <p className={NOTE}>Nothing matches that search.</p>;

  return (
    <>
      <TemplateSection
        title="Chores"
        headingId="task-box-chores"
        items={shown.filter((item) => !item.routine)}
        handlers={handlers}
      />
      <TemplateSection
        title="Routines"
        headingId="task-box-routines"
        items={shown.filter((item) => item.routine)}
        handlers={handlers}
      />
    </>
  );
}

/* -------------------------------------------------------------- the sheet -- */

export function TaskBoxSheet({ onChoose, onClose }: TaskBoxSheetProps) {
  const { householdId, actor, categories, withActor } = useFamily();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, closeRef);
  const box = useTaskBox(householdId);
  const [query, setQuery] = useState("");
  const writes = useTemplateWrites(withActor);

  const householdHasParent = categories.some(
    (category) => category.isProfile && category.role === "parent",
  );
  const handlers: RowHandlers = {
    mayManage: can(actor, "manage_task_box", { householdHasParent }).allowed,
    writes,
    onChoose: (item) => onChoose(templateSeedOf(item)),
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-box-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="task-box-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        Task Box
      </h2>
      <p className="mt-1 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        Chores and routines you add to a profile more than once.
      </p>

      <label className={`${LABEL} mt-4`}>
        Search the Task Box
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={FIELD}
        />
      </label>

      {writes.notice === null ? null : (
        <p role="status" className="mt-3 text-(length:--fam-fs-small) text-(--fam-danger)">
          {writes.notice}
        </p>
      )}

      {/* FR-389's third parent-only verb, on the same four-field form. */}
      {handlers.mayManage ? <NewTemplate writes={writes} /> : null}

      <TaskBoxBody
        isPending={box.isPending}
        isError={box.isError}
        items={box.data ?? []}
        query={query}
        handlers={handlers}
      />

      <div className="mt-5 flex justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${BUTTON} border border-(--fam-hairline)`}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
