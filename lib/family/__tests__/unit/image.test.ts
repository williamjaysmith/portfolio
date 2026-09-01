import { describe, it, expect } from "vitest";
import { AVATAR_MIME_TYPES } from "@/lib/family/avatars";
import { sniffImageMime } from "@/lib/family/image";

/**
 * `sniffImageMime` is a security control, not a convenience: the browser's
 * `File.type` is attacker-controlled, so `uploadAvatar` trusts only these
 * bytes (research R7 / D16). Every case below is a real file header.
 */

/** Container tags ("RIFF", "WEBP", "GIF89a"…) are spelled in ASCII on disk. */
function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function bytes(...parts: readonly (number | readonly number[])[]): Uint8Array {
  return new Uint8Array(parts.flat());
}

/** Little-endian file size, the 4 bytes a RIFF container puts after the tag. */
const RIFF_SIZE = [0x24, 0x08, 0x00, 0x00];

const JPEG_JFIF = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ascii("JFIF"), 0x00, 0x01);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IHDR = bytes(PNG_SIGNATURE, 0x00, 0x00, 0x00, 0x0d, ascii("IHDR"));
const WEBP_VP8 = bytes(ascii("RIFF"), RIFF_SIZE, ascii("WEBP"), ascii("VP8 "));

describe("sniffImageMime — accepted formats", () => {
  it("identifies a JPEG by its FF D8 FF start-of-image marker", () => {
    expect(sniffImageMime(JPEG_JFIF)).toBe("image/jpeg");
  });

  it("identifies a PNG by its full 8-byte signature", () => {
    expect(sniffImageMime(PNG_IHDR)).toBe("image/png");
  });

  it("identifies a WebP by the WEBP tag at offset 8 inside a RIFF container", () => {
    expect(sniffImageMime(WEBP_VP8)).toBe("image/webp");
  });

  it("accepts a header that is exactly as long as its signature", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(sniffImageMime(bytes(PNG_SIGNATURE))).toBe("image/png");
    expect(sniffImageMime(bytes(ascii("RIFF"), RIFF_SIZE, ascii("WEBP")))).toBe("image/webp");
  });

  it("only ever returns a MIME type the avatar bucket accepts", () => {
    const accepted: readonly string[] = AVATAR_MIME_TYPES;
    for (const header of [JPEG_JFIF, PNG_IHDR, WEBP_VP8]) {
      const mime = sniffImageMime(header);
      expect(mime).not.toBeNull();
      expect(accepted).toContain(mime);
    }
  });
});

describe("sniffImageMime — rejections", () => {
  it("rejects an empty buffer", () => {
    expect(sniffImageMime(new Uint8Array(0))).toBeNull();
  });

  it("rejects a GIF, which is a real image but not an accepted one", () => {
    expect(sniffImageMime(bytes(ascii("GIF89a"), 0x01, 0x00, 0x01, 0x00))).toBeNull();
  });

  it("rejects a truncated PNG signature", () => {
    expect(sniffImageMime(bytes(PNG_SIGNATURE.slice(0, 7)))).toBeNull();
  });

  it("rejects a PNG signature with a single corrupted byte", () => {
    const corrupted = [...PNG_SIGNATURE];
    corrupted[0] = 0x88;
    expect(sniffImageMime(bytes(corrupted))).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    expect(sniffImageMime(bytes(ascii("RIFF"), RIFF_SIZE, ascii("WAVE")))).toBeNull();
    expect(sniffImageMime(bytes(ascii("RIFF"), RIFF_SIZE, ascii("AVI ")))).toBeNull();
  });

  it("rejects a buffer that ends before the WebP tag offset", () => {
    expect(sniffImageMime(bytes(ascii("RIFF")))).toBeNull();
    expect(sniffImageMime(bytes(ascii("RIFF"), RIFF_SIZE))).toBeNull();
    expect(sniffImageMime(bytes(ascii("RIFF"), RIFF_SIZE, ascii("WEB")))).toBeNull();
  });

  it("rejects a truncated JPEG marker", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageMime(bytes(0xff))).toBeNull();
  });

  it("rejects an SVG, which a browser would execute as markup", () => {
    expect(sniffImageMime(bytes(ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
  });

  it("rejects executable and document payloads renamed to look like images", () => {
    expect(sniffImageMime(bytes(ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageMime(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    expect(sniffImageMime(bytes(ascii("#!/bin/sh\nrm -rf /")))).toBeNull();
  });

  it("matches the prefix only, so a hidden signature further in does not count", () => {
    expect(sniffImageMime(bytes(0x00, PNG_SIGNATURE))).toBeNull();
    expect(sniffImageMime(bytes(ascii("GIF89a"), PNG_SIGNATURE))).toBeNull();
  });

  it("rejects a WebP tag at the wrong offset", () => {
    expect(sniffImageMime(bytes(ascii("RIFF"), ascii("WEBP"), RIFF_SIZE))).toBeNull();
  });
});
