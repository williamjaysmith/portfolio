"use client";

import { EyeOff, Star } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { adjustStars, createReward, deleteReward, updateReward } from "@/lib/family/actions/rewards";
import { can } from "@/lib/family/permissions";
import { useRedemptions, useRewards, useStarBalances } from "@/lib/family/queries";
import { balanceMapOf, balanceOf } from "@/lib/family/rewards/stars";
import type { ActorSession, Category, Redemption, Reward, StarBalance } from "@/lib/family/types";
import type { RewardInput } from "@/lib/family/validation";

import { BoardStrip } from "../../components/BoardStrip";
import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily, type FamilyContextValue } from "../../components/FamilyProvider";
import type { SubmitOutcome } from "../../components/formSubmit";
import { settleEdit, useWriteSurface } from "../../components/useWriteSurface";
import { ColumnPager, useColumnPage } from "../../components/ColumnPager";
import { useBoardGeometry } from "../../components/useBoardGeometry";
import { GiveStarsSheet, type GiveStarsInput } from "./GiveStarsSheet";
import { RedeemModal } from "./RedeemModal";
import { rewardCardKeyOf, type RewardCardTarget } from "./RewardCard";
import { RewardColumn } from "./RewardColumn";
import { RewardDetails } from "./RewardDetails";
import { RewardForm } from "./RewardForm";
import { useRedeem, type RedeemState } from "./useRedeem";
import { useRewardFilters, type RewardFilterStore } from "./useRewardFilters";
import { rewardDraftOf, type RewardSubmitOutcome } from "./useRewardForm";

/**
 * 004 T032: the Rewards tab — FR-422's columns of people, on the Tasks board's
 * chassis (R409). The pieces are the shipped ones and stay ignorant of each
 * other, as they do on the Tasks tab:
 *
 *   useBoardGeometry      measures the mounted board → how many columns fit
 *   useColumnPage         which window of them is on screen (FR-396)
 *   ColumnPager           the swipe and the arrow keys between windows
 *   BoardStrip            the grid, moved to `components/` so both boards mount it
 *   useRewardFilters      the per-device Redeemed switch (FR-426)
 *
 * **The columns are `visibleProfiles`, in the household's order** — every
 * Profile this device shows, so the shipped filter sheet's toggles apply here
 * exactly as they do on the Tasks tab (FR-426, R409). No column for a Label
 * (FR-414), no Up for Grabs (a reward belongs to someone), no reorder (the
 * household's order is the household's), no sections. "Show on Tasks tab" is
 * the Tasks tab's own rule (003 FR-313) and is deliberately NOT read here.
 *
 * **The tab holds the household's three reads once** (R407) and hands every
 * column the same lists: a column filters by the reward's own eligibility,
 * and reads its Profile's balance as ONE number from the view's map, so the
 * same reward is a bar in one column and a Redeem button in the next because
 * two balances were handed down and never because anything was counted
 * (FR-417, FR-420).
 *
 * **The model is split from the start** (plan §V): `useRewardsView` is the
 * tab's own state before any data — which Profiles, how many fit, which page,
 * the switch — and `useRewardsData` is the three reads. The write surface
 * hangs off two taps, as on the Tasks tab: the card BODY opens details, from
 * which a parent may Edit or Delete; the shell's "+" opens the create form.
 * Every commit goes through the shipped `withActor` interceptor and the
 * actions in `lib/family/actions/rewards.ts`; nothing is written to the cache
 * by hand — the tab repaints from the refetch (FR-419, FR-441).
 *
 * **Redeem and Unredeem go through `useRedeem`** (T043) — the tab's one commit
 * path, on the Tasks board's `useTaskResolve` pattern: the card's Redeem button
 * and the details sheet's Unredeem both call it, the punch-in arrives at the
 * tap through `withActor`, a refusal is the board's one line (or the sheet's,
 * while it is open), and a success opens `RedeemModal` FROM THE RETURNED ROW
 * (FR-424, FR-431, FR-432, FR-441). The celebration is mounted in response to
 * this device's own write and to nothing else: a redemption that arrives from
 * another device is data, and data repaints a column — it never celebrates
 * (R408, Assumption 12). After Done the renewing reward is a bar and the
 * one-time one a muted card because the refetch says so (FR-425, FR-430).
 *
 * The details sheet holds the card's ADDRESSES rather than its rows, so it
 * re-reads the live lists on every render: an edit made behind it repaints it
 * from the refetch, and a reward deleted on another device closes it with a
 * message instead of being recreated from a stale copy (FR-393's rule).
 *
 * **Give stars lives in the tab's own chrome** (T051), before the Redeemed
 * switch where the reference photographs it (05 shot13), and is drawn for a
 * parent's affordance only — `permissions.can` over `stars.adjust`, the rule
 * the details sheet already applies to Edit and Delete — never for a member
 * and never while nobody is punched in; the server refuses on every path
 * regardless (FR-435). Its sheet is handed the household's Profiles and the
 * balances the tab holds, so the before-and-after table is arithmetic over
 * numbers already on screen (SC-412), and its commit is `withActor` around
 * `adjustStars` like every other write here: the sheet closes on success and
 * the columns repaint from the refetch (FR-434, FR-436, FR-441).
 */

