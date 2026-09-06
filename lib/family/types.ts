/**
 * Shared domain types for /family.
 *
 * Framework-free: this file imports nothing from `app/**` (architecture §IV)
 * and nothing from Supabase, so both server and client code can use it.
 * Database row shapes (snake_case) live in `./rows.ts`; these are the
 * camelCase domain shapes the UI and actions speak.
 */

import type { PaletteColor } from "./colors";

export type Role = "parent" | "member";
export type AvatarKind = "illustration" | "photo";
export type TimeFormat = "12h" | "24h";
export type TextSize = "small" | "medium" | "large";
export type Density = "cozy" | "snug" | "roomy";
/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

export interface Household {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One record type for Profiles (people) and Labels (non-person categories),
 * distinguished by `isProfile` (FR-019). Everything in later phases attaches
 * to a Category.
 */
export interface Category {
  id: string;
  householdId: string;
  label: string;
  color: PaletteColor;
  isProfile: boolean;
  /** Profiles only. `null` → render initials on the profile colour. */
  avatarKind: AvatarKind | null;
  /** Illustration key from `lib/family/avatars.ts` when `avatarKind === "illustration"`. */
  avatarId: string | null;
  /** Storage object path `<householdId>/<profileId>.<ext>` when `avatarKind === "photo"`. */
  avatarPath: string | null;
  /** ISO date `YYYY-MM-DD`; profiles only. */
  birthday: string | null;
  dietaryPrefs: string | null;
  /** Always `"member"` on Labels. */
  role: Role;
  userId: string | null;
  /** Labels only. */
  emoji: string | null;
  showOnTasks: boolean;
  /** Fractional index — reorder writes one row. */
  sortOrder: number;
  /** Maintained by a database trigger; the hash itself is never readable. */
  hasPin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdSettings {
  householdId: string;
  showNameNotDate: boolean;
  timeFormat: TimeFormat;
  startWeekOn: WeekStart;
  punchOutMinutes: number;
  textSize: TextSize;
  density: Density;
  /**
   * The one IANA zone every render and every expansion works in (FR-284,
   * FR-219/FR-234). Seeded at setup; no interface changes it this phase.
   */
  timezone: string;
  updatedAt: string;
}

/**
 * The verified identity behind a punch-in, decoded from the signed cookie.
 * Never constructed from anything the client sent in a request body.
 */
export interface Actor {
  profileId: string;
  /** The Supabase account the cookie was minted under; must match the session. */
  userId: string;
  householdId: string;
  role: Role;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/**
 * What the client learns about the current actor. Contains nothing that is
 * not already readable within the household.
 */
export interface ActorSession {
  profileId: string;
  label: string;
  color: PaletteColor;
  role: Role;
  /** ISO timestamp of the cookie/JWT expiry. */
  expiresAt: string;
  /** Seconds until expiry at the moment the server answered — drift-free timer input. */
  ttlSeconds: number;
}

/** Input to `createCategory` (contracts/server-actions.md). */
export interface CategoryInput {
  label: string;
  color: PaletteColor;
  isProfile: boolean;
  avatar?: { kind: "illustration"; id: string } | null;
  emoji?: string | null;
  birthday?: string | null;
  dietaryPrefs?: string | null;
  role?: Role;
  showOnTasks?: boolean;
}

/** Partial update — `isProfile` cannot change (converting is out of scope for Phase 1). */
export type CategoryPatch = Partial<Omit<CategoryInput, "isProfile">>;

export interface HouseholdSettingsPatch {
  householdName?: string;
  showNameNotDate?: boolean;
  timeFormat?: TimeFormat;
  startWeekOn?: WeekStart;
  punchOutMinutes?: number;
  textSize?: TextSize;
  density?: Density;
}

/* ------------------------------------------------------------------------- *
 * Week calendar (Phase 2 — specs/002-family-week-calendar)
 * ------------------------------------------------------------------------- */

/**
 * RFC 5545 BYDAY codes — the closed grammar's weekday alphabet (R201).
 * Sunday-first to match the household's default start-of-week (`WKST=SU`).
 */
export const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The verified pyskylight scope enum (FR-237), used by edit, delete and drag alike. */
export type Scope = "this" | "this_and_future" | "all";

/**
 * The four repeat choices the form offers (FR-231/232). Clients submit this
 * structure, never an rrule string — the server-side emitter is the sole
 * producer of rule text (R201). `until` is a household-local `YYYY-MM-DD`;
 * `null` or absent = the series never ends. Monthly's BYMONTHDAY is derived
 * from the start date, never sent.
 */
export type RepeatChoice =
  | { kind: "never" }
  | { kind: "daily"; until?: string | null }
  | { kind: "weekly"; weekdays: Weekday[]; until?: string | null }
  | { kind: "monthly"; until?: string | null };

/**
 * The two-shape time model (FR-222/223): timed events are ISO instants
 * (`endsAt` strictly after `startsAt`, FR-226 — so an event may cross
 * midnight); all-day events are plain `YYYY-MM-DD` dates with an INCLUSIVE
 * `endDate` (FR-225 — equal dates cover one day).
 */
export type EventTimes =
  | { allDay: false; startsAt: string; endsAt: string }
  | { allDay: true; startDate: string; endDate: string };

export type ExceptionAction = "skip" | "override";

/**
 * One occurrence's divergence from its series: a skip, or an override of
 * exactly the four fields FR-239 permits. `null` payload fields inherit from
 * the series; `times` is `null` unless the override moved the occurrence.
 */
export interface EventException {
  id: string;
  eventId: string;
  householdId: string;
  /**
   * THE key (R204): the occurrence's ORIGINAL date in the household's
   * timezone — unchanged even when an override moves the occurrence.
   */
  occurrenceDate: string;
  action: ExceptionAction;
  summary: string | null;
  description: string | null;
  location: string | null;
  times: EventTimes | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One `family.events` row — a one-off or a whole series (occurrences are
 * computed, never stored). The read path always embeds the ordered category
 * links and every exception, which is what lets `expandWindow` find a moved
 * occurrence without any search-window bookkeeping (R206).
 */
export interface Event {
  id: string;
  householdId: string;
  summary: string;
  description: string | null;
  location: string | null;
  times: EventTimes;
  /** The creating DEVICE's IANA zone — provenance only (FR-224); never rendered from. */
  timezone: string;
  /** Canonical prefix-less RFC 5545 rule (R201); `null` = one-off. */
  rrule: string | null;
  /** Reserved for the countdown phase (FR-228); nothing reads it now. */
  countdownEnabled: boolean;
  /** Ordered — the stripe draw order (FR-227). May be empty (FR-213). */
  categoryIds: string[];
  exceptions: EventException[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One rendered calendar entry, produced by the shared expander — the same
 * code the server validates `occurrenceDate` against, so client and server
 * can never disagree about what an occurrence is (contracts, "Read path").
 * Field values are effective: any override is already merged.
 */
export interface Occurrence {
  /** The `events` row (segment) this occurrence expands from — what every write round-trips. */
  eventId: string;
  /** Original household-local date — the exception key (R204), NOT necessarily the rendered date. */
  occurrenceDate: string;
  /** Whether a write on this occurrence must ask the scope question (FR-238). */
  isRepeating: boolean;
  summary: string;
  description: string | null;
  location: string | null;
  /** Ordered — the stripe draw order (FR-227). */
  categoryIds: string[];
  times: EventTimes;
}

/** Input to `createEvent` (contracts/server-actions.md). */
export type EventInput = EventTimes & {
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Filled from `Intl.DateTimeFormat().resolvedOptions().timeZone` — no picker (FR-224). */
  timezone: string;
  repeat: RepeatChoice;
  categoryIds: string[];
};

/**
 * What `updateEvent` may change. `timezone` is absent by design — provenance
 * is written once (FR-224). The drag path is this same shape: a move is the
 * time pair, a band↔grid conversion adds `allDay` (FR-251).
 */
export type EventPatch = Partial<EventTimes> & {
  summary?: string;
  description?: string | null;
  location?: string | null;
  repeat?: RepeatChoice;
  categoryIds?: string[];
};

/** Input to `updateEvent` (contracts/server-actions.md). */
export interface UpdateEventInput {
  id: string;
  patch: EventPatch;
  /** REQUIRED iff the event has a rule; FORBIDDEN on a one-off (FR-238). */
  scope?: Scope;
  /**
   * `YYYY-MM-DD`, the occurrence's ORIGINAL household-local date; required
   * for scope `this` and `this_and_future`.
   */
  occurrenceDate?: string;
}

/** Input to `deleteEvent` (contracts/server-actions.md). */
export interface DeleteEventInput {
  id: string;
  /** Must be `true` — FR-258; once confirmed the delete is final. */
  confirm: boolean;
  scope?: Scope;
  occurrenceDate?: string;
}

/* ------------------------------------------------------------------------- *
 * Tasks (Phase 3 — specs/003-family-tasks)
 * ------------------------------------------------------------------------- */

/**
 * The three time-of-day slots (FR-302, FR-335). The order they are written in
 * is the canonical one the `task_slots_shape` CHECK enumerates and the board
 * renders its sections in.
 */
export type TimeOfDay = "morning" | "afternoon" | "evening";

/**
 * FR-347's delete scopes. The same three values Phase 2 verified, so the
 * calendar's `Scope` is reused rather than restated — a second union could
 * drift from the one the scope dialog and the action already share.
 */
export type TaskScope = Scope;

/** The Completed Date delay's unit (FR-342). */
export type RenewUnit = "day" | "week" | "month";

/**
 * The repeat the form submits (FR-334, FR-339–FR-346). Clients never send a
 * rule string; `ruleFromTaskChoice` maps this onto the shared emitter.
 * `after_completion` is not a rule at all — it writes the `renew_after_*`
 * triple and leaves `rrule` null. Monthly's BYMONTHDAY is derived from
 * `startsOn`, never sent.
 */
export type TaskRepeatChoice =
  | { kind: "never" }
  | { kind: "daily"; interval: number; until?: string | null }
  | { kind: "weekly"; interval: number; weekdays: Weekday[]; until?: string | null }
  | { kind: "monthly"; interval: number; until?: string | null }
  | { kind: "after_completion"; amount: number; unit: RenewUnit; until?: string | null };

/** A resolution's two stored statuses (FR-360); absence of a row is "outstanding". */
export type ResolutionStatus = "complete" | "skipped";

/**
 * What an occurrence is, once the resolution index has been consulted (R315).
 * Skipped occurrences stay in the list — hiding them is the filter layer's job
 * (FR-361) and removing them from the denominator is the counters' (FR-360).
 */
export type OccurrenceState = "unresolved" | ResolutionStatus;

/**
 * One assignee of a task, in that Profile's own routine order, carrying that
 * Profile's own habit streak (FR-310, FR-324, FR-371). Zero assignee rows on a
 * task means up for grabs (FR-365).
 */
export interface TaskAssignee {
  taskId: string;
  householdId: string;
  categoryId: string;
  /** Fractional index — a routine drag writes one row (FR-310). */
  sortOrder: number;
  streakCount: number;
  /** The last household-local date `streakCount` accounts for (FR-373). */
  streakThrough: string | null;
  /** The day this assignee's Completed Date chain is seeded from (R309). */
  createdAt: string;
}

/**
 * One `family.tasks` row — a chore or a routine definition (FR-317).
 * Occurrences are computed, never stored. The four chore sub-types fall out of
 * `startsOn` and `dueTime` (FR-325); the repeat mode is which of `rrule` and
 * `renewAfterAmount` is populated (FR-339).
 */
export interface Task {
  id: string;
  householdId: string;
  summary: string;
  description: string | null;
  emoji: string | null;
  /** The one discriminator (FR-317). */
  routine: boolean;
  upForGrabs: boolean;
  trackHabit: boolean;
  /** Household-local `YYYY-MM-DD`; the rule anchor and the chain seed. Null = Anytime. */
  startsOn: string | null;
  /** Household wall clock `HH:MM` (FR-326), never an instant. Chores only. */
  dueTime: string | null;
  /** A routine's slots (FR-335); empty on a chore. */
  timesOfDay: TimeOfDay[];
  /** Canonical prefix-less rule (R201); null = no rule-mode repeat. */
  rrule: string | null;
  /** `0` IS "Immediately" (FR-342); null = not a Completed Date chore. */
  renewAfterAmount: number | null;
  renewAfterUnit: RenewUnit | null;
  renewUntil: string | null;
  /**
   * The star value a completion credits (004 FR-401, FR-405), 0–500; null =
   * worth nothing, which draws no chip (FR-403). Read by the credit trigger at
   * the moment of the completion, so a later edit changes nothing already
   * earned (FR-409).
   */
  rewardPoints: number | null;
  assignees: TaskAssignee[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One RESOLVED occurrence, complete or skipped (FR-360). `occurrenceDate` is
 * the occurrence's SCHEDULED date (FR-353); `resolvedOn` is the day it was
 * actually ticked, which for a late chore is a different day (FR-354).
 */
export interface TaskResolution {
  id: string;
  householdId: string;
  taskId: string;
  /** Null on an Anytime chore's single undated occurrence (FR-328). */
  occurrenceDate: string | null;
  /** Routines only (FR-335). */
  occurrenceSlot: TimeOfDay | null;
  /** The chain's OWNER; null for an up-for-grabs task's household chain (FR-363). */
  assigneeId: string | null;
  /** The Profile CREDITED (FR-354, FR-368); null only on a skip crediting nobody. */
  categoryId: string | null;
  /** The previous cycle of a Completed Date chore (FR-343); null on every rule-mode row. */
  cyclePrev: string | null;
  status: ResolutionStatus;
  resolvedOn: string;
  resolvedAt: string;
  /** The punched-in ACTOR, who may not be the credited Profile (Assumption 3). */
  createdBy: string | null;
  createdAt: string;
}

/**
 * The tail of one Completed Date chain, from the `family.task_cursors` view —
 * the row that decides what is due, which may be arbitrarily old (R309).
 */
export interface TaskCursor {
  householdId: string;
  taskId: string;
  assigneeId: string | null;
  tailId: string;
  tailResolvedOn: string;
}

/**
 * One Task Box template. FR-377 fixes the field set: a title, an optional
 * emoji and a type — no description, date, repeat or assignment — and Phase 4
 * adds the fourth field, the star value a task made from it starts with
 * (004 FR-401, FR-404).
 */
export interface TaskBoxItem {
  id: string;
  householdId: string;
  summary: string;
  emoji: string | null;
  routine: boolean;
  /** 0–500; null = worth nothing. Copied onto the create form's Stars field (FR-404). */
  rewardPoints: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The five columns a resolution's uniqueness is keyed by (FR-353, FR-370) —
 * the same tuple `lib/family/tasks/resolutions.ts` indexes on, so client and
 * database agree about what an occurrence is by construction.
 *
 * `contracts/server-actions.md` calls this shape `TaskOccurrenceKey`; it is one
 * type under one name here.
 */
export interface OccurrenceKey {
  taskId: string;
  /** The CHAIN OWNER; null = an up-for-grabs task's household chain. */
  assigneeId: string | null;
  /** The occurrence's ORIGINAL household-local date; null = an Anytime chore. */
  occurrenceDate: string | null;
  slot: TimeOfDay | null;
  /** Completed Date only: the resolution id this cycle follows. */
  cyclePrev?: string | null;
}

/**
 * One dated appearance of a task for one assignee (spec §Key Entities), as
 * `expandTaskDay` produces it — the shape every renderer and every
 * occurrence-validating action reads (R315).
 *
 * The first five fields are `OccurrenceKey`: `scheduledDate` is the identity
 * and what a late card shows (FR-358), never the day it is drawn on.
 */
export interface BoardOccurrence {
  taskId: string;
  assigneeId: string | null;
  /** The occurrence's own household-local date; null = an Anytime chore (FR-328). */
  scheduledDate: string | null;
  slot: TimeOfDay | null;
  cyclePrev: string | null;
  /** The board day it is drawn on — differs from `scheduledDate` only when carried (FR-357). */
  displayedDate: string;
  /** FR-325's Late: a Timed or All-day chore drawn past its own date. */
  isLate: boolean;
  summary: string;
  description: string | null;
  emoji: string | null;
  routine: boolean;
  upForGrabs: boolean;
  trackHabit: boolean;
  /** Household wall clock `HH:MM`; null on an all-day, anytime or routine occurrence. */
  dueTime: string | null;
  /** The instant `dueTime` falls at under FR-326's DST rules; null without a due time. */
  dueAt: string | null;
  /** FR-359: Skip exists for routines and repeating chores only. */
  isRepeating: boolean;
  /** FR-311's tie-break: the defining task's creation order. */
  taskCreatedAt: string;
  state: OccurrenceState;
  /** The Profile a resolution credited — an up-for-grabs claim (FR-367); null while unresolved. */
  creditedCategoryId: string | null;
  /**
   * The task's star value as it is NOW, carried unchanged by `expandTaskDay`
   * (004 FR-403): the card's chip when > 0, nothing otherwise. What a past
   * completion actually earned lives in the ledger, not here (FR-409).
   */
  rewardPoints: number | null;
}

/**
 * The four per-device task switches (FR-384, R319). The per-Profile toggle is
 * NOT here — it rides Phase 1's shipped `useDeviceVisibility` category set.
 * Skipped defaults OFF: FR-361 shows skipped occurrences only when it is on.
 */
export interface TaskFilters {
  completed: boolean;
  late: boolean;
  skipped: boolean;
  upForGrabs: boolean;
}

/* ------------------------------------------------------------------------- *
 * Rewards (Phase 4 — specs/004-family-rewards)
 * ------------------------------------------------------------------------- */

/**
 * The five movements of stars (025 `star_entries.kind`). Credits and
 * retractions hang off a resolution and carry `earnedOn`; redemptions and
 * refunds hang off a redemption; an adjustment is a parent's hand (FR-436).
 * The sign is the kind's: credit and refund positive, retraction and
 * redemption negative, an adjustment either way.
 */
export type StarEntryKind = "credit" | "retraction" | "redemption" | "refund" | "adjustment";

/**
 * One `family.rewards` row with its eligibilities embedded (024): something a
 * Profile can spend stars on. One record, several eligible Profiles, progress
 * derived per Profile from their balance against `pointValue` (FR-417,
 * FR-420, Assumption 7) — there is no per-reward counter.
 */
export interface Reward {
  id: string;
  householdId: string;
  name: string;
  /** Shown in the details view, never on the card (FR-415). */
  description: string | null;
  emoji: string | null;
  /** The cost, 1–500 (FR-416). Editing it changes no redemption's stored cost (FR-420). */
  pointValue: number;
  /** FR-430: "Renew after redeeming" — the reference's field name. */
  respawnOnRedemption: boolean;
  /** The eligible Profiles, in a pinned order; never a Label (FR-414). At least one (FR-415). */
  categoryIds: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One movement of stars for one Profile (025) — append-only; a reversal is a
 * second row, never an edit (FR-408, FR-412, Assumption 5). The Profile
 * credited is `categoryId`; the punched-in actor is `createdBy` (FR-405).
 */
export interface StarEntry {
  id: string;
  householdId: string;
  categoryId: string;
  /** Never 0; signed by kind. */
  amount: number;
  kind: StarEntryKind;
  /** The household day the stars were EARNED — what the column pill sums (FR-407). Null off a resolution. */
  earnedOn: string | null;
  /** Loose references, no FK: history survives what it was for (FR-411, FR-421). */
  resolutionId: string | null;
  redemptionId: string | null;
  /** The task's or reward's title as it was; null on an adjustment. */
  summary: string | null;
  createdBy: string | null;
  /** The household day of the write. */
  enteredOn: string;
  createdAt: string;
}

/**
 * One row of the `family.star_balances` view: a Profile's balance, the sum of
 * their entries (FR-412). May be negative after an un-tick of spent stars
 * (Assumption 5); a Label never has one (FR-414).
 */
export interface StarBalance {
  categoryId: string;
  balance: number;
}

/**
 * That one Profile redeemed one reward (026), with the cost and the name AS
 * THEY WERE (FR-428) and the household day (FR-433). Reversible, never erased:
 * `reversedAt` set means unredeemed (FR-431); one standing (unreversed) row per
 * one-time reward and Profile (FR-430).
 */
export interface Redemption {
  id: string;
  householdId: string;
  rewardId: string;
  categoryId: string;
  pointValue: number;
  rewardName: string;
  redeemedOn: string;
  redeemedAt: string;
  /** The punched-in actor, who may be a parent redeeming on the Profile's behalf (FR-424). */
  redeemedBy: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
}

/**
 * The Rewards tab's one per-device switch (FR-426, R409), on the `TaskFilters`
 * pattern: off by default, so only unredeemed rewards show until it is on.
 */
export interface RewardFilters {
  redeemed: boolean;
}

/* ------------------------------------------------------------------ lists -- */

/** FR-510: the three types the device offers; no behaviour hangs on it this phase. */
export type ListKind = "to_do" | "grocery" | "other";

/**
 * One shared list of the household (028; 005 FR-509–FR-515). Belongs to the
 * household, never to a Profile or Label; its count is not stored — it is the
 * number of its unchecked items (FR-505).
 */
export interface List {
  id: string;
  householdId: string;
  name: string;
  kind: ListKind;
  color: PaletteColor;
  /** FR-514: shown only while a parent is punched in on the device (Assumption 5). */
  parentsOnly: boolean;
  /** The card's place in the row — a fractional index, set on creation (Assumption 17). */
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One line on a list (028; FR-516–FR-533). A section is the name it carries,
 * or none (R501); checked while `checkedAt` is set (R503); one position among
 * the LIST's items, written once per drop (R502).
 */
export interface ListItem {
  id: string;
  householdId: string;
  listId: string;
  text: string;
  section: string | null;
  checkedAt: string | null;
  /** Who checked it; null while unchecked, and null after that Profile's deletion (FR-540). */
  checkedBy: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
}

/**
 * The Lists tab's one per-device switch (FR-520, R509), on the `TaskFilters`
 * pattern: on by default, so checked items stay in place, struck through.
 */
export interface ListFilters {
  completed: boolean;
}

/* ------------------------------------------------------------------ meals -- */

/**
 * One of the household's four mealtimes (030; 006 FR-608–FR-612). A record
 * with an identity — a rename carries every recipe and meal that names it —
 * seeded once and never deleted (R601, R604).
 */
export interface MealCategory {
  id: string;
  householdId: string;
  name: string;
  color: PaletteColor;
  /** 1–4, the row order on the grid and the rail. */
  position: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One saved recipe (031; FR-613–FR-617): a name, one mealtime, one free text
 * of ingredients and instructions. Planned meals REFERENCE it (Assumption 9);
 * `removedAt` is FR-616's first delete choice — out of the pane and the picker,
 * still readable for the meals that point at it (R601).
 */
export interface Recipe {
  id: string;
  householdId: string;
  name: string;
  categoryId: string;
  text: string;
  removedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One occurrence of a repeating meal that diverges from its series (032):
 * a skip, or an override of date, mealtime or note — keyed by the occurrence's
 * ORIGINAL date, as an event's exception is (R602). `note` of `""` clears the
 * series' note for that occurrence; `null` inherits.
 */
export interface MealException {
  id: string;
  mealId: string;
  householdId: string;
  occurrenceDate: string;
  action: ExceptionAction;
  date: string | null;
  categoryId: string | null;
  note: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One `family.meals` row — a one-off or a whole series (032; FR-622–FR-630).
 * The read path embeds every exception, so `expandMeals` finds a moved
 * occurrence without any search-window bookkeeping (R605).
 */
export interface Meal {
  id: string;
  householdId: string;
  /** The slot's date — the series anchor when `rrule` is set. */
  date: string;
  categoryId: string;
  recipeId: string;
  note: string | null;
  /** Canonical prefix-less RFC 5545 rule with a date UNTIL (R602); `null` = one-off. */
  rrule: string | null;
  exceptions: MealException[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One drawn meal — a one-off, or one occurrence of a series with any override
 * merged. `occurrenceDate` is the exception key, NOT necessarily `date`.
 */
export interface MealOccurrence {
  mealId: string;
  occurrenceDate: string;
  /** Whether a write on this occurrence must ask the scope question (FR-629). */
  isRepeating: boolean;
  /** The drawn date — the override's when one moved it. */
  date: string;
  categoryId: string;
  recipeId: string;
  note: string | null;
  /** Planning order within a slot (Assumption 7): the meal's creation. */
  createdAt: string;
}

/** `planMeal`'s recipe: one the household has, or a new entry that also becomes one (FR-622). */
export type RecipeChoice =
  | { kind: "existing"; id: string }
  | { kind: "new"; name: string; text?: string };

/** The calendar's three scopes, worded for meals in the dialog (FR-629). */
export type MealScope = Scope;

/** The calendar's one per-device meals switch (FR-635, R609), on the `ListFilters` pattern. */
export interface CalendarMealSwitches {
  showMeals: boolean;
}
