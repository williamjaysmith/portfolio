"use client";

import type { FieldErrors } from "@/lib/family/errors";
import type { Category, Reward } from "@/lib/family/types";
import { parseOrThrow, rewardInputSchema, type RewardInput } from "@/lib/family/validation";

import {
  settleSubmit,
  toggled,
  useSubmission,
  type Settled,
  type SubmitOutcome,
} from "../../components/formSubmit";
import { useDraft, type Draft } from "../../components/useDraft";

/**
 * Draft state + submit machinery for the reward form (004 T036), on the same
 * `formSubmit` path as the calendar's `useEventForm` and the board's
 * `useTaskForm`, so a refusal is shown one way across the three forms.
 *
 * The draft speaks the FORM's vocabulary — the cost as the text that was
 * typed, blank optionals as empty strings — and `draftToRewardInput`
 * translates it into the contract's `RewardInput` exactly once, at submit.
 *
 * Validation is the SAME schema the action runs (`rewardInputSchema`), so a
 * refusal the server would give lands against its field before the network is
 * touched, and the two layers cannot disagree (FR-415, FR-416). Nothing else
 * is pre-checked: who may save is the server's gate (FR-419).
 */

export interface RewardDraft {
  name: string;
  description: string;
  emoji: string;
  /**
   * FR-416's cost as typed — text, so a half-typed number is not silently
   * repaired; `costOf` sends a number the schema judges (1–500, whole).
   */
  pointValue: string;
  /** FR-430's "Renew after redeeming" — the reference's field name. */
  respawnOnRedemption: boolean;
  /** The picked Profile ids; the submitted order is the household's. */
  categoryIds: string[];
}

/** Prefill — the reward being edited (`rewardDraftOf`), or a partial for a test. */
export type RewardFormSeed = Partial<RewardDraft>;

export type RewardFormMode = "create" | "edit";

/**
 * What the caller's commit hands back. A result is shown or closed on as usual;
 * `null` means there is nothing for the form to show — the punch-in was
 * dismissed before any write, or the caller already took the outcome over.
 */
export type RewardSubmitOutcome = SubmitOutcome;

function blankDraft(): RewardDraft {
  return {
    name: "",
    description: "",
    emoji: "",
    pointValue: "",
    respawnOnRedemption: false,
    categoryIds: [],
  };
}

/** Blank optional text means "not set", stored as NULL. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The cost as the schema will judge it. A blank or malformed box yields `NaN`,
 * which `rewardInputSchema` refuses against its own field rather than being
 * quietly rounded into a value nobody chose.
 */
function costOf(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/** The draft as `createReward` expects it — and as `updateReward`'s whole patch. */
function draftToRewardInput(draft: RewardDraft, orderedIds: string[]): RewardInput {
  return {
    name: draft.name,
    description: orNull(draft.description),
    emoji: orNull(draft.emoji),
    pointValue: costOf(draft.pointValue),
    respawnOnRedemption: draft.respawnOnRedemption,
    categoryIds: orderedIds,
  };
}

/**
 * A stored reward as the draft that would have produced it, so the edit form
 * shows what the reward actually is. The mirror of `draftToRewardInput`.
 */
export function rewardDraftOf(reward: Reward): RewardDraft {
  return {
    name: reward.name,
    description: reward.description ?? "",
    emoji: reward.emoji ?? "",
    pointValue: String(reward.pointValue),
    respawnOnRedemption: reward.respawnOnRedemption,
    categoryIds: [...reward.categoryIds],
  };
}

/**
 * Validate locally with the action's own schema, then hand the parsed input to
 * the caller (`settleSubmit`). The ids are sent in the order of the Profiles
 * offered — the household's — and an id that is not among them (a Profile
 * deleted on another device since the seed) is dropped rather than sent.
 */
function validateAndSubmit(draft: RewardDraft, options: UseRewardFormOptions): Promise<Settled> {
  const orderedIds = options.profiles
    .filter((profile) => draft.categoryIds.includes(profile.id))
    .map((profile) => profile.id);
  return settleSubmit(
    () => parseOrThrow(rewardInputSchema, draftToRewardInput(draft, orderedIds)),
    options.onSubmit,
  );
}

export interface UseRewardFormOptions {
  seed?: RewardFormSeed;
  /** The Profiles this reward may be for, in the household's order (FR-414, FR-415). */
  profiles: readonly Category[];
  /**
   * The commit — the board routes it through `withActor(...)` to the real
   * action so punch-in arrives at the moment of the write; tests drive a mock.
   */
  onSubmit: (input: RewardInput) => Promise<RewardSubmitOutcome>;
  onClose: () => void;
}

export interface RewardFormState {
  draft: RewardDraft;
  set: Draft<RewardDraft>["set"];
  toggleProfile: (id: string) => void;
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  submit: () => Promise<void>;
}

export function useRewardForm(options: UseRewardFormOptions): RewardFormState {
  const { draft, set, update } = useDraft(blankDraft, options.seed);
  const submission = useSubmission(options.onClose);

  function toggleProfile(id: string): void {
    update((current) => ({ ...current, categoryIds: toggled(current.categoryIds, id) }));
  }

  return {
    draft,
    set,
    toggleProfile,
    errors: submission.errors,
    message: submission.message,
    pending: submission.pending,
    submit: () => submission.submit(() => validateAndSubmit(draft, options)),
  };
}
