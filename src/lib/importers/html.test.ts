import { describe, expect, it } from "vitest";
import { recipeInputSchema } from "@/lib/domain/recipe";
import {
  cleanInstagramDescription,
  detectSource,
  extractFirstUrl,
  extractJsonLdRecipe,
  extractMeta,
  extractTiktokDescription,
  extractYoutubeDescription,
  htmlLang,
  htmlToText,
} from "./html";
import { flattenInstructions, isoDurationToMinutes, jsonLdToDraft, parseYield } from "./jsonld";

const RECIPE_PAGE = `<!doctype html><html lang="es-ES"><head>
<meta property="og:title" content="Lentejas de la abuela &amp; chorizo">
<meta content="https://cdn.example.com/lentejas.jpg" property="og:image">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"Blog"},
 {"@type":["Recipe"],"name":"Lentejas de la abuela","description":"Un clásico.",
  "recipeYield":["4","4 raciones"],"prepTime":"PT15M","cookTime":"PT1H",
  "keywords":"cuchara, legumbres","recipeIngredient":["300 g de lentejas pardinas","2 dientes de ajo, picados","Sal al gusto"],
  "recipeInstructions":[{"@type":"HowToSection","name":"Sofrito","itemListElement":[{"@type":"HowToStep","text":"Picar la verdura."}]},
   {"@type":"HowToStep","text":"Cocer &lt;b&gt;40 min&lt;/b&gt;."}],
  "image":{"@type":"ImageObject","url":"https://cdn.example.com/l.jpg"}}]}</script>
</head><body><nav>Menú</nav><article><h1>Lentejas</h1><p>Texto<br>útil</p><script>x()</script></article></body></html>`;

describe("JSON-LD", () => {
  it("encuentra la receta dentro de @graph y la convierte en borrador válido", () => {
    const ld = extractJsonLdRecipe(RECIPE_PAGE);
    expect(ld).not.toBeNull();
    const { draft, image } = jsonLdToDraft(ld!, "https://blog.example.com/lentejas");
    expect(draft).toMatchObject({
      title: "Lentejas de la abuela",
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 60,
      tags: ["cuchara", "legumbres"],
      sourceType: "web",
    });
    expect(draft.ingredients[1]).toMatchObject({ quantity: 2, unit: "diente", name: "ajo", note: "picados" });
    expect(draft.steps.map((s) => s.text)).toEqual(["Picar la verdura.", "Cocer 40 min ."]);
    expect(image).toBe("https://cdn.example.com/l.jpg");
    expect(recipeInputSchema.safeParse(draft).success).toBe(true);
  });

  it("ignora JSON-LD roto y páginas sin receta", () => {
    expect(extractJsonLdRecipe('<script type="application/ld+json">{roto</script>')).toBeNull();
    expect(extractJsonLdRecipe("<html></html>")).toBeNull();
  });

  it("utilidades de JSON-LD", () => {
    expect(isoDurationToMinutes("PT1H20M")).toBe(80);
    expect(isoDurationToMinutes("P0DT30M")).toBe(30);
    expect(isoDurationToMinutes("PT0M")).toBeNull();
    expect(isoDurationToMinutes("30 min")).toBeNull();
    expect(parseYield("6 personas")).toBe(6);
    expect(parseYield(4)).toBe(4);
    expect(parseYield("al gusto")).toBeNull();
    expect(flattenInstructions("<p>Uno.</p><p>Dos.</p>")).toEqual(["Uno.", "Dos."]);
  });
});

describe("metadatos y redes", () => {
  it("lee og:title (con entidades), og:image y el idioma", () => {
    const meta = extractMeta(RECIPE_PAGE);
    expect(meta.title).toBe("Lentejas de la abuela & chorizo");
    expect(meta.image).toBe("https://cdn.example.com/lentejas.jpg");
    expect(htmlLang(RECIPE_PAGE)).toBe("es-es");
  });

  it.each([
    ["https://www.instagram.com/reel/abc/", "instagram"],
    ["https://vm.tiktok.com/xyz", "tiktok"],
    ["https://youtu.be/abc", "youtube"],
    ["https://m.youtube.com/shorts/abc", "youtube"],
    ["https://www.recetasderechupete.com/x", "web"],
  ])("%s → %s", (url, type) => expect(detectSource(url)).toBe(type));

  it("saca el enlace de un texto compartido", () => {
    expect(extractFirstUrl("Mira esto https://www.instagram.com/reel/abc/?igsh=1, ¡qué rico!")).toBe(
      "https://www.instagram.com/reel/abc/?igsh=1",
    );
    expect(extractFirstUrl("sin enlace")).toBeNull();
  });

  it("limpia el prefijo de Instagram", () => {
    expect(cleanInstagramDescription('1,234 likes, 56 comments - cocinera on March 3, 2025: "Tortilla 🥔\nIngredientes: 4 huevos".')).toBe(
      "Tortilla 🥔\nIngredientes: 4 huevos",
    );
    expect(cleanInstagramDescription("Texto normal")).toBe("Texto normal");
  });

  it("extrae descripciones de YouTube y TikTok con escapes", () => {
    expect(extractYoutubeDescription('..."shortDescription":"Ingredientes:\\n- 2 huevos \\"L\\"",...')).toBe(
      'Ingredientes:\n- 2 huevos "L"',
    );
    expect(extractTiktokDescription('{"desc":"Receta f\\u00e1cil #cocina"}')).toBe("Receta fácil #cocina");
  });

  it("convierte HTML en texto legible sin scripts ni navegación", () => {
    const t = htmlToText(RECIPE_PAGE);
    expect(t).toContain("Lentejas");
    expect(t).toContain("útil");
    expect(t).not.toContain("x()");
    expect(t).not.toContain("Menú");
  });
});
