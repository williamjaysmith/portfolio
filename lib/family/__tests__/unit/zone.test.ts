import { describe, expect, it } from "vitest";
import {
  instantToWall,
  wallToInstant,
  zoneOffsetMs,
  type WallTime,
} from "@/lib/family/recurrence/zone";

const HOUR = 3_600_000;
const MINUTE = 60_000;

function wall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): WallTime {
  return { year, month, day, hour, minute, second };
}

describe("America/Chicago", () => {
  const ZONE = "America/Chicago";

  it("holds CST (-6h) in winter and CDT (-5h) in summer", () => {
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 0, 15, 12))).toBe(-6 * HOUR);
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 6, 15, 12))).toBe(-5 * HOUR);
  });

  describe("2026-03-08 spring-forward (02:00 CST jumps to 03:00 CDT)", () => {
    it("converts the last CST minute normally", () => {
      expect(wallToInstant(ZONE, wall(2026, 3, 8, 1, 59))).toBe(Date.UTC(2026, 2, 8, 7, 59));
    });

    it("lands a 02:30 gap time at 03:00 exactly — the first valid time, not 03:30 (FR-235)", () => {
      expect(wallToInstant(ZONE, wall(2026, 3, 8, 2, 30))).toBe(Date.UTC(2026, 2, 8, 8, 0));
    });

    it("lands the gap's first missing minute (02:00) on the same edge", () => {
      expect(wallToInstant(ZONE, wall(2026, 3, 8, 2, 0))).toBe(Date.UTC(2026, 2, 8, 8, 0));
    });

    it("converts 03:00 and later as plain CDT", () => {
      expect(wallToInstant(ZONE, wall(2026, 3, 8, 3, 0))).toBe(Date.UTC(2026, 2, 8, 8, 0));
      expect(wallToInstant(ZONE, wall(2026, 3, 8, 3, 30))).toBe(Date.UTC(2026, 2, 8, 8, 30));
    });

    it("reads the gap landing back as 03:00 wall time", () => {
      expect(instantToWall(ZONE, Date.UTC(2026, 2, 8, 8, 0))).toEqual(wall(2026, 3, 8, 3, 0));
    });
  });

  describe("2026-11-01 fall-back (02:00 CDT returns to 01:00 CST)", () => {
    it("resolves the doubled 01:30 to the first instant — CDT (FR-236)", () => {
      expect(wallToInstant(ZONE, wall(2026, 11, 1, 1, 30))).toBe(Date.UTC(2026, 10, 1, 6, 30));
    });

    it("resolves the fold's first doubled minute (01:00) to CDT", () => {
      expect(wallToInstant(ZONE, wall(2026, 11, 1, 1, 0))).toBe(Date.UTC(2026, 10, 1, 6, 0));
    });

    it("converts times either side of the fold unambiguously", () => {
      expect(wallToInstant(ZONE, wall(2026, 11, 1, 0, 30))).toBe(Date.UTC(2026, 10, 1, 5, 30));
      expect(wallToInstant(ZONE, wall(2026, 11, 1, 2, 0))).toBe(Date.UTC(2026, 10, 1, 8, 0));
    });

    it("reads both instants of the fold as the same 01:30 wall time", () => {
      expect(instantToWall(ZONE, Date.UTC(2026, 10, 1, 6, 30))).toEqual(wall(2026, 11, 1, 1, 30));
      expect(instantToWall(ZONE, Date.UTC(2026, 10, 1, 7, 30))).toEqual(wall(2026, 11, 1, 1, 30));
    });
  });
});

describe("Europe/London", () => {
  const ZONE = "Europe/London";

  it("holds GMT (0) in winter and BST (+1h) in summer", () => {
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 0, 15, 12))).toBe(0);
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 6, 15, 12))).toBe(HOUR);
  });

  it("lands the 2026-03-29 gap (01:30) at 02:00 BST — the transition edge", () => {
    expect(wallToInstant(ZONE, wall(2026, 3, 29, 1, 30))).toBe(Date.UTC(2026, 2, 29, 1, 0));
    expect(instantToWall(ZONE, Date.UTC(2026, 2, 29, 1, 0))).toEqual(wall(2026, 3, 29, 2, 0));
  });

  it("resolves the 2026-10-25 fold (01:30) to the first instant — BST", () => {
    expect(wallToInstant(ZONE, wall(2026, 10, 25, 1, 30))).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });
});

