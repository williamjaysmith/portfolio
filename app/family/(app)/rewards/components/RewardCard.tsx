"use client";

import { Star } from "lucide-react";
import type { CSSProperties } from "react";

import { inkOn, profileVars, type PaletteColor } from "@/lib/family/colors";
import { rewardProgressOf, type RewardProgress } from "@/lib/family/rewards/progress";
import type { Redemption, Reward } from "@/lib/family/types";

/**
 * One reward in one Profile's column (004 T034 — FR-420, FR-423, FR-425).
 *
 * The card is dumb: the reward, the Profile's balance and the standing
 * redemption all arrive as props, and the only thing it decides is which of
 * its **three faces** to draw — and it is always exactly one of them (FR-423):
 *
 *   - **the bar**, below the cost: `rewardProgressOf`'s fraction as the fill
 *     over a track of the Profile's colour at 40 %, the fill at full strength,
 *     "☆ balance/cost" centred ON the bar and folded into the body control's
 *     accessible name so it is said once (FR-420, FR-423);
 *   - **the Redeem button**, at or above the cost, naming the cost ("Redeem ⭐
 *     20") and, in its accessible name, the reward — a column holds many
 *     cards, and "Redeem, 20" said six times names none of them (FR-423,
 *     FR-445);
 *   - **the muted card**, for a standing redemption: "Redeemed on <day>",
 *     dimmed, offering nothing but its details (FR-425, FR-426).
 *
 * Two controls, never nested (Phase 3's rule on the task card): the body
 * opens details and the Redeem button beside it redeems. The bar is not a
 * control and sits inside the body; the button is the body's sibling.
 *
 * **Progress is the balance against the cost** and nothing here counts
 * anything (FR-420): the same reward reads differently in two columns because
 * two balances were handed down (FR-417), and a balance below zero is drawn
 * as an empty bar with the number kept honest (FR-413, Assumption 5).
 *
 * **Ink** (FR-398): the card is white, so its text is the primary ink; the
 * bar's label straddles the 40 % track — dark ink on all twenty accents — and
 * the full-strength fill, where six of the twenty flip to white. The label is
 * therefore drawn twice, once over the whole bar in `--fam-reward-bar-ink`
 * (the always-safe track ink) and once clipped to the fill's width in
 * `--fam-reward-bar-fill-ink`, which this card SETS from `inkOn(accent)` on
 * the bar it actually drew — exactly as `TaskCard` sets `--fam-task-ink`,
 * because neither can be decided in CSS. Legible on both halves however far
 * the fill has come.
 *
 * **Muted by ink, not by opacity** (tokens.css): a redeemed card still has a
 * title and a date to read and a details view to open, and the shipped dim
 * would take the primary ink below 1.4.3 on white. So the card takes
 * `--fam-reward-muted-ink` and only the emoji — decoration — takes the dim.
 *
 * Tokens (T037, R414): the card, the bar and the button consume the
 * `--fam-reward-*` family — card radius / padding / gap, emoji (~110 at the
 * reference unit), `--fam-fs-reward-title` (serif ~30), bar height / radius /
 * two inks / fill transition, and the Redeem button's height and radius,
 * floored at the touch target inside the token itself (FR-445). What is
 * deliberately still the badge family is the star icon and its gap: the same
 * star as the chip and the header pill, which R414 says reuse them.
 */

/**
 * What one card stands for: a reward in one Profile's column and — on a muted
 * card — the redemption it records. The board's handlers receive this whole,
 * so a tap on the card can be answered without another lookup.
 */
export interface RewardCardTarget {
  reward: Reward;
  /** The Profile whose column the card sits in (FR-417). */
  categoryId: string;
  /** The standing redemption a muted card stands for; null on a live card. */
  redemption: Redemption | null;
}

/**
 * FR-441's busy match: one reward in one column, as a string. Only the reward's
 * id is read, so a redemption — which carries `rewardId` and `categoryId` but
 * no `Reward` row — can name the card it stands for with the same key.
 */
export function rewardCardKeyOf(target: {
  reward: Pick<Reward, "id">;
  categoryId: string;
}): string {
  return `${target.reward.id}:${target.categoryId}`;
}

/** "1 star", "20 stars" — the count said in words, wherever a cost or a balance is spoken. */
export function starsInWords(count: number): string {
  return `${count} ${Math.abs(count) === 1 ? "star" : "stars"}`;
}

