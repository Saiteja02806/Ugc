import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/prepare-explore-character-previews.mjs <source-folder>");

const output = fileURLToPath(new URL("../public/explore/characters/", import.meta.url));
const portraits = [
  ["Cozy Bedroom Vlog Selfie.png", "creator-bedroom.webp"],
  ["Selfie Vlog with Mini Microphone.png", "creator-selfie.webp"],
  ["Modern Vlogging Portrait with Microphone.png", "creator-window.webp"],
];

await mkdir(output, { recursive: true });
const manifest = [];
for (const [source, file] of portraits) {
  // Preserve the complete supplied portrait. The component handles display framing.
  const info = await sharp(resolve(input, source))
    .rotate()
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(resolve(output, file));
  const { size } = await stat(resolve(output, file));
  manifest.push({ source, file, width: info.width, height: info.height, bytes: size });
}
await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ portraits: manifest.length, bytes: manifest.reduce((sum, item) => sum + item.bytes, 0) }));
