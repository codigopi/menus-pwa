/**
 * Datos listos para pintar la pantalla del menú (Server Components).
 */
import { connection } from "next/server";
import { addDays, dayLabel, isIsoDate, isWeekend, mondayOf, todayIso, weekDays, weekRangeLabel, type IsoDate } from "@/lib/domain/dates";
import { classifyRecipe, type Category, type Meal, type PlanParams } from "@/lib/domain/menu";
import { warningsFor } from "@/lib/domain/menu-planner";
import { totalMinutes } from "@/lib/domain/recipe";
import { listRecipesForMatching } from "@/lib/recipes/repo";
import * as repo from "./repo";

export interface MenuRecipe {
  id: string;
  title: string;
  photo: string | null;
  minutes: number | null;
  category: Category;
}

export interface SlotView {
  id: string;
  date: IsoDate;
  meal: Meal;
  locked: boolean;
  freeText: string | null;
  recipe: MenuRecipe | null;
}

export interface DayView {
  date: IsoDate;
  label: string;
  isToday: boolean;
  slots: SlotView[];
}

export interface MenuView {
  weekStart: IsoDate;
  rangeLabel: string;
  prevWeek: IsoDate;
  nextWeek: IsoDate;
  isCurrentWeek: boolean;
  plan: {
    params: PlanParams;
    days: DayView[];
    stats: Partial<Record<Category, number>>;
    warnings: string[];
  } | null;
  defaultParams: PlanParams;
  library: MenuRecipe[];
}

export async function loadMenuView(weekParam: string | undefined): Promise<MenuView> {
  await connection(); // datos y "hoy" en tiempo de petición
  const today = todayIso();
  const weekStart = mondayOf(isIsoDate(weekParam) ? weekParam : today);

  const recipes = listRecipesForMatching();
  const library: MenuRecipe[] = recipes
    .map((r) => ({ id: r.id, title: r.title, photo: r.photo, minutes: totalMinutes(r), category: classifyRecipe(r) }))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
  const byId = new Map(library.map((r) => [r.id, r]));

  const plan = repo.getPlan(weekStart);
  let planView: MenuView["plan"] = null;
  if (plan) {
    const stats: Partial<Record<Category, number>> = {};
    const slotsView: SlotView[] = plan.slots.map((s) => {
      const recipe = s.recipeId ? (byId.get(s.recipeId) ?? null) : null;
      if (recipe) stats[recipe.category] = (stats[recipe.category] ?? 0) + 1;
      return { id: s.id, date: s.date, meal: s.meal, locked: s.locked, freeText: s.freeText, recipe };
    });
    const warnings = warningsFor(
      {
        recipes,
        params: plan.params,
        // Huecos con texto libre ("Sobras") son fijos y vacíos a propósito.
        slots: plan.slots.map((s) => ({ date: s.date, meal: s.meal, weekend: isWeekend(s.date), ...(s.freeText ? { fixed: null } : {}) })),
      },
      plan.slots.map((s) => s.recipeId),
    );
    planView = {
      params: plan.params,
      stats,
      warnings,
      days: weekDays(weekStart)
        .map((date) => ({ date, label: dayLabel(date), isToday: date === today, slots: slotsView.filter((s) => s.date === date) }))
        .filter((d) => d.slots.length > 0),
    };
  }

  return {
    weekStart,
    rangeLabel: weekRangeLabel(weekStart),
    prevWeek: addDays(weekStart, -7),
    nextWeek: addDays(weekStart, 7),
    isCurrentWeek: weekStart === mondayOf(today),
    plan: planView,
    defaultParams: plan?.params ?? repo.latestParams(),
    library,
  };
}