/**
 * Both formats run in **UTC** on purpose: a household day is a plain date with
 * no zone, and running it through the browser's would shift it across
 * midnight (FR-433, the same rule the late badge follows).
 */
const AS_UTC = { timeZone: "UTC" } as const;
const SHORT_DAY = new Intl.DateTimeFormat("en-US", { ...AS_UTC, month: "short", day: "numeric" });
const LONG_DAY = new Intl.DateTimeFormat("en-US", { ...AS_UTC, dateStyle: "long" });

/** FR-425's line: short where a card has one line to spare, long where it is spoken or has room. */
export function redeemedOnLabelOf(redeemedOn: string, length: "short" | "long"): string {
  const day = new Date(`${redeemedOn}T00:00:00Z`);
  return `Redeemed on ${(length === "short" ? SHORT_DAY : LONG_DAY).format(day)}`;
}

/** FR-423's two faces of a live card, and FR-425's third. */
type CardFace = RewardProgress | { kind: "redeemed"; redemption: Redemption };

function faceOf(redemption: Redemption | null, balance: number, cost: number): CardFace {
  if (redemption !== null) return { kind: "redeemed", redemption };
  return rewardProgressOf(balance, cost);
}

/**
 * What the body control is CALLED: the title, plus the one mark drawn under it
 * — the bar's reading or the redeemed line — said once, which is why both are
 * `aria-hidden` inside it. A card with a Redeem button is named by its title
 * alone, so the two controls are never confusable.
 */
function cardLabelOf(name: string, face: CardFace): string {
  if (face.kind === "bar") return `${name}, ${face.label}`;
  if (face.kind === "redeemed") {
    return `${name}, ${redeemedOnLabelOf(face.redemption.redeemedOn, "long")}`;
  }
  return name;
}

/** Each layer's ink token — the track's is always safe, the fill's is set by the bar (FR-398). */
const LABEL_INK: Record<BarLabelProps["layer"], string> = {
  track: "text-(--fam-reward-bar-ink)",
  fill: "text-(--fam-reward-bar-fill-ink)",
};

/** The label drawn twice — see the ink note above. */
function BarLabel({ label, layer, filled }: BarLabelProps) {
  const clipped = layer === "fill" ? { clipPath: `inset(0 ${(1 - filled) * 100}% 0 0)` } : {};
  return (
    <span
      data-reward-bar-label={layer}
      style={clipped}
      className={`absolute inset-0 grid place-items-center text-(length:--fam-fs-body) font-medium tabular-nums ${LABEL_INK[layer]}`}
    >
      {label}
    </span>
  );
}

interface BarLabelProps {
  label: string;
  layer: "track" | "fill";
  filled: number;
}

interface RewardBarProps {
  filled: number;
  label: string;
  accent: PaletteColor;
}

/**
 * FR-423's bar: the track at 40 %, the fill at full strength, left-aligned,
 * the reading centred on it. Hidden from the reading order because the body
 * control's name already says it.
 */
function RewardBar({ filled, label, accent }: RewardBarProps) {
  // React's CSSProperties is closed over the CSS spec, so the custom property
  // that inks the fill's half of the label needs the cast (TaskCard's pattern).
  const style = { "--fam-reward-bar-fill-ink": inkOn(accent) } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-reward-bar
      data-filled={filled}
      style={style}
      className="fam-tint-40 relative block h-(--fam-reward-bar-h) w-full overflow-hidden rounded-(--fam-reward-bar-r)"
    >
      <span
        data-reward-bar-fill
        style={{ width: `${filled * 100}%` }}
        // The fill's growth is FR-445's animated bar; `--fam-reward-bar-ms` is what the
        // reduced-motion block in `tokens.css` collapses, so this needs no hook of its own.
        className="fam-tint-100 absolute inset-y-0 left-0 rounded-(--fam-reward-bar-r) transition-all duration-(--fam-reward-bar-ms) ease-(--fam-reward-bar-ease)"
      />
      <BarLabel label={label} layer="track" filled={filled} />
      {/* Nothing filled, nothing to ink: the fill's copy is clipped to zero
          width, and a label nobody can read should not be drawn at all — it
          reads as pale text on the track to anything that measures colour
          (007 FR-723). */}
      {filled > 0 ? <BarLabel label={label} layer="fill" filled={filled} /> : null}
    </span>
  );
}

interface RedeemButtonProps {
  reward: Reward;
  busy: boolean;
  onRedeem: () => void;
}

