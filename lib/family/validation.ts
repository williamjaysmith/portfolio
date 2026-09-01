/**
 * Zod schemas for every server-action input (contracts/server-actions.md).
 *
 * These are the first line of defence; the database CHECK constraints in
 * data-model.md 003/005 are the second and must agree with them. The
 * cross-field rules (`label_has_no_person_fields`, `profile_has_no_emoji`)
 * are expressed once in `crossFieldIssues` and applied both to a full
 * `CategoryInput` and to a patch merged onto the existing row, so a partial
 * update cannot sneak a birthday onto a Label.
 *
 * Zod 4 API: `z.iso.date()`, `z.uuid()`, `z.flattenError`, `error:` params.
 */

import { z } from "zod";
import { AVATAR_IDS } from "./avatars";
import { isPaletteColor, normalizeHex } from "./colors";
import { ACTION_MESSAGES, ActionFailure, type FieldErrors } from "./errors";
import type { Category, CategoryPatch, Role } from "./types";

export const pinSchema = z
  .string({ error: "PIN must be exactly 4 digits." })
  .regex(/^[0-9]{4}$/, { error: "PIN must be exactly 4 digits." });

/** Accepts any case/whitespace, emits the canonical uppercase palette value. */
export const paletteColorSchema = z
  .string({ error: "Pick a colour from the palette." })
  .transform(normalizeHex)
  .refine(isPaletteColor, { error: "Pick a colour from the palette." });

const labelSchema = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, { error: "Name is required." })
  .max(40, { error: "Name must be 40 characters or fewer." });

/** Zod 4 counts code points: 8 is enough for a ZWJ family sequence, not for a sentence. */
const emojiSchema = z
  .string({ error: "Emoji must be text." })
  .trim()
  .min(1, { error: "Emoji can't be blank." })
  .max(8, { error: "Emoji must be a single emoji." });

const dietaryPrefsSchema = z
  .string({ error: "Dietary notes must be text." })
  .trim()
  .max(280, { error: "Dietary notes must be 280 characters or fewer." })
  .transform((value) => (value === "" ? null : value));

const avatarSchema = z.object({
  kind: z.literal("illustration", { error: "Only a built-in avatar can be set here." }),
  id: z.enum(AVATAR_IDS, { error: "Pick one of the built-in avatars." }),
});

const roleSchema = z.enum(["parent", "member"], { error: "Role must be parent or member." });

const birthdaySchema = z.iso.date({ error: "Birthday must be a date like 2020-03-22." });

// Everything a patch may touch; `isProfile` is added only for creation
// because a category cannot change kind in Phase 1.
const patchableFields = {
  label: labelSchema,
  color: paletteColorSchema,
  avatar: avatarSchema.nullable(),
  emoji: emojiSchema.nullable(),
  birthday: birthdaySchema.nullable(),
  dietaryPrefs: dietaryPrefsSchema.nullable(),
  role: roleSchema,
  showOnTasks: z.boolean({ error: "Show on tasks must be on or off." }),
};

/** The fields the cross-kind rules look at, normalised so a patch and a full input read the same. */
interface PersonFields {
  isProfile: boolean;
  hasAvatar: boolean;
  birthday: string | null;
  dietaryPrefs: string | null;
  role: Role;
  emoji: string | null;
}

type PersonFieldName = Exclude<keyof PersonFields, "isProfile" | "hasAvatar"> | "avatar";

function crossFieldIssues(fields: PersonFields): { path: PersonFieldName; message: string }[] {
  const issues: { path: PersonFieldName; message: string }[] = [];
  if (fields.isProfile) {
    if (fields.emoji !== null) {
      issues.push({ path: "emoji", message: "Profiles use an avatar, not an emoji." });
    }
    return issues;
  }
  if (fields.hasAvatar) issues.push({ path: "avatar", message: "Labels can't have an avatar." });
  if (fields.birthday !== null) issues.push({ path: "birthday", message: "Labels can't have a birthday." });
  if (fields.dietaryPrefs !== null) {
    issues.push({ path: "dietaryPrefs", message: "Labels can't have dietary notes." });
  }
  if (fields.role !== "member") issues.push({ path: "role", message: "Labels can't be parents." });
  return issues;
}