/** What the shell's "+" is called on this tab, and what it opens. */
const FAB_LABEL = "Add Reward";

/** A failed read says so once, in the household's words, not the API's. */
const READ_FAILED = "Rewards could not be loaded.";

/** The open sheet's reward went away underneath it (FR-393). */
const GONE_MESSAGE = "That reward is no longer here.";

/** No column to draw: the filter sheet has hidden every Profile on this device. */
const NO_COLUMNS = "Every Profile is hidden on this device.";

/** Constitution §VI: the switch still works for the session, and the tab says so. */
const NOT_REMEMBERED = "The Redeemed switch won't be remembered on this device.";

/** The tab's chrome idiom — the top bar's pill (R414), at the FR-445 touch floor. */
const SWITCH_CLASS =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full bg-(--fam-pill-btn-bg) px-4 " +
  "font-medium text-(length:--fam-fs-pill) text-(--fam-text-muted) " +
  "aria-checked:bg-(--fam-text-primary) aria-checked:text-(--fam-app-bg)";

/** The modal's "By <Profile>" when the Profile has left the household underneath the write. */
const UNKNOWN_PROFILE = "someone";

/** What FR-434's control is called — the reference's own name (05 shot13). */
const GIVE_STARS = "Give stars";

/* ------------------------------------------------------------------ data -- */

export interface RewardsBoardProps {
  /** The three reads the server performed (R407), each seeded to its own key. */
  initialRewards: Reward[];
  initialBalances: StarBalance[];
  initialRedemptions: Redemption[];
}

const NO_REWARDS: Reward[] = [];
const NO_REDEMPTIONS: Redemption[] = [];
const NO_BALANCES: StarBalance[] = [];

interface RewardsData {
  rewards: readonly Reward[];
  /** Standing and reversed alike; the column reads the standing ones (FR-426, FR-431). */
  redemptions: readonly Redemption[];
  /** The view's rows keyed by Profile (R402); a Profile with no row reads 0. */
  balances: ReadonlyMap<string, number>;
  error: Error | null;
}

/** The three reads, each seeded from the server's row for its own key (R407). */
function useRewardsData(householdId: string, props: RewardsBoardProps): RewardsData {
  const rewards = useRewards(householdId, props.initialRewards);
  const balances = useStarBalances(householdId, props.initialBalances);
  const redemptions = useRedemptions(householdId, props.initialRedemptions);

  const rows = balances.data;
  const balanceMap = useMemo(() => balanceMapOf(rows ?? NO_BALANCES), [rows]);

  return {
    rewards: rewards.data ?? NO_REWARDS,
    redemptions: redemptions.data ?? NO_REDEMPTIONS,
    balances: balanceMap,
    error: rewards.error ?? balances.error ?? redemptions.error,
  };
}

/* ------------------------------------------------------------------ view -- */

/**
 * The tab's own state, before any data is read: how many columns fit, which
 * page of them is on screen, and the one per-device switch. Split from the
 * model below so each half stays inside the complexity budget on its own.
 */
function useRewardsView(columns: readonly Category[]) {
  const columnCount = columns.length;
  const geometry = useBoardGeometry(columnCount);
  const page = useColumnPage({
    columnCount,
    perRow: geometry.layout.perRow,
    mode: geometry.layout.mode,
  });
  const filters = useRewardFilters();
  return { layout: geometry.layout, boardRef: geometry.boardRef, page, filters };
}

/* ----------------------------------------------------------- write surface -- */

/** Which write surface is open: the create form, or the edit form over one reward. */
type RewardEditorSurface =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; reward: Reward };

const EDITOR_CLOSED: RewardEditorSurface = { kind: "closed" };