/** FR-423's button, naming the cost — "Redeem ⭐ 20" — at FR-445's 44-point floor. */
function RedeemButton({ reward, busy, onRedeem }: RedeemButtonProps) {
  return (
    <button
      type="button"
      data-reward-redeem
      aria-label={`Redeem ${reward.name} for ${starsInWords(reward.pointValue)}`}
      aria-busy={busy ? "true" : undefined}
      disabled={busy}
      onClick={onRedeem}
      className="flex min-h-(--fam-reward-redeem-h) w-full items-center justify-center gap-(--fam-task-badge-gap) rounded-(--fam-reward-redeem-r) bg-(--fam-primary-blue) px-(--fam-reward-card-pad) text-(length:--fam-fs-body) font-medium text-white disabled:opacity-(--fam-past-dim)"
    >
      Redeem
      {/* Filled, and the verified palette gold — the same star the chip and the pill draw. */}
      <Star
        aria-hidden="true"
        fill="currentColor"
        className="h-(--fam-task-streak-icon) w-(--fam-task-streak-icon) text-(--fam-star-gold)"
      />
      <span className="tabular-nums">{reward.pointValue}</span>
    </button>
  );
}

/** The face under the title: the bar, the redeemed line, or nothing (the button is a sibling). */
function CardFaceMark({ face, accent }: { face: CardFace; accent: PaletteColor }) {
  if (face.kind === "bar") return <RewardBar filled={face.filled} label={face.label} accent={accent} />;
  if (face.kind === "redeemed") {
    return (
      <span
        aria-hidden="true"
        className="text-(length:--fam-fs-body) text-(--fam-text-secondary) tabular-nums"
      >
        {redeemedOnLabelOf(face.redemption.redeemedOn, "short")}
      </span>
    );
  }
  return null;
}

export interface RewardCardProps {
  reward: Reward;
  /** The Profile whose column this card sits in (FR-417). */
  categoryId: string;
  /** The column's accent: the bar's two tints, and the ink over its fill (FR-398). */
  accent: PaletteColor;
  /** That Profile's balance from the view (FR-420); a muted card ignores it. */
  balance: number;
  /** The standing redemption a muted card stands for (FR-425); null draws a live card. */
  redemption?: Redemption | null;
  /** FR-441: this card's write is in flight. */
  busy?: boolean;
  /** A tap on the BODY opens the details view. */
  onOpen: (target: RewardCardTarget) => void;
  /** A tap on the Redeem button; the board owns the write and the gate (FR-424). */
  onRedeem: (target: RewardCardTarget) => void;
}

export function RewardCard({
  reward,
  categoryId,
  accent,
  balance,
  redemption = null,
  busy = false,
  onOpen,
  onRedeem,
}: RewardCardProps) {
  const face = faceOf(redemption, balance, reward.pointValue);
  const target: RewardCardTarget = { reward, categoryId, redemption };

  return (
    <li
      data-reward-card
      data-state={face.kind}
      style={profileVars(accent) as CSSProperties}
      className={`fam-profile flex flex-col gap-(--fam-reward-card-gap) rounded-(--fam-reward-card-r) border border-(--fam-hairline) bg-(--fam-app-bg) p-(--fam-reward-card-pad) shadow-sm ${
        face.kind === "redeemed" ? "text-(--fam-reward-muted-ink)" : "text-(--fam-text-primary)"
      }`}
    >
      <button
        type="button"
        aria-label={cardLabelOf(reward.name, face)}
        onClick={() => onOpen(target)}
        className="flex min-h-(--fam-touch) w-full flex-col items-center gap-(--fam-reward-card-gap) text-center"
      >
        {reward.emoji === null ? null : (
          <span
            aria-hidden="true"
            data-reward-emoji
            className={`text-(length:--fam-reward-emoji) leading-none ${
              face.kind === "redeemed" ? "opacity-(--fam-past-dim)" : ""
            }`}
          >
            {reward.emoji}
          </span>
        )}
        <span
          data-reward-title
          className="max-w-full truncate font-(family-name:--fam-font-serif) text-(length:--fam-fs-reward-title)"
        >
          {reward.name}
        </span>
        <CardFaceMark face={face} accent={accent} />
      </button>
      {face.kind === "redeem" ? (
        <RedeemButton reward={reward} busy={busy} onRedeem={() => onRedeem(target)} />
      ) : null}
    </li>
  );
}
