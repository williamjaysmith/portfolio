"use client";

import { Star } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

import { can } from "@/lib/family/permissions";
import type { ActorSession, Category, Redemption, Reward } from "@/lib/family/types";

import { DetailRow } from "../../components/DetailRow";
import { useModalDialog } from "../../components/useModalDialog";
import { redeemedOnLabelOf, starsInWords } from "./RewardCard";

/**
 * The reward details view (004 T035 — FR-415, FR-418, FR-419, FR-425, FR-431):
 * opened by a tap on a card's **body**, never on its Redeem button — the two
 * are siblings inside the card exactly so this distinction can exist.
 *
 * It shows the title, the emoji, the description (which is deliberately NOT on
 * the card — FR-415), the cost, whether the reward renews, and the Profiles it
 * is for; a field the reward does not carry simply does not render. Opened
 * from a **redeemed** card it also reads the household day and the cost **as
 * it was** (FR-428): the redemption's stored number, not the reward's current
 * one, which a parent may have changed since (FR-420).
 *
 * **Edit and Delete are affordances, not the gate.** FR-419 refuses a member on
 * every path "not only by hiding the controls", so `permissions.can` is used
 * here over the two parent-only verbs to decide only whether to DRAW them; the
 * action refuses the write regardless. They also need somewhere to go: the
 * board hands over `onEdit` and `onDelete`, and a control with nowhere to go
 * is not drawn. Delete sits behind a confirmation that says the two things a
 * parent will otherwise assume the opposite of — that it cannot be undone, and
 * that stars already spent on it stay spent (FR-418, FR-421, R405).
 *
 * **Unredeem** is drawn on a redeemed card only, once the board has wired it
 * (T043), and for **whoever** is punched in: FR-424's rule is the server's,
 * and a member tapping another's redemption must reach the refusal by name,
 * not a missing button.
 *
 * Purely presentational: every write intent leaves through a callback and no
 * action is imported. Modality is Phase 1's dialog idiom — native
 * `showModal()` for the focus trap, Escape routed through `onClose`, the
 * opener refocused on unmount.
 */

const BUTTON_CLASS =
  "min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 " +
  "text-(length:--fam-fs-body) font-medium";
const PRIMARY_CLASS =
  "min-h-(--fam-touch) rounded-full bg-(--fam-text-primary) px-5 " +
  "text-(length:--fam-fs-body) font-medium text-(--fam-app-bg)";
const DANGER_CLASS =
  "min-h-(--fam-touch) rounded-full bg-(--fam-danger) px-5 text-(length:--fam-fs-body) font-medium text-white";
const STAR_CLASS = "h-(--fam-task-streak-icon) w-(--fam-task-streak-icon) text-(--fam-star-gold)";

/** The reward's title, with its emoji beside it rather than in its name. */
function DetailsTitle({ emoji, name }: { emoji: string | null; name: string }) {
  return (
    <h2
      id="reward-details-title"
      className="flex items-center gap-3 font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
    >
      {emoji === null ? null : (
        <span aria-hidden="true" className="text-(length:--fam-task-emoji) leading-none">
          {emoji}
        </span>
      )}
      {name}
    </h2>
  );
}

/**
 * FR-425's line under the title, with FR-428's stored cost and — while the
 * redeemer is still a Profile — who did it, since a parent may have redeemed
 * on the child's behalf (FR-424).
 */
function redeemedLineOf(redemption: Redemption, categories: readonly Category[]): string {
  const base = `${redeemedOnLabelOf(redemption.redeemedOn, "long")} for ${starsInWords(
    redemption.pointValue,
  )}`;
  const by = categories.find((category) => category.id === redemption.redeemedBy);
  return by === undefined ? base : `${base} by ${by.label}`;
}

/** FR-415's eligible Profiles, in the household's order, each in its own colour. */
function EligibleProfiles({ reward, categories }: { reward: Reward; categories: readonly Category[] }) {
  const eligible = categories.filter(
    (category) => category.isProfile && reward.categoryIds.includes(category.id),
  );
  return (
    <ul aria-label="Eligible Profiles" className="flex flex-wrap gap-x-4">
      {eligible.map((profile) => (
        <li key={profile.id} className="flex min-h-(--fam-touch) items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: profile.color }}
          />
          {profile.label}
        </li>
      ))}
    </ul>
  );
}

interface RewardFactsProps {
  reward: Reward;
  categories: readonly Category[];
  redemption: Redemption | null;
}

/** What the reward IS (FR-415), and — from a redeemed card — what was spent on it (FR-428). */
function RewardFacts({ reward, categories, redemption }: RewardFactsProps) {
  return (
    <>
      {redemption === null ? null : (
        <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary) tabular-nums">
          {redeemedLineOf(redemption, categories)}
        </p>
      )}
      {reward.description === null ? null : (
        <DetailRow label="Description">
          <span className="whitespace-pre-wrap">{reward.description}</span>
        </DetailRow>
      )}
      <DetailRow label="Cost">
        <span className="flex items-center gap-(--fam-task-badge-gap) tabular-nums">
          <Star aria-hidden="true" fill="currentColor" className={STAR_CLASS} />
          {starsInWords(reward.pointValue)}
        </span>
      </DetailRow>
      <DetailRow label="Renews after redeeming">{reward.respawnOnRedemption ? "Yes" : "No"}</DetailRow>
      <DetailRow label="For">
        <EligibleProfiles reward={reward} categories={categories} />
      </DetailRow>
    </>
  );
}

