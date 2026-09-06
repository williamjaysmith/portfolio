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
  type List,
  type RepeatChoice,
  type Reward,
  type Role,
  type Scope,
  type TaskRepeatChoice,
  type TimeOfDay,
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
function emojiFieldSchema(maxLength: number) {
  return z
    .string({ error: "Emoji must be text." })
    .trim()
    .min(1, { error: "Emoji can't be blank." })
    .max(maxLength, { error: "Emoji must be a single emoji." });
}

const emojiSchema = emojiFieldSchema(8);

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

function weekdayListSchema(missing: string) {
  return z
    .array(z.enum(WEEKDAYS, { error: "Weekdays must be codes like MO." }), { error: missing })
    .min(1, { error: "Pick at least one weekday." })
    .refine((days) => new Set(days).size === days.length, {
      error: "Each weekday can appear only once.",
    });
}

const weekdaysSchema = weekdayListSchema("Pick the weekdays the event repeats on.");

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

/** A long optional text field: trimmed, bounded, and blank folded to `null`. */
function longTextSchema(noun: string, maxLength: number) {
  return z
    .string({ error: `${noun} must be text.` })
    .trim()
    .max(maxLength, { error: `${noun} must be ${maxLength} characters or fewer.` })
    .transform((value) => (value === "" ? null : value));
}

const descriptionSchema = longTextSchema("Notes", 2000);

const locationSchema = longTextSchema("Location", 200);

function idListSchema(missing: string, duplicate: string) {
  return z
    .array(z.uuid({ error: "Invalid id." }), { error: missing })
    .refine((ids) => new Set(ids).size === ids.length, { error: duplicate });
}

const categoryIdsSchema = idListSchema(
  "Profiles and Labels must be a list of ids.",
  "Each Profile or Label can appear only once.",
);

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

/* ------------------------------------------------------------------------- *
 * Tasks (Phase 3 — contracts/server-actions.md, "Zod rules")
 * ------------------------------------------------------------------------- */

/**
 * Canonical slot order — the same sequence 017's `task_slots_shape` spells out
 * as seven literal arrays, so a routine this schema accepts cannot then be
 * refused by the CHECK behind it (FR-302, FR-335).
 */
const TIMES_OF_DAY = ["morning", "afternoon", "evening"] as const satisfies readonly TimeOfDay[];

const timeOfDaySchema = z.enum(TIMES_OF_DAY, {
  error: "Times of day are morning, afternoon or evening.",
});

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** FR-320's emoji is one glyph, not a label: 16 characters is the outer bound. */
function isOneGrapheme(value: string): boolean {
  return [...graphemes.segment(value)].length === 1;
}

const taskEmojiSchema = emojiFieldSchema(16).refine(isOneGrapheme, {
  error: "Emoji must be a single emoji.",
});

/**
 * A due time is a HOUSEHOLD WALL CLOCK (FR-326), never an instant and never
 * seconds: `dueInstantOf` composes it onto the zone at read time, so a stored
 * offset would fabricate a precision no task read ever uses.
 */
const TASK_WALL_CLOCK = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

const dueTimeSchema = z
  .string({ error: "A due time must be text." })
  .regex(TASK_WALL_CLOCK, { error: "A due time is a clock time like 18:00." });

/** FR-345: whole intervals 1–99, the bound 017's `tasks_rrule_grammar` carries. */
const intervalSchema = z
  .number({ error: "Repeat every how many? Enter a whole number." })
  .int({ error: "Repeat every how many? Enter a whole number." })
  .min(1, { error: "Repeat every 1 to 99." })
  .max(99, { error: "Repeat every 1 to 99." });

/** FR-342: `0` IS "Immediately"; the same 0–99 bound 017 stores. */
const renewAmountSchema = z
  .number({ error: "After how long? Enter a whole number." })
  .int({ error: "After how long? Enter a whole number." })
  .min(0, { error: "The delay must be between 0 and 99." })
  .max(99, { error: "The delay must be between 0 and 99." });

const renewUnitSchema = z.enum(["day", "week", "month"], {
  error: "Choose days, weeks or months.",
});

/**
 * The five structured choices (FR-334, FR-339–FR-346). Strict objects, so no
 * client can smuggle a BYMONTHDAY (the emitter derives it from `startsOn`), a
 * COUNT (FR-346 accepts no count-of-occurrences limit in either mode) or a rule
 * string of any shape — R201's no-rule-strings rule, kept for tasks.
 */