export const categoryInputSchema = z
  .object({
    ...patchableFields,
    isProfile: z.boolean({ error: "Choose Profile or Label." }),
    avatar: patchableFields.avatar.optional(),
    emoji: patchableFields.emoji.optional(),
    birthday: patchableFields.birthday.optional(),
    dietaryPrefs: patchableFields.dietaryPrefs.optional(),
    role: patchableFields.role.optional(),
    showOnTasks: patchableFields.showOnTasks.optional(),
  })
  .superRefine((value, ctx) => {
    const issues = crossFieldIssues({
      isProfile: value.isProfile,
      hasAvatar: value.avatar != null,
      birthday: value.birthday ?? null,
      dietaryPrefs: value.dietaryPrefs ?? null,
      role: value.role ?? "member",
      emoji: value.emoji ?? null,
    });
    for (const issue of issues) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message, input: value });
    }
  });

/** Field-level checks only; the cross-kind rules need the existing row — see `validateCategoryPatch`. */
export const categoryPatchSchema = z.object(patchableFields).partial();

type ParsedPatch = z.output<typeof categoryPatchSchema>;

function mergedPersonFields(existing: Category, patch: CategoryPatch): PersonFields {
  return {
    isProfile: existing.isProfile,
    hasAvatar: patch.avatar !== undefined ? patch.avatar !== null : existing.avatarKind !== null,
    birthday: patch.birthday !== undefined ? patch.birthday : existing.birthday,
    dietaryPrefs: patch.dietaryPrefs !== undefined ? patch.dietaryPrefs : existing.dietaryPrefs,
    role: patch.role ?? existing.role,
    emoji: patch.emoji !== undefined ? patch.emoji : existing.emoji,
  };
}

/** Drop keys whose value is `undefined` so "not provided" never reaches an UPDATE as `null`. */
function compactPatch(patch: ParsedPatch): CategoryPatch {
  const compact: CategoryPatch = {};
  for (const key of Object.keys(patch) as (keyof ParsedPatch)[]) {
    const value = patch[key];
    if (value !== undefined) {
      Object.assign(compact, { [key]: value });
    }
  }
  return compact;
}

/**
 * Validate a partial update against the row it will apply to. Field rules
 * come from `categoryPatchSchema`; the Profile/Label rules are re-run on the
 * merged record. Throws `ActionFailure('VALIDATION')` with `fieldErrors`.
 */
export function validateCategoryPatch(existing: Category, patch: unknown): CategoryPatch {
  const parsed = compactPatch(parseOrThrow(categoryPatchSchema, patch));
  const issues = crossFieldIssues(mergedPersonFields(existing, parsed));
  if (issues.length > 0) {
    const errors: FieldErrors = {};
    for (const issue of issues) {
      errors[issue.path] = [...(errors[issue.path] ?? []), issue.message];
    }
    throw new ActionFailure("VALIDATION", issues[0].message, errors);
  }
  return parsed;
}

export const settingsPatchSchema = z
  .object({
    householdName: z
      .string({ error: "Household name must be text." })
      .trim()
      .min(1, { error: "Household name is required." })
      .max(60, { error: "Household name must be 60 characters or fewer." })
      .optional(),
    showNameNotDate: z.boolean({ error: "Choose name or date." }).optional(),
    timeFormat: z.enum(["12h", "24h"], { error: "Time format must be 12h or 24h." }).optional(),
    startWeekOn: z.literal([0, 1], { error: "Week must start on Sunday or Monday." }).optional(),
    punchOutMinutes: z
      .number({ error: "Punch-out time must be a number of minutes." })
      .int({ error: "Punch-out time must be whole minutes." })
      .min(1, { error: "Punch-out time must be between 1 and 60 minutes." })
      .max(60, { error: "Punch-out time must be between 1 and 60 minutes." })
      .optional(),
    textSize: z.enum(["small", "medium", "large"], { error: "Text size must be small, medium or large." }).optional(),
    density: z.enum(["cozy", "snug", "roomy"], { error: "Density must be cozy, snug or roomy." }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Nothing to update.",
  });

export const reorderSchema = z
  .array(z.uuid({ error: "Invalid id." }), { error: "Reorder needs a list of ids." })
  .min(1, { error: "Reorder needs at least one id." })
  .refine((ids) => new Set(ids).size === ids.length, { error: "Each id can appear only once." });

/** Field-keyed messages for the UI; issues without a path (form-level) are left out. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) result[field] = messages;
  }
  return result;
}

/**
 * Parse or throw `ActionFailure('VALIDATION', message, fieldErrors)`. The
 * message is the first issue's, so a form-level failure still explains itself
 * when no field is highlighted.
 */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const message = result.error.issues[0]?.message ?? ACTION_MESSAGES.VALIDATION;
  throw new ActionFailure("VALIDATION", message, fieldErrors(result.error));
}
