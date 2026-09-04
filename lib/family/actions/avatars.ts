"use server";

/**
 * Photo avatars (FR-022, research R7, D16).
 *
 * The bucket is private, so a photo of a child is never world-readable at a
 * guessable URL. Reads go through short-lived signed URLs minted here; the
 * browser never talks to storage directly. Type and size are validated from
 * the bytes themselves, because a client-side check is a courtesy, not a
 * control.
 */

import { revalidatePath } from "next/cache";

import { AVATAR_MAX_BYTES, extensionFor } from "../avatars";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireMember, requireParent } from "../guards";
import { sniffImageMime } from "../image";
import { CATEGORY_COLUMNS, toCategory, type CategoryRow } from "../rows";
import { createAdminClient } from "../supabase/admin";
import type { Category } from "../types";
import { adminFamily, loadProfile, mapDbError, touchActor } from "./shared";

const BUCKET = "family-avatars";
/** Long enough for a session at the tablet, short enough that a leaked URL dies. */
const SIGNED_URL_SECONDS = 3600;

async function requireProfile(householdId: string, profileId: string): Promise<Category> {
  const profile = await loadProfile(householdId, profileId);
  if (!profile) throw new ActionFailure("NOT_FOUND");
  return profile;
}

export async function uploadAvatar(
  profileId: string,
  formData: FormData,
): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const actor = await requireParent();
    const profile = await requireProfile(actor.householdId, profileId);

    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      throw new ActionFailure("VALIDATION", "Choose a photo to upload.");
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new ActionFailure("VALIDATION", "That photo is larger than 5 MB.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageMime(bytes);
    if (!mime) {
      throw new ActionFailure("VALIDATION", "Photos must be a JPEG, PNG or WebP image.");
    }

    const path = `${actor.householdId}/${profileId}.${extensionFor(mime)}`;
    const upload = await createAdminClient()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    // The row is left untouched on a storage failure, so the previous avatar survives.
    if (upload.error) throw new ActionFailure("UNAVAILABLE", "Couldn't save that photo. Try again.");

    const { data, error } = await adminFamily()
      .from("categories")
      .update({
        avatar_kind: "photo",
        avatar_path: path,
        avatar_id: null,
        updated_by: actor.profileId,
      })
      .eq("id", profileId)
      .eq("household_id", actor.householdId)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw mapDbError(error);

    // A different extension means the old object is now an orphan.
    if (profile.avatarPath && profile.avatarPath !== path) {
      try {
        await createAdminClient().storage.from(BUCKET).remove([profile.avatarPath]);
      } catch {
        // Harmless leftover; the row already points at the new object.
      }
    }

    await touchActor(actor);
    revalidatePath("/family", "layout");
    return toCategory(data as unknown as CategoryRow);
  });
}

export async function removeAvatar(profileId: string): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const actor = await requireParent();
    const profile = await requireProfile(actor.householdId, profileId);

    const { data, error } = await adminFamily()
      .from("categories")
      .update({ avatar_kind: null, avatar_path: null, avatar_id: null, updated_by: actor.profileId })
      .eq("id", profileId)
      .eq("household_id", actor.householdId)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw mapDbError(error);

    if (profile.avatarPath) {
      try {
        await createAdminClient().storage.from(BUCKET).remove([profile.avatarPath]);
      } catch {
        // The row no longer references it; a leftover object is not worth failing on.
      }
    }

    await touchActor(actor);
    revalidatePath("/family", "layout");
    return toCategory(data as unknown as CategoryRow);
  });
}

/**
 * Signed URLs for the photo avatars of this household only. Any id outside it
 * is silently dropped rather than reported — an id is not a capability.
 */
export async function signAvatarUrls(
  profileIds: string[],
): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => {
    const { householdId } = await requireMember();
    if (profileIds.length === 0) return {};

    const { data, error } = await adminFamily()
      .from("categories")
      .select("id, avatar_path")
      .eq("household_id", householdId)
      .eq("avatar_kind", "photo")
      .in("id", profileIds);
    if (error) throw mapDbError(error);

    const rows = (data ?? []) as { id: string; avatar_path: string | null }[];
    const withPhotos = rows.filter((row): row is { id: string; avatar_path: string } =>
      Boolean(row.avatar_path),
    );
    if (withPhotos.length === 0) return {};

    const signed = await createAdminClient()
      .storage.from(BUCKET)
      .createSignedUrls(
        withPhotos.map((row) => row.avatar_path),
        SIGNED_URL_SECONDS,
      );
    if (signed.error) throw new ActionFailure("UNAVAILABLE");

    const urlByPath = new Map<string, string>();
    for (const entry of signed.data ?? []) {
      if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
    }

    const result: Record<string, string> = {};
    for (const row of withPhotos) {
      const url = urlByPath.get(row.avatar_path);
      if (url) result[row.id] = url;
    }
    return result;
  });
}
