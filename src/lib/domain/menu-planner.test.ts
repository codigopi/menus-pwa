import { describe, expect, it } from "vitest";
import { addDays, dayLabel, daysBetween, isIsoDate, isWeekend, mondayOf, todayIso, weekDays, weekRangeLabel } from "./dates";
import { classifyRecipe, courseRole, DEFAULT_PARAMS, fitsMeal, hasMeatOrFish, isWholeMeal, type Meal, type PlanParams } from "./menu";
import { allowedRecipes, planWeek, replanSlot, type PlannerRecipe, type PlannerSlot } from "./menu-planner";
import { nutritionFlags, weeklyBalance } from "./nutrition";

// ---------------------------------------------------------------- fechas

describe("fechas", () => {
  it("lunes de la semana y días", () => {
    expect(mondayOf("2026-11-06")).toBe("2026-11-02"); // viernes → lunes
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // domingo → lunes anterior
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(weekDays("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(isWeekend("2026-11-07")).toBe(true);
    expect(isWeekend("2026-11-06")).toBe(false);
  });

  it("etiquetas en español", () => {
    expect(dayLabel("2026-11-02")).toBe("Lunes 2");
    expect(weekRangeLabel("2026-11-02")).toBe("2 – 8 nov");
    expect(weekRangeLabel("2026-10-26")).toBe("26 oct – 1 nov");
  });

  it("valida y calcula hoy en Madrid", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("hoy")).toBe(false);
    // 23:30 UTC del domingo ya es lunes en Madrid (UTC+1 en invierno)
    expect(todayIso("Europe/Madrid", new Date("2026-11-08T23:30:00Z"))).toBe("2026-11-09");
  });
});

// ---------------------------------------------------------------- clasificación

const rec = (id: string, ingredients: string[], extra: Partial<PlannerRecipe> = {}): PlannerRecipe => ({
  id,
  title: id,
  tags: [],
  rating: null,
  isFavorite: false,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredients: ingredients.map((name) => ({ name })),
  ...extra,
});

describe("classifyRecipe", () => {
  it.each([
    [["lentejas", "chorizo", "cebolla"], "legumbre"],
    [["macarrones", "chorizo", "tomate"], "pasta_arroz"],
    [["pechuga de pollo", "ajo"], "carne"],
    [["huevos", "patatas", "cebolla"], "huevo"],
    [["merluza", "patata"], "pescado"],
    [["calabacín", "pimiento", "tomate"], "verdura"],
    [["cebolla", "bacalao desalado", "pimiento"], "pescado"],
  ])("%j → %s", (ings, cat) => expect(classifyRecipe({ tags: [], ingredients: ings.map((name) => ({ name })) })).toBe(cat));

  it("la etiqueta manda", () => {
    expect(classifyRecipe({ tags: ["legumbres"], ingredients: [{ name: "cebolla" }] })).toBe("legumbre");
  });

  it("vegetariano detecta carne y pescado (también en caldos)", () => {
    expect(hasMeatOrFish({ tags: [], ingredients: [{ name: "arroz" }, { name: "caldo de pollo" }] })).toBe(true);
    expect(hasMeatOrFish({ tags: [], ingredients: [{ name: "garbanzos" }, { name: "espinacas" }] })).toBe(false);
  });
});

// ---------------------------------------------------------------- planificador

const LIBRARY: PlannerRecipe[] = [
  rec("lentejas", ["lentejas", "chorizo"], { tags: ["cuchara"] }),
  rec("garbanzos", ["garbanzos", "espinacas"]),
  rec("alubias", ["alubias", "verduras"]),
  rec("merluza", ["merluza", "patata"]),
  rec("salmon", ["salmón", "limón"]),
  rec("bacalao", ["bacalao", "tomate"]),
  rec("pollo", ["pechuga de pollo", "ajo"]),
  rec("albondigas", ["carne picada", "tomate"]),
  rec("tortilla", ["huevos", "patatas"]),
  rec("revuelto", ["huevos", "champiñones"]),
  rec("macarrones", ["macarrones", "tomate"]),
  rec("arroz", ["arroz", "verduras"]),
  rec("pisto", ["calabacín", "pimiento", "tomate"]),
  rec("crema", ["calabacín", "puerro"]),
  rec("ensalada", ["lechuga", "tomate"]),
  rec("cocido", ["garbanzos", "morcillo"], { prepMinutes: 30, cookMinutes: 150 }),
];

