"use client";

import { useState } from "react";

import { removeAvatar, uploadAvatar } from "@/lib/family/actions/avatars";
import type { Category } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";

/**
 * Photo avatar upload and removal (FR-022).
 *
 * The image is shrunk in the browser first — a phone photo is several
 * megabytes and the avatar is never drawn above ~112 px — but the server still
 * checks the real type and size, because a client-side check is a courtesy.
 */

const MAX_UPLOAD_DIMENSION = 512;

export interface PhotoUploadButtonProps {
  profile: Category;
  disabled: boolean;
}

export function PhotoUploadButton({ profile, disabled }: PhotoUploadButtonProps) {
  const { withActor } = useFamily();
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File): Promise<void> {
    setMessage(null);
    const formData = new FormData();
    formData.append("file", await downscale(file), file.name);
    const result = await withActor(() => uploadAvatar(profile.id, formData));
    if (!result.ok) setMessage(result.message);
  }

  async function remove(): Promise<void> {
    setMessage(null);
    const result = await withActor(() => removeAvatar(profile.id));
    if (!result.ok) setMessage(result.message);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/*
        The focusable element is the file input, and it is `sr-only` — clipped
        to a 1px box where no focus ring can be seen. The indicator belongs on
        the visible label instead, or tabbing here shows nothing at all
        (WCAG 2.4.7, SC-009).
      */}
      <label className="flex min-h-[44px] cursor-pointer items-center rounded-full px-1 text-(length:--fam-fs-small) text-(--fam-text-secondary) has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--fam-text-primary) has-[:focus-visible]:ring-offset-2">
        <span className="underline">{profile.avatarKind === "photo" ? "Replace photo" : "Upload photo"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>

      {profile.avatarKind === "photo" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void remove()}
          className="min-h-[44px] text-(length:--fam-fs-small) text-(--fam-text-secondary) underline disabled:opacity-50"
        >
          Remove photo
        </button>
      ) : null}

      {message ? (
        <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Falls back to the original file whenever the browser cannot re-encode it. */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
