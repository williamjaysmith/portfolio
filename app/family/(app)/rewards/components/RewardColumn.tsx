"use client";

import { Star } from "lucide-react";
import { useMemo, type CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import {
  isRedeemedOneTime,
  orderRewardCards,
  type OrderableRewardCard,
} from "@/lib/family/rewards/progress";
import type { Category, Redemption, Reward } from "@/lib/family/types";

import { Avatar } from "../../components/Avatar";
import { RewardCard, rewardCardKeyOf, starsInWords, type RewardCardTarget } from "./RewardCard";

/**
 * One Rewards column per Profile (004 T033 — FR-413, FR-422, FR-425–FR-427).
 *
 * The header is the Tasks column's: the avatar, the name, and — where the
 * Tasks header has the count and the day's stars — one pill reading the
 * Profile's **balance** (FR-413). That balance arrives as a NUMBER, read above
 * from the view by `balanceOf` (R402), for the reason `starsToday` does on the
 * Tasks column: a column handed no ledger cannot sum the wrong Profile or the
 * wrong kind. A negative balance is drawn as it is (FR-413, Assumption 5) and
 * spoken as "minus", because a screen reader reading "-5" as "dash five" is
 * not the honesty the requirement asks for.
 *
 * The body lists the rewards this Profile is **eligible** for (FR-422) — the
 * eligibility is on the reward itself (`categoryIds`), so the column applies
 * it and the board hands every column the same list. Cards are put in
 * `orderRewardCards`'s order (FR-427); a one-time reward with a standing
 * redemption for this Profile has no live card at all (FR-425), and while the
 * Redeemed switch is on every STANDING redemption of this Profile becomes one
 * muted card, sorted last and most recent first, so a renewing reward's live
 * card always sits above its own history (FR-426). A reversed redemption is
 * history the tab does not draw (FR-431). A redemption whose reward is no
 * longer in the list — the two reads can land a moment apart — draws nothing
 * rather than a card with no emoji and no cost.
 *
 * Eligibility is deliberately NOT required of a history card: a Profile edited
 * out of a reward after redeeming it still spent those stars, and FR-426
 * counts "per standing redemption", not per eligible reward.
 *
 * The accent is set once here as `--profile`; the header's 20 % panel and each
 * card's bar tints derive from it. Nothing below hand-picks a tint.
 *
 * Tokens: the header reuses the Tasks header's geometry and pill verbatim
 * (R414 — "the header balance pill reuses the counter pill tokens"); the pill
 * class is restated here because the Tasks header keeps its own private.
 */

/** FR-427's keys for one card, with what the column needs to draw and address it. */
interface ColumnCard extends OrderableRewardCard {
  /** The React key: a live card's reward-in-column, a history card's redemption. */
  key: string;
  target: RewardCardTarget;
}

/** The live cards: every eligible reward without a standing one-time redemption (FR-425). */
function liveCardsOf(
  rewards: readonly Reward[],
  redemptions: readonly Redemption[],
  categoryId: string,
  balance: number,
): ColumnCard[] {
  return rewards
    .filter((reward) => reward.categoryIds.includes(categoryId))
    .filter((reward) => !isRedeemedOneTime(reward, redemptions, categoryId))
    .map((reward) => ({
      key: rewardCardKeyOf({ reward, categoryId }),
      target: { reward, categoryId, redemption: null },
      cost: reward.pointValue,
      createdAt: reward.createdAt,
      affordable: balance >= reward.pointValue,
      redeemedAt: null,
    }));
}

/** FR-426's history: one muted card per standing redemption of this Profile whose reward is still here. */
function historyCardsOf(
  rewards: readonly Reward[],
  redemptions: readonly Redemption[],
  categoryId: string,
): ColumnCard[] {
  const byId = new Map(rewards.map((reward) => [reward.id, reward]));
  return redemptions
    .filter((one) => one.categoryId === categoryId && one.reversedAt === null)
    .flatMap((redemption) => {
      const reward = byId.get(redemption.rewardId);
      if (reward === undefined) return [];
      return [
        {
          key: redemption.id,
          target: { reward, categoryId, redemption },
          cost: reward.pointValue,
          createdAt: reward.createdAt,
          affordable: false,
          redeemedAt: redemption.redeemedAt,
        },
      ];
    });
}

/** What this column draws, in FR-427's order. */
function columnCardsOf(
  rewards: readonly Reward[],
  redemptions: readonly Redemption[],
  categoryId: string,
  balance: number,
  showRedeemed: boolean,
): ColumnCard[] {
  const live = liveCardsOf(rewards, redemptions, categoryId, balance);
  const history = showRedeemed ? historyCardsOf(rewards, redemptions, categoryId) : [];
  return orderRewardCards([...live, ...history]);
}

/**
 * The Tasks header's pill geometry, restated (R414). The icon size is the badge
 * family's, so the star here is the star on the chip and the Tasks pill.
 */
const HEADER_PILL =
  "flex w-fit items-center gap-(--fam-task-badge-gap) rounded-(--fam-task-badge-r) " +
  "bg-(--fam-app-bg) px-(--fam-task-badge-pad) py-(--fam-task-badge-gap) " +
  "text-(length:--fam-fs-pill) tabular-nums";

/** FR-413's spoken half, with a negative said as "minus" rather than left to be read as a dash. */
function balanceLabelOf(balance: number): string {
  const words = starsInWords(Math.abs(balance));
  return `Balance: ${balance < 0 ? `minus ${words}` : words}`;
}

interface ColumnHeaderProps {
  category: Category;
  balance: number;
  photoUrl?: string;
}

function RewardColumnHeader({ category, balance, photoUrl }: ColumnHeaderProps) {
  return (
    <header
      role="group"
      aria-label={category.label}
      className="fam-tint-20 flex flex-col gap-(--fam-task-header-gap) rounded-(--fam-radius-card) p-(--fam-task-header-pad)"
    >
      <div className="flex items-center gap-(--fam-task-header-gap)">
        <Avatar
          category={category}
          photoUrl={photoUrl}
          sizeClassName="h-(--fam-task-avatar) w-(--fam-task-avatar)"
        />
        <span className="min-w-0 truncate font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
          {category.label}
        </span>
      </div>
      <p data-balance-pill aria-label={balanceLabelOf(balance)} className={HEADER_PILL}>
        <Star
          aria-hidden="true"
          fill="currentColor"
          className="h-(--fam-task-streak-icon) w-(--fam-task-streak-icon) text-(--fam-star-gold)"
        />
        {balance}
      </p>
    </header>
  );
}

export interface RewardColumnProps {
  category: Category;
  /** The household's rewards, unfiltered; the column keeps those this Profile is eligible for (FR-422). */
  rewards: readonly Reward[];
  /** The household's redemptions, standing and reversed; the column reads this Profile's standing ones. */
  redemptions: readonly Redemption[];
  /** FR-413: this Profile's balance from the view — `balanceOf(balances, category.id)`, read above. */
  balance: number;
  /** FR-426's per-device Redeemed switch. */
  showRedeemed: boolean;
  /** Signed URL for a photo avatar. */
  photoUrl?: string;
  /** `rewardCardKeyOf` of every card whose write is in flight (FR-441). */
  busyKeys?: ReadonlySet<string>;
  onOpen: (target: RewardCardTarget) => void;
  onRedeem: (target: RewardCardTarget) => void;
}

export function RewardColumn({
  category,
  rewards,
  redemptions,
  balance,
  showRedeemed,
  photoUrl,
  busyKeys,
  onOpen,
  onRedeem,
}: RewardColumnProps) {
  const cards = useMemo(
    () => columnCardsOf(rewards, redemptions, category.id, balance, showRedeemed),
    [rewards, redemptions, category.id, balance, showRedeemed],
  );

  return (
    <section
      aria-label={category.label}
      data-column={category.id}
      style={profileVars(category.color) as CSSProperties}
      className="fam-profile flex h-full min-h-0 w-full min-w-0 flex-col gap-(--fam-task-col-gap)"
    >
      <RewardColumnHeader category={category} balance={balance} photoUrl={photoUrl} />
      <div
        data-column-body
        className="fam-task-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-(--fam-task-col-pad)"
      >
        {cards.length === 0 ? (
          <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
            {`No rewards for ${category.label} yet`}
          </p>
        ) : (
          <ul className="flex flex-col gap-(--fam-task-section-gap)">
            {cards.map((card) => (
              <RewardCard
                key={card.key}
                reward={card.target.reward}
                categoryId={category.id}
                accent={category.color}
                balance={balance}
                redemption={card.target.redemption}
                busy={busyKeys?.has(rewardCardKeyOf(card.target)) ?? false}
                onOpen={onOpen}
                onRedeem={onRedeem}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
