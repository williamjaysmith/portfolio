import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  categoryInputSchema,
  categoryPatchSchema,
  fieldErrors,
  paletteColorSchema,
  parseOrThrow,
  pinSchema,
  reorderSchema,
  settingsPatchSchema,
  validateCategoryPatch,
} from "@/lib/family/validation";
import { ActionFailure } from "@/lib/family/errors";
import type {
  Category,
  CategoryInput,
  CategoryPatch,
  HouseholdSettingsPatch,
} from "@/lib/family/types";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: UUID_A,
    householdId: UUID_B,
    label: "Existing",
    color: "#FDC36D",
    isProfile: true,
    avatarKind: null,
    avatarId: null,
    avatarPath: null,
    birthday: null,
    dietaryPrefs: null,
    role: "member",
    userId: null,
    emoji: null,
    showOnTasks: true,
    sortOrder: 1000,
    hasPin: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...value };
  delete copy[key];
  return copy as Omit<T, K>;
}

const existingProfile = makeCategory();
const existingLabel = makeCategory({ isProfile: false, label: "Holidays", emoji: "🎉" });

function failurePaths(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

/** Throws unless `fn` throws an ActionFailure('VALIDATION'); returns it for further assertions. */
function expectValidationFailure(fn: () => unknown): ActionFailure {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ActionFailure);
  const failure = caught as ActionFailure;
  expect(failure.code).toBe("VALIDATION");
  return failure;
}

describe("pinSchema", () => {
  it("accepts exactly four digits", () => {
    expect(pinSchema.safeParse("1234").success).toBe(true);
    expect(pinSchema.safeParse("0000").success).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["123", "12345", "12a4", " 1234", "1234 ", "", "١٢٣٤"]) {
      expect(pinSchema.safeParse(bad).success, bad).toBe(false);
    }
    expect(pinSchema.safeParse(1234).success).toBe(false);
  });
});

describe("paletteColorSchema", () => {
  it("normalises then checks the palette", () => {
    expect(paletteColorSchema.parse("#fdc36d")).toBe("#FDC36D");
    expect(paletteColorSchema.parse("  #d5b6ec ")).toBe("#D5B6EC");
  });

  it("rejects off-palette and empty values", () => {
    expect(paletteColorSchema.safeParse("#FFFFFF").success).toBe(false);
    expect(paletteColorSchema.safeParse("").success).toBe(false);
    expect(paletteColorSchema.safeParse(0xfdc36d).success).toBe(false);
  });
});

describe("categoryInputSchema — profiles", () => {
  const profile = {
    label: "  Will ",
    color: "#fdc36d",
    isProfile: true,
    avatar: { kind: "illustration", id: "fox" },
    birthday: "1990-05-04",
    dietaryPrefs: "No peanuts",
    role: "parent",
    showOnTasks: true,
  };

  it("accepts a full profile and normalises label and colour", () => {
    const parsed: CategoryInput = parseOrThrow(categoryInputSchema, profile);
    expect(parsed).toEqual({
      label: "Will",
      color: "#FDC36D",
      isProfile: true,
      avatar: { kind: "illustration", id: "fox" },
      birthday: "1990-05-04",
      dietaryPrefs: "No peanuts",
      role: "parent",
      showOnTasks: true,
    });
  });

  it("accepts the minimal profile", () => {
    expect(
      categoryInputSchema.safeParse({ label: "Kid", color: "#2178AF", isProfile: true }).success,
    ).toBe(true);
  });

  it("accepts null person fields", () => {
    const result = categoryInputSchema.safeParse({
      ...profile,
      avatar: null,
      birthday: null,
      dietaryPrefs: null,
      emoji: null,
    });
    expect(result.success).toBe(true);
  });

  it("strips unknown keys", () => {
    const parsed = parseOrThrow(categoryInputSchema, { ...profile, userId: UUID_A, hasPin: true });
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("hasPin");
  });

  it("rejects an emoji on a profile", () => {
    expect(failurePaths(categoryInputSchema, { ...profile, emoji: "🦊" })).toEqual(["emoji"]);
  });

  it("rejects an unknown avatar id", () => {
    expect(failurePaths(categoryInputSchema, { ...profile, avatar: { kind: "illustration", id: "unicorn" } })).toEqual([
      "avatar.id",
    ]);
  });

  it("rejects a photo avatar through this input", () => {
    expect(failurePaths(categoryInputSchema, { ...profile, avatar: { kind: "photo", id: "fox" } })).toContain(
      "avatar.kind",
    );
  });

  it("rejects a birthday that is not an ISO date", () => {
    expect(failurePaths(categoryInputSchema, { ...profile, birthday: "2020-13-45" })).toEqual(["birthday"]);
    expect(failurePaths(categoryInputSchema, { ...profile, birthday: "04/05/1990" })).toEqual(["birthday"]);
    expect(failurePaths(categoryInputSchema, { ...profile, birthday: "1990-05-04T00:00:00Z" })).toEqual([
      "birthday",
    ]);
  });

  it("caps dietary notes at 280 characters and maps empty to null", () => {
    expect(categoryInputSchema.safeParse({ ...profile, dietaryPrefs: "x".repeat(280) }).success).toBe(true);
    expect(failurePaths(categoryInputSchema, { ...profile, dietaryPrefs: "x".repeat(281) })).toEqual([
      "dietaryPrefs",
    ]);
    expect(parseOrThrow(categoryInputSchema, { ...profile, dietaryPrefs: "" }).dietaryPrefs).toBeNull();
    expect(parseOrThrow(categoryInputSchema, { ...profile, dietaryPrefs: "   " }).dietaryPrefs).toBeNull();
  });

  it("requires a trimmed label of 1–40 characters", () => {
    expect(failurePaths(categoryInputSchema, { ...profile, label: "" })).toEqual(["label"]);
    expect(failurePaths(categoryInputSchema, { ...profile, label: "   " })).toEqual(["label"]);
    expect(failurePaths(categoryInputSchema, { ...profile, label: "x".repeat(41) })).toEqual(["label"]);
    expect(categoryInputSchema.safeParse({ ...profile, label: "x".repeat(40) }).success).toBe(true);
    expect(categoryInputSchema.safeParse({ ...profile, label: ` ${"x".repeat(40)} ` }).success).toBe(true);
  });

  it("requires a palette colour", () => {
    expect(failurePaths(categoryInputSchema, { ...profile, color: "#ABCDEF" })).toEqual(["color"]);
    expect(failurePaths(categoryInputSchema, without(profile, "color"))).toEqual(["color"]);
  });

  it("requires isProfile and a valid role", () => {
    expect(failurePaths(categoryInputSchema, without(profile, "isProfile"))).toEqual(["isProfile"]);
    expect(failurePaths(categoryInputSchema, { ...profile, role: "admin" })).toEqual(["role"]);
  });
});

