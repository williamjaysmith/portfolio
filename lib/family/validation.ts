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
import {
  WEEKDAYS,
  type Category,
  type CategoryPatch,
  type EventInput,
  type RepeatChoice,
  type Role,
  type Scope,
} from "./types";

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

/* ------------------------------------------------------------------------- *
 * Week calendar (Phase 2 — contracts/server-actions.md, "Shared input shapes")
 * ------------------------------------------------------------------------- */

export const scopeSchema = z.enum(["this", "this_and_future", "all"], {
  error: "Choose which events this applies to.",
});

const untilSchema = z.iso
  .date({ error: "Repeat end must be a date like 2026-12-15." })
  .nullable()
  .optional();

const weekdaysSchema = z
  .array(z.enum(WEEKDAYS, { error: "Weekdays must be codes like MO." }), {
    error: "Pick the weekdays the event repeats on.",
  })
  .min(1, { error: "Pick at least one weekday." })
  .refine((days) => new Set(days).size === days.length, {
    error: "Each weekday can appear only once.",
  });

/**
 * The four structured choices (FR-231/232). Strict objects: a client can
 * never smuggle a BYMONTHDAY (the emitter derives it from the start) or a
 * COUNT (the grammar is UNTIL-only) — R201's no-rule-strings rule starts here.
 */
export const repeatChoiceSchema = z.discriminatedUnion(
  "kind",
  [
    z.strictObject({ kind: z.literal("never") }),
    z.strictObject({ kind: z.literal("daily"), until: untilSchema }),
    z.strictObject({ kind: z.literal("weekly"), weekdays: weekdaysSchema, until: untilSchema }),
    z.strictObject({ kind: z.literal("monthly"), until: untilSchema }),
  ],
  { error: "Choose how the event repeats." },
);

// The same source the client fills the field from (FR-224); the database
// trigger against pg_timezone_names is the backstop.
const SUPPORTED_TIMEZONES = new Set<string>(Intl.supportedValuesOf("timeZone"));

const timezoneSchema = z
  .string({ error: "Timezone must be an IANA name." })
  .refine((zone) => SUPPORTED_TIMEZONES.has(zone), {
    error: "Timezone must be an IANA name like America/Chicago.",
  });

const instantSchema = z.iso.datetime({
  offset: true,
  error: "Times must be ISO instants like 2026-10-06T17:00:00-05:00.",
});

const plainDateSchema = z.iso.date({ error: "Dates must look like 2026-10-06." });

const summarySchema = z
  .string({ error: "Title is required." })
  .trim()
  .min(1, { error: "Title is required." })
  .max(120, { error: "Title must be 120 characters or fewer." });

const descriptionSchema = z
  .string({ error: "Notes must be text." })
  .trim()
  .max(2000, { error: "Notes must be 2000 characters or fewer." })
  .transform((value) => (value === "" ? null : value));

const locationSchema = z
  .string({ error: "Location must be text." })
  .trim()
  .max(200, { error: "Location must be 200 characters or fewer." })
  .transform((value) => (value === "" ? null : value));

const categoryIdsSchema = z
  .array(z.uuid({ error: "Invalid id." }), { error: "Profiles and Labels must be a list of ids." })
  .refine((ids) => new Set(ids).size === ids.length, {
    error: "Each Profile or Label can appear only once.",
  });

const END_AFTER_START = "The end must be after the start.";
const END_DATE_BEFORE_START = "The end date can't be before the start date.";

interface FieldIssue {
  path: (string | number)[];
  message: string;
}

const eventBaseFields = {
  summary: summarySchema,
  description: descriptionSchema.nullable().optional(),
  location: locationSchema.nullable().optional(),
  timezone: timezoneSchema,
  repeat: repeatChoiceSchema,
  categoryIds: categoryIdsSchema,
};

/**
 * The two-shape time model at the boundary (FR-222/223): strict objects, so
 * mixing shapes — or sending an rrule string — is refused, not stripped.
 * FR-226 compares instants (a midnight-crosser is valid); FR-225 makes the
 * all-day end inclusive (equal dates are one day).
 */
export const eventInputSchema = z
  .discriminatedUnion(
    "allDay",
    [
      z.strictObject({
        ...eventBaseFields,
        allDay: z.literal(false),
        startsAt: instantSchema,
        endsAt: instantSchema,
      }),
      z.strictObject({
        ...eventBaseFields,
        allDay: z.literal(true),
        startDate: plainDateSchema,
        endDate: plainDateSchema,
      }),
    ],
    { error: "Choose timed or all-day." },
  )
  .superRefine((value, ctx) => {
    if (value.allDay) {
      if (value.endDate < value.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: END_DATE_BEFORE_START, input: value });
      }
    } else if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: END_AFTER_START, input: value });
    }
  });

/** `null` on a series that never ends (FR-232). */
function repeatUntil(repeat: RepeatChoice): string | null {
  return repeat.kind === "never" ? null : (repeat.until ?? null);
}

/** The household-zone calendar date of an instant — `en-CA` formats as `YYYY-MM-DD`. */
function localDateInZone(instantIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instantIso));
}

const UNTIL_BEFORE_START = "The repeat can't end before the event starts.";

/**
 * Full `createEvent` validation. The one rule the schema alone cannot hold —
 * `until` ≥ the start, compared as HOUSEHOLD-zone local dates (R201), never
 * as UTC dates — needs the household timezone, so it lives here. Throws
 * field-keyed `ActionFailure('VALIDATION')` (FR-262).
 */
