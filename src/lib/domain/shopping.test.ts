import { describe, expect, it } from "vitest";
import { findCatalog, sectionFor } from "./catalog";
import { addLine, buildShoppingList, estimateCost, formatAmounts, manualEntry, recipeCost, shoppingKey, shoppingListText, type Amounts, type NeedLine } from "./shopping";
import { SECTION_LABELS } from "./catalog";

const L = (name: string, quantity: number | null, unit: string | null = null, source = "r"): NeedLine => ({ name, quantity, unit, source });
const amounts = (lines: [number | null, string | null][]): Amounts => {
  const a: Amounts = { g: 0, ml: 0, counts: {}, toTaste: false };
  lines.forEach(([q, u]) => addLine(a, q, u));
  return a;
};
const find = (res: ReturnType<typeof buildShoppingList>, key: string) => res.items.find((i) => i.key === key);

describe("catálogo y secciones", () => {
  it.each([
    ["Cebollas", "fruteria"],
    ["tomate triturado", "despensa"],
    ["tomates maduros", "fruteria"],
    ["pechuga de pollo", "carniceria"],
    ["contramuslos de pavo", "carniceria"],
    ["caldo de pollo", "despensa"],
    ["atún en lata", "despensa"],
    ["merluza", "pescaderia"],
    ["huevos L", "lacteos"],
    ["queso rallado", "lacteos"],
    ["pan rallado", "despensa"],
    ["pimienta negra molida", "especias"],
    ["pimientos del piquillo", "despensa"],
    ["judías verdes", "fruteria"],
    ["leche de coco", "despensa"],
    ["garbanzos cocidos", "despensa"],
    ["tomate en conserva", "despensa"],
    ["ingrediente raro", "otros"],
  ])("%s → %s", (name, section) => expect(sectionFor(name)).toBe(section));

  it("encuentra la entrada más específica", () => {
    expect(findCatalog("aceite de oliva virgen extra")?.match).toBe("aceite");
    expect(findCatalog("aceite de girasol")?.match).toBe("aceite girasol");
    expect(findCatalog("nuez moscada")?.match).toBe("nuez moscada");
    expect(findCatalog("nueces")?.match).toBe("nuez");
  });
});

describe("claves de agrupación", () => {
  it("agrupa variantes y separa productos distintos", () => {
    expect(shoppingKey("Cebollas grandes")).toBe("cebolla");
    expect(shoppingKey("cebolla picada")).toBe("cebolla");
    expect(shoppingKey("aceite de oliva virgen extra")).toBe("aceite");
    expect(shoppingKey("AOVE")).toBe("aceite");
    expect(shoppingKey("huevos L")).toBe("huevo");
    expect(shoppingKey("pimiento rojo")).not.toBe(shoppingKey("pimiento verde"));
  });
});

describe("formato para comprar (redondeando hacia arriba)", () => {
  it.each([
    [[[333, "g"]], "340 g"],
    [[[12, "g"]], "15 g"],
    [[[0.6, "kg"], [700, "g"]], "1,3 kg"],
    [[[1, "cda"], [1, "cdta"]], "1½ cdas"],
    [[[2, "cda"], [1, "cdta"]], "40 ml"],
    [[[0.5, "cdta"]], "½ cdta"],
    [[[50, "ml"]], "50 ml"],
    [[[200, "ml"], [1, "taza"]], "440 ml"],
    [[[1.2, "l"]], "1,2 l"],
    [[[1.5, null]], "2 uds"],
    [[[1, null]], "1 ud"],
    [[[3, "diente"], [2, "diente"]], "5 dientes"],
    [[[1, "lata"], [2, null]], "2 uds + 1 lata"],
  ] as [[number, string | null][], string][])("%j → %s", (lines, text) => {
    expect(formatAmounts(amounts(lines))).toBe(text);
  });
});

