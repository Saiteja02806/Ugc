import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const manifestArg = process.argv.indexOf("--manifest"), outputArg = process.argv.indexOf("--output");
const release = JSON.parse(readFileSync(manifestArg >= 0 ? process.argv[manifestArg + 1] : "worker/src/lib/explore-hook-reference-addition-release.json", "utf8"));
const transcripts = JSON.parse(readFileSync("lib/explore/reference-text-transcripts.json", "utf8"));
const output = path.resolve(outputArg >= 0 ? process.argv[outputArg + 1] : ".tmp/hook-reference-addition-review");
mkdirSync(output, { recursive: true });

const sheets = [];
for (let offset = 0; offset < release.items.length; offset += 3) {
  const rows = release.items.slice(offset, offset + 3), layers = [];
  for (const [row, item] of rows.entries()) {
    const source = transcripts.items.find(transcript => transcript.referenceId === item.id && transcript.slideId === null);
    if (!source?.frames?.length) throw new Error(`Missing extraction ${item.id}`);
    const indices = [0, .25, .5, .75, 1].map(fraction => Math.round(fraction * (source.frames.length - 1)));
    for (const [column, index] of indices.entries()) {
      const frame = source.frames[index], left = column * 360, top = row * 680;
      layers.push({ input: Buffer.from(`<svg width="360" height="40"><rect width="360" height="40" fill="white"/><text x="6" y="24" font-family="Arial" font-size="17">${item.title} · ${item.sourceFolder} · ${frame.timestampMs}ms</text></svg>`), left, top });
      layers.push({ input: await sharp(frame.path).resize({ width: 360, height: 640, fit: "inside" }).png().toBuffer(), left, top: top + 40 });
    }
  }
  const file = path.join(output, `sheet-${String(sheets.length + 1).padStart(2, "0")}.jpg`);
  await sharp({ create: { width: 1800, height: rows.length * 680, channels: 3, background: "#ddd" } }).composite(layers).jpeg({ quality: 94 }).toFile(file);
  sheets.push({ file, references: rows.map(item => ({ id: item.id, folder: item.sourceFolder, sourcePlatform: item.sourcePlatform ?? null, sourceUrl: item.sourceUrl ?? null })) });
}
writeFileSync(path.join(output, "manifest.json"), JSON.stringify(sheets, null, 2) + "\n");
console.log(JSON.stringify({ output, sheets: sheets.length, hooks: release.items.length }));
