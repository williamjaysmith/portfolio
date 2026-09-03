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