export function validateEventInput(input: unknown, householdTimezone: string): EventInput {
  const parsed = parseOrThrow(eventInputSchema, input);
  const until = repeatUntil(parsed.repeat);
  if (until !== null) {
    const startDate = parsed.allDay
      ? parsed.startDate
      : localDateInZone(parsed.startsAt, householdTimezone);
    if (until < startDate) {
      throw new ActionFailure("VALIDATION", UNTIL_BEFORE_START, { repeat: [UNTIL_BEFORE_START] });
    }
  }
  return parsed;
}

// Time fields arrive as whole pairs — a lone edge cannot say what the other
// edge should become.
function halfPairIssues(patch: PatchTimeFields): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if ((patch.startsAt === undefined) !== (patch.endsAt === undefined)) {
    const missing = patch.startsAt === undefined ? "startsAt" : "endsAt";
    issues.push({ path: [missing], message: "A new time needs both its start and its end." });
  }
  if ((patch.startDate === undefined) !== (patch.endDate === undefined)) {
    const missing = patch.startDate === undefined ? "startDate" : "endDate";
    issues.push({ path: [missing], message: "A new date range needs both its start and its end." });
  }
  return issues;
}

// At most one time shape per patch, and a band↔grid conversion (FR-251) must
// carry the new shape's times.
function shapeIssues(patch: PatchTimeFields): FieldIssue[] {
  const hasInstants = patch.startsAt !== undefined;
  const hasDates = patch.startDate !== undefined;
  if (hasInstants && hasDates) {
    return [{ path: ["allDay"], message: "A change can carry clock times or dates, not both." }];
  }
  if (patch.allDay === true && !hasDates) {
    return [{ path: ["startDate"], message: "An all-day change needs its dates." }];
  }
  if (patch.allDay === false && !hasInstants) {
    return [{ path: ["startsAt"], message: "A timed change needs its start and end times." }];
  }
  return [];
}

// FR-226/FR-225 hold on patched times exactly as on created ones.
function orderIssues(patch: PatchTimeFields): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (
    patch.startsAt !== undefined &&
    patch.endsAt !== undefined &&
    Date.parse(patch.endsAt) <= Date.parse(patch.startsAt)
  ) {
    issues.push({ path: ["endsAt"], message: END_AFTER_START });
  }
  if (patch.startDate !== undefined && patch.endDate !== undefined && patch.endDate < patch.startDate) {
    issues.push({ path: ["endDate"], message: END_DATE_BEFORE_START });
  }
  return issues;
}

interface PatchTimeFields {
  allDay?: boolean;
  startsAt?: string;
  endsAt?: string;
  startDate?: string;
  endDate?: string;
}

function patchTimeIssues(patch: PatchTimeFields): FieldIssue[] {
  const halves = halfPairIssues(patch);
  if (halves.length > 0) return halves;
  return [...shapeIssues(patch), ...orderIssues(patch)];
}

/**
 * What `updateEvent` may change. Strict: `timezone` (provenance, written
 * once — FR-224) and `rrule` (emitter-only — R201) are refused, not stripped.
 */
const eventPatchSchema = z
  .strictObject({
    summary: summarySchema.optional(),
    description: descriptionSchema.nullable().optional(),
    location: locationSchema.nullable().optional(),
    repeat: repeatChoiceSchema.optional(),
    categoryIds: categoryIdsSchema.optional(),
    allDay: z.boolean({ error: "Choose timed or all-day." }).optional(),
    startsAt: instantSchema.optional(),
    endsAt: instantSchema.optional(),
    startDate: plainDateSchema.optional(),
    endDate: plainDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    for (const issue of patchTimeIssues(value)) {
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message, input: value });
    }
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Nothing to update.",
  });

function occurrenceScoped(scope: Scope | undefined): boolean {
  return scope === "this" || scope === "this_and_future";
}

const OCCURRENCE_REQUIRED = "Say which occurrence this applies to.";

// The scope rules a schema can hold without the row: a per-occurrence scope
// names its occurrence, and a 'this' patch cannot carry series-only fields —
// categories change at series scope only (FR-287) and a repeat is a series
// property (FR-239). Whether a scope is required at all needs the row (FR-238)
// and stays in the action.
function updateScopeIssues(value: {
  scope?: Scope;
  occurrenceDate?: string;
  patch: { categoryIds?: unknown; repeat?: unknown };
}): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (occurrenceScoped(value.scope) && value.occurrenceDate === undefined) {
    issues.push({ path: ["occurrenceDate"], message: OCCURRENCE_REQUIRED });
  }
  if (value.scope === "this" && value.patch.categoryIds !== undefined) {
    issues.push({
      path: ["patch", "categoryIds"],
      message: "Profiles and Labels change for the whole series, not one event.",
    });
  }
  if (value.scope === "this" && value.patch.repeat !== undefined) {
    issues.push({
      path: ["patch", "repeat"],
      message: "The repeat changes for the whole series, not one event.",
    });
  }
  return issues;
}

export const updateEventInputSchema = z
  .strictObject({
    id: z.uuid({ error: "Invalid id." }),
    patch: eventPatchSchema,
    scope: scopeSchema.optional(),
    occurrenceDate: plainDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    for (const issue of updateScopeIssues(value)) {
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message, input: value });
    }
  });

export const deleteEventInputSchema = z
  .strictObject({
    id: z.uuid({ error: "Invalid id." }),
    // FR-258: no delete without explicit confirmation; once confirmed it is final.
    confirm: z.literal(true, { error: "Deleting needs explicit confirmation." }),
    scope: scopeSchema.optional(),
    occurrenceDate: plainDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (occurrenceScoped(value.scope) && value.occurrenceDate === undefined) {
      ctx.addIssue({ code: "custom", path: ["occurrenceDate"], message: OCCURRENCE_REQUIRED, input: value });
    }
  });