describe("categoryInputSchema — labels", () => {
  const label = { label: "Holidays", color: "#F66951", isProfile: false, emoji: "🎉" };

  it("accepts a label with an emoji and no person fields", () => {
    const parsed = parseOrThrow(categoryInputSchema, label);
    expect(parsed).toEqual(label);
  });

  it("accepts a label with role member, or with role omitted", () => {
    expect(categoryInputSchema.safeParse({ ...label, role: "member" }).success).toBe(true);
    expect(categoryInputSchema.safeParse({ label: "Chores", color: "#F66951", isProfile: false }).success).toBe(true);
  });

  it("accepts null person fields on a label", () => {
    expect(
      categoryInputSchema.safeParse({ ...label, avatar: null, birthday: null, dietaryPrefs: null }).success,
    ).toBe(true);
  });

  it("trims the emoji and allows up to 8 code points", () => {
    expect(parseOrThrow(categoryInputSchema, { ...label, emoji: " 🦊 " }).emoji).toBe("🦊");
    // A ZWJ family sequence is 5 code points (8 UTF-16 units) — it must fit.
    expect(categoryInputSchema.safeParse({ ...label, emoji: "👨‍👩‍👧" }).success).toBe(true);
    expect(categoryInputSchema.safeParse({ ...label, emoji: "🦊".repeat(8) }).success).toBe(true);
  });

  it("rejects an empty or over-long emoji", () => {
    expect(failurePaths(categoryInputSchema, { ...label, emoji: "" })).toEqual(["emoji"]);
    expect(failurePaths(categoryInputSchema, { ...label, emoji: "   " })).toEqual(["emoji"]);
    expect(failurePaths(categoryInputSchema, { ...label, emoji: "🦊".repeat(9) })).toEqual(["emoji"]);
    expect(failurePaths(categoryInputSchema, { ...label, emoji: "party time" })).toEqual(["emoji"]);
  });

  it("rejects person fields on a label", () => {
    expect(failurePaths(categoryInputSchema, { ...label, avatar: { kind: "illustration", id: "fox" } })).toEqual([
      "avatar",
    ]);
    expect(failurePaths(categoryInputSchema, { ...label, birthday: "2020-01-01" })).toEqual(["birthday"]);
    expect(failurePaths(categoryInputSchema, { ...label, dietaryPrefs: "Vegan" })).toEqual(["dietaryPrefs"]);
    expect(failurePaths(categoryInputSchema, { ...label, role: "parent" })).toEqual(["role"]);
  });

  it("reports every offending person field at once", () => {
    const paths = failurePaths(categoryInputSchema, {
      ...label,
      avatar: { kind: "illustration", id: "fox" },
      birthday: "2020-01-01",
      dietaryPrefs: "Vegan",
      role: "parent",
    });
    expect(paths.sort()).toEqual(["avatar", "birthday", "dietaryPrefs", "role"]);
  });
});