export const taskRepeatChoiceSchema = z.discriminatedUnion(
  "kind",
  [
    z.strictObject({ kind: z.literal("never") }),
    z.strictObject({ kind: z.literal("daily"), interval: intervalSchema, until: untilSchema }),
    z.strictObject({
      kind: z.literal("weekly"),
      interval: intervalSchema,
      weekdays: weekdayListSchema("Pick the weekdays this repeats on."),
      until: untilSchema,
    }),
    z.strictObject({ kind: z.literal("monthly"), interval: intervalSchema, until: untilSchema }),
    z.strictObject({
      kind: z.literal("after_completion"),
      amount: renewAmountSchema,
      unit: renewUnitSchema,
      until: untilSchema,
    }),
  ],
  { error: "Choose how this repeats." },
);

const STARS_RANGE = "Stars must be a whole number from 0 to 500.";

/**
 * The star value (004 FR-401, FR-402): a whole number 0–500, where blank and 0
 * alike mean "no stars" and store null — so a card worth nothing and a card
 * never given a value are the same card (FR-403). The 500 ceiling is this
 * schema's alone; 017/021's CHECK stops at `>= 0` and is not tightened
 * (004 data-model, Assumption 4).
 */
const rewardPointsSchema = z
  .union(
    [
      z
        .number({ error: STARS_RANGE })
        .int({ error: STARS_RANGE })
        .min(0, { error: STARS_RANGE })
        .max(500, { error: STARS_RANGE }),
      z.literal(""),
      z.null(),
    ],
    { error: STARS_RANGE },
  )
  .transform((value) => (value === "" || value === null || value === 0 ? null : value))
  .optional();

/**
 * `TaskInput` (contracts → `createTask`). Strict: `rrule` and the
 * `renew_after_*` triple are refused rather than stripped, so a client that
 * tries to write one gets told (R201); the star value Phase 3 reserved is now
 * the one field it grew (004 FR-401).
 */
const taskObjectSchema = z.strictObject({
  summary: summarySchema,
  description: longTextSchema("Description", 2000).nullable().optional(),
  emoji: taskEmojiSchema.nullable().optional(),
  // FR-317: the one discriminator. Every shape rule below reads off it.
  routine: z.boolean({ error: "Choose chore or routine." }),
  assigneeIds: idListSchema(
    "Assignees must be a list of Profile ids.",
    "Each Profile can appear only once.",
  ),
  upForGrabs: z.boolean({ error: "Up for grabs must be on or off." }).optional(),
  trackHabit: z.boolean({ error: "Track habit must be on or off." }).optional(),
  startsOn: plainDateSchema.nullable().optional(),
  dueTime: dueTimeSchema.nullable().optional(),
  timesOfDay: z
    .array(timeOfDaySchema, { error: "Times of day must be a list." })
    .optional(),
  repeat: taskRepeatChoiceSchema,
  rewardPoints: rewardPointsSchema,
  saveToTaskBox: z.boolean({ error: "Save to task box must be on or off." }).optional(),
});

/** The fields the cross-field rules read, with every optional resolved once. */
interface TaskShape {
  routine: boolean;
  upForGrabs: boolean;
  trackHabit: boolean;
  assigneeIds: string[];
  startsOn: string | null;
  dueTime: string | null;
  timesOfDay: TimeOfDay[];
  repeat: TaskRepeatChoice;
}

function taskShapeOf(value: z.output<typeof taskObjectSchema>): TaskShape {
  return {
    routine: value.routine,
    upForGrabs: value.upForGrabs ?? false,
    trackHabit: value.trackHabit ?? false,
    assigneeIds: value.assigneeIds,
    startsOn: value.startsOn ?? null,
    dueTime: value.dueTime ?? null,
    timesOfDay: value.timesOfDay ?? [],
    repeat: value.repeat,
  };
}

const NEEDS_AN_ASSIGNEE = "Assign this to at least one Profile, or mark it Up for Grabs.";

