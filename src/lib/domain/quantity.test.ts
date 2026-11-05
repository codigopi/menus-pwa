import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantity, quantityToInput } from "./quantity";

describe("parseQuantity", () => {
  it.each([
    ["2", 2],
    ["0,5", 0.5],
    ["0.5", 0.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["3 / 4", 0.75],
    ["½", 0.5],
    ["1½", 1.5],
    ["1 ½", 1.5],
    ["2-3", 2],
    ["2 a 3", 2],
    ["  250 ", 250],
  ])("lee %j como %d", (input, expected) => {
    expect(parseQuantity(input)).toBeCloseTo(expected);
  });

  it("devuelve null si está vacío (al gusto)", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("   ")).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });

  it("devuelve NaN si no se entiende", () => {
    expect(parseQuantity("un poco")).toBeNaN();
    expect(parseQuantity("1/0")).toBeNaN();
  });
});

describe("formatQuantity", () => {
  it.each([
    [2, "2"],
    [0.5, "½"],
    [1.5, "1½"],
    [0.25, "¼"],
    [0.333, "⅓"],
    [2.75, "2¾"],
    [12.5, "12,5"],
    [1.2, "1,2"],
    [250, "250"],
  ])("formatea %d como %j", (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });

  it("devuelve cadena vacía sin cantidad", () => {
    expect(formatQuantity(null)).toBe("");
  });
});

describe("quantityToInput (ida y vuelta)", () => {
  it.each([0.5, 1.5, 2, 0.75, 12.5, 1.2])("%d sobrevive a formatear y volver a leer", (n) => {
    expect(parseQuantity(quantityToInput(n))).toBeCloseTo(n, 2);
  });
});
