import type { Metadata } from "next";

import { getMember } from "@/lib/family/guards";
import { fetchListItems, fetchLists } from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/server";
import type { List, ListItem } from "@/lib/family/types";

import { ListsBoard } from "./components/ListsBoard";

export const metadata: Metadata = { title: "Lists" };

/**
 * The Lists tab (005 T026, FR-501): the Phase 1 placeholder replaced, in the
 * same place behind the same tab, label and list icon. A server component
 * that performs the tab's **two** reads under the signed-in session (RLS, the
 * server client — never the admin client) and seeds each as `initialData` for
 * its own key (R506), so the wall tablet's first paint is the tab itself.
 *
 * Neither read is day-dependent and neither is windowed: every list and every
 * item are the whole tab. The Parents only filter is the client's (R505) — the
 * server reads what RLS allows, which is the household.
 *
 * The layout above is the gate; this page only has to decline to fetch. The
 * degradation path is the Rewards page's (constitution §VI): the reads are
 * taken together, and a failure renders an honest unavailable state with the
 * tab's chrome intact rather than throwing the route.
 */

interface ListsData {
  lists: List[];
  items: ListItem[];
}

async function loadLists(householdId: string): Promise<ListsData | null> {
  try {
    const supabase = await createClient();
    const [lists, items] = await Promise.all([
      fetchLists(supabase, householdId),
      fetchListItems(supabase, householdId),
    ]);
    return { lists, items };
  } catch (error) {
    console.error("[family] the lists tab could not be read", error);
    return null;
  }
}

function ListsUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-(--fam-edge-inset) text-center">
      <h1 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        Lists
      </h1>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        Lists can&rsquo;t be loaded right now. Everything else still works.
      </p>
    </div>
  );
}

export default async function ListsPage() {
  const member = await getMember();
  if (member === null) return null;

  const data = await loadLists(member.householdId);
  if (data === null) return <ListsUnavailable />;

  return <ListsBoard initialLists={data.lists} initialItems={data.items} />;
}
