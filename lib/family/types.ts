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
