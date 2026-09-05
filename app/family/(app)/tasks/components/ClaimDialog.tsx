"use client";

import { useState } from "react";

import { ownsOccurrence } from "@/lib/family/permissions";
import type { ActorSession, Category } from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * FR-367's claim (T062): an Up for Grabs card, opened, offers the Profile to
 * credit and then Complete. Nothing moves and nothing is reassigned — the
 * stored credit is the whole of it, and it is what makes the expander draw the
 * occurrence in that Profile's column afterwards (US3-9).
 *
 * **Who is offered whom is affordance, never the gate** (FR-350, R323). A
 * member is offered only themselves and a parent anyone, read off the same
 * `ownsOccurrence` the server decides with — one rule, two readers, so the
 * sheet cannot promise something the action then refuses. With **nobody**
 * punched in every Profile is offered, because the punch-in arrives at the
 * moment of the tap: pre-refusing here would make the sheet unusable before
 * anybody could punch in, and the server still answers US3-13's refusal.
 *
 * Only Profiles are credited. A Label is not a person and cannot do a chore
 * (FR-323), so it is filtered here as well as refused by the database.
 *
 * A lost race (FR-370, SC-311) is shown in the server's own words, in this
 * sheet, where the tap happened — the other device's claim won, the message
 * names who, and both screens settle on the same stored row at the next
 * refetch.
 *
 * Purely presentational: the parent owns the `completeTaskOccurrence` call and
 * the busy state around it. Modality is Phase 1's dialog idiom.
 */

const BUTTON = "min-h-(--fam-touch) rounded-full px-5 text-(length:--fam-fs-body) font-medium";

/**
 * FR-351 as an affordance. A parent may credit anyone; a member only
 * themselves; and with nobody punched in there is nothing yet to judge, so
 * everyone stands (FR-350).
 */
function mayCredit(actor: ActorSession | null, profileId: string): boolean {
  if (actor === null) return true;
  if (actor.role === "parent") return true;
  return ownsOccurrence(
    { profileId: actor.profileId },
    { upForGrabs: true, assigneeId: null, creditProfileId: profileId },
  );
}

function offeredProfiles(
  profiles: readonly Category[],
  actor: ActorSession | null,
): readonly Category[] {
  return profiles.filter((one) => one.isProfile && mayCredit(actor, one.id));
}

/** The face already in front of the person, when it is one they may credit. */
function initialCreditOf(offered: readonly Category[], actor: ActorSession | null): string {
  const mine = offered.find((one) => one.id === actor?.profileId);
  return mine?.id ?? offered[0]?.id ?? "";
}

export interface ClaimDialogProps {
  /** The occurrence's title, quoted in the question. */
  summary: string;
  /** The Profiles the board is showing; Labels among them are filtered out. */
  profiles: readonly Category[];
  /** Who is punched in — the affordance's input, never the gate. */
  actor: ActorSession | null;
  /** FR-393: the claim is in flight. */
  busy?: boolean;
  /** FR-370's refusal, or any other the server gave, in its own words. */
  notice?: string | null;
  onClaim: (creditProfileId: string) => void;
  onCancel: () => void;
}

export function ClaimDialog({
  summary,
  profiles,
  actor,
  busy = false,
  notice = null,
  onClaim,
  onCancel,
}: ClaimDialogProps) {
  const offered = offeredProfiles(profiles, actor);
  const [credit, setCredit] = useState(() => initialCreditOf(offered, actor));
  const dialogRef = useModalDialog(true, "input:checked");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-claim-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="task-claim-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        &ldquo;{summary}&rdquo;
      </h2>

      <p
        id="task-claim-question"
        className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)"
      >
        Who did this one?
      </p>

      <div role="radiogroup" aria-labelledby="task-claim-question" className="mt-4">
        {offered.map((profile) => (
          <label
            key={profile.id}
            className="flex min-h-(--fam-touch) cursor-pointer items-center gap-3 rounded-lg px-2 text-(length:--fam-fs-body)"
          >
            <input
              type="radio"
              name="task-claim-credit"
              value={profile.id}
              checked={credit === profile.id}
              onChange={() => setCredit(profile.id)}
              className="size-5 accent-(--fam-primary-blue)"
            />
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: profile.color }}
            />
            {profile.label}
          </label>
        ))}
      </div>

      {notice === null ? null : (
        <p role="alert" className="mt-3 text-(length:--fam-fs-small) text-(--fam-danger)">
          {notice}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border border-(--fam-hairline)`}
        >
          Cancel
        </button>
        <button
          type="button"
          aria-busy={busy ? "true" : undefined}
          disabled={busy || credit === ""}
          onClick={() => onClaim(credit)}
          className={`${BUTTON} bg-(--fam-primary-blue) text-white`}
        >
          Complete
        </button>
      </div>
    </dialog>
  );
}
