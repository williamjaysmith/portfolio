import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  completeTaskOccurrence,
  skipTaskOccurrence,
  unresolveTaskOccurrence,
} from "@/lib/family/actions/tasks";
import { ACTION_MESSAGES, fail, type ActionResult } from "@/lib/family/errors";
import type { BoardOccurrence, OccurrenceState } from "@/lib/family/types";

import { callAction } from "../../../components/action-client";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { makeContext, withFamily } from "../../../components/__tests__/family-test-utils";
import { occurrenceKeyOf } from "../TaskCard";
import { occurrenceKeyFrom, resolveVerbOf, useTaskResolve } from "../useTaskResolve";

/**
 * T044 / R323 — the ONE commit path.
 *
 * What is proved here is the shape of the write rather than its effect: the
 * server action's own behaviour is the policies tier's (T036), and the
 * punch-in sheet is Phase 1's (`usePunchInPrompt.test.tsx`). This file pins
 * the three things a second write path would get wrong —
 *
 *   - every verb goes through `withActor`, so the punch-in arrives AT THE TAP
 *     and a dismissed sheet writes nothing (FR-350, US1-3);
 *   - the payload carries FR-353's five columns and nothing else, so no client
 *     ever asserts who is acting (FR-387, R323);
 *   - nothing is painted optimistically: the circle is busy for the round trip
 *     and the cache is never written by hand (FR-393).
 */

vi.mock("@/lib/family/actions/tasks", () => ({
  completeTaskOccurrence: vi.fn(),
  skipTaskOccurrence: vi.fn(),
  unresolveTaskOccurrence: vi.fn(),
}));

const completeMock = completeTaskOccurrence as Mock;
const skipMock = skipTaskOccurrence as Mock;
const unresolveMock = unresolveTaskOccurrence as Mock;

const CLEO = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-09-04";

const REFUSAL = "That's Ben's task — only Ben or a parent can do it.";

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    rewardPoints: null,
    taskId: "22222222-2222-4222-8222-222222222222",
    assigneeId: CLEO,
    scheduledDate: TODAY,
    slot: null,
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: "Feed the cat",
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    dueTime: null,
    dueAt: null,
    isRepeating: false,
    taskCreatedAt: "2026-08-01T12:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

/**
 * The shipped interceptor's own shape, minus its network: it runs the write
 * only once somebody is punched in, and turns a rejected transport into
 * `UNAVAILABLE` exactly as `callAction` does for the real one.
 */
function withActorThatRuns(): FamilyContextValue["withActor"] {
  return (run) => callAction(run);
}

/** A sheet nobody answers: `withActor` refuses before the write is reached. */
function withActorThatPrompts(): FamilyContextValue["withActor"] {
  return async () => fail("NO_ACTOR");
}

function withActorThatRefuses(): FamilyContextValue["withActor"] {
  return async () => fail("FORBIDDEN", REFUSAL);
}

function renderResolve(withActor: FamilyContextValue["withActor"] = withActorThatRuns()) {
  const queryClient = new QueryClient();
  const setQueryData = vi.spyOn(queryClient, "setQueryData");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      withFamily(makeContext({ withActor }), children),
    );
  return { setQueryData, ...renderHook(() => useTaskResolve(), { wrapper }) };
}

/** A promise this test resolves by hand, so the in-flight state can be read. */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

beforeEach(() => {
  vi.clearAllMocks();
  completeMock.mockResolvedValue({ ok: true, data: null });
  skipMock.mockResolvedValue({ ok: true, data: null });
  unresolveMock.mockResolvedValue({ ok: true, data: null });
});

describe("resolveVerbOf", () => {
  it("gives each drawn state the verb its circle already offers (FR-348, FR-355, FR-361)", () => {
    const verbs: Record<OccurrenceState, string> = {
      unresolved: resolveVerbOf("unresolved"),
      complete: resolveVerbOf("complete"),
      skipped: resolveVerbOf("skipped"),
    };
    expect(verbs).toEqual({
      unresolved: "complete",
      complete: "uncomplete",
      skipped: "unskip",
    });
  });
});

describe("occurrenceKeyFrom", () => {
  it("projects FR-353's five columns and nothing else (R323, FR-387)", () => {
    const key = occurrenceKeyFrom(
      occurrence({ slot: "morning", cyclePrev: "cycle-1", summary: "Brush teeth" }),
    );
    expect(key).toEqual({
      taskId: "22222222-2222-4222-8222-222222222222",
      assigneeId: CLEO,
      occurrenceDate: TODAY,
      slot: "morning",
      cyclePrev: "cycle-1",
    });
  });
});

