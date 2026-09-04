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
  // Optional: the calendar tables subscribe UNFILTERED (R209, Assumption 39) —
  // DELETE payloads carry primary keys only, never household_id, so a filtered
  // subscription would silently never fire on deletes.
  readonly filter?: (householdId: string) => string;
};

const TABLES: readonly TableSubscription[] = [
  { table: "categories", filter: (id) => `household_id=eq.${id}` },
  { table: "household_settings", filter: (id) => `household_id=eq.${id}` },
  { table: "households", filter: (id) => `id=eq.${id}` },
  { table: "events" },
  { table: "event_categories" },
  { table: "event_exceptions" },
];

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
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}
