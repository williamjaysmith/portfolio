"use client";

import { useRef, useState, type FormEvent } from "react";

import { ActionFailure } from "@/lib/family/errors";
import type { ListItem } from "@/lib/family/types";
import { listItemTextSchema, parseOrThrow } from "@/lib/family/validation";

import { FIELD } from "../../components/settings/CategoryFields";
import type { WriteOutcome } from "./useListWrites";

/**
 * The "Add item" box at the top of every card (005 FR-516, FR-537; 37275069922971
 * — "an 'Add item' textbox sits at the top of every list"). Enter adds; the box
 * is disabled while its write is pending and cleared only on success, with
 * focus kept for the next item; a refusal keeps the text and says why beside
 * the box — the refuse-never-queue posture made visible.
 *
 * The text is checked locally with the action's own schema first
 * (`listItemTextSchema`), so nothing is sent that would be refused, and the
 * refusal lands here rather than as a round trip. A dismissed punch-in (`null`)
 * shows nothing: the text stays for the next try.
 */

export interface AddItemBoxProps {
  /** For the accessible name: "Add item to Grocery List". */
  listName: string;
  /** FR-537: the card's add is in flight. */
  pending: boolean;
  onAdd: (text: string) => Promise<WriteOutcome<ListItem>>;
  /** The card's menu "Add item" focuses this box (FR-516). */
  inputRef?: (node: HTMLInputElement | null) => void;
}

/** A local refusal's message, or null when the text parses. */
function localRefusalOf(text: string): string | null {
  try {
    parseOrThrow(listItemTextSchema, text);
    return null;
  } catch (error) {
    if (error instanceof ActionFailure) return error.message;
    throw error;
  }
}

export function AddItemBox({ listName, pending, onAdd, inputRef }: AddItemBoxProps) {
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const ownRef = useRef<HTMLInputElement | null>(null);

  function attach(node: HTMLInputElement | null): void {
    ownRef.current = node;
    inputRef?.(node);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const refused = localRefusalOf(text);
    if (refused !== null) {
      setNotice(refused);
      return;
    }
    setNotice(null);
    const outcome = await onAdd(text.trim());
    if (outcome === null) return;
    if (outcome.ok) {
      setText("");
      ownRef.current?.focus();
      return;
    }
    setNotice(outcome.message);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 px-(--fam-task-col-pad)" data-add-item>
      <input
        ref={attach}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Add item"
        aria-label={`Add item to ${listName}`}
        maxLength={200}
        disabled={pending}
        aria-busy={pending ? "true" : undefined}
        enterKeyHint="done"
        className={FIELD}
      />
      {notice === null ? null : (
        <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
          {notice}
        </p>
      )}
    </form>
  );
}
