import type { Metadata } from "next";

import { localDateOf } from "@/lib/family/calendar/dates";
import { getMember } from "@/lib/family/guards";
import { fetchMealCategories, fetchMeals, fetchRecipes, fetchSettings } from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/server";
import type { Meal, MealCategory, Recipe } from "@/lib/family/types";

import { MealsBoard } from "./components/MealsBoard";

export const metadata: Metadata = { title: "Meals" };

/**
 * The Meals tab (006 T032, FR-601): the Phase 1 placeholder replaced, in the
 * same place behind the same tab, label and icon. A server component that
 * performs the tab's **three** reads under the signed-in session (RLS, the
 * server client — never the admin client) and seeds each as `initialData` for
 * its own key (R605), so the wall tablet's first paint is the grid itself. It
 * also hands over the household-local date, so the first paint shows this
 * week before the client clock has published.
 *
 * The layout above is the gate; this page only has to decline to fetch. The
 * degradation path is the Lists page's (constitution §VI): the reads are taken
 * together, and a failure renders an honest unavailable state.
 */

interface MealsData {
  categories: MealCategory[];
  recipes: Recipe[];
  meals: Meal[];
  today: string;
}

async function loadMeals(householdId: string): Promise<MealsData | null> {
  try {
    const supabase = await createClient();
    const [settings, categories, recipes, meals] = await Promise.all([
      fetchSettings(supabase, householdId),
      fetchMealCategories(supabase, householdId),
      fetchRecipes(supabase, householdId),
      fetchMeals(supabase, householdId),
    ]);
    if (settings === null) throw new Error("the household has no settings row");
    return { categories, recipes, meals, today: localDateOf(settings.timezone, Date.now()) };
  } catch (error) {
    console.error("[family] the meals tab could not be read", error);
    return null;
  }
}

function MealsUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-(--fam-edge-inset) text-center">
      <p className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        Meals can&rsquo;t be loaded right now.
      </p>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">Everything else still works.</p>
    </div>
  );
}

export default async function MealsPage() {
  const member = await getMember();
  if (member === null) return null;
  const data = await loadMeals(member.householdId);
  if (data === null) return <MealsUnavailable />;
  return (
    <MealsBoard
      initialCategories={data.categories}
      initialRecipes={data.recipes}
      initialMeals={data.meals}
      initialToday={data.today}
    />
  );
}
