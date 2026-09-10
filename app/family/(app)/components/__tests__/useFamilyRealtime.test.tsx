import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { familyKeys } from "@/lib/family/queries";

import { useFamilyRealtime } from "../useFamilyRealtime";

/**
 * FR-276 / Assumption 39 / R209: the calendar tables must be subscribed with
 * NO server-side `household_id` filter — DELETE payloads carry primary keys
 * only, so a filtered subscription silently never fires on deletes — and no
 * notice may use its PAYLOAD's content, because Realtime does not apply a normal
 * read's column privileges to payloads. (The breadth of the invalidation was
 * also pinned here until 012; it now belongs to `lib/family/invalidation.ts`.)
 *
 * FR-392 / R324 puts the four task tables on the same terms, and raises the
 * stakes: Phase 3 DELETES on the hot path (every un-complete and every unskip),
 * so a filter here would not merely miss a rare delete but the commonest write
 * of the phase. The status callback is the other half — a channel that never
 * subscribes fails silently, and the wall tablet would go on showing yesterday.
 *
 * 004 FR-410 / R411 adds the four rewards tables on the same terms: an un-tick
 * writes a ledger row and a reward's deletion is a DELETE, and both must reach
 * the other device's balance, pill, bar and button within seconds.
 *
 * **012 extends "no filter" from most tables to ALL of them, and it is no longer
 * an optimisation — it is the difference between this hook working and doing
 * nothing at all.** A single filtered binding makes the server discard every
 * binding on the channel, silently, while the client still reports
 * `SUBSCRIBED`. Three tables carried a filter from Phase 1, so live updates had
 * never worked; the two-browser journeys that should have caught it were
 * skipping, because their environment check counts subscription rows that
 * outlive the socket that made them. Both are fixed in 012.
 */

type CapturedSubscription = {
  params: Record<string, unknown>;
  handler: (payload?: unknown) => void;
};

type StatusCallback = (status: string, error?: Error) => void;

const captured = vi.hoisted(() => ({
  subscriptions: [] as CapturedSubscription[],
  onStatus: null as StatusCallback | null,
  removed: 0,
}));

vi.mock("@/lib/family/supabase/client", () => {
  const channel = {
    on(_event: string, params: Record<string, unknown>, handler: (payload?: unknown) => void) {
      captured.subscriptions.push({ params, handler });
      return channel;
    },
    subscribe(onStatus?: StatusCallback) {
      captured.onStatus = onStatus ?? null;
      return channel;
    },
  };
  return {
    createClient: () => ({
      channel: () => channel,
      removeChannel: () => {
        captured.removed += 1;
        return Promise.resolve("ok");
      },
    }),
  };
});

const HOUSEHOLD_ID = "household-1";
const UNFILTERED_TABLES = [
  "events",
  "event_categories",
  "event_exceptions",
  "tasks",
  "task_assignees",
  "task_resolutions",
  "task_box_items",
  "rewards",
  "reward_eligibilities",
  "star_entries",
  "redemptions",
  "lists",
  "list_items",
  "meal_categories",
  "recipes",
  "meals",
  "meal_exceptions",
] as const;

function renderRealtime() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useFamilyRealtime(HOUSEHOLD_ID), { wrapper });
  return { invalidateSpy, ...rendered };
}

function subscriptionsByTable(): Map<unknown, Record<string, unknown>> {
  return new Map(captured.subscriptions.map(({ params }) => [params.table, params]));
}

