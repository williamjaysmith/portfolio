/**
 * Image type detection by magic bytes.
 *
 * A browser's `File.type` is whatever the client says it is, and
 * `storage.upload()` ignores `contentType` for File/Blob bodies. So the server
 * reads the first bytes itself and uploads a `Uint8Array` with the type it
 * proved (research R7 / D16).
 */

import { AVATAR_MIME_TYPES } from "./avatars";

export type ImageMime = (typeof AVATAR_MIME_TYPES)[number];

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** "RIFF" ... "WEBP" — the 4-byte file size sits between them. */
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** `null` for anything that is not one of the three accepted image types. */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}