interface RewardEditor {
  surface: RewardEditorSurface;
  /** The board's own line: a reward that left before its write landed. */
  notice: string | null;
  clearNotice: () => void;
  /** FR-393: another device deleted it first — the board says so, once. */
  reportGone: () => void;
  openCreate: () => void;
  openEdit: (reward: Reward) => void;
  close: () => void;
  submit: (input: RewardInput) => Promise<RewardSubmitOutcome>;
}

/**
 * The create and edit commits and the surfaces they belong to. Each write is
 * `withActor(() => action(...))`, so punch-in arrives at the moment of the
 * write and the cache is swept on success (FR-419, FR-441).
 */
function useRewardEditor(withActor: FamilyContextValue["withActor"]): RewardEditor {
  const { surface, notice, open, close, clearNotice, reportGone } =
    useWriteSurface<RewardEditorSurface>(EDITOR_CLOSED, GONE_MESSAGE);

  const openCreate = useCallback(() => open({ kind: "create" }), [open]);
  const openEdit = useCallback((reward: Reward) => open({ kind: "edit", reward }), [open]);

  const submit = useCallback(
    async (input: RewardInput): Promise<RewardSubmitOutcome> => {
      if (surface.kind === "create") return withActor(() => createReward(input));
      if (surface.kind !== "edit") return null;
      // FR-418: every field, as one patch the server judges merged (T029);
      // FR-393: another device deleted it first — close, recreate nothing, say so.
      return settleEdit(
        () => withActor(() => updateReward({ id: surface.reward.id, patch: input })),
        reportGone,
      );
    },
    [surface, withActor, reportGone],
  );

  return { surface, notice, clearNotice, reportGone, openCreate, openEdit, close, submit };
}

/* ------------------------------------------------------------ give stars -- */

interface GiveStars {
  /** The sheet is open. One surface at a time: it is its own boolean, like the details. */
  open: boolean;
  show: () => void;
  close: () => void;
  /** The sheet's one commit — `withActor` around `adjustStars` (FR-434, FR-435). */
  submit: (input: GiveStarsInput) => Promise<SubmitOutcome>;
}

/**
 * FR-434's sheet and its write. The result goes back to the sheet whole: a
 * success closes it there, a refusal is shown at its field, and a dismissed
 * punch-in (`null` from the interceptor's `NO_ACTOR`) shows nothing.
 */
function useGiveStars(withActor: FamilyContextValue["withActor"]): GiveStars {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const submit = useCallback(
    (input: GiveStarsInput): Promise<SubmitOutcome> => withActor(() => adjustStars(input)),
    [withActor],
  );
  return { open, show, close, submit };
}

/**
 * FR-435's affordance, decided the way the details sheet decides Edit and
 * Delete: `permissions.can` over the parent-only verb, so a member and an
 * empty punch-in both read false. The gate is the server's.
 */
function mayGiveStars(actor: ActorSession | null, categories: readonly Category[]): boolean {
  const householdHasParent = categories.some(
    (category) => category.isProfile && category.role === "parent",
  );
  return can(actor, "stars.adjust", { householdHasParent }).allowed;
}

/* ---------------------------------------------------------------- details -- */

/** Where the open card lives: the reward, the column, and — on a muted card — the redemption. */
interface SheetKey {
  rewardId: string;
  categoryId: string;
  redemptionId: string | null;
}

/**
 * The live target for an address, or `null` when the reward has left the
 * list. A redemption reversed underneath the sheet (FR-431, another device)
 * reads as no redemption, so the details show the card as it now is.
 */
function sheetTargetOf(
  key: SheetKey,
  rewards: readonly Reward[],
  redemptions: readonly Redemption[],
): RewardCardTarget | null {
  const reward = rewards.find((one) => one.id === key.rewardId);
  if (reward === undefined) return null;
  const redemption = redemptions.find((one) => one.id === key.redemptionId) ?? null;
  return {
    reward,
    categoryId: key.categoryId,
    redemption: redemption?.reversedAt === null ? redemption : null,
  };
}

interface RewardSheet {
  target: RewardCardTarget | null;
  /** The open reward has left the tab underneath the sheet (FR-393). */
  gone: boolean;
  /** FR-441: the sheet's one write is in flight. */
  busy: boolean;
  /** A refused delete, shown where the tap happened. */
  notice: string | null;
  open: (target: RewardCardTarget) => void;
  close: () => void;
  /** FR-418: after the sheet's own confirmation — the one write made from here. */
  remove: () => Promise<void>;
}

