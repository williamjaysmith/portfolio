"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ActionFailure } from "@/lib/family/errors";
import { itemsInWords } from "@/lib/family/lists/grouping";
import { linesOf, type RecipeLine } from "@/lib/family/meals/lines";
import type { List } from "@/lib/family/types";

import { FormDialog } from "../../components/FormDialog";
import { FormFooter } from "../../components/FormFooter";
import { settleSubmit, useSubmission, type Settled, type SubmitOutcome } from "../../components/formSubmit";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";

/**
 * Add to List (006 FR-631–FR-633; R610; 42181628465435 — "tap 'Add to Grocery
 * List'"): the recipe's lines as a checklist, every line chosen so the
 * person unticks the instructions, a chooser of the household's lists with
 * Grocery lists first — the master map's divergence row 7 — and one write.
 * A line longer than an item says it will be cut. No list, or no line, is
 * said and writes nothing.
 */

export interface AddToListSheetProps {
  recipeName: string;
  text: string;
  /** The lists this actor may see, in the household's order (Parents only filtered by the board). */
  lists: readonly List[];
  onSubmit: (input: { listId: string; texts: string[] }) => Promise<SubmitOutcome>;
  onClose: () => void;
}

const CHOOSE_A_LINE = "Choose at least one line.";
const ROW = "flex min-h-(--fam-touch) cursor-pointer items-center gap-3 text-(length:--fam-fs-body)";

/** Grocery lists first, then the rest, each in the household's order (FR-631). */
function orderedLists(lists: readonly List[]): List[] {
  return [...lists.filter((list) => list.kind === "grocery"), ...lists.filter((list) => list.kind !== "grocery")];
}

function Empty({ title, body, onClose }: { title: string; body: React.ReactNode; onClose: () => void }) {
  return (
    <FormDialog titleId="add-to-list-title" title={title} onClose={onClose}>
      <p className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">{body}</p>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="min-h-(--fam-touch) rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white">
          Close
        </button>
      </div>
    </FormDialog>
  );
}

function LineChecklist({ lines, chosen, onToggle }: { lines: readonly RecipeLine[]; chosen: ReadonlySet<number>; onToggle: (index: number) => void }) {
  return (
    <fieldset className="flex max-h-[40vh] flex-col overflow-y-auto">
      <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Lines</legend>
      {lines.map((line, index) => (
        <label key={index} className={ROW}>
          <input type="checkbox" checked={chosen.has(index)} onChange={() => onToggle(index)} className="h-5 w-5" />
          <span className="min-w-0 flex-1 truncate">{line.text}</span>
          {line.truncated ? <span className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">cut to 200 characters</span> : null}
        </label>
      ))}
    </fieldset>
  );
}

export function AddToListSheet({ recipeName, text, lists, onSubmit, onClose }: AddToListSheetProps) {
  const lines = useMemo(() => linesOf(text), [text]);
  const ordered = useMemo(() => orderedLists(lists), [lists]);
  const [chosen, setChosen] = useState<ReadonlySet<number>>(() => new Set(lines.map((_, index) => index)));
  const [listId, setListId] = useState(ordered[0]?.id ?? "");
  const submission = useSubmission(onClose);

  if (ordered.length === 0) {
    return (
      <Empty
        title="No list to add to"
        body={
          <>
            Make a list on the <Link href="/family/lists" className="underline">Lists tab</Link> first.
          </>
        }
        onClose={onClose}
      />
    );
  }
  if (lines.length === 0) {
    return <Empty title="Nothing to add" body={`${recipeName} has no ingredients or instructions yet.`} onClose={onClose} />;
  }

  function toggle(index: number): void {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function parse(): { listId: string; texts: string[] } {
    const texts = lines.filter((_, index) => chosen.has(index)).map((line) => line.text);
    if (texts.length === 0) throw new ActionFailure("VALIDATION", CHOOSE_A_LINE, { lines: [CHOOSE_A_LINE] });
    return { listId, texts };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await submission.submit((): Promise<Settled> => settleSubmit(parse, onSubmit));
  }

  return (
    <FormDialog titleId="add-to-list-title" title={`Add ${recipeName} to a list`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <LineChecklist lines={lines} chosen={chosen} onToggle={toggle} />
        <FieldError messages={submission.errors.lines} />
        <label className={LABEL}>
          List
          <select value={listId} onChange={(event) => setListId(event.target.value)} className={FIELD}>
            {ordered.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>
        <FormFooter errors={submission.errors} message={submission.message} pending={submission.pending} onClose={onClose} />
        <p className="sr-only" aria-live="polite">
          {itemsInWords(chosen.size)} chosen
        </p>
      </form>
    </FormDialog>
  );
}