function week(meals: Meal[] = ["comida", "cena"]): PlannerSlot[] {
  return weekDays("2026-11-02").flatMap((date) => meals.map((meal) => ({ date, meal, weekend: isWeekend(date) })));
}

const params = (p: Partial<PlanParams> = {}): PlanParams => ({ ...DEFAULT_PARAMS, ...p });

describe("planWeek", () => {
  it("rellena los 14 huecos sin repetir y equilibrando tipos", () => {
    const { assignments, warnings } = planWeek({ recipes: LIBRARY, slots: week(), params: params(), seed: 42 });
    expect(assignments.every(Boolean)).toBe(true);
    expect(new Set(assignments).size).toBe(14);
    expect(warnings).toEqual([]);

    const cats = assignments.map((id) => classifyRecipe(LIBRARY.find((r) => r.id === id)!));
    const count = (c: string) => cats.filter((x) => x === c).length;
    expect(count("legumbre")).toBeGreaterThanOrEqual(2);
    expect(count("pescado")).toBeGreaterThanOrEqual(2);
    expect(count("carne")).toBeLessThanOrEqual(4);
  });

  it("es reproducible con la misma semilla y cambia con otra", () => {
    const a = planWeek({ recipes: LIBRARY, slots: week(), params: params(), seed: 7 }).assignments;
    const b = planWeek({ recipes: LIBRARY, slots: week(), params: params(), seed: 7 }).assignments;
    const c = planWeek({ recipes: LIBRARY, slots: week(), params: params(), seed: 99 }).assignments;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("no pone el cocido (3 h) entre semana con límite de 45 min", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const slots = week();
      const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params({ maxMinutesWeekday: 45 }), seed });
      assignments.forEach((id, i) => {
        if (id === "cocido") expect(slots[i].weekend).toBe(true);
      });
    }
  });

  it("evita legumbres en la cena", () => {
    let legumeDinners = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const slots = week();
      const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params(), seed });
      assignments.forEach((id, i) => {
        if (slots[i].meal === "cena" && classifyRecipe(LIBRARY.find((r) => r.id === id)!) === "legumbre") legumeDinners++;
      });
    }
    expect(legumeDinners).toBeLessThanOrEqual(2); // en 8 semanas, casi nunca
  });

  it("respeta los huecos fijos y no repite la receta fijada", () => {
    const slots = week();
    slots[0].fixed = "tortilla";
    slots[3].fixed = null; // "comer fuera": hueco fijo vacío
    const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params(), seed: 3 });
    expect(assignments[0]).toBe("tortilla");
    expect(assignments[3]).toBeNull();
    expect(assignments.filter((id) => id === "tortilla")).toHaveLength(1);
  });

  it("vegetariano y alimentos a evitar", () => {
    const { assignments } = planWeek({ recipes: LIBRARY, slots: week(["comida"]), params: params({ vegetarian: true, avoid: ["tomate"] }), seed: 1 });
    const chosen = assignments.filter(Boolean).map((id) => LIBRARY.find((r) => r.id === id)!);
    expect(chosen.some(hasMeatOrFish)).toBe(false);
    expect(chosen.some((r) => r.ingredients.some((i) => i.name === "tomate"))).toBe(false);
  });

  it("en modo económico prefiere platos baratos según su coste", () => {
    // Carnes caras (la carne no tiene mínimo en la pirámide, así que el
    // presupuesto puede reducirlas); deben salir menos que en "normal".
    const isExpensive = (id: string | null) => id === "pollo" || id === "albondigas";
    const priced = LIBRARY.map((r) => ({ ...r, costPerServing: isExpensive(r.id) ? 6 : 1 }));
    const count = (budget: PlanParams["budget"]) =>
      [1, 2, 3, 4, 5, 6, 7, 8].reduce(
        (n, seed) => n + planWeek({ recipes: priced, slots: week(), params: params({ budget }), seed }).assignments.filter(isExpensive).length,
        0,
      );
    expect(count("economico")).toBeLessThan(count("normal"));
  });

  it("penaliza lo cocinado la semana pasada", () => {
    const recent = new Map([["tortilla", 3], ["merluza", 3]]);
    const counts = { tortilla: 0 };
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { assignments } = planWeek({ recipes: LIBRARY, slots: week(["cena"]), params: params(), seed, recent });
      if (assignments.includes("tortilla")) counts.tortilla++;
    }
    expect(counts.tortilla).toBeLessThanOrEqual(2);
  });

  it("biblioteca pequeña: repite y avisa; vacía: avisa", () => {
    const small = planWeek({ recipes: LIBRARY.slice(0, 3), slots: week(), params: params({ maxMinutesWeekday: null }), seed: 1 });
    expect(small.assignments.every(Boolean)).toBe(true);
    expect(small.warnings.some((w) => w.includes("Se repiten"))).toBe(true);

    const empty = planWeek({ recipes: [], slots: week(), params: params(), seed: 1 });
    expect(empty.assignments.every((a) => a === null)).toBe(true);
    expect(empty.warnings[0]).toContain("Aún no tienes recetas");
  });

  it("allowedRecipes descarta recetas sin ingredientes y postres", () => {
    expect(allowedRecipes([rec("vacia", [])], params())).toEqual([]);
    expect(allowedRecipes([rec("brownie", ["chocolate", "huevos"], { tags: ["postre"] })], params())).toEqual([]);
  });
});

