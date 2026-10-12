// Local visual evidence, with every sampled frame represented in source order.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const selected = new Set(process.argv.slice(2));
const transcripts = JSON.parse(readFileSync("lib/explore/reference-text-transcripts.json", "utf8"));
const output = path.resolve(".tmp/remix-text-audit/contacts-v2");
mkdirSync(output, { recursive: true });
const manifest = [];
for (const source of transcripts.items.filter(item => !selected.size || selected.has(item.referenceId))) {
  // Full frame sheets avoid concealing content outside a guessed caption region.
  for (let offset = 0; offset < source.frames.length; offset += 12) {
    const frames = source.frames.slice(offset, offset + 12), cellWidth = 360, cellHeight = 680, columns = 4;
    const layers = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i], left = i % columns * cellWidth, top = Math.floor(i / columns) * cellHeight;
      const label = frame.timestampMs === null ? "SLIDE" : `${(frame.timestampMs / 1000).toFixed(3)}s`;
      layers.push({ input: Buffer.from(`<svg width="360" height="30"><rect width="360" height="30" fill="white"/><text x="8" y="21" font-family="Arial" font-size="18">Frame ${offset + i + 1} · ${label}</text></svg>`), left, top });
      layers.push({ input: await sharp(frame.path).resize({ width: cellWidth, height: cellHeight - 30, fit: "inside" }).png().toBuffer(), left, top: top + 30 });
    }
    const file = path.join(output, `${source.referenceId}-${String(offset).padStart(4, "0")}.png`);
    await sharp({ create: { width: columns * cellWidth, height: Math.ceil(frames.length / columns) * cellHeight, channels: 3, background: "#ddd" } }).composite(layers).png().toFile(file);
    manifest.push({ referenceId: source.referenceId, slideId: source.slideId, firstFrame: offset, frames: frames.length, file });
  }
}
writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ sheets: manifest.length, frames: manifest.reduce((sum, sheet) => sum + sheet.frames, 0), output }));