describe("useTaskResolve", () => {
  it("sends the tapped occurrence's key to completeTaskOccurrence, and no identity", async () => {
    const one = occurrence();
    const { result } = renderResolve();

    await act(async () => {
      await result.current.resolve({ occurrence: one, verb: "complete" });
    });

    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith({ occurrence: occurrenceKeyFrom(one) });
  });

  it("writes nothing when the punch-in sheet is dismissed (FR-350, US1-3)", async () => {
    const { result } = renderResolve(withActorThatPrompts());
    let outcome: ActionResult<null> | null = null;

    await act(async () => {
      outcome = await result.current.resolve({ occurrence: occurrence(), verb: "complete" });
    });

    expect(completeMock).not.toHaveBeenCalled();
    expect(outcome).toEqual(fail("NO_ACTOR"));
    // The card is left exactly as it was: a dismissal is a decision, not a
    // failure, so there is nothing to tell the family about.
    expect(result.current.notice).toBeNull();
  });

  it("surfaces the FR-351 refusal verbatim", async () => {
    const { result } = renderResolve(withActorThatRefuses());

    await act(async () => {
      await result.current.resolve({ occurrence: occurrence(), verb: "complete" });
    });

    expect(result.current.notice).toBe(REFUSAL);

    act(() => {
      result.current.clearNotice();
    });
    expect(result.current.notice).toBeNull();
  });

  it("marks only the tapped occurrence busy, and paints nothing itself (FR-393)", async () => {
    const one = occurrence();
    const gate = deferred<ActionResult<null>>();
    completeMock.mockReturnValue(gate.promise);
    const { result, setQueryData } = renderResolve();

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.resolve({ occurrence: one, verb: "complete" });
    });
    expect(result.current.busyKeys.has(occurrenceKeyOf(one))).toBe(true);

    await act(async () => {
      gate.settle({ ok: true, data: null });
      await pending;
    });

    expect(result.current.busyKeys.size).toBe(0);
    // No optimistic cache write anywhere: the refetch `withActor` triggers is
    // the only thing that repaints the board.
    expect(setQueryData).not.toHaveBeenCalled();
  });

  it("ignores a second tap while a write is in flight", async () => {
    const gate = deferred<ActionResult<null>>();
    completeMock.mockReturnValue(gate.promise);
    const { result } = renderResolve();
    let second: ActionResult<null> | null = { ok: true, data: null };

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.resolve({ occurrence: occurrence(), verb: "complete" });
      second = await result.current.resolve({ occurrence: occurrence(), verb: "complete" });
    });

    expect(second).toBeNull();
    expect(completeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.settle({ ok: true, data: null });
      await pending;
    });
  });

  it("queues a tap on a DIFFERENT card behind the write in flight — busy on both, dropped on neither", async () => {
    const gate = deferred<ActionResult<null>>();
    completeMock.mockReturnValueOnce(gate.promise).mockResolvedValueOnce({ ok: true, data: null });
    const { result } = renderResolve();
    const first = occurrence();
    const second = occurrence({
      taskId: "33333333-3333-4333-8333-333333333333",
      summary: "Sweep the porch",
    });

    let firstPending: Promise<unknown> = Promise.resolve();
    let secondPending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      firstPending = result.current.resolve({ occurrence: first, verb: "complete" });
      secondPending = result.current.resolve({ occurrence: second, verb: "complete" });
    });
    // Waiting, not dropped: the second card shows busy and has not written yet.
    expect(result.current.busyKeys.has(occurrenceKeyOf(first))).toBe(true);
    expect(result.current.busyKeys.has(occurrenceKeyOf(second))).toBe(true);
    expect(completeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.settle({ ok: true, data: null });
      await firstPending;
      await secondPending;
    });
    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(await secondPending).toEqual({ ok: true, data: null });
    expect(result.current.busyKeys.size).toBe(0);
  });

  it("un-completes and unskips through the one DELETE (FR-355, FR-361)", async () => {
    const done = occurrence({ state: "complete", creditedCategoryId: CLEO });
    const skipped = occurrence({ state: "skipped" });
    const { result } = renderResolve();

    await act(async () => {
      await result.current.resolve({ occurrence: done, verb: "uncomplete" });
      await result.current.resolve({ occurrence: skipped, verb: "unskip" });
    });

    expect(completeMock).not.toHaveBeenCalled();
    expect(unresolveMock).toHaveBeenNthCalledWith(1, { occurrence: occurrenceKeyFrom(done) });
    expect(unresolveMock).toHaveBeenNthCalledWith(2, { occurrence: occurrenceKeyFrom(skipped) });
  });

  it("skips through skipTaskOccurrence, with the same key and no credit (T063, FR-359)", async () => {
    const one = occurrence({ isRepeating: true });
    const { result } = renderResolve();

    await act(async () => {
      await result.current.resolve({ occurrence: one, verb: "skip" });
    });

    expect(skipMock).toHaveBeenCalledWith({ occurrence: occurrenceKeyFrom(one) });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("claims through the SAME completion action, carrying the credited Profile (FR-367)", async () => {
    const grabs = occurrence({ assigneeId: null, upForGrabs: true });
    const { result } = renderResolve();

    await act(async () => {
      await result.current.resolve({ occurrence: grabs, verb: "claim", creditProfileId: CLEO });
    });

    // FR-367: a claim IS a completion — one action, one row, one code path;
    // the credit is the only thing that makes it a claim.
    expect(completeMock).toHaveBeenCalledWith({
      occurrence: occurrenceKeyFrom(grabs),
      creditProfileId: CLEO,
    });
  });

  it("carries the credit on the CLAIM alone — an ordinary completion asserts nobody", async () => {
    const { result } = renderResolve();

    await act(async () => {
      await result.current.resolve({
        occurrence: occurrence(),
        verb: "complete",
        creditProfileId: CLEO,
      });
    });

    expect(completeMock).toHaveBeenCalledWith({ occurrence: occurrenceKeyFrom(occurrence()) });
  });

  it("refuses offline rather than queueing (FR-393)", async () => {
    completeMock.mockRejectedValue(new Error("Failed to fetch"));
    const { result } = renderResolve();
    let outcome: ActionResult<null> | null = null;

    await act(async () => {
      outcome = await result.current.resolve({ occurrence: occurrence(), verb: "complete" });
    });

    expect(outcome).toEqual(fail("UNAVAILABLE"));
    expect(result.current.notice).toBe(ACTION_MESSAGES.UNAVAILABLE);
    // One attempt, and nothing held for later.
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  /**
   * 004 T048 — FR-439's `inFlightLocal`: how many of THIS device's completions
   * for a Profile are still queued or writing, read at the moment of a tap so
   * two quick taps on the last two outstanding cards fire the rain once, on
   * the second (SC-414). Only a completion shortens a list: a skip, an undo
   * and a claim (which joins a column's total and its count together) do not.
   */
  describe("inFlightCompletions (T048, FR-439)", () => {
    const BEN = "33333333-3333-4333-8333-333333333333";

    it("counts a completion for its Profile from the tap until it settles", async () => {
      const gate = deferred<ActionResult<null>>();
      completeMock.mockReturnValue(gate.promise);
      const { result } = renderResolve();

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.resolve({ occurrence: occurrence(), verb: "complete" });
      });
      expect(result.current.inFlightCompletions(CLEO)).toBe(1);
      expect(result.current.inFlightCompletions(BEN)).toBe(0);

      await act(async () => {
        gate.settle({ ok: true, data: null });
        await pending;
      });
      expect(result.current.inFlightCompletions(CLEO)).toBe(0);
    });

    it("counts the queued one too, and a second tap on the same card not at all", async () => {
      const gate = deferred<ActionResult<null>>();
      completeMock.mockReturnValueOnce(gate.promise).mockResolvedValue({ ok: true, data: null });
      const { result } = renderResolve();
      const first = occurrence();
      const second = occurrence({ taskId: "33333333-3333-4333-8333-333333333333" });

      let pending: Promise<unknown>[] = [];
      await act(async () => {
        pending = [
          result.current.resolve({ occurrence: first, verb: "complete" }),
          result.current.resolve({ occurrence: second, verb: "complete" }),
          result.current.resolve({ occurrence: second, verb: "complete" }),
        ];
      });
      // One writing, one waiting; the third tap was the second tap twice.
      expect(result.current.inFlightCompletions(CLEO)).toBe(2);

      await act(async () => {
        gate.settle({ ok: true, data: null });
        await Promise.all(pending);
      });
      expect(result.current.inFlightCompletions(CLEO)).toBe(0);
    });

    it("counts no skip, no undo and no claim — none of them shortens a list", async () => {
      const gates = [deferred<ActionResult<null>>(), deferred<ActionResult<null>>()];
      skipMock.mockReturnValue(gates[0].promise);
      unresolveMock.mockReturnValue(gates[0].promise);
      completeMock.mockReturnValue(gates[1].promise);
      const { result } = renderResolve();
      const done = occurrence({
        taskId: "33333333-3333-4333-8333-333333333333",
        state: "complete",
        creditedCategoryId: CLEO,
      });
      const grabs = occurrence({
        taskId: "44444444-4444-4444-8444-444444444444",
        assigneeId: null,
        upForGrabs: true,
      });

      let pending: Promise<unknown>[] = [];
      await act(async () => {
        pending = [
          result.current.resolve({ occurrence: occurrence(), verb: "skip" }),
          result.current.resolve({ occurrence: done, verb: "uncomplete" }),
          result.current.resolve({ occurrence: grabs, verb: "claim", creditProfileId: CLEO }),
        ];
      });
      expect(result.current.inFlightCompletions(CLEO)).toBe(0);

      await act(async () => {
        for (const gate of gates) gate.settle({ ok: true, data: null });
        await Promise.all(pending);
      });
    });
  });
});