describe("useFamilyRealtime", () => {
  beforeEach(() => {
    captured.subscriptions.length = 0;
    captured.onStatus = null;
    captured.removed = 0;
  });

  it("subscribes the calendar and task tables with no filter member at all", () => {
    renderRealtime();

    const byTable = subscriptionsByTable();
    for (const table of UNFILTERED_TABLES) {
      const params = byTable.get(table);
      expect(params, `missing subscription for ${table}`).toBeDefined();
      expect(params).not.toHaveProperty("filter");
      expect(params).toMatchObject({ event: "*", schema: "family", table });
    }
  });

  /**
   * 012 — the test that would have caught the defect that made this whole hook
   * a no-op.
   *
   * Phase 1 filtered three tables by household, and the previous version of
   * this test pinned those filters as a guarantee. They were not a guarantee;
   * they were the bug. **One filtered binding discards every binding on the
   * channel**, server-side, while `subscribe()` still reports `SUBSCRIBED` —
   * so the household's two devices never saw each other and nothing ever
   * said so. Bisected in a browser: one unfiltered binding delivers, twenty
   * unfiltered deliver, twenty with a single filter register nothing at all.
   *
   * A filter was only ever saving bandwidth. It was never access control —
   * a payload is a refetch signal, never rendered, and the refetch goes
   * through RLS like every other read — so there is nothing to weigh against
   * the feature working.
   *
   * This is asserted over EVERY table rather than the three, so the next
   * person to reach for `filter` has to delete this test to do it.
   */
  it("carries no filter on any table, because one filter kills them all (012)", () => {
    renderRealtime();

    for (const { params } of captured.subscriptions) {
      expect(params, `${String(params.table)} must not be filtered`).not.toHaveProperty("filter");
    }
    expect(captured.subscriptions).toHaveLength(3 + UNFILTERED_TABLES.length);
    // And the three that used to be filtered are still subscribed — dropping
    // the filter must not have dropped the table.
    const byTable = subscriptionsByTable();
    for (const table of ["categories", "household_settings", "households"]) {
      expect(byTable.get(table), `missing subscription for ${table}`).toBeDefined();
    }
  });

  /**
   * The payload half of the old contract still holds and is what matters for
   * privacy: a notice is a SIGNAL, and nothing in it is read. Realtime does not
   * apply a normal read's column privileges, so the refetch — which does — is
   * the only thing allowed to put data on a screen.
   *
   * What changed in 012 is the breadth. Every notice used to invalidate
   * `familyKeys.all`, which cost nothing while the channel delivered nothing;
   * now that it delivers, a ticked chore was refetching the week's events, the
   * meal plan and the shopping lists on every open device. Which keys each table
   * reaches is `lib/family/invalidation.ts`'s business and is tested there,
   * exhaustively and including the orphan check. What is asserted here is only
   * the wiring: the table's own prefixes, and no use of the payload.
   */
  it("invalidates by the changed table's own prefixes, never reading the payload", () => {
    const { invalidateSpy } = renderRealtime();
    const byTable = subscriptionsByTable();

    // A lists notice touches the two list reads and nothing else.
    const listItems = captured.subscriptions.find(({ params }) => params.table === "list_items");
    listItems?.handler({ eventType: "DELETE", old: { id: "pk-only" }, new: {} });

    expect(invalidateSpy.mock.calls.map(([arg]) => arg)).toEqual([
      { queryKey: ["family", "lists", HOUSEHOLD_ID] },
      { queryKey: ["family", "list-items", HOUSEHOLD_ID] },
    ]);

    // A Profile is wide and rare, and still sweeps the household.
    invalidateSpy.mockClear();
    const categories = captured.subscriptions.find(({ params }) => params.table === "categories");
    categories?.handler({ eventType: "UPDATE", old: {}, new: { id: "pk-only" } });

    expect(invalidateSpy.mock.calls).toEqual([[{ queryKey: familyKeys.all }]]);
    expect(byTable.get("list_items"), "the lists binding exists to be driven").toBeDefined();
  });

  it("still answers a notice for every table it subscribed to", () => {
    const { invalidateSpy } = renderRealtime();

    for (const { handler } of captured.subscriptions) {
      handler({ eventType: "DELETE", old: { id: "pk-only" }, new: {} });
    }

    // Narrowing must not have left a table whose notice does nothing at all —
    // the silent failure this change could have introduced.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(
      captured.subscriptions.length,
    );
  });

  it("reports a subscription that failed rather than going quietly dead", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderRealtime();

    captured.onStatus?.("CHANNEL_ERROR", new Error("websocket closed"));
    captured.onStatus?.("TIMED_OUT");

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("CHANNEL_ERROR");
    expect(String(errorSpy.mock.calls[1]?.[0])).toContain("TIMED_OUT");
    errorSpy.mockRestore();
  });

  it("says nothing when the channel subscribes or is closed on unmount", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderRealtime();

    captured.onStatus?.("SUBSCRIBED");
    captured.onStatus?.("CLOSED");

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderRealtime();
    unmount();

    expect(captured.removed).toBe(1);
  });
});
