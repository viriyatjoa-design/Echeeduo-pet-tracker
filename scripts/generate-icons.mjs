// Generate PWA icons from an inline SVG using sharp (ships with Next.js).
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");

// British Blue: coat-blue background + milk cat face + copper eyes (the BSH
// signature). `pad` = extra safe-zone padding fraction for maskable icons.
function svg({ pad = 0 } = {}) {
  const bg = "#566c86"; // coat blue ≈ hsl(212 22% 43%)
  const cream = "#f6f3ec"; // milk
  const dark = "#232a35"; // ink
  const copper = "#be7440"; // eyes
  const s = 512;
  const p = Math.round(s * pad);
  const inner = s - p * 2;
  // Cat face geometry within the inner box.
  const cx = s / 2;
  const faceR = inner * 0.3;
  const cy = p + inner * 0.56;
  const earW = inner * 0.2;
  const earH = inner * 0.22;
  const earY = cy - faceR * 0.85;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${bg}"/>
  <g fill="${cream}">
    <path d="M ${cx - faceR * 0.75} ${earY} l ${earW} ${-earH} l ${earW * 0.2} ${earH * 1.1} Z"/>
    <path d="M ${cx + faceR * 0.75} ${earY} l ${-earW} ${-earH} l ${-earW * 0.2} ${earH * 1.1} Z"/>
    <circle cx="${cx}" cy="${cy}" r="${faceR}"/>
  </g>
  <g fill="${copper}">
    <circle cx="${cx - faceR * 0.38}" cy="${cy - faceR * 0.1}" r="${faceR * 0.14}"/>
    <circle cx="${cx + faceR * 0.38}" cy="${cy - faceR * 0.1}" r="${faceR * 0.14}"/>
  </g>
  <g fill="${dark}">
    <circle cx="${cx - faceR * 0.38}" cy="${cy - faceR * 0.1}" r="${faceR * 0.07}"/>
    <circle cx="${cx + faceR * 0.38}" cy="${cy - faceR * 0.1}" r="${faceR * 0.07}"/>
    <path d="M ${cx} ${cy + faceR * 0.12} l ${-faceR * 0.09} ${faceR * 0.13} l ${faceR * 0.18} 0 Z"/>
  </g>
  <g stroke="${dark}" stroke-width="${faceR * 0.05}" stroke-linecap="round">
    <line x1="${cx - faceR * 0.5}" y1="${cy + faceR * 0.28}" x2="${cx - faceR * 1.02}" y2="${cy + faceR * 0.18}"/>
    <line x1="${cx - faceR * 0.5}" y1="${cy + faceR * 0.38}" x2="${cx - faceR * 1.0}" y2="${cy + faceR * 0.42}"/>
    <line x1="${cx + faceR * 0.5}" y1="${cy + faceR * 0.28}" x2="${cx + faceR * 1.02}" y2="${cy + faceR * 0.18}"/>
    <line x1="${cx + faceR * 0.5}" y1="${cy + faceR * 0.38}" x2="${cx + faceR * 1.0}" y2="${cy + faceR * 0.42}"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const base = Buffer.from(svg());
  const maskable = Buffer.from(svg({ pad: 0.12 }));

  const outputs = [
    ["icon-192.png", base, 192],
    ["icon-512.png", base, 512],
    ["icon-maskable-512.png", maskable, 512],
    ["apple-touch-icon.png", base, 180],
  ];
  for (const [name, buf, size] of outputs) {
    await sharp(buf).resize(size, size).png().toFile(join(iconsDir, name));
    console.log("wrote", name, size);
  }
  await writeFile(join(iconsDir, "icon.svg"), svg());
  console.log("wrote icon.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
