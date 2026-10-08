import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

// Read-only originals. Only rendered covers and their provenance enter public/.
const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/build-explore-format-covers.mjs <format2 folder>");
const destination = path.resolve("public/explore/covers");
const temporary = mkdtempSync(path.join(tmpdir(), "explore-format-covers-"));
mkdirSync(destination, { recursive: true });
const sources = [];
function record(file) {
  const bytes = readFileSync(file);
  sources.push({ file: path.relative(source, file).replaceAll("\\", "/"), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  return file;
}
function run(args) { execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" }); }
function pairFilter() {
  return "[0:v]fps=24,scale=480:540:force_original_aspect_ratio=decrease,pad=480:540:(ow-iw)/2:(oh-ih)/2:color=0x202020,setsar=1[a];[1:v]fps=24,scale=480:540:force_original_aspect_ratio=decrease,pad=480:540:(ow-iw)/2:(oh-ih)/2:color=0x202020,setsar=1[b];[a][b]hstack=inputs=2,format=yuv420p[out]";
}
for (const [name, files] of [["hook-video-v1", ["hook.mp4", "hook1.mp4"]], ["wall-of-text-v1", ["WOT.mp4", "WOT_2-Vmake.mp4"]]]) {
  const inputs = files.map(file => record(path.join(source, file)));
  run(["-stream_loop", "-1", "-i", inputs[0], "-stream_loop", "-1", "-i", inputs[1], "-filter_complex", pairFilter(), "-map", "[out]", "-t", "8", "-an", "-c:v", "libx264", "-crf", "25", "-preset", "medium", "-movflags", "+faststart", path.join(destination, `${name}.mp4`)]);
}
// Keep every slide in numeric order and its full original framing, including text.
const decks = ["slideshows", "slideshows (2)"].map(dir => readdirSync(path.join(source, dir)).filter(file => /\.jpe?g$/i.test(file)).sort((a, b) => Number.parseInt(a) - Number.parseInt(b)).map(file => record(path.join(source, dir, file))));
for (let index = 0; index < 6; index++) {
  const layers = await Promise.all(decks.map(async (deck, column) => ({ input: await sharp(deck[index % deck.length]).resize(456, 516, { fit: "contain", background: "#202020" }).png().toBuffer(), left: column * 480 + 12, top: 12 })));
  await sharp({ create: { width: 960, height: 540, channels: 3, background: "#202020" } }).composite(layers).png().toFile(path.join(temporary, `${index + 1}.png`));
}
run(["-framerate", "1/1.5", "-i", path.join(temporary, "%d.png"), "-vf", "fps=24,format=yuv420p", "-an", "-c:v", "libx264", "-crf", "24", "-movflags", "+faststart", path.join(destination, "slideshows-v1.mp4")]);
for (const name of ["hook-video-v1", "wall-of-text-v1", "slideshows-v1"]) {
  const poster = path.join(temporary, `${name}.png`);
  run(["-i", path.join(destination, `${name}.mp4`), "-frames:v", "1", poster]);
  await sharp(poster).webp({ quality: 84 }).toFile(path.join(destination, `${name}.webp`));
}
writeFileSync(path.join(destination, "format-covers-v1.json"), JSON.stringify({ version: 1, layout: "two original references, full framing", sources }, null, 2) + "\n");
console.log("Rendered three separate covers with original-source hashes.");
