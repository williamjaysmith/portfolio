/**
 * The built-in illustration avatars and the photo-upload limits.
 *
 * The ids are frozen (D24): they are stored in `categories.avatar_id`, so a
 * rename here would orphan existing rows. Artwork lives in
 * `public/family/avatars/<id>.svg` — original flat animals, not the reference
 * product's licensed set. A profile with no avatar renders initials on its
 * colour (see `initialsFor` in `./colors`).
 *
 * Framework-free: no imports at all.
 */

export const AVATAR_IDS = [
  "fox",
  "bear",
  "bunny",
  "cat",
  "dog",
  "owl",
  "frog",
  "penguin",
  "koala",
  "panda",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

/** Accessible names for the picker and `alt` text. */
export const AVATAR_LABELS: Record<AvatarId, string> = {
  fox: "Fox",
  bear: "Bear",
  bunny: "Bunny",
  cat: "Cat",
  dog: "Dog",
  owl: "Owl",
  frog: "Frog",
  penguin: "Penguin",
  koala: "Koala",
  panda: "Panda",
};

const AVATAR_ID_SET: ReadonlySet<string> = new Set(AVATAR_IDS);

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && AVATAR_ID_SET.has(v);
}

export function avatarSrc(id: AvatarId): string {
  return `/family/avatars/${id}.svg`;
}

/** Photo uploads: 5 MB ceiling, enforced client-side and again in `uploadAvatar`. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const EXTENSION_BY_MIME: Record<(typeof AVATAR_MIME_TYPES)[number], "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Storage object extension for an allowed mime type (`<householdId>/<profileId>.<ext>`). */
export function extensionFor(mime: (typeof AVATAR_MIME_TYPES)[number]): "jpg" | "png" | "webp" {
  return EXTENSION_BY_MIME[mime];
}
