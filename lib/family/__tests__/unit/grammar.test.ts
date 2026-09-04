import { describe, expect, it } from "vitest";
import {
  emitRule,
  parseRule,
  type RecurrenceRule,
} from "@/lib/family/recurrence/grammar";

// The verified Skylight capture (FR-233) — must survive a round-trip byte-for-byte.
const REFERENCE_RULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU";

// America/Chicago end-of-day for 2026-12-17 as a UTC instant (R201's timed-UNTIL
// form): 2026-12-17T23:59:59-06:00 = 2026-12-18T05:59:59Z.
const CHICAGO_EOD_MS = Date.UTC(2026, 11, 18, 5, 59, 59);

describe("parseRule", () => {
  it("parses the observed reference rule exactly (FR-233)", () => {
    expect(parseRule(REFERENCE_RULE)).toEqual({
      freq: "WEEKLY",
      interval: 1,
      until: { kind: "instant", ms: Date.UTC(2026, 0, 6, 23, 59, 59) },
      wkst: "SU",
      byDay: ["MO", "TU"],
    });
  });

  it("parses a minimal endless daily rule", () => {
    expect(parseRule("FREQ=DAILY;INTERVAL=1")).toEqual({
      freq: "DAILY",
      interval: 1,
      until: null,
    });
  });

  it("parses a plain-date UNTIL (all-day series) as a local date, not an instant", () => {
    expect(parseRule("FREQ=DAILY;INTERVAL=1;UNTIL=20261217")).toEqual({
      freq: "DAILY",
      interval: 1,
      until: { kind: "date", date: "2026-12-17" },
    });
  });

  it("parses a zoned end-of-day UNTIL (timed series) to the exact UTC epoch", () => {
    expect(parseRule("FREQ=DAILY;INTERVAL=1;UNTIL=20261218T055959Z")).toEqual({
      freq: "DAILY",
      interval: 1,
      until: { kind: "instant", ms: CHICAGO_EOD_MS },
    });
  });

  it("parses a weekly rule without WKST, keeping the absence", () => {
    expect(parseRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE,FR")).toEqual({
      freq: "WEEKLY",
      interval: 1,
      until: null,
      wkst: null,
      byDay: ["WE", "FR"],
    });
  });

  it("preserves BYDAY order as written", () => {
    const rule = parseRule("FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=FR,MO,TU");
    expect(rule).toMatchObject({ byDay: ["FR", "MO", "TU"], wkst: "MO" });
  });

  it("parses a monthly rule with its explicit BYMONTHDAY", () => {
    expect(parseRule("FREQ=MONTHLY;INTERVAL=1;UNTIL=20270301;BYMONTHDAY=31")).toEqual({
      freq: "MONTHLY",
      interval: 1,
      until: { kind: "date", date: "2027-03-01" },
      byMonthDay: 31,
    });
  });

  describe("INTERVAL 1–99 (FR-345, R301) — the only field the widening moves", () => {
    it.each([
      ["FREQ=DAILY;INTERVAL=2", 2],
      ["FREQ=DAILY;INTERVAL=3", 3],
      ["FREQ=DAILY;INTERVAL=9", 9],
      ["FREQ=DAILY;INTERVAL=10", 10],
      ["FREQ=DAILY;INTERVAL=99", 99],
    ])("parses %s as interval %i", (text, interval) => {
      expect(parseRule(text)).toEqual({ freq: "DAILY", interval, until: null });
    });

    it("parses a weekly rule above interval 1, WKST carried as the parity origin", () => {
      expect(parseRule("FREQ=WEEKLY;INTERVAL=3;WKST=SU;BYDAY=TU,TH")).toEqual({
        freq: "WEEKLY",
        interval: 3,
        until: null,
        wkst: "SU",
        byDay: ["TU", "TH"],
      });
    });

    it("parses a monthly rule above interval 1", () => {
      expect(parseRule("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15")).toEqual({
        freq: "MONTHLY",
        interval: 2,
        until: null,
        byMonthDay: 15,
      });
    });

    // WKST decides which weeks a wider weekly rule lands in (R303); at interval 1
    // every week matches, so its absence there is legal and inert.
    it("requires WKST on a weekly rule above interval 1", () => {
      expect(() => parseRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO")).toThrow(/WKST/);
    });

    it("still accepts a weekly rule without WKST at interval 1", () => {
      expect(parseRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO")).toMatchObject({
        interval: 1,
        wkst: null,
      });
    });
  });

  describe("refuses everything outside the closed grammar", () => {
    it.each([
      ["the RRULE: property prefix", "RRULE:FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=MO", /FREQ/],
      ["COUNT on a daily rule (FR-232)", "FREQ=DAILY;INTERVAL=1;COUNT=10", /COUNT/],
      ["COUNT on a weekly rule (FR-232)", "FREQ=WEEKLY;INTERVAL=1;COUNT=5;WKST=SU;BYDAY=MO", /COUNT/],
      ["INTERVAL above 99", "FREQ=DAILY;INTERVAL=100", /INTERVAL/],
      ["INTERVAL=0", "FREQ=DAILY;INTERVAL=0", /INTERVAL/],
      ["a zero-padded INTERVAL", "FREQ=DAILY;INTERVAL=01", /INTERVAL/],
      ["a signed INTERVAL", "FREQ=DAILY;INTERVAL=+2", /INTERVAL/],
      ["a fractional INTERVAL", "FREQ=DAILY;INTERVAL=1.0", /INTERVAL/],
      ["a negative INTERVAL", "FREQ=DAILY;INTERVAL=-1", /INTERVAL/],
      ["a missing INTERVAL", "FREQ=DAILY", /INTERVAL/],
      ["a weekly rule above interval 1 without WKST", "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", /WKST/],
      ["FREQ=YEARLY (not one of the four choices, FR-231)", "FREQ=YEARLY;INTERVAL=1", /FREQ/],
      ["FREQ=HOURLY", "FREQ=HOURLY;INTERVAL=1", /FREQ/],
      ["an unknown part", "FREQ=DAILY;INTERVAL=1;BYSETPOS=1", /BYSETPOS/],
      ["WKST on a daily rule", "FREQ=DAILY;INTERVAL=1;WKST=SU", /WKST/],
      ["WKST on a monthly rule", "FREQ=MONTHLY;INTERVAL=1;WKST=SU;BYMONTHDAY=5", /WKST/],
      ["an invalid WKST token", "FREQ=WEEKLY;INTERVAL=1;WKST=XX;BYDAY=MO", /XX/],
      ["WKST after BYDAY (fixed field order)", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;WKST=SU", /WKST/],
      ["UNTIL after WKST (fixed field order)", "FREQ=WEEKLY;INTERVAL=1;WKST=SU;UNTIL=20260101;BYDAY=MO", /UNTIL/],
      ["FREQ not first (fixed field order)", "INTERVAL=1;FREQ=DAILY", /FREQ/],
      ["a weekly rule without BYDAY (BYDAY always explicit)", "FREQ=WEEKLY;INTERVAL=1", /BYDAY/],
      ["a monthly rule without BYMONTHDAY", "FREQ=MONTHLY;INTERVAL=1", /BYMONTHDAY/],
      ["BYDAY on a daily rule", "FREQ=DAILY;INTERVAL=1;BYDAY=MO", /BYDAY/],
      ["BYMONTHDAY on a weekly rule", "FREQ=WEEKLY;INTERVAL=1;BYMONTHDAY=3;BYDAY=MO", /BYDAY|BYMONTHDAY/],
      ["an empty BYDAY", "FREQ=WEEKLY;INTERVAL=1;BYDAY=", /BYDAY/],
      ["a duplicate weekday in BYDAY", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,MO", /duplicate/],
      ["an invalid weekday token", "FREQ=WEEKLY;INTERVAL=1;BYDAY=XX", /XX/],
      ["a lowercase weekday token", "FREQ=WEEKLY;INTERVAL=1;BYDAY=mo", /mo/],
      ["BYMONTHDAY=0", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=0", /BYMONTHDAY/],
      ["BYMONTHDAY=32", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=32", /BYMONTHDAY/],
      ["a BYMONTHDAY list", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15", /BYMONTHDAY/],
      ["a zero-padded BYMONTHDAY", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=05", /BYMONTHDAY/],
      ["an impossible UNTIL date", "FREQ=DAILY;INTERVAL=1;UNTIL=20260230", /UNTIL|real/],
      ["an impossible UNTIL time", "FREQ=DAILY;INTERVAL=1;UNTIL=20260101T256060Z", /UNTIL|real/],
      ["a dashed UNTIL date", "FREQ=DAILY;INTERVAL=1;UNTIL=2026-12-17", /UNTIL/],
      ["an UNTIL instant without the Z", "FREQ=DAILY;INTERVAL=1;UNTIL=20261217T235959", /UNTIL/],
      ["a duplicate UNTIL", "FREQ=DAILY;INTERVAL=1;UNTIL=20260101;UNTIL=20260102", /UNTIL/],
      ["a trailing semicolon", "FREQ=DAILY;INTERVAL=1;", /./],
      ["an empty string", "", /./],
      ["lowercase keys", "freq=daily;interval=1", /./],
    ])("refuses %s", (_label, text, message) => {
      expect(() => parseRule(text)).toThrow(message);
    });
  });
});

describe("emitRule", () => {
  it("emits the canonical field order FREQ;INTERVAL=1;UNTIL;WKST;BYDAY", () => {
    const rule: RecurrenceRule = {
      freq: "WEEKLY",
      interval: 1,
      until: { kind: "instant", ms: Date.UTC(2026, 0, 6, 23, 59, 59) },
      wkst: "SU",
      byDay: ["MO", "TU"],
    };
    expect(emitRule(rule)).toBe(REFERENCE_RULE);
  });

  it("always writes INTERVAL=1 (a stored rule is self-describing)", () => {
    expect(emitRule({ freq: "DAILY", interval: 1, until: null })).toBe("FREQ=DAILY;INTERVAL=1");
  });

  it("emits a plain-date UNTIL for an all-day series", () => {
    expect(
      emitRule({ freq: "DAILY", interval: 1, until: { kind: "date", date: "2026-12-17" } }),
    ).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20261217");
  });

  it("emits a timed UNTIL as the zoned end-of-day UTC instant, not T235959Z on the date", () => {
    // The R201 divergence: Chicago's 2026-12-17 end of day is 05:59:59Z on the 18th.
    expect(
      emitRule({ freq: "DAILY", interval: 1, until: { kind: "instant", ms: CHICAGO_EOD_MS } }),
    ).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20261218T055959Z");
  });

  it("emits WKST before BYDAY on weekly rules and omits it when absent", () => {
    expect(
      emitRule({ freq: "WEEKLY", interval: 1, until: null, wkst: "MO", byDay: ["WE"] }),
    ).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=WE");
    expect(
      emitRule({ freq: "WEEKLY", interval: 1, until: null, wkst: null, byDay: ["WE"] }),
    ).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE");
  });

  it("preserves BYDAY order as given", () => {
    expect(
      emitRule({ freq: "WEEKLY", interval: 1, until: null, wkst: "SU", byDay: ["FR", "MO"] }),
    ).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR,MO");
  });

  it("emits BYMONTHDAY on monthly rules", () => {
    expect(emitRule({ freq: "MONTHLY", interval: 1, until: null, byMonthDay: 31 })).toBe(
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
    );
  });

  it("writes the interval in slot 2, whatever it is", () => {
    expect(emitRule({ freq: "DAILY", interval: 2, until: null })).toBe("FREQ=DAILY;INTERVAL=2");
    expect(emitRule({ freq: "DAILY", interval: 99, until: null })).toBe("FREQ=DAILY;INTERVAL=99");
    expect(
      emitRule({ freq: "WEEKLY", interval: 3, until: null, wkst: "SU", byDay: ["TU"] }),
    ).toBe("FREQ=WEEKLY;INTERVAL=3;WKST=SU;BYDAY=TU");
    expect(emitRule({ freq: "MONTHLY", interval: 2, until: null, byMonthDay: 15 })).toBe(
      "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15",
    );
  });

  describe("refuses rule objects the grammar cannot express", () => {
    it.each<[string, RecurrenceRule, RegExp]>([
      [
        "an empty BYDAY",
        { freq: "WEEKLY", interval: 1, until: null, wkst: "SU", byDay: [] },
        /weekday/,
      ],
      [
        "a duplicate weekday",
        { freq: "WEEKLY", interval: 1, until: null, wkst: "SU", byDay: ["MO", "MO"] },
        /duplicate/,
      ],
      ["byMonthDay 0", { freq: "MONTHLY", interval: 1, until: null, byMonthDay: 0 }, /1–31/],
      ["byMonthDay 32", { freq: "MONTHLY", interval: 1, until: null, byMonthDay: 32 }, /1–31/],
      [
        "a fractional byMonthDay",
        { freq: "MONTHLY", interval: 1, until: null, byMonthDay: 1.5 },
        /1–31/,
      ],
      ["interval 0", { freq: "DAILY", interval: 0, until: null }, /interval/],
      ["interval 100", { freq: "DAILY", interval: 100, until: null }, /interval/],
      ["a negative interval", { freq: "DAILY", interval: -1, until: null }, /interval/],
      ["a fractional interval", { freq: "DAILY", interval: 1.5, until: null }, /interval/],
      ["a non-finite interval", { freq: "DAILY", interval: Number.NaN, until: null }, /interval/],
      [
        "a weekly rule above interval 1 with no WKST",
        { freq: "WEEKLY", interval: 2, until: null, wkst: null, byDay: ["MO"] },
        /WKST/,
      ],
      [
        "an until date not in YYYY-MM-DD form",
        { freq: "DAILY", interval: 1, until: { kind: "date", date: "20261217" } },
        /YYYY-MM-DD/,
      ],
      [
        "an impossible until date",
        { freq: "DAILY", interval: 1, until: { kind: "date", date: "2026-02-30" } },
        /real/,
      ],
      [
        "an until instant with sub-second precision (cannot round-trip)",
        { freq: "DAILY", interval: 1, until: { kind: "instant", ms: CHICAGO_EOD_MS + 500 } },
        /second/,
      ],
      [
        "a non-finite until instant",
        { freq: "DAILY", interval: 1, until: { kind: "instant", ms: Number.NaN } },
        /second|instant/,
      ],
    ])("refuses %s", (_label, rule, message) => {
      expect(() => emitRule(rule)).toThrow(message);
    });
  });
});

describe("round-trips", () => {
  // LOAD-BEARING: this is the frozen Phase 2 corpus — every shape the shipped
  // emitter could write for the LIVE calendar. The widening is only safe while
  // each of these strings comes back byte-identical, so no row may be edited or
  // removed to make a change pass (R302).
  it.each([
    [REFERENCE_RULE],
    ["FREQ=DAILY;INTERVAL=1"],
    ["FREQ=DAILY;INTERVAL=1;UNTIL=20261217"],
    ["FREQ=DAILY;INTERVAL=1;UNTIL=20261218T055959Z"],
    ["FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU"],
    ["FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,TU,WE,TH,FR"],
    ["FREQ=WEEKLY;INTERVAL=1;UNTIL=20270101;WKST=SU;BYDAY=TU"],
    ["FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"],
    ["FREQ=MONTHLY;INTERVAL=1;UNTIL=20271231T235959Z;BYMONTHDAY=15"],
  ])("emit(parse(%s)) returns the identical string", (text) => {
    expect(emitRule(parseRule(text))).toBe(text);
  });

  it.each([
    ["FREQ=DAILY;INTERVAL=2"],
    ["FREQ=DAILY;INTERVAL=99;UNTIL=20271231"],
    ["FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU,TH"],
    ["FREQ=WEEKLY;INTERVAL=3;UNTIL=20270101;WKST=MO;BYDAY=MO"],
    ["FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15"],
    ["FREQ=MONTHLY;INTERVAL=12;UNTIL=20301231T055959Z;BYMONTHDAY=31"],
  ])("emit(parse(%s)) returns the identical string", (text) => {
    expect(emitRule(parseRule(text))).toBe(text);
  });

  it("parse(emit(rule)) preserves every field", () => {
    const rules: RecurrenceRule[] = [
      { freq: "DAILY", interval: 1, until: null },
      { freq: "DAILY", interval: 2, until: { kind: "date", date: "2026-11-01" } },
      { freq: "WEEKLY", interval: 1, until: null, wkst: null, byDay: ["TU"] },
      {
        freq: "WEEKLY",
        interval: 4,
        until: { kind: "instant", ms: Date.UTC(2026, 11, 15, 5, 59, 59) },
        wkst: "SU",
        byDay: ["TU", "TH"],
      },
      {
        freq: "MONTHLY",
        interval: 1,
        until: { kind: "date", date: "2027-06-30" },
        byMonthDay: 29,
      },
      { freq: "MONTHLY", interval: 99, until: null, byMonthDay: 1 },
    ];
    for (const rule of rules) {
      expect(parseRule(emitRule(rule))).toEqual(rule);
    }
  });
});