/**
 * The details view, opened over ONE card and re-read from the live lists every
 * render. The delete lives here because its refusal belongs in the sheet that
 * asked (FR-424's "say plainly", applied to FR-418), while a `NOT_FOUND`
 * closes the sheet and hands the board its one line.
 */
function useRewardSheet(
  data: RewardsData,
  withActor: FamilyContextValue["withActor"],
  onGone: () => void,
): RewardSheet {
  const [key, setKey] = useState<SheetKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const target = useMemo(
    () => (key === null ? null : sheetTargetOf(key, data.rewards, data.redemptions)),
    [key, data.rewards, data.redemptions],
  );

  const open = useCallback((next: RewardCardTarget) => {
    setNotice(null);
    setKey({
      rewardId: next.reward.id,
      categoryId: next.categoryId,
      redemptionId: next.redemption?.id ?? null,
    });
  }, []);
  const close = useCallback(() => setKey(null), []);

  const remove = useCallback(async () => {
    if (target === null || busy) return;
    setBusy(true);
    setNotice(null);
    // FR-418's dialog, restated to the server: confirmed, and permanent.
    const result = await withActor(() => deleteReward({ id: target.reward.id, confirm: true }));
    setBusy(false);
    if (result.ok) {
      setKey(null);
      return;
    }
    if (result.error === "NOT_FOUND") {
      setKey(null);
      onGone();
      return;
    }
    setNotice(result.message);
  }, [target, busy, withActor, onGone]);

  return { target, gone: key !== null && target === null, busy, notice, open, close, remove };
}

/* ------------------------------------------------------------ celebration -- */

/** What the modal is rendered from: the row the local write returned, and the card's emoji. */
interface Celebration {
  redemption: Redemption;
  emoji: string | null;
}

interface CelebrationState {
  celebration: Celebration | null;
  /** R408: called from the local redeem's success and from nowhere else. */
  celebrate: (reward: Reward, redemption: Redemption) => void;
  /** Done, or a successful Unredeem from the modal. */
  dismiss: () => void;
}

/**
 * FR-432's modal and FR-438's stars, held as the ROW this device's own write
 * returned. Nothing here reads the redemptions list: a refetch can add a
 * hundred redemptions and this stays null, which is the whole of Assumption 12.
 */
function useCelebration(): CelebrationState {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrate = useCallback(
    (reward: Reward, redemption: Redemption) =>
      setCelebration({ redemption, emoji: reward.emoji }),
    [],
  );
  const dismiss = useCallback(() => setCelebration(null), []);
  return { celebration, celebrate, dismiss };
}

/** The Profile redeemed FOR, by name — the modal's "By <Profile>" (FR-424). */
function profileNameOf(categories: readonly Category[], categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.label ?? UNKNOWN_PROFILE;
}

/**
 * The two writes `useRedeem` makes, and what the board does with each answer:
 * a redeem's success opens the modal from the returned row (FR-432); an
 * unredeem's success closes the details it was chosen in, the refetch drawing
 * the card as it was (FR-431). A refusal stays where the tap happened.
 */
function useRedeemHandlers(redeem: RedeemState, celebration: CelebrationState, sheet: RewardSheet) {
  const { redeem: runRedeem, unredeem: runUnredeem } = redeem;
  const { celebrate } = celebration;
  const { close: closeSheet } = sheet;

  const onRedeem = useCallback(
    async (next: RewardCardTarget) => {
      const outcome = await runRedeem(next);
      if (outcome !== null && outcome.ok) celebrate(next.reward, outcome.data);
    },
    [runRedeem, celebrate],
  );

  const onUnredeem = useCallback(
    async (redemption: Redemption) => {
      const outcome = await runUnredeem(redemption);
      if (outcome !== null && outcome.ok) closeSheet();
    },
    [runUnredeem, closeSheet],
  );

  return { onRedeem, onUnredeem };
}

/** The two callbacks that cross between the sheet and the write surface. */
function useRewardHandlers(sheet: RewardSheet, editor: RewardEditor, redeem: RedeemState) {
  const { open: openSheet, close: closeSheet, target } = sheet;
  const { clearNotice, openEdit } = editor;
  const { clearNotice: clearRedeemNotice } = redeem;

  const onOpen = useCallback(
    (next: RewardCardTarget) => {
      // A message belongs to the tap that earned it, not to the next card.
      clearNotice();
      clearRedeemNotice();
      openSheet(next);
    },
    [clearNotice, clearRedeemNotice, openSheet],
  );

  // The details sheet hands over to the edit form: one dialog at a time.
  const onEdit = useCallback(() => {
    if (target === null) return;
    closeSheet();
    openEdit(target.reward);
  }, [target, closeSheet, openEdit]);

  return { onOpen, onEdit };
}

