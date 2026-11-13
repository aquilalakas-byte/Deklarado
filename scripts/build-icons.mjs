// Draws the Deklarado app icon and saves PNGs in public/icons/.
// Run: node scripts/build-icons.mjs   (uses "sharp", which comes with Next.js)

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BRAND = "#1f3fd1";
const RED = "#d92d20";

// "D" letter mark with a red alert dot. `pad` shrinks the art for maskable icons (Android crops the edges).
const svg = (pad = 0, rounded = true) => {
  const s = 64 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${BRAND}"/>
  <g transform="translate(${pad} ${pad}) scale(${s / 64})">
    <path d="M19 15h13c10.5 0 17 6.6 17 17s-6.5 17-17 17H19V15Zm9 8v18h4c5.3 0 8-3.3 8-9s-2.7-9-8-9h-4Z" fill="#fff"/>
    <circle cx="49" cy="15" r="7" fill="${RED}" stroke="${BRAND}" stroke-width="3"/>
  </g>
</svg>`;
};

await mkdir("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, svg()],
  ["icon-512.png", 512, svg()],
  ["icon-maskable-512.png", 512, svg(10, false)],
  ["apple-touch-icon.png", 180, svg(4, false)],
  ["badge-96.png", 96, svg()],
];
for (const [name, size, art] of out) {
  await writeFile(`public/icons/${name}`, await sharp(Buffer.from(art)).resize(size, size).png().toBuffer());
  console.log(`public/icons/${name}`);
}
await writeFile("src/app/icon.svg", svg());
console.log("src/app/icon.svg");
