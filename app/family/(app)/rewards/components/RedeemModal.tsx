"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

import { redemptionCelebration } from "@/lib/family/rewards/celebrations";
import type { Redemption } from "@/lib/family/types";

import { StarConfetti } from "../../components/celebrations/StarConfetti";
import { useModalDialog } from "../../components/useModalDialog";
import { rewardCardKeyOf } from "./RewardCard";
import { useRedeem } from "./useRedeem";

/**
 * The redeem modal (004 T041 — FR-432, FR-433, FR-438, FR-445; 07 §4.13):
 * what the device that redeemed shows, and only that device (R408). The board
 * mounts it from the row `useRedeem` handed back and unmounts it on Done — it
 * is never rendered from a refetched redemption, which is what keeps another
 * device's celebration off this screen (Assumption 12).
 *
 * **The copy is `redemptionCelebration`'s** and nothing here re-derives it:
 * "Great work! <Reward> redeemed" over "By <Profile> for N stars on <Month D,
 * YYYY>", the reward's name and cost as they were STORED on the row (FR-428)
 * and the household's day of the redemption (FR-433). The emoji is the
 * reward's own, ~150 units, decoration.
 *
 * **Warmed, not dimmed** (FR-438; 07 §4.13 — "backdrop: NOT dimmed — the
 * screen behind stays bright"). The shipped dialogs dim with black at 30 %;
 * this one paints `--fam-redeem-wash` on its `::backdrop` for exactly as long
 * as the stars fall and then nothing at all: the wash is part of the
 * celebration, so it lasts the shower's life and is absent under reduced
 * motion by construction — `StarConfetti` reports `onDone` at once there,
 * before a first paint the person could notice.
 *
 * **Where the stars are mounted matters** (tokens.css, the sprites' note). The
 * layer is `position: fixed; inset: 0`, and a transformed ancestor becomes its
 * containing block — so the entrance is animated on an INNER wrapper and the
 * shower is the `<dialog>`'s own child, outside that wrapper: fixed to the
 * viewport, and in the top layer over the columns AND the modal. A sibling
 * outside the dialog would paint under the backdrop instead.
 *
 * **Unredeem goes through its own `useRedeem`** — a second instance of the
 * tab's commit path, with its own queue and notice, which is safe only because
 * this is a modal dialog and no card behind it can be tapped meanwhile — rather
 * than out through a callback as the other dialogs' writes do, because the
 * write is this modal's own: the redemption it was rendered from, put back by
 * the person who just made it, with the refusal shown where the tap happened
 * (FR-424's "say plainly"). It stays open on a refusal — a lost race and a
 * dismissed punch-in are both things the person may answer again — and closes
 * on success, the refetch drawing the card as it was (FR-431).
 *
 * Reduced motion collapses the entrance as well as the shower (FR-445): the
 * shipped hook is `useReducedMotion`, the one every framer-driven surface here
 * consults, and `null` — not yet read — is treated as motion allowed.
 */

const DIALOG_CLASS =
  "m-auto w-[min(92vw,var(--fam-redeem-modal-w))] rounded-(--fam-redeem-modal-r) " +
  "bg-(--fam-app-bg) p-(--fam-redeem-modal-pad) text-(--fam-text-primary) shadow-2xl " +
  "backdrop:transition-colors backdrop:duration-(--fam-sprite-fade-ms)";

/** The wash while the stars fall; nothing — not a dim — once they have. */
const WASH_ON = "backdrop:bg-(--fam-redeem-wash)";
const WASH_OFF = "backdrop:bg-transparent";

/**
 * The photographed height is a target the content may exceed, never a clip
 * (tokens.css). It needs no viewport clamp of its own: `--fam-u` is
 * `max(100vw, 100vh) / 1920`, so 700 units is never more than ~36 % of the
 * larger dimension and the box always fits standing or lying down.
 */
const BODY_CLASS = "flex min-h-(--fam-redeem-modal-h) flex-col items-center gap-4 text-center";

const BUTTON_CLASS = "w-full px-6 text-(length:--fam-fs-body) font-medium";
const DONE_CLASS =
  `${BUTTON_CLASS} min-h-(--fam-redeem-btn-h) rounded-(--fam-redeem-btn-r) ` +
  "bg-(--fam-primary-blue) text-white";
const UNREDEEM_CLASS =
  `${BUTTON_CLASS} min-h-(--fam-redeem-btn-secondary-h) rounded-(--fam-redeem-btn-secondary-r) ` +
  "bg-(--fam-btn-secondary-bg) text-(--fam-text-primary) disabled:opacity-(--fam-past-dim)";

/** The entrance: a short settle from slightly small, on the shipped curve's cousin. */
const ENTRANCE_FROM = { opacity: 0, scale: 0.94 };
const ENTRANCE_TO = { opacity: 1, scale: 1 };
const ENTRANCE = { duration: 0.28, ease: "easeOut" } as const;

export interface RedeemModalProps {
  /** The row the local redeem returned — the modal is rendered from it and nothing else (FR-441). */
  redemption: Redemption;
  /** The reward's emoji, from the card that was tapped; null draws none. */
  emoji: string | null;
  /** The Profile redeemed FOR, by name — not the actor (FR-424). */
  profileName: string;
  /** Done, or a successful Unredeem: the board unmounts the modal. */
  onClose: () => void;
}

export function RedeemModal({ redemption, emoji, profileName, onClose }: RedeemModalProps) {
  const { title, subtitle } = redemptionCelebration(redemption, profileName);
  const doneRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, doneRef);
  const reducedMotion = useReducedMotion() === true;
  const [showering, setShowering] = useState(true);
  const endShower = useCallback(() => setShowering(false), []);

  const { busyKeys, notice, unredeem } = useRedeem();
  const busy = busyKeys.has(
    rewardCardKeyOf({ reward: { id: redemption.rewardId }, categoryId: redemption.categoryId }),
  );

  const onUnredeem = useCallback(async () => {
    const outcome = await unredeem(redemption);
    if (outcome !== null && outcome.ok) onClose();
  }, [unredeem, redemption, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="redeem-modal-title"
      aria-describedby="redeem-modal-subtitle"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`${DIALOG_CLASS} ${showering ? WASH_ON : WASH_OFF}`}
    >
      <motion.div
        initial={reducedMotion ? false : ENTRANCE_FROM}
        animate={ENTRANCE_TO}
        transition={ENTRANCE}
        className={BODY_CLASS}
      >
        {emoji === null ? null : (
          <span
            aria-hidden="true"
            data-redeem-emoji
            className="mt-2 text-(length:--fam-redeem-emoji) leading-none"
          >
            {emoji}
          </span>
        )}
        <h2
          id="redeem-modal-title"
          className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) leading-tight"
        >
          {title}
        </h2>
        <p
          id="redeem-modal-subtitle"
          className="text-(length:--fam-fs-redeem-sub) text-(--fam-text-secondary) tabular-nums"
        >
          {subtitle}
        </p>

        {notice === null ? null : (
          <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
            {notice}
          </p>
        )}

        <div className="mt-auto flex w-full flex-col gap-(--fam-redeem-btn-gap) pt-4">
          <button ref={doneRef} type="button" onClick={onClose} className={DONE_CLASS}>
            Done
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy ? "true" : undefined}
            onClick={() => void onUnredeem()}
            className={UNREDEEM_CLASS}
          >
            Unredeem
          </button>
        </div>
      </motion.div>

      {/* The dialog's OWN child, outside the animated wrapper — see the note above. */}
      {showering ? <StarConfetti onDone={endShower} /> : null}
    </dialog>
  );
}