describe("buildShoppingList", () => {
  it("fusiona duplicados de varias recetas y convierte unidades", () => {
    const res = buildShoppingList([
      L("cebolla", 1, null, "Lentejas"),
      L("Cebollas grandes", 1, null, "Pisto"),
      L("cebolla picada", 150, "g", "Tortilla"), // 150 g ≈ 1 cebolla
      L("patatas", 3, null, "Tortilla"), // patatas se compran al peso
      L("patata", 200, "g", "Crema"),
      L("aceite de oliva", 3, "cda", "Pisto"),
      L("AOVE", 100, "ml", "Tortilla"),
      L("sal", null, null, "Tortilla"),
    ]);
    expect(find(res, "cebolla")).toMatchObject({ amount: "3 uds", section: "fruteria", sources: ["Lentejas", "Pisto", "Tortilla"] });
    expect(find(res, "patata")).toMatchObject({ amount: "800 g" });
    expect(find(res, "aceite")).toMatchObject({ amount: "150 ml", section: "despensa" });
    expect(find(res, "sal")).toMatchObject({ amount: "", toTaste: true });
  });

  it("ordena por secciones del súper", () => {
    const res = buildShoppingList([L("sal", null), L("merluza", 400, "g"), L("tomate", 2), L("huevos", 6)]);
    expect(res.items.map((i) => i.section)).toEqual(["fruteria", "pescaderia", "lacteos", "especias"]);
  });

  it("resta la despensa: entera, parcial y sin cantidad", () => {
    const res = buildShoppingList(
      [L("huevos", 6), L("arroz", 500, "g"), L("aceite de oliva", 4, "cda"), L("patatas", 4), L("sal", null)],
      [
        { name: "huevos", quantity: 2, unit: null }, // tengo 2 → compro 4
        { name: "arroz", quantity: 1, unit: "kg" }, // tengo de sobra
        { name: "aceite", quantity: null, unit: null }, // "siempre hay"
        { name: "patata", quantity: 1, unit: "kg" }, // 4 patatas ≈ 800 g < 1 kg
        { name: "sal", quantity: null, unit: null },
      ],
    );
    expect(find(res, "huevo")).toMatchObject({ amount: "4 uds", pantryNote: "Tienes 2 uds" });
    expect(res.items.map((i) => i.key)).toEqual(["huevo"]);
    expect(res.covered.map((c) => c.key).sort()).toEqual(["aceite", "arroz", "patata", "sal"]);
  });

  it("estima costes orientativos", () => {
    expect(estimateCost(amounts([[500, "g"]]), findCatalog("merluza"))).toBe(6);
    expect(estimateCost(amounts([[6, null]]), findCatalog("huevo"))).toBe(1.68);
    expect(estimateCost(amounts([[2, null]]), findCatalog("cebolla"))).toBe(0.45); // 2 × 150 g × 1,5 €/kg
    expect(estimateCost(amounts([[1, "kg"]]), findCatalog("ingrediente raro"))).toBeNull();
    expect(recipeCost([{ name: "lentejas", quantity: 300, unit: "g" }, { name: "sal", quantity: null, unit: null }])).toBe(0.78);
  });

  it("texto para compartir, sin lo ya marcado", () => {
    const text = shoppingListText(
      "Compra 2 – 8 nov",
      [
        { name: "cebolla", amount: "3 uds", section: "fruteria" },
        { name: "merluza", amount: "400 g", section: "pescaderia", checked: true },
        { name: "sal", amount: "", section: "especias" },
      ],
      SECTION_LABELS,
    );
    expect(text).toBe("🛒 Compra 2 – 8 nov\n\n*Frutería y verdura*\n- cebolla (3 uds)\n\n*Especias y condimentos*\n- sal");
  });
});

describe("manualEntry", () => {
  it.each([
    ["2 kg de patatas", { name: "patatas", amount: "2 kg", section: "fruteria", key: "patata" }],
    ["papel de cocina", { name: "papel de cocina", amount: "", section: "otros", toTaste: true }],
    ["6 huevos", { name: "huevos", amount: "6 uds", section: "lacteos" }],
  ])("%s", (text, expected) => expect(manualEntry(text)).toMatchObject(expected));
});
