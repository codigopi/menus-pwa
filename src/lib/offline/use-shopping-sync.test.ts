import { describe, expect, it, vi } from "vitest";

// El hook importa una Server Action; para probar la función pura la simulamos.
vi.mock("@/app/(app)/compra/actions", () => ({ syncShopping: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

const { applyLocalOps } = await import("./use-shopping-sync");

const base = [
  { id: "a", key: "huevo", name: "huevos", section: "lacteos" as const, amount: "6 uds", toTaste: false, sources: [], cost: 1.68, pantryNote: null, checked: false, manual: false },
];

describe("applyLocalOps (misma lógica que el servidor)", () => {
  it("marca, añade y quita en orden temporal", () => {
    const out = applyLocalOps(base, [
      { type: "add", id: "m1", text: "2 kg de naranjas", at: 2 },
      { type: "check", id: "a", checked: true, at: 3 },
      { type: "check", id: "m1", checked: true, at: 4 },
    ]);
    expect(out.find((i) => i.id === "a")?.checked).toBe(true);
    expect(out.find((i) => i.id === "m1")).toMatchObject({ name: "naranjas", amount: "2 kg", section: "fruteria", checked: true, manual: true });

    const removed = applyLocalOps(out, [{ type: "delete", id: "m1", at: 5 }]);
    expect(removed.map((i) => i.id)).toEqual(["a"]);
  });

  it("un 'añadir' repetido no duplica", () => {
    const op = { type: "add" as const, id: "m1", text: "pan", at: 1 };
    expect(applyLocalOps(base, [op, op])).toHaveLength(2);
  });
});
