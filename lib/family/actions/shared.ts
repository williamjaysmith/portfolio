import "server-only";

/**
 * Helpers shared by the /family server actions. Not a `"use server"` module —
 * it exports non-action values, which Next forbids in an action file.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { ttlSecondsOf } from "../actor-token";
import { writeActor } from "../actor";
import { ActionFailure } from "../errors";
import {
  CATEGORY_COLUMNS,
  SETTINGS_COLUMNS,
  toCategory,
  toSettings,
  type CategoryRow,
  type HouseholdSettingsRow,
} from "../rows";
import { createAdminClient } from "../supabase/admin";
import type { Actor, ActorSession, Category, HouseholdSettings } from "../types";

/** The service-role client, already pointed at the `family` schema. */
export function adminFamily() {
  return createAdminClient().schema("family");
}

/** Postgres/PostgREST codes the actions translate into the contract's errors. */
const DB_ERROR_CODES: Record<string, ActionFailure["code"]> = {
  // 23514 is a CHECK violation: off-palette colour, a Label with person fields,
  // or the last-parent trigger — the message tells them apart.
  "23505": "CONFLICT", // unique violation
  "23503": "CONFLICT", // foreign key violation
  "22023": "VALIDATION", // malformed PIN, raised by set_pin
  P0002: "NOT_FOUND", // no such profile, raised by the PIN functions
  PGRST116: "NOT_FOUND", // .single() found no row
  "42501": "FORBIDDEN", // privilege / not a member
};

/**
 * Never leak a database message to the client: each maps to a contract error
 * with copy the household can read. An unrecognised code is `UNAVAILABLE` —
 * a failure is always reported, never silently swallowed.
 */
export function mapDbError(error: PostgrestError): ActionFailure {
  if (error.code === "23514") {
    if (error.message.includes("LAST_PARENT")) {
      return new ActionFailure(
        "CONFLICT",
        "You can't remove the only parent. Make someone else a parent first.",
      );
    }
    return new ActionFailure("VALIDATION", "That value isn't allowed.");
  }
  const code = error.code ? DB_ERROR_CODES[error.code] : undefined;
  if (code) return new ActionFailure(code);
  console.error("[family] database error", error);
  return new ActionFailure("UNAVAILABLE");
}

async function loadSettings(householdId: string): Promise<HouseholdSettings> {
  const { data, error } = await adminFamily()
    .from("household_settings")
    .select(SETTINGS_COLUMNS)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND", "This household has no settings row.");
  return toSettings(data as unknown as HouseholdSettingsRow);
}

/** How long a punch-in lasts on this device, from the household's own setting. */
/**
 * One profile in one household — the lookup every actor-facing action starts
 * with. Scoping by household here means no caller can forget to.
 */
export async function loadProfile(
  householdId: string,
  profileId: string,
): Promise<Category | null> {
  const { data, error } = await adminFamily()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("id", profileId)
    .eq("household_id", householdId)
    .eq("is_profile", true)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? toCategory(data as unknown as CategoryRow) : null;
}

export async function punchOutTtlSeconds(householdId: string): Promise<number> {
  const settings = await loadSettings(householdId);
  return settings.punchOutMinutes * 60;
}

/** What the client is told about the current actor — nothing it cannot already read. */
export function toActorSession(actor: Actor, profile: Category): ActorSession {
  return {
    profileId: actor.profileId,
    label: profile.label,
    color: profile.color,
    role: actor.role,
    expiresAt: new Date(actor.expiresAt).toISOString(),
    ttlSeconds: ttlSecondsOf(actor),
  };
}

/**
 * Push the idle expiry forward after a successful change, so someone working
 * through a few chores is not punched out mid-task (FR-013). Best effort: a
 * failure here must never fail the mutation that already succeeded.
 */
export async function touchActor(actor: Actor | null): Promise<void> {
  if (!actor) return;
  try {
    const ttlSeconds = await punchOutTtlSeconds(actor.householdId);
    await writeActor(
      {
        profileId: actor.profileId,
        userId: actor.userId,
        householdId: actor.householdId,
        role: actor.role,
      },
      ttlSeconds,
    );
  } catch {
    // The cookie keeps its previous expiry; the next action re-checks it.
  }
}
