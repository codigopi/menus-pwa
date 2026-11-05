// Genera los iconos PNG de la PWA a partir de scripts/icon.svg.
// Uso: npm run icons  (requiere sharp, que ya viene con Next.js)
import sharp from "sharp";
import fs from "node:fs/promises";

const svg = await fs.readFile(new URL("./icon.svg", import.meta.url));
const out = (p) => new URL(`../${p}`, import.meta.url);

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/maskable-512.png", 512],
  ["src/app/apple-icon.png", 180],
];
for (const [file, size] of targets) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(file).pathname.replace(/^\/([A-Z]:)/, "$1"));
  console.log("✓", file);
}
await fs.copyFile(new URL("./icon.svg", import.meta.url), out("src/app/icon.svg"));
console.log("✓ src/app/icon.svg");