describe("categoryPatchSchema", () => {
  it("accepts an empty patch", () => {
    expect(categoryPatchSchema.safeParse({}).success).toBe(true);
  });

  it("normalises the fields it receives", () => {
    const parsed: CategoryPatch = parseOrThrow(categoryPatchSchema, {
      label: " New ",
      color: "#2178af",
      dietaryPrefs: "",
    });
    expect(parsed).toEqual({ label: "New", color: "#2178AF", dietaryPrefs: null });
  });

  it("never lets isProfile through", () => {
    const parsed = parseOrThrow(categoryPatchSchema, { isProfile: false, label: "X" });
    expect(parsed).toEqual({ label: "X" });
  });

  it("still validates each field", () => {
    expect(failurePaths(categoryPatchSchema, { color: "bad" })).toEqual(["color"]);
    expect(failurePaths(categoryPatchSchema, { label: "" })).toEqual(["label"]);
    expect(failurePaths(categoryPatchSchema, { avatar: { kind: "illustration", id: "dragon" } })).toEqual([
      "avatar.id",
    ]);
  });
});

describe("validateCategoryPatch", () => {
  it("returns the normalised patch for a valid profile change", () => {
    expect(validateCategoryPatch(existingProfile, { birthday: "2020-01-01", label: " Kid " })).toEqual({
      birthday: "2020-01-01",
      label: "Kid",
    });
  });

  it("returns the normalised patch for a valid label change", () => {
    expect(validateCategoryPatch(existingLabel, { label: "Holidays ", emoji: "🎄" })).toEqual({
      label: "Holidays",
      emoji: "🎄",
    });
  });

  it("accepts an empty patch on either kind", () => {
    expect(validateCategoryPatch(existingProfile, {})).toEqual({});
    expect(validateCategoryPatch(existingLabel, {})).toEqual({});
  });

  it("accepts clearing a field", () => {
    expect(validateCategoryPatch(existingProfile, { avatar: null })).toEqual({ avatar: null });
    expect(validateCategoryPatch(existingLabel, { emoji: null })).toEqual({ emoji: null });
  });

  it("does not trip over person fields the profile already has", () => {
    const withAvatar = makeCategory({
      avatarKind: "illustration",
      avatarId: "fox",
      birthday: "1990-05-04",
      dietaryPrefs: "None",
      role: "parent",
    });
    expect(validateCategoryPatch(withAvatar, { label: "Dad" })).toEqual({ label: "Dad" });
  });

  it("refuses to sneak a birthday onto a label", () => {
    const failure = expectValidationFailure(() => validateCategoryPatch(existingLabel, { birthday: "2020-01-01" }));
    expect(failure.fieldErrors).toHaveProperty("birthday");
  });

  it("refuses an avatar, dietary notes or a parent role on a label", () => {
    expect(
      expectValidationFailure(() =>
        validateCategoryPatch(existingLabel, { avatar: { kind: "illustration", id: "fox" } }),
      ).fieldErrors,
    ).toHaveProperty("avatar");
    expect(
      expectValidationFailure(() => validateCategoryPatch(existingLabel, { dietaryPrefs: "Vegan" })).fieldErrors,
    ).toHaveProperty("dietaryPrefs");
    expect(
      expectValidationFailure(() => validateCategoryPatch(existingLabel, { role: "parent" })).fieldErrors,
    ).toHaveProperty("role");
  });

  it("allows an explicit member role on a label", () => {
    expect(validateCategoryPatch(existingLabel, { role: "member" })).toEqual({ role: "member" });
  });

  it("refuses an emoji on a profile", () => {
    const failure = expectValidationFailure(() => validateCategoryPatch(existingProfile, { emoji: "🦊" }));
    expect(failure.fieldErrors).toHaveProperty("emoji");
  });

  it("rejects a malformed patch before merging", () => {
    expectValidationFailure(() => validateCategoryPatch(existingProfile, { color: "#123456" }));
    expectValidationFailure(() => validateCategoryPatch(existingProfile, "nope"));
    expectValidationFailure(() => validateCategoryPatch(existingProfile, null));
  });
});