/**
 * The one line under the chrome. A refused delete is shown IN the sheet,
 * which is modal, so it is not repeated behind it — and so is a refused
 * Unredeem, which the sheet carries itself while it is open. A refused Redeem
 * comes from a card on the board, and is the board's to say (FR-424).
 */
function noticeFor(
  data: RewardsData,
  sheet: RewardSheet,
  editor: RewardEditor,
  redeem: RedeemState,
): string | null {
  if (data.error !== null) return READ_FAILED;
  if (sheet.gone) return GONE_MESSAGE;
  if (editor.notice !== null) return editor.notice;
  return sheet.target === null ? redeem.notice : null;
}

/* ----------------------------------------------------------------- model -- */

/**
 * Every hook the tab needs, assembled once, so the rendering below is a
 * rendering of a value rather than a wiring of hooks.
 */
function useRewardsBoardModel(props: RewardsBoardProps) {
  const { householdId, categories, profiles, visibleProfiles, avatarUrls, actor, withActor } =
    useFamily();
  const view = useRewardsView(visibleProfiles);
  const data = useRewardsData(householdId, props);
  const editor = useRewardEditor(withActor);
  const sheet = useRewardSheet(data, withActor, editor.reportGone);
  const redeem = useRedeem();
  const celebration = useCelebration();
  const giveStars = useGiveStars(withActor);
  const handlers = useRewardHandlers(sheet, editor, redeem);
  const redeemHandlers = useRedeemHandlers(redeem, celebration, sheet);

  // The shell's one create control, named for this tab while it is mounted.
  useRegisterFabAction(FAB_LABEL, editor.openCreate);

  return {
    ...view,
    ...data,
    // FR-422: one column per Profile this device shows, in the household's order.
    columns: visibleProfiles,
    // The household's Profiles, for the form's picker — a device filter should
    // not limit who a reward may be for (FR-415), nor who may be given stars (FR-434).
    profiles,
    categories,
    avatarUrls,
    actor,
    editor,
    sheet,
    redeem,
    celebration,
    giveStars,
    // FR-435: the control is drawn for a parent and for nobody else.
    mayGiveStars: mayGiveStars(actor, categories),
    ...handlers,
    ...redeemHandlers,
    notice: noticeFor(data, sheet, editor, redeem),
  };
}

type RewardsBoardModel = ReturnType<typeof useRewardsBoardModel>;

/** One drawn column and the name the pager announces it by (FR-396). */
interface DrawnColumn {
  label: string;
  node: ReactNode;
}

/** Every column the tab has, in the household's order — the pager shows a window of it. */
function drawnColumnsOf(m: RewardsBoardModel): DrawnColumn[] {
  return m.columns.map((profile) => ({
    label: profile.label,
    node: (
      <RewardColumn
        key={profile.id}
        category={profile}
        rewards={m.rewards}
        redemptions={m.redemptions}
        balance={balanceOf(m.balances, profile.id)}
        showRedeemed={m.filters.filters.redeemed}
        photoUrl={m.avatarUrls[profile.id]}
        busyKeys={m.redeem.busyKeys}
        onOpen={m.onOpen}
        onRedeem={(target) => void m.onRedeem(target)}
      />
    ),
  }));
}

/* ------------------------------------------------------------------ view -- */

/**
 * FR-426's switch, in the tab's own chrome where the reference photographs it
 * (05 shot13 — a toggle beside Give stars). A real switch to the keyboard and
 * the screen reader, so its state is spoken rather than only coloured.
 */
function RedeemedSwitch({ filters }: { filters: RewardFilterStore }) {
  const on = filters.filters.redeemed;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => filters.setRedeemed(!on)}
      className={SWITCH_CLASS}
    >
      <EyeOff size={20} aria-hidden="true" />
      Redeemed
    </button>
  );
}

/**
 * FR-434's control, in the same pill as the switch beside it and at the same
 * touch floor (FR-445). Drawn only when the board has decided the affordance
 * (`onGiveStars` present); the star is the reference's, in its gold.
 */
function GiveStarsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={SWITCH_CLASS}>
      <Star size={20} aria-hidden="true" fill="currentColor" className="text-(--fam-star-gold)" />
      {GIVE_STARS}
    </button>
  );
}