/** FR-322 / FR-338 / FR-365: assigned to somebody, or to nobody on purpose. */
function assignmentIssues(task: TaskShape): FieldIssue[] {
  if (!task.upForGrabs) {
    return task.assigneeIds.length > 0 ? [] : [{ path: ["assigneeIds"], message: NEEDS_AN_ASSIGNEE }];
  }
  const issues: FieldIssue[] = [];
  if (task.assigneeIds.length > 0) {
    issues.push({
      path: ["upForGrabs"],
      message: "An Up for Grabs task belongs to nobody — clear its assignees first.",
    });
  }
  if (task.routine) {
    issues.push({ path: ["upForGrabs"], message: "Only a chore can be Up for Grabs." });
  }
  return issues;
}

/** FR-337: habit tracking is unrepresentable on a chore, not merely unoffered. */
function habitIssues(task: TaskShape): FieldIssue[] {
  if (!task.trackHabit || task.routine) return [];
  return [{ path: ["trackHabit"], message: "Track Habit is a routine's switch." }];
}

/** Non-empty, deduplicated and in canonical order, in one comparison. */
function isCanonicalSlotSet(slots: readonly TimeOfDay[]): boolean {
  const canonical = TIMES_OF_DAY.filter((slot) => slots.includes(slot));
  return canonical.length === slots.length && canonical.every((slot, index) => slot === slots[index]);
}

/** FR-333 / FR-335: a routine carries slots, a chore carries none. */
function slotIssues(task: TaskShape): FieldIssue[] {
  if (!task.routine) {
    if (task.timesOfDay.length === 0) return [];
    return [{ path: ["timesOfDay"], message: "Only a routine has times of day." }];
  }
  if (task.timesOfDay.length === 0) {
    return [{ path: ["timesOfDay"], message: "Pick at least one time of day." }];
  }
  if (isCanonicalSlotSet(task.timesOfDay)) return [];
  return [
    {
      path: ["timesOfDay"],
      message: "Pick each time of day once, in order: morning, afternoon, evening.",
    },
  ];
}

/** The two rule kinds a routine may repeat on (FR-334, Assumption 26). */
const ROUTINE_RULE_KINDS: readonly TaskRepeatChoice["kind"][] = ["daily", "weekly"];

/** FR-333: a routine has none of a chore's timing fields, and always repeats. */
function routineTimingIssues(task: TaskShape): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (task.dueTime !== null) {
    issues.push({ path: ["dueTime"], message: "A routine has no due time — it has times of day." });
  }
  if (task.startsOn === null) {
    issues.push({ path: ["startsOn"], message: "A routine needs a first day." });
  }
  if (!ROUTINE_RULE_KINDS.includes(task.repeat.kind)) {
    issues.push({
      path: ["repeat"],
      message: "A routine repeats every so many days, or on chosen weekdays.",
    });
  }
  return issues;
}

/** FR-325: Timed is a date AND a time; a time alone names no day. */
function choreTimingIssues(task: TaskShape): FieldIssue[] {
  if (task.dueTime === null || task.startsOn !== null) return [];
  return [{ path: ["dueTime"], message: "A due time needs a due date." }];
}

/**
 * FR-328 + FR-343: both repeat modes need an anchor — a rule needs a day to
 * walk from, a chain needs a seed — so an Anytime chore cannot repeat at all,
 * which is what 017's `task_repeat_needs_an_anchor` makes structural.
 */
function repeatAnchorIssues(task: TaskShape): FieldIssue[] {
  if (task.repeat.kind === "never" || task.startsOn !== null) return [];
  return [{ path: ["repeat"], message: "An Anytime chore has no date to repeat from." }];
}

function taskRepeatUntil(repeat: TaskRepeatChoice): string | null {
  return repeat.kind === "never" ? null : (repeat.until ?? null);
}

/**
 * FR-346's end date. `startsOn` and `until` are both household-local
 * `YYYY-MM-DD` already — unlike an event's instant start — so comparing them as
 * strings IS the household-zone local-date comparison, with no zone to consult.
 */
function repeatUntilIssues(task: TaskShape): FieldIssue[] {
  const until = taskRepeatUntil(task.repeat);
  if (until === null || task.startsOn === null || until >= task.startsOn) return [];
  return [{ path: ["repeat"], message: "The repeat can't end before the first date." }];
}

/**
 * Every cross-field rule, in one list, so `createTask` and a merged
 * `updateTask` patch (FR-318) can be judged by the same function rather than by
 * two that drift.
 */