describe("primero y segundo", () => {
  // Comida con primero y segundo + cena, como en una casa española
  const courseWeek = (singleDays: string[] = []): PlannerSlot[] =>
    weekDays("2026-11-02").flatMap((date) => [
      ...(singleDays.includes(date)
        ? [{ date, meal: "comida" as const, course: "unico" as const, weekend: isWeekend(date) }]
        : [
            { date, meal: "comida" as const, course: "primero" as const, weekend: isWeekend(date) },
            { date, meal: "comida" as const, course: "segundo" as const, weekend: isWeekend(date) },
          ]),
      { date, meal: "cena" as const, course: "unico" as const, weekend: isWeekend(date) },
    ]);

  it("courseRole: legumbre/verdura/pasta de primero; carne/pescado/huevo de segundo; la etiqueta manda", () => {
    expect(courseRole({ tags: [], ingredients: [{ name: "lentejas" }] })).toBe("primero");
    expect(courseRole({ tags: [], ingredients: [{ name: "macarrones" }] })).toBe("primero");
    expect(courseRole({ tags: [], ingredients: [{ name: "merluza" }] })).toBe("segundo");
    expect(courseRole({ tags: [], ingredients: [{ name: "huevos" }] })).toBe("segundo");
    expect(courseRole({ tags: ["segundo"], ingredients: [{ name: "calabacín" }] })).toBe("segundo");
    expect(courseRole({ tags: ["plato único"], ingredients: [{ name: "arroz" }] })).toBe("unico");
    expect(isWholeMeal({ tags: [], ingredients: [{ name: "garbanzos" }, { name: "morcillo" }] })).toBe(true);
    expect(isWholeMeal({ tags: [], ingredients: [{ name: "garbanzos" }, { name: "espinacas" }] })).toBe(false);
  });

  it("los primeros son de primero y los segundos de segundo, sin repetir tipo el mismo día", () => {
    const slots = courseWeek();
    const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params({ maxMinutesWeekday: null }), seed: 3 });
    expect(slots).toHaveLength(21);
    slots.forEach((slot, i) => {
      const r = LIBRARY.find((x) => x.id === assignments[i])!;
      if (slot.course === "primero") expect(courseRole(r)).toBe("primero");
      if (slot.course === "segundo") expect(courseRole(r)).toBe("segundo");
    });
    // Mismo día: primero y segundo de distinto tipo
    for (let d = 0; d < 7; d++) {
      const [p, s] = [assignments[d * 3], assignments[d * 3 + 1]].map((id) => classifyRecipe(LIBRARY.find((x) => x.id === id)!));
      expect(p).not.toBe(s);
    }
  });

  it("el día de plato único prefiere un plato completo", () => {
    let whole = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const slots = courseWeek(["2026-11-07"]); // sábado, plato único
      const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params({ maxMinutesWeekend: null }), seed });
      const idx = slots.findIndex((s) => s.date === "2026-11-07" && s.meal === "comida");
      expect(slots[idx].course).toBe("unico");
      if (isWholeMeal(LIBRARY.find((r) => r.id === assignments[idx])!)) whole++;
    }
    expect(whole).toBeGreaterThanOrEqual(4); // lentejas con chorizo, cocido…
  });

  it("etiquetas comida/cena: recetas exclusivas de una comida", () => {
    expect(fitsMeal({ tags: ["cena"] }, "comida")).toBe(false);
    expect(fitsMeal({ tags: ["cena"] }, "cena")).toBe(true);
    expect(fitsMeal({ tags: ["comida", "cena"] }, "comida")).toBe(true);
    expect(fitsMeal({ tags: [] }, "cena")).toBe(true);

    // La tortilla, solo para cenas; los macarrones, solo para comidas
    const tagged = LIBRARY.map((r) =>
      r.id === "tortilla" ? { ...r, tags: ["cena"] } : r.id === "macarrones" ? { ...r, tags: ["comida"] } : r,
    );
    for (const seed of [1, 2, 3, 4]) {
      const slots = courseWeek();
      const { assignments } = planWeek({ recipes: tagged, slots, params: params({ maxMinutesWeekday: null }), seed });
      assignments.forEach((id, i) => {
        if (id === "tortilla") expect(slots[i].meal).toBe("cena");
        if (id === "macarrones") expect(slots[i].meal).toBe("comida");
      });
    }
  });

  it("con pocas recetas, en la cena repite algo ligero antes que un plato contundente", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const slots = courseWeek();
      const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params({ maxMinutesWeekday: null, maxMinutesWeekend: null }), seed });
      assignments.forEach((id, i) => {
        if (slots[i].meal !== "cena") return;
        const r = LIBRARY.find((x) => x.id === id)!;
        expect(classifyRecipe(r) === "legumbre" || r.tags.includes("cuchara"), `${id} de cena`).toBe(false);
      });
    }
  });

  it("si no hay recetas de segundo, usa otras y avisa", () => {
    const onlyFirsts = LIBRARY.filter((r) => courseRole(r) === "primero");
    const { assignments, warnings } = planWeek({ recipes: onlyFirsts, slots: courseWeek(), params: params({ maxMinutesWeekday: null }), seed: 1 });
    expect(assignments.every(Boolean)).toBe(true);
    expect(warnings.some((w) => w.includes("segundo"))).toBe(true);
  });
});

