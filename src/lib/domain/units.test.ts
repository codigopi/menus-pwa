import { describe, expect, it } from "vitest";
import { getUnit, normalizeUnit, unitLabel, UNITS } from "./units";

describe("normalizeUnit", () => {
  it.each([
    ["gramos", "g"],
    ["gr", "g"],
    ["gr.", "g"],
    ["Kilos", "kg"],
    ["cucharadas", "cda"],
    ["c/s", "cda"],
    ["cucharadita", "cdta"],
    ["litro", "l"],
    ["dientes", "diente"],
    ["unidades", "ud"],
    ["chorro", "chorrito"],
  ])("%j → %j", (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected);
  });

  it("devuelve null si no se reconoce", () => {
    expect(normalizeUnit("al gusto")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
  });
});

describe("catálogo de unidades", () => {
  it("no tiene alias duplicados entre unidades", () => {
    const seen = new Map<string, string>();
    for (const u of UNITS) {
      for (const form of [u.key, ...u.aliases]) {
        const prev = seen.get(form.toLowerCase());
        expect(prev === undefined || prev === u.key, `"${form}" en ${prev} y ${u.key}`).toBe(true);
        seen.set(form.toLowerCase(), u.key);
      }
    }
  });

  it("los factores de conversión son coherentes", () => {
    expect(getUnit("kg")?.factor).toBe(1000);
    expect(getUnit("cda")?.factor).toBe(15);
    expect(getUnit("l")?.dimension).toBe("volume");
  });
});

describe("unitLabel", () => {
  it("concuerda en número", () => {
    expect(unitLabel("diente", 1)).toBe("diente");
    expect(unitLabel("diente", 3)).toBe("dientes");
    expect(unitLabel("diente", 0.5)).toBe("diente");
    expect(unitLabel("g", 200)).toBe("g");
    expect(unitLabel(null, 2)).toBe("");
  });
});