/** The tab's chrome: the Give-stars control, when it is offered, then the Redeemed switch. */
function RewardsChrome({
  filters,
  onGiveStars,
}: {
  filters: RewardFilterStore;
  /** Present means "draw it": the board has already applied FR-435's affordance rule. */
  onGiveStars?: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 px-(--fam-edge-inset) pt-2">
      {onGiveStars === undefined ? null : <GiveStarsButton onClick={onGiveStars} />}
      <RedeemedSwitch filters={filters} />
      {filters.persistent ? null : (
        <p className="w-full text-right text-(length:--fam-fs-small) text-(--fam-text-secondary)">
          {NOT_REMEMBERED}
        </p>
      )}
    </div>
  );
}

/** The form over the reward being made or changed, or nothing. */
function RewardEditorSurface({
  editor,
  profiles,
}: {
  editor: RewardEditor;
  profiles: readonly Category[];
}) {
  const { surface } = editor;
  if (surface.kind === "create") {
    return (
      <RewardForm mode="create" profiles={profiles} onSubmit={editor.submit} onClose={editor.close} />
    );
  }
  if (surface.kind === "edit") {
    return (
      <RewardForm
        mode="edit"
        seed={rewardDraftOf(surface.reward)}
        profiles={profiles}
        onSubmit={editor.submit}
        onClose={editor.close}
      />
    );
  }
  return null;
}

export function RewardsBoard(props: RewardsBoardProps) {
  const m = useRewardsBoardModel(props);
  const open = m.sheet.target;
  // FR-431: the standing redemption the open sheet stands for, if any — held as
  // a const so the Unredeem closure below is narrowed with it.
  const standing = open?.redemption ?? null;
  const celebrating = m.celebration.celebration;
  // The window the measured layout allows: every column when they all fit,
  // and a page of them when they do not (FR-394, FR-395, FR-396).
  const visible = drawnColumnsOf(m).slice(m.page.start, m.page.end);

  return (
    <div className="flex h-full min-h-0 flex-col gap-(--fam-task-col-gap)">
      <RewardsChrome
        filters={m.filters}
        onGiveStars={m.mayGiveStars ? m.giveStars.show : undefined}
      />

      {m.notice === null ? null : (
        <p
          role="alert"
          className="px-(--fam-edge-inset) py-1 text-(length:--fam-fs-small) text-(--fam-danger)"
        >
          {m.notice}
        </p>
      )}

      {m.columns.length === 0 ? (
        <p className="px-(--fam-edge-inset) text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          {NO_COLUMNS}
        </p>
      ) : (
        <ColumnPager
          paged={m.page.paged}
          onPage={m.page.step}
          visibleLabels={visible.map((column) => column.label)}
        >
          <BoardStrip boardRef={m.boardRef} perRow={m.layout.perRow} count={visible.length}>
            {visible.map((column) => column.node)}
          </BoardStrip>
        </ColumnPager>
      )}

      {open === null ? null : (
        <RewardDetails
          reward={open.reward}
          categories={m.categories}
          redemption={open.redemption}
          actor={m.actor}
          // FR-441: the sheet's delete, or this card's put-back, is in flight.
          busy={m.sheet.busy || m.redeem.busyKeys.has(rewardCardKeyOf(open))}
          // A refused delete or a refused Unredeem, where the tap happened.
          notice={m.sheet.notice ?? m.redeem.notice}
          onEdit={m.onEdit}
          onDelete={() => void m.sheet.remove()}
          onUnredeem={standing === null ? undefined : () => void m.onUnredeem(standing)}
          onClose={m.sheet.close}
        />
      )}

      {/* R408: rendered from THIS device's returned row, never from the list. */}
      {celebrating === null ? null : (
        <RedeemModal
          redemption={celebrating.redemption}
          emoji={celebrating.emoji}
          profileName={profileNameOf(m.categories, celebrating.redemption.categoryId)}
          onClose={m.celebration.dismiss}
        />
      )}

      <RewardEditorSurface editor={m.editor} profiles={m.profiles} />

      {/* FR-434: over the household's Profiles and the balances already held (SC-412). */}
      {m.giveStars.open ? (
        <GiveStarsSheet
          profiles={m.profiles}
          balances={m.balances}
          onSubmit={m.giveStars.submit}
          onClose={m.giveStars.close}
        />
      ) : null}
    </div>
  );
}