describe("pirámide nutricional", () => {
  // Biblioteca con tentaciones: mucha comida rápida, fritos y procesados
  const PYRAMID: PlannerRecipe[] = [
    ...LIBRARY.filter((r) => r.id !== "cocido"),
    rec("pizza", ["masa de pizza", "jamón cocido", "mozzarella"], { title: "Pizza", rating: 5 }),
    rec("nuggets", ["nuggets de pollo", "patatas"], { title: "Nuggets de pollo con patatas", rating: 5 }),
    rec("perrito", ["salchichas", "pan de perrito"], { title: "Perrito caliente", rating: 5 }),
    rec("hamburguesa", ["hamburguesas", "pan de hamburguesa"], { title: "Hamburguesa", rating: 5 }),
    rec("pechugas", ["pechuga de pollo", "pan rallado"], { title: "Pechugas empanadas", rating: 5 }),
    rec("sardinas", ["sardinas", "limón"], { title: "Sardinas al horno" }),
    rec("espada", ["pez espada", "ajo"], { title: "Pez espada a la plancha" }),
    rec("crema", ["calabacín", "puerro"], { title: "Crema de calabacín" }),
    rec("espinacas", ["espinacas", "garbanzos"], { title: "Espinacas con garbanzos", tags: ["legumbres"] }),
  ];
  const courseWeek2 = (): PlannerSlot[] =>
    weekDays("2026-11-02").flatMap((date) => [
      { date, meal: "comida" as const, course: "primero" as const, weekend: isWeekend(date) },
      { date, meal: "comida" as const, course: "segundo" as const, weekend: isWeekend(date) },
      { date, meal: "cena" as const, course: "unico" as const, weekend: isWeekend(date) },
    ]);

  it("respeta las frecuencias recomendadas aunque la comida rápida esté mejor valorada", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const slots = courseWeek2();
      const { assignments } = planWeek({ recipes: PYRAMID, slots, params: params({ maxMinutesWeekday: null, children: 3 }), seed });
      const dishes = assignments.map((id, i) => ({ date: slots[i].date, meal: slots[i].meal, flags: nutritionFlags(PYRAMID.find((r) => r.id === id)!) }));
      const bad = weeklyBalance(dishes).filter((r) => r.status === "alto");
      expect(bad.map((b) => `${b.id}=${b.count}`), `semilla ${seed}`).toEqual([]);
      // Legumbre y pescado, en su rango
      const byId = Object.fromEntries(weeklyBalance(dishes).map((r) => [r.id, r]));
      expect(byId.legumbre.count).toBeGreaterThanOrEqual(3);
      expect(byId.pescado.count).toBeGreaterThanOrEqual(3);
      expect(byId.pescado_azul.count).toBeGreaterThanOrEqual(1);
    }
  });

  it("con pocas legumbres en la biblioteca, repite alguna para llegar al mínimo", () => {
    // Solo 2 recetas de legumbre: para llegar a 3 hay que repetir una
    const few = LIBRARY.filter((r) => !["garbanzos", "alubias", "cocido"].includes(r.id)).concat(rec("garbanzos", ["garbanzos", "espinacas"]));
    const slots = courseWeek2();
    const { assignments } = planWeek({ recipes: few, slots, params: params({ maxMinutesWeekday: null }), seed: 2 });
    const dishes = assignments.map((id, i) => ({ date: slots[i].date, meal: slots[i].meal, flags: nutritionFlags(few.find((r) => r.id === id)!) }));
    expect(weeklyBalance(dishes).find((r) => r.id === "legumbre")!.count).toBeGreaterThanOrEqual(3);
  });

  it("avisa si las legumbres no caben entre semana por tiempo", () => {
    const slow = [rec("lentejas", ["lentejas"], { prepMinutes: 15, cookMinutes: 45 }), rec("merluza", ["merluza"]), rec("tortilla", ["huevos"])];
    const { warnings } = planWeek({ recipes: slow, slots: week(), params: params({ maxMinutesWeekday: 45 }), seed: 1 });
    expect(warnings.some((w) => w.includes("legumbres tardan más de 45 min"))).toBe(true);
    const ok = planWeek({ recipes: slow, slots: week(), params: params({ maxMinutesWeekday: 90 }), seed: 1 });
    expect(ok.warnings.some((w) => w.includes("legumbres tardan"))).toBe(false);
  });

  it("con niños, nunca pez espada; sin niños, sí puede salir", () => {
    const withKids = allowedRecipes(PYRAMID, params({ children: 2 }));
    expect(withKids.some((r) => r.id === "espada")).toBe(false);
    expect(allowedRecipes(PYRAMID, params({ children: 0 })).some((r) => r.id === "espada")).toBe(true);
  });

  it("todos los días hay algún plato con verdura", () => {
    const slots = courseWeek2();
    const { assignments } = planWeek({ recipes: PYRAMID, slots, params: params({ maxMinutesWeekday: null }), seed: 7 });
    const dishes = assignments.map((id, i) => ({ date: slots[i].date, meal: slots[i].meal, flags: nutritionFlags(PYRAMID.find((r) => r.id === id)!) }));
    expect(weeklyBalance(dishes).find((r) => r.id === "verdura_diaria")?.status).toBe("ok");
  });
});

describe("regenerar", () => {
  it("con el menú anterior, cambia la mayoría de los platos", () => {
    const slots = week();
    const first = planWeek({ recipes: LIBRARY, slots, params: params(), seed: 1 }).assignments;
    const second = planWeek({ recipes: LIBRARY, slots, params: params(), seed: 2, previous: first }).assignments;
    const same = second.filter((id, i) => id === first[i]).length;
    expect(same).toBeLessThanOrEqual(3);
  });
});

describe("replanSlot", () => {
  it("elige una receta distinta para ese hueco", () => {
    const slots = week();
    const { assignments } = planWeek({ recipes: LIBRARY, slots, params: params(), seed: 5 });
    const next = replanSlot({ recipes: LIBRARY, slots, params: params(), seed: 6 }, assignments, 2);
    expect(next).not.toBeNull();
    expect(next).not.toBe(assignments[2]);
    expect(assignments.filter((id, i) => i !== 2)).not.toContain(next);
  });
});