function taskShapeIssues(task: TaskShape): FieldIssue[] {
  return [
    ...assignmentIssues(task),
    ...habitIssues(task),
    ...slotIssues(task),
    ...(task.routine ? routineTimingIssues(task) : choreTimingIssues(task)),
    ...repeatAnchorIssues(task),
    ...repeatUntilIssues(task),
  ];
}

export const taskInputSchema = taskObjectSchema.superRefine((value, ctx) => {
  for (const issue of taskShapeIssues(taskShapeOf(value))) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message, input: value });
  }
});

export type TaskInput = z.output<typeof taskInputSchema>;

/* ------------------------------------------------------------------------- *
 * The Task Box (Phase 3 — contracts/server-actions.md, "The Task Box")
 * ------------------------------------------------------------------------- */

/**
 * One template's whole content: FR-377's title, optional emoji and type, and
 * Phase 4's fourth field, the star value (004 FR-401). The object is strict, so
 * a description, a date, a repeat or an assignment is REFUSED rather than
 * quietly stripped.
 *
 * The edit path parses the MERGED template through this same schema rather
 * than a patch schema of its own, so FR-380's field list is one list that
 * cannot drift, and a refusal lands against its own top-level field.
 */
export const taskBoxItemSchema = z.strictObject({
  summary: summarySchema,
  emoji: taskEmojiSchema.nullable().optional(),
  routine: z.boolean({ error: "Choose chore or routine." }),
  rewardPoints: rewardPointsSchema,
});

export type TaskBoxItemInput = z.output<typeof taskBoxItemSchema>;

/* ------------------------------------------------------------------------- *
 * Rewards (Phase 4 — specs/004-family-rewards, contracts/server-actions.md)
 * ------------------------------------------------------------------------- */

const INVALID_ID = "Invalid id.";
const CHOOSE_A_PROFILE = "Choose at least one Profile.";
const COST_RANGE = "Cost must be a whole number from 1 to 500.";

/**
 * At least one Profile, each once (FR-415, FR-436). That each id IS a Profile
 * and not a Label needs the rows and is the action's check, backed by 024's
 * trigger (FR-414).
 */
function profileIdsSchema(missing: string) {
  return z
    .array(z.uuid({ error: INVALID_ID }), { error: missing })
    .min(1, { error: CHOOSE_A_PROFILE })
    .refine((ids) => new Set(ids).size === ids.length, {
      error: "Each Profile can appear only once.",
    });
}

/** FR-416: the reference's own bound, 1..500 — the same CHECK 024 carries. */
const pointValueSchema = z
  .number({ error: COST_RANGE })
  .int({ error: COST_RANGE })
  .min(1, { error: COST_RANGE })
  .max(500, { error: COST_RANGE });

/**
 * `RewardInput` (contracts → `createReward`). Strict: a balance, a progress
 * counter, a redemption date or any other star-shaped key a client invents is
 * refused rather than stripped — progress is derived (FR-420), never sent.
 */
export const rewardInputSchema = z.strictObject({
  name: summarySchema,
  description: longTextSchema("Description", 2000).nullable().optional(),
  emoji: taskEmojiSchema.nullable().optional(),
  pointValue: pointValueSchema,
  respawnOnRedemption: z.boolean({ error: "Renew after redeeming must be on or off." }),
  categoryIds: profileIdsSchema("Eligible Profiles must be a list of ids."),
});

export type RewardInput = z.output<typeof rewardInputSchema>;

/**
 * `updateReward`'s envelope. The patch is carried as bare keys and judged as
 * part of the MERGED reward by `validateRewardPatch` rather than field by field
 * here — `updateTask`'s discipline — so there is no second list of allowed
 * fields to drift from `rewardInputSchema`'s, and a refusal lands against its
 * own top-level field for the form to show.
 */
export const updateRewardSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z.record(z.string(), z.unknown(), { error: "That edit didn't look right." }),
});

/** The stored reward as the create form would have sent it. */
function rewardInputOf(reward: Reward): RewardInput {
  return {
    name: reward.name,
    description: reward.description,
    emoji: reward.emoji,
    pointValue: reward.pointValue,
    respawnOnRedemption: reward.respawnOnRedemption,
    categoryIds: reward.categoryIds,
  };
}

/**
 * Contracts §updateReward: the MERGED shape is validated through the create
 * schema, never the patch alone — which is what refuses a patch that empties
 * the eligible Profiles (FR-415) and one that invents a key. Throws field-keyed
 * `ActionFailure('VALIDATION')`.
 */
