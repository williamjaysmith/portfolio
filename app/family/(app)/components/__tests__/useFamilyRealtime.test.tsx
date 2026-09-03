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
 */

type CapturedSubscription = {
  params: Record<string, unknown>;
  handler: (payload?: unknown) => void;
};

const captured = vi.hoisted(() => ({
  subscriptions: [] as CapturedSubscription[],
  removed: 0,
}));

vi.mock("@/lib/family/supabase/client", () => {
  const channel = {
    on(_event: string, params: Record<string, unknown>, handler: (payload?: unknown) => void) {
      captured.subscriptions.push({ params, handler });
      return channel;
    },
    subscribe() {
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
const CALENDAR_TABLES = ["events", "event_categories", "event_exceptions"] as const;

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
    captured.removed = 0;
  });

  it("subscribes the three calendar tables with no filter member at all", () => {
    renderRealtime();

    const byTable = subscriptionsByTable();
    for (const table of CALENDAR_TABLES) {
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
    expect(captured.subscriptions).toHaveLength(6);
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

  it("removes the channel on unmount", () => {
    const { unmount } = renderRealtime();
    unmount();

    expect(captured.removed).toBe(1);
  });
});
