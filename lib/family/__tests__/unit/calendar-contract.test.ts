import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  eventInputSchema,
  repeatChoiceSchema,
  updateEventInputSchema,
} from "@/lib/family/validation";
import type { RepeatChoice } from "@/lib/family/types";

/**
 * T018 — the grammar widened; the CALENDAR's contract did not (R301).
 * `INTERVAL` is 1–99 in `recurrence/grammar.ts`, but `RepeatChoice` and
 * `repeatChoiceSchema` still carry no interval at all, so an event client
 * sending `interval: 2` is refused at the boundary rather than quietly
 * producing a rule the calendar's UI cannot render or edit back.
 *
 * The other half is the emitter side: every rule `actions/events.ts`
 * constructs must still say `INTERVAL=1`. Those construction sites are module
 * -private, so they are asserted from the source text — the five object
 * literals that stamp `interval: 1` and the two spreads that carry the parsed
 * rule's own. Asserted, not trusted (contracts §Shared input shapes).
 */

const UUID = "00000000-0000-4000-8000-000000000001";

function timedInput(repeat: unknown): Record<string, unknown> {
  return {
    allDay: false,
    startsAt: "2026-10-06T22:00:00.000Z",
    endsAt: "2026-10-06T22:45:00.000Z",
    summary: "Piano",
    timezone: "America/Chicago",
    repeat,
    categoryIds: [],
  };
}

describe("RepeatChoice carries no interval (the type)", () => {
  // Distributes over the union, so this is the union of EVERY arm's keys —
  // adding `interval` to any one arm stops this file type-checking.
  type ArmKeys = RepeatChoice extends infer Arm ? (Arm extends object ? keyof Arm : never) : never;
  const noIntervalKey: Extract<ArmKeys, "interval"> extends never ? true : false = true;

  it("has no arm with an interval key", () => {
    expect(noIntervalKey).toBe(true);
  });
});

describe("repeatChoiceSchema still refuses an interval (the boundary)", () => {
  it.each([
    ["never", { kind: "never", interval: 2 }],
    ["daily", { kind: "daily", until: null, interval: 2 }],
    ["weekly", { kind: "weekly", weekdays: ["MO"], until: null, interval: 2 }],
    ["monthly", { kind: "monthly", until: null, interval: 2 }],
  ])("refuses an interval on the %s choice", (_kind, choice) => {
    expect(repeatChoiceSchema.safeParse(choice).success).toBe(false);
  });

  it.each([
    ["never", { kind: "never" }],
    ["daily", { kind: "daily", until: null }],
    ["weekly", { kind: "weekly", weekdays: ["MO"], until: null }],
    ["monthly", { kind: "monthly", until: null }],
  ])("still accepts the shipped %s choice unchanged", (_kind, choice) => {
    expect(repeatChoiceSchema.safeParse(choice).success).toBe(true);
  });

  it("names the smuggled key rather than stripping it", () => {
    const result = repeatChoiceSchema.safeParse({ kind: "daily", until: null, interval: 2 });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/interval/);
  });
});

describe("the event input schemas refuse it too", () => {
  it("eventInputSchema rejects a repeat carrying an interval", () => {
    expect(eventInputSchema.safeParse(timedInput({ kind: "daily", until: null })).success).toBe(
      true,
    );
    expect(
      eventInputSchema.safeParse(timedInput({ kind: "daily", until: null, interval: 2 })).success,
    ).toBe(false);
  });

  it("updateEventInputSchema rejects it on the patch path", () => {
    expect(
      updateEventInputSchema.safeParse({
        id: UUID,
        patch: { repeat: { kind: "daily", until: null, interval: 2 } },
        scope: "all",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------- the emitter side (R301) -- */

const EVENTS_PATH = join(import.meta.dirname, "..", "..", "actions", "events.ts");
const EVENTS_SOURCE = readFileSync(EVENTS_PATH, "utf8");

const EMIT_CALL = /emitRule\(\s*\{/g;

/** The `{ … }` argument of every `emitRule` call in the source, brace-matched. */
function emitRuleArguments(source: string): string[] {
  const args: string[] = [];
  for (const match of source.matchAll(EMIT_CALL)) {
    const open = match.index + match[0].length - 1;
    args.push(source.slice(open, closingBrace(source, open) + 1));
  }
  return args;
}

function closingBrace(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}" && (depth -= 1) === 0) return index;
  }
  throw new Error("unbalanced emitRule({ … }) argument in lib/family/actions/events.ts");
}

// A spread site opens with `{ ...rule` — an ARRAY spread inside a field value
// (`byDay: [...choice.weekdays]`) is still a literal construction.
const RULE_SPREAD = /^\{\s*\.\.\./;

describe("every rule the calendar emits is still INTERVAL=1", () => {
  const args = emitRuleArguments(EVENTS_SOURCE);
  const literals = args.filter((arg) => !RULE_SPREAD.test(arg));
  const spreads = args.filter((arg) => RULE_SPREAD.test(arg));

  it("constructs a rule at exactly seven sites", () => {
    expect(args).toHaveLength(7);
  });

  it("stamps interval: 1 at all five literal sites (3 in ruleFromChoice, 2 in reanchor)", () => {
    expect(literals).toHaveLength(5);
    for (const literal of literals) {
      expect(literal).toMatch(/\binterval:\s*1\b/);
    }
  });

  it("leaves the two spread sites carrying the parsed rule's own interval", () => {
    expect(spreads).toHaveLength(2);
    for (const spread of spreads) {
      expect(spread).not.toMatch(/\binterval\b/);
    }
  });

  it("never writes rule text by hand — the emitter is the only source", () => {
    expect(EVENTS_SOURCE).not.toMatch(/FREQ=/);
  });
});
