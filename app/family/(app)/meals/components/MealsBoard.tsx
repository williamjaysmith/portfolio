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
import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily } from "../../components/FamilyProvider";
import { PagedColumns, type PagedColumn } from "../../components/PagedColumns";
import { useBoardGeometry } from "../../components/useBoardGeometry";
import { CategoriesSheet } from "./CategoriesSheet";
import { CategoryForm } from "./CategoryForm";
import { DAY_HEADER_CLASS, MealDayColumn } from "./MealDayColumn";
import { MealRail } from "./MealRail";
import { MealSurfaces, useMealSurfaceModel } from "./MealSurfaces";
import { distanceInWords } from "@/lib/family/meals/window";

import { DayNav } from "../../components/DayNav";
import { useHiddenMealtimes } from "./useHiddenMealtimes";
import { useMealWindow } from "./useMealWindow";

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

/**
 * The grid measures itself, and that measurement IS the window's width (013
 * FR-1301).
 *
 * There is no pager here any more. Until 013 this hook also held a
 * `useColumnPage` — which slice of a seven-day week was visible — and the board
 * had two independent ways to move: that slice by swipe, and the week by the
 * labelled arrows. On a phone they disagreed and the arrows were the ones that
 * skipped days. The window replaced both, so the only thing left to measure is
 * how many columns fit.
 *
 * `MEASURED_COLUMN_CEILING` is what we ask the measurement about, not what the
 * grid draws: `useBoardGeometry` reports how many of that many fit, and the
 * window is then exactly that wide. Seven, because a week is as much as this
 * grid has ever shown at once and the reference's own layout is seven columns
 * `[VERIFIED]`.
 */
const MEASURED_COLUMN_CEILING = 7;

function useMealsView() {
  const geometry = useBoardGeometry(MEASURED_COLUMN_CEILING, {
    widthToken: "--fam-meal-cell-w",
    layoutOf: rowLayoutOf,
  });
  return { layout: geometry.layout, boardRef: geometry.boardRef };
}

/* ----------------------------------------------------------------- model -- */

function useMealsBoardModel(props: MealsBoardProps) {
  const { householdId, settings, isParent } = useFamily();
  // The measurement comes first: the window's width IS what the grid fits, so
  // the view is read before the window rather than handed a count by it.
  const view = useMealsView();
  const week = useMealWindow({
    zone: settings.timezone,
    initialToday: props.initialToday,
    columns: view.layout.perRow,
  });
  const hidden = useHiddenMealtimes();
  const data = useMealsData(householdId, props, week.dates, settings.timezone, hidden.hiddenIds);

  /**
   * What `PagedColumns` needs, built from the window rather than from a pager
   * (013 FR-1302, FR-1310).
   *
   * **Nothing is held back.** The window is already exactly as wide as the grid
   * fits, so every one of its columns is drawn — `start` 0 through `end` length.
   * That is what keeps the rendered structure the same size before and after the
   * measurement lands, which is why this grid has never shifted its layout and
   * must not start (CLS 0 at four widths, measured).
   *
   * **`paged` stays true, and means "the swipe is live" here.** On a Profile
   * board it means columns are being withheld (FR-396). On this one it means the
   * strip can move, which it always can: the window has no end. Keeping it true
   * preserves the pager's group, its live region and its pan handlers — so the
   * swipe and the arrows now do the SAME thing, one window at a time. Before 013
   * they did different things, and that was the defect.
   */
  const page = useMemo(
    () => ({ paged: true, start: 0, end: week.dates.length, step: week.page }),
    [week.dates.length, week.page],
  );
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
    page,
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
  return m.week.dates.map((date, index) => ({
    label: dayWordsOf(date),
    node: (
      <MealDayColumn
        key={date}
        date={date}
        dividerBefore={index > 0}
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
      {/* Recipes and Categories ride this row as DayNav's children, the way the
          Calendar's view switcher and search box do — 014. They used to sit in
          a wrapper of their own with its own `ml-auto`, which fought the
          cluster's, and the two tabs' toolbars drifted apart from there. */}
      <DayNav
        distance={distanceInWords(m.week.dates.length)}
        label={m.week.label}
        todayDisabled={m.week.isLiveWindow}
        onPage={m.week.page}
        onToday={m.week.today}
      >
        <button type="button" onClick={() => editor.openRecipes(null)} className={TOOL} aria-haspopup="dialog">
          <BookOpen aria-hidden="true" size={20} strokeWidth={1.5} />
          Recipes
        </button>
        <button type="button" onClick={editor.openCategories} className={TOOL} aria-haspopup="dialog">
          <SlidersHorizontal aria-hidden="true" size={20} strokeWidth={1.5} />
          Categories
        </button>
      </DayNav>

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
