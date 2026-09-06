"use client";

import type { FormEvent } from "react";

import { settleSubmit, useSubmission, type Settled, type SubmitOutcome, type Submission } from "./formSubmit";
import { useDraft, type Draft } from "./useDraft";

/**
 * What every form sheet does between its fields and its commit (006 R608): a
 * draft, a submission, and a submit handler that parses the draft into the
 * action's input — refusing at the field before anything is sent — and hands
 * it to the caller's `onSubmit`, which closes the sheet on success. One hook,
 * so the mealtime, recipe and meal forms cannot drift from one another.
 */

export interface SheetForm<T extends object> extends Draft<T> {
  submission: Submission;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useSheetForm<T extends object, Input>(
  blank: () => T,
  parse: (draft: T) => Input,
  onSubmit: (input: Input) => Promise<SubmitOutcome>,
  onClose: () => void,
): SheetForm<T> {
  const draft = useDraft<T>(blank);
  const submission = useSubmission(onClose);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await submission.submit((): Promise<Settled> => settleSubmit(() => parse(draft.draft), onSubmit));
  }

  return { ...draft, submission, handleSubmit };
}
