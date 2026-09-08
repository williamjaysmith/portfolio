"use client";

import { useRef } from "react";

import type { CountdownStatus } from "@/lib/family/countdowns/target";
import { countdownPhrase } from "@/lib/family/countdowns/wording";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * The full list of active countdowns (009 FR-909).
 *
 * The reference: tapping the preview bar "opens a full list of all active
 * countdowns" [VERIFIED](40459070511515). What that list looks like is
 * [UNKNOWN], so this is the shipped modal idiom — a native `<dialog>` through
 * `useModalDialog`, which is what gives the focus trap, the backdrop and
 * Escape.
 *
 * It exists because of the rotation: when the bar cannot show everything, the
 * household still needs a way to see everything, and one tap on the thing that
 * is moving is the reference's answer.
 *
 * Each row opens that countdown's own event. The list is already soonest-first
 * — `inforce.ts` sorted it — and this component does not re-order it, so the
 * bar and the list agree about which countdown is next.
 */

const ROW =
  "flex min-h-(--fam-touch) w-full items-center justify-between gap-4 rounded-(--fam-radius-pill) " +
  "px-3 text-left text-(length:--fam-fs-body) text-(--fam-text-primary)";

export interface CountdownListProps {
  /** Every countdown in force, soonest first. */
  countdowns: readonly CountdownStatus[];
  /** FR-909: opens that countdown's event. */
  onOpen: (countdown: CountdownStatus) => void;
  onClose: () => void;
}

export function CountdownList({ countdowns, onOpen, onClose }: CountdownListProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, closeRef);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="countdown-list-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="countdown-list-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        Countdowns
      </h2>

      {countdowns.length === 0 ? (
        <p className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          Nothing to count down to yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {countdowns.map((countdown) => (
            <li key={countdown.eventId}>
              <button type="button" onClick={() => onOpen(countdown)} className={ROW}>
                <span className="min-w-0 truncate">{countdown.summary}</span>
                <span className="shrink-0 text-(--fam-text-secondary) tabular-nums">
                  {countdownPhrase(countdown.state, countdown.days)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex min-h-(--fam-touch) items-center rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium text-(length:--fam-fs-pill) text-(--fam-text-muted)"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