export function validateRewardPatch(existing: Reward, patch: Record<string, unknown>): RewardInput {
  return parseOrThrow(rewardInputSchema, { ...rewardInputOf(existing), ...patch });
}

export const deleteRewardSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  // FR-418: a confirmation that says it cannot be undone — a literal `true`,
  // so a missing flag is a refusal and not a default.
  confirm: z.literal(true, { error: "Deleting a reward can't be undone — confirm to delete it." }),
});

/**
 * `redeemReward` names the reward and the Profile and NOTHING else (FR-428):
 * the cost, the name and the day are copied from the stored reward by 026's
 * trigger, never trusted from the caller.
 */
export const redeemRewardSchema = z.strictObject({
  rewardId: z.uuid({ error: INVALID_ID }),
  categoryId: z.uuid({ error: INVALID_ID }),
});

export const unredeemRewardSchema = z.strictObject({
  redemptionId: z.uuid({ error: INVALID_ID }),
});

const AMOUNT_WHOLE = "Enter a whole number of stars.";
const AMOUNT_RANGE = "Stars must be between -500 and 500.";

/**
 * `adjustStars` (FR-434, FR-436): one whole amount, negative to take stars
 * away, −500…500 and never 0 — the same bound 025's `assert_star_adjustment`
 * carries. Whether any chosen Profile would end below zero needs the balances
 * and is the trigger's refusal (`P0004`), shown by the action per Profile.
 */
export const adjustStarsSchema = z.strictObject({
  categoryIds: profileIdsSchema("Profiles must be a list of ids."),
  amount: z
    .number({ error: AMOUNT_WHOLE })
    .int({ error: AMOUNT_WHOLE })
    .min(-500, { error: AMOUNT_RANGE })
    .max(500, { error: AMOUNT_RANGE })
    .refine((amount) => amount !== 0, { error: "Enter a number other than 0." }),
});

/* ------------------------------------------------------------------ lists -- */

const LIST_NAME_REQUIRED = "Name is required.";
const LIST_NAME_LONG = "Keep it under 120 characters.";
const ITEM_TEXT = "An item is 1 to 200 characters.";
const SECTION_NAME = "A section name is 1 to 60 characters.";
const CHOOSE_AN_ITEM = "Choose at least one item.";

/** FR-509: 1–120, trimmed — the same bound 028 carries. */
const listNameSchema = z
  .string({ error: LIST_NAME_REQUIRED })
  .trim()
  .min(1, { error: LIST_NAME_REQUIRED })
  .max(120, { error: LIST_NAME_LONG });

/** FR-510: the three types the device offers, in its order. */
export const listKindSchema = z.enum(["to_do", "grocery", "other"], {
  error: "Choose To do, Grocery or Other.",
});

/**
 * `ListInput` (contracts → `createList`). Strict: a count, a position or any other
 * derived key a client invents is refused rather than stripped.
 */
export const listInputSchema = z.strictObject({
  name: listNameSchema,
  kind: listKindSchema,
  color: paletteColorSchema,
  parentsOnly: z.boolean({ error: "Parents only must be on or off." }),
});

export type ListInput = z.output<typeof listInputSchema>;

/** `updateList`'s envelope — the patch is judged as the MERGED list (`updateReward`'s discipline). */
export const updateListSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z.record(z.string(), z.unknown(), { error: "That edit didn't look right." }),
});

/** The stored list as the create form would have sent it. */
function listInputOf(list: List): ListInput {
  return { name: list.name, kind: list.kind, color: list.color, parentsOnly: list.parentsOnly };
}

/** Contracts §updateList: the merged shape through the create schema; throws field-keyed `VALIDATION`. */
export function validateListPatch(existing: List, patch: Record<string, unknown>): ListInput {
  return parseOrThrow(listInputSchema, { ...listInputOf(existing), ...patch });
}

export const deleteListSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  // FR-512: a confirmation that names the count — a literal `true`, never a default.
  confirm: z.literal(true, { error: "Deleting a list can't be undone — confirm to delete it." }),
});

/** FR-517: an item is its text, 1–200 trimmed — 028's CHECK. */
export const listItemTextSchema = z
  .string({ error: ITEM_TEXT })
  .trim()
  .min(1, { error: ITEM_TEXT })
  .max(200, { error: ITEM_TEXT });

