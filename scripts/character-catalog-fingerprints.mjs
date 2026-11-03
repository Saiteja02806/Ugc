// Run after adding/replacing character catalog images; tests catch stale content versions.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

if (!process.argv[2]) throw new Error("Pass the external source directory containing the complete catalog; originals must not be stored in public/.");
const root = path.resolve(process.argv[2]);
function images(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? images(file) : /\.(png|jpe?g|webp)$/i.test(file) ? [file] : [];
  });
}
const manifest = Object.fromEntries(images(root).sort().map(file => [
  "/explore/influencer-studio/" + path.relative(root, file).replaceAll("\\", "/"),
  createHash("sha256").update(readFileSync(file)).digest("hex"),
]));
writeFileSync(new URL("../lib/characters/studio-image-fingerprints.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Versioned ${Object.keys(manifest).length} character catalog images.`);
