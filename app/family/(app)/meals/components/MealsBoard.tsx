"use client";

import { BookOpen, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo } from "react";

import { rowLayoutOf } from "@/lib/family/lists/layout";
import { expandMeals } from "@/lib/family/meals/expand";
import { slotsOf } from "@/lib/family/meals/slots";
import { shownCategoriesOf } from "@/lib/family/meals/visibility";
import { dayWordsOf } from "@/lib/family/meals/week";
import { useMealCategories, useMeals, useRecipes } from "@/lib/family/queries";
import type { Meal, MealCategory, MealOccurrence, Recipe } from "@/lib/family/types";

import { BoardNotice } from "../../components/BoardNotice";
import { useColumnPage } from "../../components/ColumnPager";
import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily } from "../../components/FamilyProvider";
import { PagedColumns, type PagedColumn } from "../../components/PagedColumns";
import { useBoardGeometry } from "../../components/useBoardGeometry";
import { CategoriesSheet } from "./CategoriesSheet";
import { CategoryForm } from "./CategoryForm";
import { DAY_HEADER_CLASS, MealDayColumn } from "./MealDayColumn";
import { MealRail } from "./MealRail";
import { MealSurfaces, useMealSurfaceModel } from "./MealSurfaces";
import { WeekNav } from "./WeekNav";
import { useHiddenMealtimes } from "./useHiddenMealtimes";
import { useMealWeek } from "./useMealWeek";

/**
 * 006 T034: the Meals tab — FR-602's week grid on the shipped board chassis
 * (R606), the third board to mount it after Rewards and Lists:
 *
 *   useBoardGeometry      measures the strip against `--fam-meal-cell-w`, and
 *                         applies `rowLayoutOf` — whole day columns or a pager,
 *                         never a second row (FR-603)
 *   useColumnPage         which slice of the week is on screen
 *   ColumnPager           the swipe and the arrow keys between slices
 *   useMealWeek           the household's week, the arrows, Today (R606)
 *   useHiddenMealtimes    the per-device hidden rows (FR-611, R609)
 *
 * **The columns are the seven days of the shown week**, each a stack of one
 * cell per shown mealtime, with the rail beside the strip. The tab holds the
 * household's three reads once (R605) and expands the week's meals with the
 * calendar's rule walk (R602).
 *
 * **The model is split from the start** (plan §V): `useMealsData` the reads and
 * the expansion, `useMealsView` the chassis, and `useMealSurfaceModel` the
 * surfaces and the queue — the same model the Week calendar mounts (FR-636),
 * so the popover, the sheets and the recipes pane are one code path. Every
 * commit goes through the shipped `withActor` interceptor (FR-639) and nothing
 * is written to the cache by hand (FR-642). Only the mealtime sheets are the
 * tab's own.
 */

const FAB_LABEL = "Add Meal";
const READ_FAILED = "Meals could not be loaded.";
const NO_MEALTIMES = "No mealtimes shown on this device";

/* ------------------------------------------------------------------ data -- */

export interface MealsBoardProps {
  initialCategories: MealCategory[];
  initialRecipes: Recipe[];
  initialMeals: Meal[];
  /** The server's household-local today, for the first paint. */
  initialToday: string;
}

const NO_CATEGORIES: MealCategory[] = [];
const NO_RECIPES: Recipe[] = [];
const NO_MEALS: Meal[] = [];

interface MealsData {
  categories: readonly MealCategory[];
  shownCategories: readonly MealCategory[];
  recipes: readonly Recipe[];
  meals: readonly Meal[];
  occurrences: readonly MealOccurrence[];
  slots: ReadonlyMap<string, MealOccurrence[]>;
  error: Error | null;
}

function useMealsData(
  householdId: string,
  props: MealsBoardProps,
  dates: readonly string[],
  zone: string,
  hiddenIds: ReadonlySet<string>,
): MealsData {
  const categories = useMealCategories(householdId, props.initialCategories);
  const recipes = useRecipes(householdId, props.initialRecipes);
  const meals = useMeals(householdId, props.initialMeals);
  const all = categories.data ?? NO_CATEGORIES;
  const recipeRows = recipes.data ?? NO_RECIPES;
  const mealRows = meals.data ?? NO_MEALS;

  const shownCategories = useMemo(() => shownCategoriesOf(all, hiddenIds), [all, hiddenIds]);
  const occurrences = useMemo(
    () => expandMeals(mealRows, { start: dates[0], end: dates[dates.length - 1] }, zone),
    [mealRows, dates, zone],
  );
  const slots = useMemo(() => slotsOf(occurrences), [occurrences]);

  return {
    categories: all,
    shownCategories,
    recipes: recipeRows,
    meals: mealRows,
    occurrences,
    slots,
    error: categories.error ?? recipes.error ?? meals.error,
  };
}

/* ------------------------------------------------------------------ view -- */