/** FR-528: a section name, 1–60 trimmed — 028's CHECK; the case-insensitive match is the action's. */
export const sectionNameSchema = z
  .string({ error: SECTION_NAME })
  .trim()
  .min(1, { error: SECTION_NAME })
  .max(60, { error: SECTION_NAME });

export const addListItemSchema = z.strictObject({
  listId: z.uuid({ error: INVALID_ID }),
  text: listItemTextSchema,
});

/** `updateListItem`: the text, the section (a name, or null for ungrouped), or both. */
export const updateListItemSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z
    .strictObject({
      text: listItemTextSchema.optional(),
      section: sectionNameSchema.nullable().optional(),
    })
    .refine((patch) => patch.text !== undefined || patch.section !== undefined, {
      error: "Nothing to change.",
    }),
});

export const setListItemCheckedSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  checked: z.boolean({ error: "Checked must be on or off." }),
});

/** `moveListItem` (R502): the two neighbours and the section, as `dropOf` computed them. */
export const moveListItemSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  previousItemId: z.uuid({ error: INVALID_ID }).nullable(),
  nextItemId: z.uuid({ error: INVALID_ID }).nullable(),
  section: sectionNameSchema.nullable(),
});

export const deleteListItemSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
});

export const clearCompletedSchema = z.strictObject({
  listId: z.uuid({ error: INVALID_ID }),
  confirm: z.literal(true, {
    error: "Clearing completed items can't be undone — confirm to clear them.",
  }),
});

/** FR-528: Add section / Move items — a name and at least one item, each once. */
export const sectionItemsSchema = z.strictObject({
  listId: z.uuid({ error: INVALID_ID }),
  name: sectionNameSchema,
  itemIds: z
    .array(z.uuid({ error: INVALID_ID }), { error: "Items must be a list of ids." })
    .min(1, { error: CHOOSE_AN_ITEM })
    .refine((ids) => new Set(ids).size === ids.length, { error: "Each item can appear only once." }),
});

export const renameSectionSchema = z.strictObject({
  listId: z.uuid({ error: INVALID_ID }),
  from: sectionNameSchema,
  to: sectionNameSchema,
});

export const removeSectionSchema = z.strictObject({
  listId: z.uuid({ error: INVALID_ID }),
  name: sectionNameSchema,
});

/* ------------------------------------------------------------------ meals -- */

const MEALTIME_NAME = "A mealtime name is 1 to 40 characters.";
const RECIPE_NAME = "A recipe name is 1 to 120 characters.";
const RECIPE_TEXT = "Keep the recipe under 10 000 characters.";
const MEAL_NOTE = "Keep the note under 200 characters.";
const MEAL_DATE = "Choose a date.";
const SCOPE_FOR_SERIES = "Choose a scope for a repeating meal.";
const SERIES_ONLY = "A recipe can only change for the whole series.";
const CHOOSE_A_MEALTIME = "Choose a mealtime.";
const CHOOSE_A_RECIPE = "Choose a recipe, or type a new entry.";

/** FR-610: 1–40, trimmed — 030's CHECK; uniqueness is the index's, mapped to a field error. */
export const mealtimeNameSchema = z
  .string({ error: MEALTIME_NAME })
  .trim()
  .min(1, { error: MEALTIME_NAME })
  .max(40, { error: MEALTIME_NAME });

/** `updateMealCategory`: the name, the colour, or both (FR-610, FR-612). */
export const updateMealCategorySchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z
    .strictObject({
      name: mealtimeNameSchema.optional(),
      color: paletteColorSchema.optional(),
    })
    .refine((patch) => patch.name !== undefined || patch.color !== undefined, { error: "Nothing to change." }),
});

/** FR-613: 1–120, trimmed — 031's CHECK. */
const recipeNameSchema = z
  .string({ error: RECIPE_NAME })
  .trim()
  .min(1, { error: RECIPE_NAME })
  .max(120, { error: RECIPE_NAME });

/** FR-613: the one free text, up to 10 000 — 031's CHECK. Not trimmed: line breaks are the content. */
export const recipeTextSchema = z.string({ error: RECIPE_TEXT }).max(10_000, { error: RECIPE_TEXT });

