import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ACTION_MESSAGES, fail, type ActionResult } from "@/lib/family/errors";

import { callAction } from "../action-client";
import type { FamilyContextValue } from "../FamilyProvider";
import { useSerialisedWrites } from "../useSerialisedWrites";
import { makeContext, withFamily } from "./family-test-utils";

/**
 * 004 T048's dedup — the ONE queue behind both boards' commit paths
 * (`useTaskResolve`, `useRedeem`). What is proved here is the queue's own
 * contract, which each of those files used to prove twice over:
 *
 *   - a write goes through `withActor`, so the punch-in arrives at the tap;
 *   - the tapped key is busy from the tap until its own write settles;
 *   - a second commit on the SAME key while it waits is the same tap twice,
 *     and is refused synchronously — `null`, and nothing written;
 *   - a commit on a DIFFERENT key waits its turn behind the one in flight —
 *     busy on both, dropped on neither, one punch-in sheet at a time;
 *   - a refusal is surfaced in the server's words, a dismissed punch-in
 *     (`NO_ACTOR`) in silence, and the queue moves on whatever a write's fate.
 */

const REFUSAL = "That's Ben's task — only Ben or a parent can do it.";

type Answer = ActionResult<string>;

const OK: Answer = { ok: true, data: "written" };

/** The shipped interceptor's own shape, minus its network. */
function withActorThatRuns(): FamilyContextValue["withActor"] {
  return (run) => callAction(run);
}

function renderWrites(withActor: FamilyContextValue["withActor"] = withActorThatRuns()) {
  return renderHook(() => useSerialisedWrites(), {
    wrapper: ({ children }) => withFamily(makeContext({ withActor }), children),
  });
}

/** A promise this test resolves by hand, so the in-flight state can be read. */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

describe("useSerialisedWrites", () => {
  it("runs the write through withActor and hands its answer back whole", async () => {
    const seen: string[] = [];
    const { result } = renderWrites(async (run) => {
      seen.push("withActor");
      return run();
    });
    const write = vi.fn(async () => OK);
    let outcome: Answer | null = null;

    await act(async () => {
      outcome = await result.current.commit("card-1", write);
    });

    expect(seen).toEqual(["withActor"]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual(OK);
    expect(result.current.notice).toBeNull();
  });

  it("marks the committed key busy until its own write settles, and no other key", async () => {
    const gate = deferred<Answer>();
    const { result } = renderWrites();

    let pending: Promise<unknown> | null = null;
    await act(async () => {
      pending = result.current.commit("card-1", () => gate.promise);
    });
    expect(result.current.busyKeys.has("card-1")).toBe(true);
    expect(result.current.busyKeys.has("card-2")).toBe(false);

    await act(async () => {
      gate.settle(OK);
      await pending;
    });
    expect(result.current.busyKeys.size).toBe(0);
  });

  it("refuses a second commit on the SAME key synchronously — null, and nothing written", async () => {
    const gate = deferred<Answer>();
    const { result } = renderWrites();
    const again = vi.fn(async () => OK);

    let pending: Promise<unknown> | null = null;
    let second: Promise<unknown> | null = Promise.resolve();
    await act(async () => {
      pending = result.current.commit("card-1", () => gate.promise);
      second = result.current.commit("card-1", again);
    });

    expect(second).toBeNull();
    expect(again).not.toHaveBeenCalled();

    await act(async () => {
      gate.settle(OK);
      await pending;
    });
  });

  it("queues a DIFFERENT key behind the write in flight — busy on both, dropped on neither", async () => {
    const gate = deferred<Answer>();
    const { result } = renderWrites();
    const second = vi.fn(async (): Promise<Answer> => ({ ok: true, data: "second" }));

    let firstPending: Promise<unknown> | null = null;
    let secondPending: Promise<Answer> | null = null;
    await act(async () => {
      firstPending = result.current.commit("card-1", () => gate.promise);
      secondPending = result.current.commit("card-2", second);
    });
    // Waiting, not dropped: the second key shows busy and has not written yet.
    expect(result.current.busyKeys.has("card-1")).toBe(true);
    expect(result.current.busyKeys.has("card-2")).toBe(true);
    expect(second).not.toHaveBeenCalled();

    await act(async () => {
      gate.settle(OK);
      await firstPending;
      await secondPending;
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(await secondPending).toEqual({ ok: true, data: "second" });
    expect(result.current.busyKeys.size).toBe(0);
  });

  it("says nothing when the punch-in sheet is dismissed (NO_ACTOR), and writes nothing", async () => {
    const { result } = renderWrites(async () => fail("NO_ACTOR"));
    const write = vi.fn(async () => OK);
    let outcome: Answer | null = null;

    await act(async () => {
      outcome = await result.current.commit("card-1", write);
    });

    expect(write).not.toHaveBeenCalled();
    expect(outcome).toEqual(fail("NO_ACTOR"));
    // A dismissal is a decision, not a failure: nothing to tell the family.
    expect(result.current.notice).toBeNull();
  });

  it("surfaces a refusal verbatim, and clears it on request", async () => {
    const { result } = renderWrites(async () => fail("FORBIDDEN", REFUSAL));

    await act(async () => {
      await result.current.commit("card-1", async () => OK);
    });
    expect(result.current.notice).toBe(REFUSAL);

    act(() => {
      result.current.clearNotice();
    });
    expect(result.current.notice).toBeNull();
  });

  it("refuses offline rather than queueing, and the queue moves on", async () => {
    const { result } = renderWrites();
    let outcome: Answer | null = null;

    await act(async () => {
      outcome = await result.current.commit("card-1", async () => {
        throw new Error("Failed to fetch");
      });
    });
    expect(outcome).toEqual(fail("UNAVAILABLE"));
    expect(result.current.notice).toBe(ACTION_MESSAGES.UNAVAILABLE);

    // The next write is not stuck behind the one that failed.
    await act(async () => {
      outcome = await result.current.commit("card-2", async () => OK);
    });
    expect(outcome).toEqual(OK);
    expect(result.current.busyKeys.size).toBe(0);
  });

  it("frees the key and moves the queue on even when the interceptor itself throws", async () => {
    const { result } = renderWrites(async () => {
      throw new Error("interceptor down");
    });

    await act(async () => {
      await expect(result.current.commit("card-1", async () => OK)).rejects.toThrow(
        "interceptor down",
      );
    });
    expect(result.current.busyKeys.size).toBe(0);
    // Nothing settled, so nothing is said — and the next key is not blocked.
    expect(result.current.notice).toBeNull();
  });
});
