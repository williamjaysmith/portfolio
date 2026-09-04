import { describe, expect, it } from "vitest";

import { repeatChoiceOf } from "@/lib/family/calendar/expand";

/**
 * T050 — the one reader that turns stored rule text back into the form's
 * structured `RepeatChoice` (FR-231/232), behind the sealed expansion
 * module so no component ever parses a rule. `until` is read as the
 * household-local date it admits — the expander's own reading — so the
 * details view and the edit form agree with the grid about when a series
 * ends.
 */

const ZONE = "America/Chicago";

describe("repeatChoiceOf", () => {
  it("reads a null rule as never", () => {
    expect(repeatChoiceOf(null, ZONE)).toEqual({ kind: "never" });
  });

  it("reads a daily rule without an end as an endless daily", () => {
    expect(repeatChoiceOf("FREQ=DAILY;INTERVAL=1", ZONE)).toEqual({ kind: "daily", until: null });
  });

  it("reads a weekly rule's weekdays and its instant UNTIL as the household-local date", () => {
    // 2026-12-15 23:59:59 in Chicago (CST, UTC-6) is 2026-12-16T05:59:59Z.
    expect(
      repeatChoiceOf("FREQ=WEEKLY;INTERVAL=1;UNTIL=20261216T055959Z;WKST=SU;BYDAY=TU,TH", ZONE),
    ).toEqual({ kind: "weekly", weekdays: ["TU", "TH"], until: "2026-12-15" });
  });

  it("reads an all-day series' plain-date UNTIL verbatim", () => {
    expect(repeatChoiceOf("FREQ=DAILY;INTERVAL=1;UNTIL=20261215", ZONE)).toEqual({
      kind: "daily",
      until: "2026-12-15",
    });
  });

  it("reads a monthly rule as monthly, dropping the derived BYMONTHDAY", () => {
    expect(repeatChoiceOf("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15", ZONE)).toEqual({
      kind: "monthly",
      until: null,
    });
  });
});
