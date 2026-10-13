// Offline audit with saved speech. Never submits transcription or uploads media.
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { SUBTITLE_STYLE_REGISTRY } from "../worker/dist/subtitles/styles.js";

const input = resolve(process.argv[2] ?? ".tmp/subtitle-parity-20261014");
const transcript = JSON.parse(await readFile(join(input, "transcript.json"), "utf8"));
const out = await mkdtemp(resolve(".tmp/subtitle-style-audit-"));
const entries = [], tiles = [];
for (const style of SUBTITLE_STYLE_REGISTRY) {
  const dir = join(out, style.id); await mkdir(dir);
  const start = performance.now();
  const result = await finishExploreVideo({ sourcePath: join(input, "source.mp4"), workDir: join(dir, "render"),
    tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") },
    subtitles: { language: "en", version: 2, style: style.id, placement: "bottom", loadTranscript: async ({ durationMs }) => ({ ...transcript, durationMs }) } });
  const frame = join(dir, "frame.png");
  execFileSync(ffmpeg, ["-v", "error", "-ss", "0.8", "-i", result.outputPath, "-frames:v", "1", "-y", frame], { windowsHide: true });
  const srt = await readFile(join(dir, "render/subtitles/captions.srt"), "utf8");
  const phrases = srt.trim().split(/\n\n/).map(cue => cue.split("\n").slice(2));
  if (style.id === "serif-box" && phrases.some(lines => lines.length !== 1)) throw new Error("Serif black box must stay on one line");
  entries.push({ style: style.id, renderVersion: result.subtitleRenderVersion, words: result.subtitleWordCount, durationMs: result.durationMs,
    maxLines: Math.max(...phrases.map(lines => lines.length)), phrases: phrases.length, processingMs: Math.round(performance.now() - start), output: result.outputPath });
  const tile = await sharp(frame).resize(239,425).toBuffer();
  const label = Buffer.from(`<svg width="239" height="36"><rect width="239" height="36" fill="#202020"/><text x="12" y="24" fill="white" font-family="Arial" font-size="15">${style.label}</text></svg>`);
  tiles.push({ input: await sharp({create:{width:239,height:461,channels:3,background:'#202020'}}).composite([{input:label,top:0,left:0},{input:tile,top:36,left:0}]).png().toBuffer(),top:Math.floor((tiles.length)/4)*461,left:(tiles.length%4)*239 });
  console.log(JSON.stringify(entries.at(-1)));
}
await sharp({create:{width:956,height:922,channels:3,background:'#202020'}}).composite(tiles).png().toFile(join(out,'contact-sheet.png'));
await writeFile(join(out,"report.json"),JSON.stringify({source:"Existing owned video and saved real Scribe transcript; offline renderer, no new provider calls",entries},null,2));
console.log(`Audit saved: ${out}`);