interface DeleteConfirmationProps {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * FR-418's confirmation. It says what the delete does NOT do as well as what it
 * does: the redemptions go with the reward but the ledger stays (R405), so
 * nobody's balance moves — a parent about to delete a redeemed reward will
 * otherwise assume the stars come back.
 */
function DeleteConfirmation({ name, busy, onConfirm, onCancel }: DeleteConfirmationProps) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-(--fam-hairline) p-3">
      <p className="text-(length:--fam-fs-body)">
        Delete &ldquo;{name}&rdquo;? This can&rsquo;t be undone, and it is removed from every
        column. Stars already spent on it stay spent.
      </p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={BUTTON_CLASS}>
          Keep it
        </button>
        <button
          type="button"
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
          onClick={onConfirm}
          className={DANGER_CLASS}
        >
          Delete for good
        </button>
      </div>
    </div>
  );
}

/** One of the row's optional actions, drawn only when the caller both may and can. */
interface ActionSpec {
  label: string;
  onClick: () => void;
  className: string;
  /** FR-441: the one action that writes from here is held while a write is in flight. */
  busy?: boolean;
}

interface DetailsFooterProps {
  name: string;
  busy: boolean;
  /** Already filtered by the affordance rule: present means "draw it". */
  onEdit?: () => void;
  onDelete?: () => void;
  onUnredeem?: () => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
}

/** The handlers the optional actions are drawn from — never the ref, which render must not read. */
type FooterHandlers = Pick<DetailsFooterProps, "busy" | "onEdit" | "onDelete" | "onUnredeem">;

/** The optional actions in their drawn order: Delete, Edit, Unredeem. */
function actionsOf(handlers: FooterHandlers, askToDelete: () => void): ActionSpec[] {
  const actions: ActionSpec[] = [];
  if (handlers.onDelete !== undefined) {
    actions.push({ label: "Delete", onClick: askToDelete, className: `${BUTTON_CLASS} text-(--fam-danger)` });
  }
  if (handlers.onEdit !== undefined) {
    actions.push({ label: "Edit", onClick: handlers.onEdit, className: BUTTON_CLASS });
  }
  if (handlers.onUnredeem !== undefined) {
    actions.push({
      label: "Unredeem",
      onClick: handlers.onUnredeem,
      className: PRIMARY_CLASS,
      busy: handlers.busy,
    });
  }
  return actions;
}

/**
 * The action row, or — once Delete is tapped — FR-418's confirmation in its
 * place. Close is always first and holds the initial focus; the rest are drawn
 * from `actionsOf`, so the row and the confirmation are one component's two
 * states rather than two nests of conditions.
 */
function DetailsFooter({
  name,
  busy,
  onEdit,
  onDelete,
  onUnredeem,
  onClose,
  closeRef,
}: DetailsFooterProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming && onDelete !== undefined) {
    return (
      <DeleteConfirmation
        name={name}
        busy={busy}
        onConfirm={onDelete}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  const actions = actionsOf({ busy, onEdit, onDelete, onUnredeem }, () => setConfirming(true));

  return (
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button ref={closeRef} type="button" onClick={onClose} className={BUTTON_CLASS}>
        Close
      </button>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={action.busy}
          aria-busy={action.busy ? "true" : undefined}
          onClick={action.onClick}
          className={action.className}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

/** A parent-only control the board has given somewhere to go (FR-419). */
function affordance(handler: (() => void) | undefined, mayManage: boolean) {
  return mayManage ? handler : undefined;
}

export interface RewardDetailsProps {
  reward: Reward;
  /** The household's categories, to name the eligible Profiles by name and colour (FR-415). */
  categories: readonly Category[];
  /** The standing redemption a muted card was opened from (FR-425); null for a live card. */
  redemption?: Redemption | null;
  /** Who is punched in — the affordance's input, never the gate (FR-419). */
  actor: ActorSession | null;
  /** FR-441: a write for this reward is in flight. */
  busy?: boolean;
  /** FR-424's refusal, shown where the tap happened rather than behind the sheet. */
  notice?: string | null;
  /** Parent-only (FR-419); drawn only once the board gives them a surface to open. */
  onEdit?: () => void;
  /** Called after FR-418's confirmation; the board owns `deleteReward`. */
  onDelete?: () => void;
  /** FR-431: drawn on a redeemed card only, once T043 wires it; the server decides who may. */
  onUnredeem?: () => void;
  onClose: () => void;
}

export function RewardDetails({
  reward,
  categories,
  redemption = null,
  actor,
  busy = false,
  notice = null,
  onEdit,
  onDelete,
  onUnredeem,
  onClose,
}: RewardDetailsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, closeRef);

  const householdHasParent = categories.some(
    (category) => category.isProfile && category.role === "parent",
  );
  const mayEdit = can(actor, "reward.edit", { householdHasParent }).allowed;
  const mayDelete = can(actor, "reward.delete", { householdHasParent }).allowed;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="reward-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <DetailsTitle emoji={reward.emoji} name={reward.name} />
      <RewardFacts reward={reward} categories={categories} redemption={redemption} />

      {notice === null ? null : (
        <p role="alert" className="mt-3 text-(length:--fam-fs-small) text-(--fam-danger)">
          {notice}
        </p>
      )}

      <DetailsFooter
        name={reward.name}
        busy={busy}
        onEdit={affordance(onEdit, mayEdit)}
        onDelete={affordance(onDelete, mayDelete)}
        onUnredeem={redemption === null ? undefined : onUnredeem}
        onClose={onClose}
        closeRef={closeRef}
      />
    </dialog>
  );
}