function useMealsView(columnCount: number) {
  const geometry = useBoardGeometry(columnCount, { widthToken: "--fam-meal-cell-w", layoutOf: rowLayoutOf });
  const page = useColumnPage({ columnCount, perRow: geometry.layout.perRow, mode: geometry.layout.mode });
  return { layout: geometry.layout, boardRef: geometry.boardRef, page };
}

/* ----------------------------------------------------------------- model -- */

function useMealsBoardModel(props: MealsBoardProps) {
  const { householdId, settings, isParent } = useFamily();
  const week = useMealWeek({ zone: settings.timezone, startWeekOn: settings.startWeekOn, initialToday: props.initialToday });
  const hidden = useHiddenMealtimes();
  const data = useMealsData(householdId, props, week.dates, settings.timezone, hidden.hiddenIds);
  const view = useMealsView(week.dates.length);
  const surfaces = useMealSurfaceModel({
    categories: data.categories,
    recipes: data.recipes,
    meals: data.meals,
    occurrences: data.occurrences,
    todayDate: week.todayDate,
  });

  const { openAdd, openPopover } = surfaces.editor;
  const firstMealtime = data.shownCategories[0]?.id ?? data.categories[0]?.id;
  const addFromFab = useCallback(() => {
    if (firstMealtime !== undefined) openAdd({ date: week.todayDate, categoryId: firstMealtime });
  }, [openAdd, week.todayDate, firstMealtime]);
  useRegisterFabAction(FAB_LABEL, addFromFab);

  return {
    ...view,
    week,
    hidden,
    data,
    surfaces,
    isParent,
    onAdd: openAdd,
    onOpen: openPopover,
    notice: data.error === null ? surfaces.notice : READ_FAILED,
  };
}

type MealsBoardModel = ReturnType<typeof useMealsBoardModel>;

function drawnColumnsOf(m: MealsBoardModel): PagedColumn[] {
  return m.week.dates.map((date) => ({
    label: dayWordsOf(date),
    node: (
      <MealDayColumn
        key={date}
        date={date}
        todayDate={m.week.todayDate}
        categories={m.data.shownCategories}
        slots={m.data.slots}
        recipeNames={m.surfaces.recipeNames}
        onAdd={m.onAdd}
        onAddAnother={m.onAdd}
        onOpen={m.onOpen}
      />
    ),
  }));
}

/** The tab's own two surfaces (US1): the Categories sheet and a mealtime's edit form. */
function MealtimeSurfaces({ m }: { m: MealsBoardModel }) {
  const { editor } = m.surfaces;
  const { surface } = editor;
  if (surface.kind === "categories") {
    return <CategoriesSheet categories={m.data.categories} hidden={m.hidden} canEdit={m.isParent} onEdit={editor.openMealtime} onClose={editor.close} />;
  }
  if (surface.kind === "mealtime") {
    return <CategoryForm category={surface.category} categories={m.data.categories} onSubmit={editor.submitMealtime} onClose={editor.close} />;
  }
  return null;
}

/* ------------------------------------------------------------------ view -- */

const TOOL =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full bg-(--fam-pill-btn-bg) px-4 text-(length:--fam-fs-pill) " +
  "font-medium text-(--fam-text-muted)";

export function MealsBoard(props: MealsBoardProps) {
  const m = useMealsBoardModel(props);
  const { editor } = m.surfaces;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 pt-2">
      <div className="flex flex-wrap items-center gap-2 px-(--fam-edge-inset)">
        <WeekNav label={m.week.label} isCurrentWeek={m.week.isCurrentWeek} onPage={m.week.page} onToday={m.week.today} />
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => editor.openRecipes(null)} className={TOOL} aria-haspopup="dialog">
            <BookOpen aria-hidden="true" size={20} strokeWidth={1.5} />
            Recipes
          </button>
          <button type="button" onClick={editor.openCategories} className={TOOL} aria-haspopup="dialog">
            <SlidersHorizontal aria-hidden="true" size={20} strokeWidth={1.5} />
            Categories
          </button>
        </div>
      </div>

      <BoardNotice notice={m.notice} />

      {m.data.shownCategories.length === 0 ? (
        <p className="px-(--fam-edge-inset) text-(length:--fam-fs-body) text-(--fam-text-secondary)">{NO_MEALTIMES}</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-(--fam-meal-gap-x) px-(--fam-edge-inset)">
          <MealRail categories={m.data.shownCategories} headerClassName={DAY_HEADER_CLASS} />
          <div className="min-w-0 flex-1">
            <PagedColumns
              page={m.page}
              boardRef={m.boardRef}
              perRow={m.layout.perRow}
              columns={drawnColumnsOf(m)}
              gapClassName="gap-(--fam-meal-gap-x)"
              label="Meals"
            />
          </div>
        </div>
      )}

      <MealtimeSurfaces m={m} />
      <MealSurfaces m={m.surfaces} />
    </div>
  );
}
