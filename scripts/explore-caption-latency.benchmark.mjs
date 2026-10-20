import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { readFile, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";

// Repeatable offline comparison using already downloaded audit media and its
// real saved transcript. No network, new transcription, upload, or scheduling.
const root = resolve(".tmp/talking-head-subtitle-audit");
const original = JSON.parse(await readFile(join(root, "production-transcript.json"), "utf8"));
const transcript = original.transcript ?? original;
await mkdir(resolve(".tmp"), { recursive: true });
const dir = await mkdtemp(resolve(".tmp/explore-caption-benchmark-"));
const reports = [];
for (const [name, captionPreview] of [["caption review", true], ["final export with cached speech", false]]) {
  const work = join(dir, String(reports.length)); await mkdir(work);
  const start = performance.now(); let speechMs;
  const result = await finishExploreVideo({ sourcePath: join(root, "speaking-opening.mp4"), demoPath: join(root, "speaking-demo.mp4"), workDir: join(work, "render"), captionPreview,
    tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") },
    subtitles: { language: "en", style: "clean", version: 2, loadTranscript: async ({ durationMs }) => { speechMs = Math.round(performance.now() - start); return { ...transcript, durationMs }; } } });
  reports.push({ name, speechAvailableMs: speechMs, totalMs: Math.round(performance.now() - start), durationMs: result.durationMs });
}
const report = { fixture: "Actual 20-second, 716x1284 Talking Head + Demo audit clips; cached Scribe words; local CPU. Excludes cloud startup, download, provider time and upload.", reports };
await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