describe("settingsPatchSchema", () => {
  it("requires at least one key", () => {
    expect(settingsPatchSchema.safeParse({}).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ householdName: undefined }).success).toBe(false);
  });

  it("accepts a full patch typed as HouseholdSettingsPatch", () => {
    const parsed: HouseholdSettingsPatch = parseOrThrow(settingsPatchSchema, {
      householdName: "  The Smiths ",
      showNameNotDate: false,
      timeFormat: "24h",
      startWeekOn: 1,
      punchOutMinutes: 5,
      textSize: "large",
      density: "cozy",
    });
    expect(parsed).toEqual({
      householdName: "The Smiths",
      showNameNotDate: false,
      timeFormat: "24h",
      startWeekOn: 1,
      punchOutMinutes: 5,
      textSize: "large",
      density: "cozy",
    });
  });

  it("bounds the household name to 1–60 trimmed characters", () => {
    expect(failurePaths(settingsPatchSchema, { householdName: "   " })).toEqual(["householdName"]);
    expect(failurePaths(settingsPatchSchema, { householdName: "x".repeat(61) })).toEqual(["householdName"]);
    expect(settingsPatchSchema.safeParse({ householdName: "x".repeat(60) }).success).toBe(true);
  });

  it("bounds punch-out minutes to whole numbers 1–60", () => {
    for (const bad of [0, 61, 2.5, -1, "5", Number.NaN]) {
      expect(failurePaths(settingsPatchSchema, { punchOutMinutes: bad })).toEqual(["punchOutMinutes"]);
    }
    expect(settingsPatchSchema.safeParse({ punchOutMinutes: 1 }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ punchOutMinutes: 60 }).success).toBe(true);
  });

  it("only allows the known enum values", () => {
    expect(failurePaths(settingsPatchSchema, { timeFormat: "13h" })).toEqual(["timeFormat"]);
    expect(failurePaths(settingsPatchSchema, { startWeekOn: 2 })).toEqual(["startWeekOn"]);
    expect(failurePaths(settingsPatchSchema, { startWeekOn: "0" })).toEqual(["startWeekOn"]);
    expect(failurePaths(settingsPatchSchema, { textSize: "huge" })).toEqual(["textSize"]);
    expect(failurePaths(settingsPatchSchema, { density: "packed" })).toEqual(["density"]);
    expect(failurePaths(settingsPatchSchema, { showNameNotDate: "yes" })).toEqual(["showNameNotDate"]);
    expect(settingsPatchSchema.safeParse({ startWeekOn: 0 }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ timeFormat: "12h", textSize: "small", density: "snug" }).success).toBe(
      true,
    );
  });
});

describe("reorderSchema", () => {
  it("accepts a non-empty list of distinct uuids", () => {
    expect(reorderSchema.parse([UUID_A, UUID_B])).toEqual([UUID_A, UUID_B]);
  });

  it("rejects an empty list", () => {
    expect(reorderSchema.safeParse([]).success).toBe(false);
  });

  it("rejects duplicates", () => {
    expect(reorderSchema.safeParse([UUID_A, UUID_A]).success).toBe(false);
  });

  it("rejects non-uuid entries", () => {
    expect(failurePaths(reorderSchema, [UUID_A, "not-a-uuid"])).toEqual(["1"]);
    expect(reorderSchema.safeParse("not-an-array").success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("maps each failing top-level field to its messages", () => {
    const result = categoryInputSchema.safeParse({ label: "", color: "bad", isProfile: true });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual(["color", "label"]);
    expect(errors.label).toHaveLength(1);
    expect(typeof errors.label[0]).toBe("string");
  });

  it("keys nested issues by their top-level field", () => {
    const result = categoryInputSchema.safeParse({
      label: "Kid",
      color: "#2178AF",
      isProfile: true,
      avatar: { kind: "illustration", id: "dragon" },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(fieldErrors(result.error))).toEqual(["avatar"]);
  });

  it("returns an empty object when only form-level issues exist", () => {
    const result = settingsPatchSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({});
  });
});

describe("parseOrThrow", () => {
  it("returns the parsed value on success", () => {
    expect(parseOrThrow(pinSchema, "1234")).toBe("1234");
  });

  it("throws ActionFailure('VALIDATION') carrying field errors", () => {
    const failure = expectValidationFailure(() =>
      parseOrThrow(categoryInputSchema, { label: "", color: "#2178AF", isProfile: true }),
    );
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe("ActionFailure");
    expect(failure.message.length).toBeGreaterThan(0);
    expect(failure.fieldErrors).toEqual({ label: [failure.message] });
  });

  it("uses the form-level message when no field is to blame", () => {
    const failure = expectValidationFailure(() => parseOrThrow(settingsPatchSchema, {}));
    expect(failure.fieldErrors).toEqual({});
    expect(failure.message.length).toBeGreaterThan(0);
  });

  it("never throws a raw ZodError", () => {
    let caught: unknown;
    try {
      parseOrThrow(reorderSchema, []);
    } catch (error) {
      caught = error;
    }
    expect(caught).not.toBeInstanceOf(z.ZodError);
    expect(caught).toBeInstanceOf(ActionFailure);
  });
});