export const createRecipeSchema = z.strictObject({
  name: recipeNameSchema,
  categoryId: z.uuid({ error: CHOOSE_A_MEALTIME }),
  text: recipeTextSchema.optional(),
});

export const updateRecipeSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z
    .strictObject({
      name: recipeNameSchema.optional(),
      categoryId: z.uuid({ error: CHOOSE_A_MEALTIME }).optional(),
      text: recipeTextSchema.optional(),
    })
    .refine((patch) => Object.values(patch).some((value) => value !== undefined), { error: "Nothing to change." }),
});

/** FR-616: the two choices, and a confirmation that is a literal `true`. */
export const deleteRecipeSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  mode: z.enum(["recipe", "recipe_and_meals"], { error: "Choose what to delete." }),
  confirm: z.literal(true, { error: "Deleting a recipe can't be undone — confirm to delete it." }),
});

/** FR-624: up to 200, trimmed; an empty note is no note. */
export const mealNoteSchema = z
  .string({ error: MEAL_NOTE })
  .trim()
  .max(200, { error: MEAL_NOTE })
  .transform((note) => (note === "" ? null : note));

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const mealDateSchema = z.string({ error: MEAL_DATE }).regex(LOCAL_DATE, { error: MEAL_DATE });

/** FR-622: an existing recipe, or a new entry that also becomes one. */
export const recipeChoiceSchema = z.discriminatedUnion(
  "kind",
  [
    z.strictObject({ kind: z.literal("existing"), id: z.uuid({ error: CHOOSE_A_RECIPE }) }),
    z.strictObject({ kind: z.literal("new"), name: recipeNameSchema, text: recipeTextSchema.optional() }),
  ],
  { error: CHOOSE_A_RECIPE },
);

export const planMealSchema = z.strictObject({
  date: mealDateSchema,
  categoryId: z.uuid({ error: CHOOSE_A_MEALTIME }),
  recipe: recipeChoiceSchema,
  note: mealNoteSchema.optional(),
  repeat: repeatChoiceSchema.optional(),
});

export type PlanMealInput = z.output<typeof planMealSchema>;

const mealScopeSchema = z.enum(["this", "this_and_future", "all"], { error: SCOPE_FOR_SERIES });

/**
 * `updateMeal` (FR-626, FR-629, FR-630): `occurrenceDate` names the occurrence;
 * `scope` is required for a series and refused for a one-off — but only the
 * action knows which, so the schema checks the one rule it can: at `this` the
 * recipe and the repeat are not on offer.
 */
export const updateMealSchema = z
  .strictObject({
    id: z.uuid({ error: INVALID_ID }),
    occurrenceDate: mealDateSchema,
    scope: mealScopeSchema.optional(),
    patch: z
      .strictObject({
        date: mealDateSchema.optional(),
        categoryId: z.uuid({ error: CHOOSE_A_MEALTIME }).optional(),
        note: mealNoteSchema.nullable().optional(),
        recipeId: z.uuid({ error: CHOOSE_A_RECIPE }).optional(),
        repeat: repeatChoiceSchema.optional(),
      })
      .refine((patch) => Object.values(patch).some((value) => value !== undefined), { error: "Nothing to change." }),
  })
  .superRefine((input, ctx) => {
    if (input.scope !== "this") return;
    if (input.patch.recipeId !== undefined) {
      ctx.addIssue({ code: "custom", path: ["patch", "recipeId"], message: SERIES_ONLY });
    }
    if (input.patch.repeat !== undefined) {
      ctx.addIssue({ code: "custom", path: ["patch", "repeat"], message: SERIES_ONLY });
    }
  });

export type UpdateMealInput = z.output<typeof updateMealSchema>;

export const deleteMealSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  occurrenceDate: mealDateSchema,
  scope: mealScopeSchema.optional(),
  confirm: z.literal(true, { error: "Deleting a meal can't be undone — confirm to delete it." }),
});

/** `addListItems` (FR-632): the chosen lines, each an item's text, one write. */
export const addListItemsSchema = z.strictObject({
  listId: z.uuid({ error: INVALID_ID }),
  texts: z
    .array(listItemTextSchema, { error: "Choose at least one line." })
    .min(1, { error: "Choose at least one line." })
    .max(200, { error: "Add at most 200 lines at once." }),
});

/** The one message the action maps a taken mealtime name to (FR-610). */
export const MEALTIME_NAME_TAKEN = "That name is already used.";
