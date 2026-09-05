"use client";

import { useState } from "react";

/**
 * A form's draft: the blank shape, a seed laid over it once, and the one
 * keyed setter every field control binds to. The submit machinery is
 * `useSubmission` (formSubmit.ts); this is the other half a form hook holds,
 * so a third form does not carry a third copy of it.
 */
export interface Draft<T extends object> {
  draft: T;
  /** One key, one value — what a text box, a number box or a switch calls. */
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  /** A gesture that reads the current draft to make the next (a toggle in a list). */
  update: (recipe: (current: T) => T) => void;
}

export function useDraft<T extends object>(blank: () => T, seed?: Partial<T>): Draft<T> {
  const [draft, setDraft] = useState<T>(() => ({ ...blank(), ...seed }));

  function set<K extends keyof T>(key: K, value: T[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return { draft, set, update: setDraft };
}
