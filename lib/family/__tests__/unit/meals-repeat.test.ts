import { describe, expect, it } from "vitest";

import { ActionFailure } from "@/lib/family/errors";
import { assertMealRuleReachable, mealRepeatChoiceOf, mealRuleOf, reanchoredMealRule, truncatedMealRule  } from "@/lib/family/meals/repeat";

/**
 * 006 T020 — a meal's repeat as the calendar's rule (FR-627, FR-628, R602):
 * the four choices emitted through the engine's grammar with a date UNTIL,
 * the round trip back to a choice, and the head of a split ending the day
 * before the cut.
 */

describe("mealRuleOf", () => {
  it("is null for Never", () => {
    expect(mealRuleOf({ kind: "never" }, "2026-09-11", 0)).toBeNull();
  });

  it("emits daily, weekly (with the household's week start) and monthly on the date's day", () => {
    expect(mealRuleOf({ kind: "daily" }, "2026-09-11", 0)).toBe("FREQ=DAILY;INTERVAL=1");
    expect(mealRuleOf({ kind: "weekly", weekdays: ["FR"] }, "2026-09-11", 0)).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR");
    expect(mealRuleOf({ kind: "weekly", weekdays: ["MO", "FR"] }, "2026-09-11", 1)).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,FR");
    expect(mealRuleOf({ kind: "monthly" }, "2026-09-11", 0)).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=11");
  });

  it("carries the end as a date UNTIL, never an instant, and refuses one before the date", () => {
    expect(mealRuleOf({ kind: "weekly", weekdays: ["FR"], until: "2026-12-31" }, "2026-09-11", 0)).toBe(
      "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231;WKST=SU;BYDAY=FR",
    );
    expect(mealRuleOf({ kind: "daily", until: "" }, "2026-09-11", 0)).toBe("FREQ=DAILY;INTERVAL=1");
    expect(() => mealRuleOf({ kind: "daily", until: "2026-09-10" }, "2026-09-11", 0)).toThrow(ActionFailure);
    try {
      mealRuleOf({ kind: "monthly", until: "2026-09-10" }, "2026-09-11", 0);
    } catch (error) {
      expect((error as ActionFailure).fieldErrors).toEqual({ repeat: ["The repeat can't end before the meal's date."] });
    }
  });

  it("refuses a weekly repeat with no weekday", () => {
    expect(() => mealRuleOf({ kind: "weekly", weekdays: [] }, "2026-09-11", 0)).toThrow("Choose at least one weekday.");
  });
});

describe("mealRepeatChoiceOf", () => {
  it("reads every emitted rule back as its choice", () => {
    expect(mealRepeatChoiceOf(null)).toEqual({ kind: "never" });
    expect(mealRepeatChoiceOf("FREQ=DAILY;INTERVAL=1")).toEqual({ kind: "daily", until: null });
    expect(mealRepeatChoiceOf("FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231;WKST=SU;BYDAY=MO,FR")).toEqual({
      kind: "weekly",
      weekdays: ["MO", "FR"],
      until: "2026-12-31",
    });
    expect(mealRepeatChoiceOf("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=11")).toEqual({ kind: "monthly", until: null });
  });
});

describe("truncatedMealRule", () => {
  it("ends the head the day before the cut", () => {
    expect(truncatedMealRule("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR", "2026-09-25")).toBe(
      "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260924;WKST=SU;BYDAY=FR",
    );
    expect(truncatedMealRule("FREQ=DAILY;INTERVAL=1;UNTIL=20261231", "2026-10-01")).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20260930");
  });

  it("leaves a rule that already ends before the cut as it is", () => {
    expect(truncatedMealRule("FREQ=DAILY;INTERVAL=1;UNTIL=20260920", "2026-10-01")).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20260920");
  });
});

describe("reanchoredMealRule", () => {
  it("moves a monthly rule to the new date's day and leaves a daily rule alone", () => {
    expect(reanchoredMealRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=11", "2026-09-11", "2026-10-03")).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=3");
    expect(reanchoredMealRule("FREQ=DAILY;INTERVAL=1;UNTIL=20261231", "2026-09-11", "2026-10-03")).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20261231");
  });

  it("shifts a weekly rule's days by the move, so a Wednesday series moved to Thursday is a Thursday series (FR-629)", () => {
    expect(reanchoredMealRule("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE", "2026-09-23", "2026-09-24")).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TH");
    expect(reanchoredMealRule("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=MO,FR", "2026-09-11", "2026-09-10")).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=SU,TH");
    expect(reanchoredMealRule("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR", "2026-09-11", "2026-09-25")).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR");
  });
});

describe("assertMealRuleReachable", () => {
  it("refuses a rule that ends before its anchor, at the repeat field, and passes the rest", () => {
    expect(() => assertMealRuleReachable("FREQ=DAILY;INTERVAL=1;UNTIL=20260910", "2026-09-11")).toThrow("The repeat can't end before the meal starts.");
    expect(() => assertMealRuleReachable("FREQ=DAILY;INTERVAL=1;UNTIL=20260911", "2026-09-11")).not.toThrow();
    expect(() => assertMealRuleReachable("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR", "2026-09-11")).not.toThrow();
    expect(() => assertMealRuleReachable(null, "2026-09-11")).not.toThrow();
  });
});
