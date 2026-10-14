import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { mock } from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// Offline profiling of existing audit media. No transcription, generation,
// database write, upload or publishing. Build the worker before running with
// node --experimental-test-module-mocks scripts/talking-head-prepare-latency.benchmark.mjs
const root = resolve(".tmp/talking-head-subtitle-audit");
const saved = JSON.parse(await readFile(join(root, "production-transcript.json"), "utf8"));
const transcript = saved.transcript ?? saved;
await mkdir(resolve(".tmp"), { recursive: true });
const dir = await mkdtemp(resolve(".tmp/talking-head-prepare-benchmark-"));
const media = await import("../worker/dist/subtitles/media.js");
const commands = [];
mock.module("../worker/dist/subtitles/media.js", { namedExports: { ...media,
  renderSubtitleVideo: async (...args) => {
    const started = performance.now();
    try { return await media.renderSubtitleVideo(...args); }
    finally { commands.push({ operation: "video_encode", ms: Math.round(performance.now() - started) }); }
  },
  probeVideo: async (...args) => {
    const started = performance.now();
    try { return await media.probeVideo(...args); }
    finally { commands.push({ operation: "probe", ms: Math.round(performance.now() - started) }); }
  }, runMediaCommand: async (program, args, options) => {
  const started = performance.now();
  try { return await media.runMediaCommand(program, args, options); }
  finally { commands.push({ operation: program === ffprobe.path ? "probe" : args.includes("libx264") ? "video_encode" : args.at(-1)?.endsWith(".png") ? "font_probe" : "audio_prepare",
    ms: Math.round(performance.now() - started) }); }
} } });
const { finishExploreVideo } = await import("../worker/dist/lib/explore-video-finishing.js");
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const highResolution = process.argv.includes("--high-resolution");
const resolution = highResolution ? "1080:1920" : "478:850";
const sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4");
for (const [input, output, duration] of [["speaking-opening.mp4", sourcePath, 8], ["speaking-demo.mp4", demoPath, 4]]) {
  await media.runMediaCommand(ffmpeg, ["-nostdin", "-v", "error", "-n", "-i", join(root, input), "-t", String(duration),
    "-vf", `scale=${resolution}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", output]);
}
const reports = [];
const editedOnly = process.argv.includes("--edited-only");
const scenarios = editedOnly ? [{ style: null, clipEdits: true }, { style: "clean", clipEdits: true }]
  : [null, "clean", "serif-box", "editorial"].map(style => ({ style, clipEdits: false }));
const clipEditing = durationMs => ({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: durationMs,
  originalVolume: .9, musicVolume: .2, text: { value: "Existing clip edit", width: .8, y: .18, fontSize: 48,
    color: "#ffffff", startMs: 0, endMs: durationMs } });
for (const { style, clipEdits } of scenarios) {
  console.log(`Profiling ${style ?? "no captions"}${clipEdits ? " with both clip edits" : ""}…`);
  commands.length = 0; const started = performance.now(); let speechAvailableMs;
  const scenarioDir = join(dir, String(reports.length)); await mkdir(scenarioDir);
  const result = await finishExploreVideo({ sourcePath, demoPath, workDir: join(scenarioDir, "render"), tools,
    ...(clipEdits ? { clipComposition: { version: 1, sourceEditing: clipEditing(8000), demoEditing: clipEditing(4000), sourceAudioPlayback: "once" } } : {}),
    ...(style ? { subtitles: { language: "en", style, placement: "bottom", version: 2, loadTranscript: async ({ durationMs }) => {
      speechAvailableMs = Math.round(performance.now() - started);
      const words = transcript.words.filter(word => word.startMs < 8000).map(word => ({ ...word, endMs: Math.min(8000, word.endMs) }));
      words.push(...transcript.words.filter(word => word.startMs >= 15042 && word.startMs < 19042).map(word => ({ ...word, startMs: word.startMs - 15042 + 8000, endMs: Math.min(durationMs, word.endMs - 15042 + 8000) })));
      return { ...transcript, durationMs, words };
    } } } : {}) });
  const categories = ["probe", "video_encode", "font_probe", "audio_prepare"];
  reports.push({ style: style ?? "none", clipEdits, totalMs: Math.round(performance.now() - started), speechAvailableMs, outputDurationMs: Math.round(result.durationMs),
    operations: Object.fromEntries(categories.map(category => [category, { count: commands.filter(c => c.operation === category).length,
      ms: commands.filter(c => c.operation === category).reduce((sum, c) => sum + c.ms, 0) }])) });
}
const report = { fixture: `8-second Talking Head + 4-second Demo, ${resolution.replace(":", "x")}. Existing local media and saved speech words. Sequential local CPU measurements; excludes queue, network, new ASR, uploads and UI polling.`, reports };
await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
const reportName = `talking-head-prepare${editedOnly ? "-edit" : ""}${highResolution ? "-1080p" : ""}-latency.json`;
await writeFile(resolve(".tmp", reportName), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
