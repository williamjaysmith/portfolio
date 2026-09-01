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

const TABLES = [
  { table: "categories", filter: (id: string) => `household_id=eq.${id}` },
  { table: "household_settings", filter: (id: string) => `household_id=eq.${id}` },
  { table: "households", filter: (id: string) => `id=eq.${id}` },
] as const;

export function useFamilyRealtime(householdId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: familyKeys.all });

    let channel = supabase.channel(`family:${householdId}`);
    for (const { table, filter } of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "family", table, filter: filter(householdId) },
        invalidate,
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}
