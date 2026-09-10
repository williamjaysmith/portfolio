"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { invalidationPrefixesFor } from "@/lib/family/invalidation";
import { createClient } from "@/lib/family/supabase/client";

/**
 * One Realtime channel for the whole shell (D17): a change made on the phone
 * shows up on the wall tablet without a refresh.
 *
 * Payloads are used only as a signal to refetch — never rendered — because
 * Realtime does not apply the same column privileges as a normal read.
 */

/**
 * **Every table subscribes UNFILTERED, and that is load-bearing (012).**
 *
 * Seventeen of these always were, for the reason R209/R324/Assumption 39 gives:
 * a DELETE payload carries primary keys only, never `household_id`, so a
 * filtered subscription silently never fires on a delete — and deletes are the
 * hot path here (an un-complete, an unskip, Clear Completed, Delete list).
 *
 * Three — `categories`, `household_settings`, `households` — carried a filter
 * until 012, and it **broke live updates entirely, for every table**. Bisected
 * in a browser against the local stack:
 *
 *   - one unfiltered binding: registers in `realtime.subscription`, delivers;
 *   - all twenty unfiltered: registers, delivers;
 *   - all twenty with ONE filter added back: **nothing registers at all**, and
 *     the channel still reports `SUBSCRIBED`.
 *
 * So a single filtered binding discards the whole channel's bindings, and it
 * does it without an error anyone can see. That is why two devices never
 * watched each other, and why nothing ever said so.
 *
 * **What a filter was buying, and what it was not.** It was bandwidth: fewer
 * payloads reaching a client that would ignore them anyway. It was never
 * privacy — payloads are a refetch signal and are never rendered (see below),
 * and the refetch that follows goes through RLS like every other read. So its
 * loss costs nothing this app relies on.
 */
type TableSubscription = {
  readonly table: string;
};

const TABLES: readonly TableSubscription[] = [
  { table: "categories" },
  { table: "household_settings" },
  { table: "households" },
  { table: "events" },
  { table: "event_categories" },
  { table: "event_exceptions" },
  // Tasks (FR-392, SC-306). Unfiltered for the reason above, which this phase
  // makes routine rather than rare: an un-complete and an unskip each DELETE a
  // `task_resolutions` row, so deletes are the hot path, not the edge case.
  //
  // Completing a Completed Date occurrence creates a FUTURE day's occurrence,
  // and the cursor read that publishes it is unwindowed — so a sweep narrowed to
  // the DISPLAYED DAY would break that mode first and quietly. 012 narrows by
  // domain instead, and `invalidation.ts` keeps `task-cursors` in the task
  // domain for exactly this reason. The warning stands; what satisfies it moved.
  { table: "tasks" },
  { table: "task_assignees" },
  { table: "task_resolutions" },
  { table: "task_box_items" },
  // Rewards (004 FR-410, R411). Unfiltered for the same reason: a reward's
  // deletion and a Profile's cascade are DELETEs, and every un-tick's ledger
  // row is what moves the other device's balance, pill, bar and button — which
  // is why every task-domain notice reaches the rewards domain too (R407,
  // `invalidation.ts`). Replica identity is left at default, so a DELETE payload
  // carries a primary key and never a reward's name.
  { table: "rewards" },
  { table: "reward_eligibilities" },
  { table: "star_entries" },
  { table: "redemptions" },
  // Lists (005 FR-538, R506). Unfiltered for the same reason, and this phase
  // deletes on the hot path: Clear Completed and Delete list are DELETEs whose
  // payloads carry only a key. Both keys sit in the lists domain.
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
    // 012: what the table can have changed, not everything the household has.
    // Until this phase the channel delivered nothing, so a bare
    // `familyKeys.all` sweep cost nobody anything; now every change reaches
    // every open device, and a ticked chore was refetching the week's events,
    // the meal plan and the shopping lists on the phone as well. It narrows by
    // DOMAIN and never by window — see `lib/family/invalidation.ts` for why the
    // task domain must always keep `task-cursors`.
    const invalidateFor = (table: string) => {
      for (const queryKey of invalidationPrefixesFor(table, householdId)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    let channel = supabase.channel(`family:${householdId}`);
    for (const { table } of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "family", table }, () =>
        invalidateFor(table),
      );
    }
    channel.subscribe(reportChannelStatus);

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}
