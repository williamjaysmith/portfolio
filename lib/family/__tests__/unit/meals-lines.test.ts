import { describe, expect, it } from "vitest";

import { ITEM_TEXT_LIMIT, linesOf } from "@/lib/family/meals/lines";

/** 006 T022 — a recipe's text as list lines (FR-631–FR-633, R610). */

describe("linesOf", () => {
  it("splits on any line break, trims, and drops blank lines", () => {
    expect(linesOf("500 g spaghetti\r\n  1 onion \n\n\r2 cloves garlic\n").map((line) => line.text)).toEqual([
      "500 g spaghetti",
      "1 onion",
      "2 cloves garlic",
    ]);
  });

  it("marks and cuts a line longer than an item", () => {
    const long = "x".repeat(ITEM_TEXT_LIMIT + 5);
    const [cut, kept] = linesOf(`${long}\nshort`);
    expect(cut).toEqual({ text: "x".repeat(ITEM_TEXT_LIMIT), truncated: true });
    expect(kept).toEqual({ text: "short", truncated: false });
  });

  it("is empty for an empty or whitespace-only text", () => {
    expect(linesOf("")).toEqual([]);
    expect(linesOf("  \n\n  ")).toEqual([]);
  });
});
