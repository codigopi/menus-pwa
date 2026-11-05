import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "./ingredient-parser";

describe("parseIngredientLine", () => {
  it.each([
    ["2 dientes de ajo, picados", { quantity: 2, unit: "diente", name: "ajo", note: "picados" }],
    ["200g de harina", { quantity: 200, unit: "g", name: "harina", note: null }],
    ["200 gr. de harina de trigo", { quantity: 200, unit: "g", name: "harina de trigo" }],
    ["1/2 kg de patatas", { quantity: 0.5, unit: "kg", name: "patatas" }],
    ["1 lata de tomate triturado (400 g)", { quantity: 1, unit: "lata", name: "tomate triturado", note: "400 g" }],
    ["Medio pimiento rojo", { quantity: 0.5, unit: null, name: "pimiento rojo" }],
    ["Una pizca de sal", { quantity: 1, unit: "pizca", name: "sal" }],
    ["Sal al gusto", { quantity: null, unit: null, name: "sal" }],
    ["Aceite de oliva virgen extra c/n", { quantity: null, unit: null, name: "aceite de oliva virgen extra" }],
    ["2-3 dientes de ajo", { quantity: 2, unit: "diente", name: "ajo" }],
    ["1 cucharada sopera de pimentón", { quantity: 1, unit: "cda", name: "pimentón" }],
    ["3 cucharadas de aceite, mejor de oliva", { quantity: 3, unit: "cda", name: "aceite", note: "mejor de oliva" }],
    ["Un par de hojas de laurel", { quantity: 2, unit: "hoja", name: "laurel" }],
    ["4 huevos L", { quantity: 4, unit: null, name: "huevos L" }],
    ["1½ vasos de agua", { quantity: 1.5, unit: "vaso", name: "agua" }],
    ["500 ml de caldo de pollo", { quantity: 500, unit: "ml", name: "caldo de pollo" }],
    ["- 1 cebolla grande", { quantity: 1, unit: null, name: "cebolla grande" }],
    ["AOVE", { quantity: null, unit: null, name: "AOVE" }],
    ["Lata de atún", { quantity: null, unit: null, name: "lata de atún" }],
  ])("%j", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });

  it("conserva el grupo indicado", () => {
    expect(parseIngredientLine("1 cebolla", "Para el sofrito").group).toBe("Para el sofrito");
  });
});
