import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  AVATAR_IDS,
  AVATAR_LABELS,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  avatarSrc,
  extensionFor,
  isAvatarId,
} from "@/lib/family/avatars";

describe("AVATAR_IDS", () => {
  it("is the frozen list of ten animals in order", () => {
    expect(AVATAR_IDS).toEqual([
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
    ]);
    expect(new Set(AVATAR_IDS).size).toBe(10);
  });

  it("has a display label for every id", () => {
    expect(Object.keys(AVATAR_LABELS)).toHaveLength(AVATAR_IDS.length);
    for (const id of AVATAR_IDS) {
      expect(AVATAR_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it("has artwork on disk for every id", () => {
    for (const id of AVATAR_IDS) {
      const file = resolve(process.cwd(), "public", "family", "avatars", `${id}.svg`);
      expect(existsSync(file), `${file} is missing`).toBe(true);
    }
  });
});

describe("isAvatarId", () => {
  it("accepts every frozen id", () => {
    for (const id of AVATAR_IDS) {
      expect(isAvatarId(id)).toBe(true);
    }
  });

  it("rejects unknown ids and non-strings", () => {
    expect(isAvatarId("unicorn")).toBe(false);
    expect(isAvatarId("Fox")).toBe(false);
    expect(isAvatarId("")).toBe(false);
    expect(isAvatarId(42)).toBe(false);
    expect(isAvatarId(null)).toBe(false);
    expect(isAvatarId(undefined)).toBe(false);
  });
});

describe("avatarSrc", () => {
  it("points at the public svg for the id", () => {
    expect(avatarSrc("fox")).toBe("/family/avatars/fox.svg");
    expect(avatarSrc("panda")).toBe("/family/avatars/panda.svg");
  });
});

describe("photo upload limits", () => {
  it("caps uploads at 5 MB", () => {
    expect(AVATAR_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("allows exactly jpeg, png and webp", () => {
    expect(AVATAR_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("maps each allowed mime to a storage extension", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});
