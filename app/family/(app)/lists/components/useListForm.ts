"use client";

import type { PaletteColor } from "@/lib/family/colors";
import type { FieldErrors } from "@/lib/family/errors";
import type { List, ListKind } from "@/lib/family/types";
import { listInputSchema, parseOrThrow, type ListInput } from "@/lib/family/validation";

import { settleSubmit, useSubmission, type Settled, type SubmitOutcome } from "../../components/formSubmit";
import { useDraft, type Draft } from "../../components/useDraft";

/**
 * Draft state + submit machinery for the list form (005 T030), on the same
 * `formSubmit` path as the event, task and reward forms, so a refusal is shown
 * one way across the four. The draft IS the contract's shape — a list has no
 * text-typed number and no optional to fold — so the only translation is the
 * schema's own trim and colour normalisation.
 *
 * Validation is the SAME schema the action runs (`listInputSchema`), so a
 * refusal the server would give lands against its field before the network is
 * touched (FR-509, FR-510). Who may save is the server's gate (FR-534).
 */

export interface ListDraft {
  name: string;
  kind: ListKind;
  color: PaletteColor;
  /** FR-514. */
  parentsOnly: boolean;
}

export type ListFormSeed = Partial<ListDraft>;
export type ListFormMode = "create" | "edit";
export type ListSubmitOutcome = SubmitOutcome;

/** A new list: To do, in Sprout — the live default grocery colour — and open to all. */
function blankDraft(): ListDraft {
  return { name: "", kind: "to_do", color: "#B6E085", parentsOnly: false };
}

/** A stored list as the draft that would have produced it. */
export function listDraftOf(list: List): ListDraft {
  return { name: list.name, kind: list.kind, color: list.color, parentsOnly: list.parentsOnly };
}

function validateAndSubmit(draft: ListDraft, options: UseListFormOptions): Promise<Settled> {
  return settleSubmit(() => parseOrThrow(listInputSchema, draft), options.onSubmit);
}

export interface UseListFormOptions {
  seed?: ListFormSeed;
  /** The commit — the board routes it through `withActor(...)`; tests drive a mock. */
  onSubmit: (input: ListInput) => Promise<ListSubmitOutcome>;
  onClose: () => void;
}

export interface ListFormState {
  draft: ListDraft;
  set: Draft<ListDraft>["set"];
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  submit: () => Promise<void>;
}

export function useListForm(options: UseListFormOptions): ListFormState {
  const { draft, set } = useDraft(blankDraft, options.seed);
  const submission = useSubmission(options.onClose);
  return {
    draft,
    set,
    errors: submission.errors,
    message: submission.message,
    pending: submission.pending,
    submit: () => submission.submit(() => validateAndSubmit(draft, options)),
  };
}