describe("Australia/Sydney", () => {
  const ZONE = "Australia/Sydney";

  it("holds AEDT (+11h) in southern summer and AEST (+10h) in southern winter", () => {
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 0, 15, 12))).toBe(11 * HOUR);
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 6, 15, 12))).toBe(10 * HOUR);
  });

  it("lands the 2026-10-04 gap (02:30) at 03:00 AEDT", () => {
    expect(wallToInstant(ZONE, wall(2026, 10, 4, 2, 30))).toBe(Date.UTC(2026, 9, 3, 16, 0));
    expect(instantToWall(ZONE, Date.UTC(2026, 9, 3, 16, 0))).toEqual(wall(2026, 10, 4, 3, 0));
  });

  it("resolves the 2026-04-05 fold (02:30) to the first instant — AEDT", () => {
    expect(wallToInstant(ZONE, wall(2026, 4, 5, 2, 30))).toBe(Date.UTC(2026, 3, 4, 15, 30));
  });
});

describe("Australia/Lord_Howe (30-minute shift)", () => {
  const ZONE = "Australia/Lord_Howe";

  it("holds LHDT (+11h) in southern summer and LHST (+10h30) in southern winter", () => {
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 0, 15, 12))).toBe(11 * HOUR);
    expect(zoneOffsetMs(ZONE, Date.UTC(2026, 6, 15, 12))).toBe(10 * HOUR + 30 * MINUTE);
  });

  it("lands the 2026-10-04 half-hour gap (02:15) at 02:30 LHDT", () => {
    expect(wallToInstant(ZONE, wall(2026, 10, 4, 2, 15))).toBe(Date.UTC(2026, 9, 3, 15, 30));
    expect(instantToWall(ZONE, Date.UTC(2026, 9, 3, 15, 30))).toEqual(wall(2026, 10, 4, 2, 30));
  });

  it("resolves the 2026-04-05 half-hour fold (01:45) to the first instant — LHDT", () => {
    expect(wallToInstant(ZONE, wall(2026, 4, 5, 1, 45))).toBe(Date.UTC(2026, 3, 4, 14, 45));
  });
});

describe("UTC", () => {
  it("is the no-op zone: offset 0, wallToInstant identical to Date.UTC", () => {
    expect(zoneOffsetMs("UTC", Date.UTC(2026, 2, 8, 8, 0))).toBe(0);
    expect(zoneOffsetMs("UTC", Date.UTC(2026, 10, 1, 6, 30))).toBe(0);
    expect(wallToInstant("UTC", wall(2026, 3, 8, 2, 30))).toBe(Date.UTC(2026, 2, 8, 2, 30));
  });
});

describe("instantToWall round-trips", () => {
  it.each<[string, WallTime]>([
    ["America/Chicago", wall(2026, 3, 8, 1, 59)],
    ["America/Chicago", wall(2026, 3, 8, 3, 0)],
    ["America/Chicago", wall(2026, 11, 1, 1, 30)],
    ["America/Chicago", wall(2026, 7, 4, 12, 0, 30)],
    ["Europe/London", wall(2026, 10, 25, 1, 30)],
    ["Europe/London", wall(2026, 12, 25, 9, 15)],
    ["Australia/Sydney", wall(2026, 4, 5, 2, 30)],
    ["Australia/Lord_Howe", wall(2026, 7, 15, 13, 45)],
    ["UTC", wall(2026, 1, 1, 0, 0)],
  ])("instantToWall(%s, wallToInstant(...)) restores the wall time", (zone, wallTime) => {
    expect(instantToWall(zone, wallToInstant(zone, wallTime))).toEqual(wallTime);
  });

  it("does not round-trip a gap time — by design it lands on the edge (FR-235)", () => {
    const landed = wallToInstant("America/Chicago", wall(2026, 3, 8, 2, 30));
    expect(instantToWall("America/Chicago", landed)).toEqual(wall(2026, 3, 8, 3, 0));
  });
});

describe("input handling", () => {
  it("throws on an invalid IANA zone name", () => {
    expect(() => zoneOffsetMs("Not/AZone", 0)).toThrow(RangeError);
  });

  it("keeps the offset stable across sub-second instants (the formatter reads whole seconds)", () => {
    const instant = Date.UTC(2026, 0, 15, 12);
    expect(zoneOffsetMs("America/Chicago", instant + 999)).toBe(-6 * HOUR);
  });
});
