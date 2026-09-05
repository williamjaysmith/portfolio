import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { familyKeys } from "@/lib/family/queries";

import { useFamilyRealtime } from "../useFamilyRealtime";

/**
 * FR-276 / Assumption 39 / R209: the calendar tables must be subscribed with
 * NO server-side `household_id` filter — DELETE payloads carry primary keys
 * only, so a filtered subscription silently never fires on deletes — and every
 * notice must stay a bare `invalidateQueries(familyKeys.all)` with no payload
 * content used (Realtime does not apply column privileges to payloads).
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

  it("keeps Phase 1's household-scoped filters on its three tables", () => {
    renderRealtime();

    const byTable = subscriptionsByTable();
    expect(byTable.get("categories")?.filter).toBe(`household_id=eq.${HOUSEHOLD_ID}`);
    expect(byTable.get("household_settings")?.filter).toBe(`household_id=eq.${HOUSEHOLD_ID}`);
    expect(byTable.get("households")?.filter).toBe(`id=eq.${HOUSEHOLD_ID}`);
    expect(captured.subscriptions).toHaveLength(3 + UNFILTERED_TABLES.length);
  });

  it("maps every notice to a bare invalidateQueries(familyKeys.all), payload unused", () => {
    const { invalidateSpy } = renderRealtime();

    for (const { handler } of captured.subscriptions) {
      handler({ eventType: "DELETE", old: { id: "pk-only" }, new: {} });
    }

    expect(invalidateSpy).toHaveBeenCalledTimes(captured.subscriptions.length);
    for (const call of invalidateSpy.mock.calls) {
      expect(call).toEqual([{ queryKey: familyKeys.all }]);
    }
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
