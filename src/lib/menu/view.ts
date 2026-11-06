/**
 * Datos listos para pintar la pantalla del menú (Server Components).
 */
import { connection } from "next/server";
import { addDays, dayLabel, isIsoDate, isWeekend, mondayOf, todayIso, weekDays, weekRangeLabel, type IsoDate } from "@/lib/domain/dates";
import { classifyRecipe, portions, type Category, type Course, type Meal, type PlanParams } from "@/lib/domain/menu";
import { warningsFor } from "@/lib/domain/menu-planner";
import { nutritionFlags, weeklyBalance, type RuleStatus } from "@/lib/domain/nutrition";
import { totalMinutes } from "@/lib/domain/recipe";
import { cookedSlotIds } from "@/lib/history/repo";
import { plannerRecipes } from "./service";
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
  course: Course;
  locked: boolean;
  /** Ya marcado como cocinado. */
  cooked: boolean;
  /** Esta comida/cena no lleva verdura: sugerir acompañar con ensalada. */
  suggestVeg: boolean;
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
    /** Equilibrio frente a la pirámide nutricional. */
    nutrition: RuleStatus[];
    /** Coste orientativo de la semana (solo platos con precio estimable). */
    cost: { total: number; priced: number; dishes: number };
  } | null;
  defaultParams: PlanParams;
  library: MenuRecipe[];
}

export async function loadMenuView(weekParam: string | undefined): Promise<MenuView> {
  await connection(); // datos y "hoy" en tiempo de petición
  const today = todayIso();
  const weekStart = mondayOf(isIsoDate(weekParam) ? weekParam : today);

  const recipes = plannerRecipes();
  const costById = new Map(recipes.map((r) => [r.id, r.costPerServing ?? null]));
  const library: MenuRecipe[] = recipes
    .map((r) => ({ id: r.id, title: r.title, photo: r.photo, minutes: totalMinutes(r), category: classifyRecipe(r) }))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
  const byId = new Map(library.map((r) => [r.id, r]));

  const plan = repo.getPlan(weekStart);
  let planView: MenuView["plan"] = null;
  if (plan) {
    const stats: Partial<Record<Category, number>> = {};
    const cost = { total: 0, priced: 0, dishes: 0 };
    const cooked = cookedSlotIds(plan.slots);
    const slotsView: SlotView[] = plan.slots.map((s) => {
      const recipe = s.recipeId ? (byId.get(s.recipeId) ?? null) : null;
      if (recipe) {
        stats[recipe.category] = (stats[recipe.category] ?? 0) + 1;
        cost.dishes++;
        const cps = costById.get(recipe.id);
        if (cps != null) {
          cost.total += cps * portions(plan.params);
          cost.priced++;
        }
      }
      return { id: s.id, date: s.date, meal: s.meal, course: s.course, locked: s.locked, cooked: cooked.has(s.id), suggestVeg: false, freeText: s.freeText, recipe };
    });
    const warnings = warningsFor(
      {
        recipes,
        params: plan.params,
        // Huecos con texto libre ("Sobras") son fijos y vacíos a propósito.
        slots: plan.slots.map((s) => ({ date: s.date, meal: s.meal, course: s.course, weekend: isWeekend(s.date), ...(s.freeText ? { fixed: null } : {}) })),
      },
      plan.slots.map((s) => s.recipeId),
    );
    // Pirámide: señales de cada plato con receta
    const flagsById = new Map(recipes.map((r) => [r.id, nutritionFlags(r)]));
    const dishes = plan.slots
      .filter((s) => s.recipeId && flagsById.has(s.recipeId))
      .map((s) => ({ date: s.date, meal: s.meal, flags: flagsById.get(s.recipeId!)! }));
    // Sugerir ensalada en la última fila de cada comida/cena sin verdura
    const groups = new Map<string, SlotView[]>();
    for (const sv of slotsView) groups.set(`${sv.date}|${sv.meal}`, [...(groups.get(`${sv.date}|${sv.meal}`) ?? []), sv]);
    for (const group of groups.values()) {
      const withRecipe = group.filter((g) => g.recipe);
      if (withRecipe.length === 0) continue;
      if (!withRecipe.some((g) => flagsById.get(g.recipe!.id)?.vegetables)) withRecipe[withRecipe.length - 1].suggestVeg = true;
    }

    planView = {
      params: plan.params,
      nutrition: weeklyBalance(dishes),
      stats,
      cost,
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
