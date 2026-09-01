import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { familyKeys } from "@/lib/family/queries";
import type { ActionResult } from "@/lib/family/errors";
import type { ActorSession } from "@/lib/family/types";

import { fail, ok } from "./action-result";
import { makeActor } from "./family-test-utils";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const { usePunchInPrompt } = await import("../usePunchInPrompt");

/**
 * US2 and contracts → error-handling row 3 (D12): a control that wants to
 * change something either has an actor or asks for one, and a cookie that
 * lapses mid-edit costs the person one PIN rather than their work.
 */

interface Pending<T> {
  settled: boolean;
  value: ActionResult<T> | null;
}

/** Watch a promise without awaiting it — `withActor` deliberately hangs on the sheet. */
function track<T>(promise: Promise<ActionResult<T>>): Pending<T> {
  const state: Pending<T> = { settled: false, value: null };
  void promise.then((value) => {
    state.settled = true;
    state.value = value;
  });
  return state;
}

function renderPrompt(actor: ActorSession | null = null) {
  const setActor = vi.fn();
  const onSuccess = vi.fn();
  // The shell runs inside the household's query cache; a lost session empties it.
  const queryClient = new QueryClient();
  queryClient.setQueryData(familyKeys.categories("household-1"), ["stale household data"]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => usePunchInPrompt({ actor, setActor, onSuccess }), { wrapper });
  return { result, setActor, onSuccess, queryClient };
}

const saved = ok("saved");

describe("usePunchInPrompt", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("holds the action open until somebody says who they are", async () => {
    const { result } = renderPrompt();
    const run = vi.fn(async () => saved);
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });

    expect(result.current.sheetOpen).toBe(true);
    expect(pending.settled).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses without running the action when the sheet is dismissed", async () => {
    const { result, setActor, onSuccess } = renderPrompt();
    const run = vi.fn(async () => saved);
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });
    await act(async () => {
      result.current.resolveSheet(null);
    });

    expect(pending.value).toEqual(fail("NO_ACTOR"));
    expect(run).not.toHaveBeenCalled();
    expect(setActor).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.sheetOpen).toBe(false);
  });

  it("adopts the session and runs the action once when someone punches in", async () => {
    const { result, setActor, onSuccess } = renderPrompt();
    const session = makeActor("parent");
    const run = vi.fn(async () => saved);
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });
    await act(async () => {
      result.current.resolveSheet(session);
    });

    expect(setActor).toHaveBeenCalledWith(session);
    expect(run).toHaveBeenCalledTimes(1);
    expect(pending.value).toBe(saved);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.sheetOpen).toBe(false);
  });

  it("never interrupts somebody who is already punched in", async () => {
    const { result, onSuccess } = renderPrompt(makeActor("parent"));
    const run = vi.fn(async () => saved);
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });

    expect(result.current.sheetOpen).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(pending.value).toBe(saved);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("asks again and retries exactly once when the cookie lapsed mid-edit", async () => {
    const lapsed = fail("NO_ACTOR", "The cookie went stale between render and save.");
    const run = vi
      .fn<() => Promise<ActionResult<string>>>()
      .mockResolvedValueOnce(lapsed)
      .mockResolvedValueOnce(saved);
    const { result, setActor, onSuccess } = renderPrompt(makeActor("parent"));
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });

    // The stale actor is dropped from the interface before the sheet reopens.
    expect(setActor).toHaveBeenCalledWith(null);
    expect(result.current.sheetOpen).toBe(true);
    expect(pending.settled).toBe(false);

    await act(async () => {
      result.current.resolveSheet(makeActor("parent"));
    });

    expect(run).toHaveBeenCalledTimes(2);
    expect(pending.value).toBe(saved);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("gives back the original failure when the second prompt is cancelled", async () => {
    const lapsed = fail("NO_ACTOR", "The cookie went stale between render and save.");
    const run = vi.fn(async (): Promise<ActionResult<string>> => lapsed);
    const { result, onSuccess } = renderPrompt(makeActor("parent"));
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });
    await act(async () => {
      result.current.resolveSheet(null);
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(pending.value).toBe(lapsed);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("leaves a refusal alone — only a missing actor reopens the sheet", async () => {
    const refused = fail("FORBIDDEN");
    const run = vi.fn(async (): Promise<ActionResult<string>> => refused);
    const { result, setActor, onSuccess } = renderPrompt(makeActor("member"));
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(pending.value).toBe(refused);
    expect(result.current.sheetOpen).toBe(false);
    expect(setActor).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("resolves a bare punch-in prompt with the session the sheet reports", async () => {
    const { result, setActor } = renderPrompt();
    const session = makeActor("parent");
    let opened: ActorSession | null | undefined;

    await act(async () => {
      void result.current.openPunchIn().then((value) => {
        opened = value;
      });
    });
    expect(result.current.sheetOpen).toBe(true);

    await act(async () => {
      result.current.resolveSheet(session);
    });

    expect(opened).toBe(session);
    expect(setActor).toHaveBeenCalledWith(session);
  });

  // Spec edge case: "a session expires while the app is open" — the person is
  // returned to sign-in without a crash and without exposing stale data.
  it("empties the cache and returns to sign-in when the session has expired", async () => {
    const expired = fail("NOT_AUTHENTICATED");
    const run = vi.fn(async (): Promise<ActionResult<string>> => expired);
    const { result, queryClient, onSuccess } = renderPrompt(makeActor("parent"));
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });

    expect(pending.value).toBe(expired);
    expect(queryClient.getQueryData(familyKeys.categories("household-1"))).toBeUndefined();
    expect(replace).toHaveBeenCalledWith("/family/sign-in");
    expect(result.current.sheetOpen).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // The documented offline edge case: the action never answers at all.
  it("turns an unreachable action into a refusal rather than a hang", async () => {
    const run = vi.fn(() => Promise.reject(new Error("Failed to fetch")));
    const { result, onSuccess } = renderPrompt(makeActor("parent"));
    let pending!: Pending<string>;

    await act(async () => {
      pending = track(result.current.withActor(run));
    });

    expect(pending.settled).toBe(true);
    expect(pending.value).toEqual(fail("UNAVAILABLE"));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
