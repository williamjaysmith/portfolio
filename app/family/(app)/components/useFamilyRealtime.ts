"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { familyKeys } from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/client";

/**
 * One Realtime channel for the whole shell (D17): a change made on the phone
 * shows up on the wall tablet without a refresh.
 *
 * Payloads are used only as a signal to refetch — never rendered — because
 * Realtime does not apply the same column privileges as a normal read.
 */

type TableSubscription = {
  readonly table: string;
  // Optional: the calendar and task tables subscribe UNFILTERED (R209, R324,
  // Assumption 39) — DELETE payloads carry primary keys only, never
  // household_id, so a filtered subscription would silently never fire on
  // deletes.
  readonly filter?: (householdId: string) => string;
};

const TABLES: readonly TableSubscription[] = [
  { table: "categories", filter: (id) => `household_id=eq.${id}` },
  { table: "household_settings", filter: (id) => `household_id=eq.${id}` },
  { table: "households", filter: (id) => `id=eq.${id}` },
  { table: "events" },
  { table: "event_categories" },
  { table: "event_exceptions" },
  // Tasks (FR-392, SC-306). Unfiltered for the reason above, which this phase
  // makes routine rather than rare: an un-complete and an unskip each DELETE a
  // `task_resolutions` row, so deletes are the hot path, not the edge case.
  //
  // The bare `familyKeys.all` invalidation below is now LOAD-BEARING, not
  // merely convenient: completing a Completed Date occurrence creates a FUTURE
  // day's occurrence, and the cursor read that publishes it is unwindowed, so
  // narrowing this sweep to the displayed day would break that mode first.
  { table: "tasks" },
  { table: "task_assignees" },
  { table: "task_resolutions" },
  { table: "task_box_items" },
  // Rewards (004 FR-410, R411). Unfiltered for the same reason: a reward's
  // deletion and a Profile's cascade are DELETEs, and every un-tick's ledger
  // row is what moves the other device's balance, pill, bar and button. The
  // bare sweep below reaches the four new keys (`starWeek`, `balances`,
  // `rewards`, `redemptions`) because they are prefix-shaped under
  // `familyKeys.all` (R407). Replica identity is left at default, so a DELETE
  // payload carries a primary key and never a reward's name.
  { table: "rewards" },
  { table: "reward_eligibilities" },
  { table: "star_entries" },
  { table: "redemptions" },
  // Lists (005 FR-538, R506). Unfiltered for the same reason, and this phase
  // deletes on the hot path: Clear Completed and Delete list are DELETEs whose
  // payloads carry only a key. The bare sweep reaches `lists` and `listItems`
  // because they are prefix-shaped under `familyKeys.all`.
  { table: "lists" },
  { table: "list_items" },
  // Meals (006 FR-643, R605). Unfiltered for the same reason: "This recipe and
  // planned meals" and Delete meal are DELETEs whose payloads carry only a key.
  // The bare sweep reaches `mealCategories`, `recipes` and `meals` because they
  // are prefix-shaped under `familyKeys.all`.
  { table: "meal_categories" },
  { table: "recipes" },
  { table: "meals" },
  { table: "meal_exceptions" },
];

/** `CLOSED` is the ordinary unmount; only these two mean nothing will arrive. */
const FAILED_STATUSES: readonly string[] = ["CHANNEL_ERROR", "TIMED_OUT"];

/**
 * A channel that never subscribes fails silently — the screen keeps showing
 * whatever it drew last and nobody learns the house has moved on. Said out
 * loud, in the one place that knows, rather than diagnosed from a stale board.
 */
function reportChannelStatus(status: string, error?: Error): void {
  if (!FAILED_STATUSES.includes(status)) return;
  console.error(`[family] realtime channel ${status}`, error?.message ?? "no reason reported");
}

export function useFamilyRealtime(householdId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: familyKeys.all });

    let channel = supabase.channel(`family:${householdId}`);
    for (const { table, filter } of TABLES) {
      channel = channel.on(
        "postgres_changes",
        // The spread keeps the params free of a `filter` key when none applies.
        { event: "*", schema: "family", table, ...(filter && { filter: filter(householdId) }) },
        invalidate,
      );
    }
    channel.subscribe(reportChannelStatus);

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}
