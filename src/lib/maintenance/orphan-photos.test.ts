import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AppDb } from "@/lib/db";
import { recipeInputSchema } from "@/lib/domain/recipe";
import { createRecipe } from "@/lib/recipes/repo";
import { cleanupOrphanPhotos } from "./orphan-photos";

let dir: string;
let db: AppDb;
const USED = "11111111-1111-1111-1111-111111111111.jpg";
const ORPHAN_OLD = "22222222-2222-2222-2222-222222222222.jpg";
const ORPHAN_NEW = "33333333-3333-3333-3333-333333333333.png";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "fotos-"));
  db = openDb(":memory:");
  createRecipe(recipeInputSchema.parse({ title: "Con foto", servings: 2, prepMinutes: null, cookMinutes: null, tags: [], ingredients: [], steps: [], rating: null }), USED, db);
  for (const f of [USED, ORPHAN_OLD, ORPHAN_NEW, "notas.txt"]) await fs.writeFile(path.join(dir, f), "x");
  const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  for (const f of [USED, ORPHAN_OLD, "notas.txt"]) await fs.utimes(path.join(dir, f), old, old);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("limpieza de fotos huérfanas", () => {
  it("borra solo fotos sin receta y antiguas", async () => {
    const deleted = await cleanupOrphanPhotos({ db, dir });
    expect(deleted).toEqual([ORPHAN_OLD]);
    expect((await fs.readdir(dir)).sort()).toEqual([USED, ORPHAN_NEW, "notas.txt"].sort());
  });

  it("sin carpeta no falla", async () => {
    expect(await cleanupOrphanPhotos({ db, dir: path.join(dir, "no-existe") })).toEqual([]);
  });
});
