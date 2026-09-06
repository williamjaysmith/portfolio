import { describe, expect, it } from "vitest";

import { dietaryNotesOf } from "@/lib/family/meals/dietary";

/** 006 T025 — the notes shown while planning (FR-638): non-blank, Profiles only, in order. */

describe("dietaryNotesOf", () => {
  it("lists every Profile with a note as Name: note, trimmed, in the household's order", () => {
    expect(
      dietaryNotesOf([
        { label: "Ana", isProfile: true, dietaryPrefs: null },
        { label: "Cleo", isProfile: true, dietaryPrefs: "  no nuts " },
        { label: "Bin day", isProfile: false, dietaryPrefs: "ignored" },
        { label: "Ben", isProfile: true, dietaryPrefs: "   " },
        { label: "Kit", isProfile: true, dietaryPrefs: "dairy-free" },
      ]),
    ).toEqual([
      { name: "Cleo", note: "no nuts" },
      { name: "Kit", note: "dairy-free" },
    ]);
  });

  it("is empty when nobody has one", () => {
    expect(dietaryNotesOf([{ label: "Ana", isProfile: true, dietaryPrefs: null }])).toEqual([]);
  });
});
