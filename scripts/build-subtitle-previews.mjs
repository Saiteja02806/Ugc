// Run after worker:build. Examples use the actual owned finishing renderer with
// a frozen offline transcript. There are no uploads or transcription requests.
import { mkdir, readFile, copyFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { SUBTITLE_STYLE_REGISTRY, subtitlePreview } from "../worker/dist/subtitles/styles.js";

const fixture = resolve("scripts/fixtures/subtitle-preview"), destination = resolve(process.argv[2] ?? "public/subtitle-previews/v1");
const work = resolve(process.argv[3] ?? `.tmp/subtitle-previews-${Date.now()}`);
const manifestPath = resolve(process.argv[5] ?? join(destination, "manifest.json"));
// A single additive style can be built without replacing previously verified examples.
const selected = process.argv[4], styles = selected ? SUBTITLE_STYLE_REGISTRY.filter(style => style.id === selected) : SUBTITLE_STYLE_REGISTRY;
if (!styles.length) throw new Error("Choose an approved subtitle style.");
const transcript = JSON.parse(await readFile(join(fixture, "transcript.json"), "utf8"));
const sourcePath = join(fixture, "source.mp4"), sourceHash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
await mkdir(dirname(destination), { recursive: true });
await mkdir(destination, { recursive: Boolean(selected) });
await mkdir(work, { recursive: false });
const saved = selected ? JSON.parse(await readFile(manifestPath, "utf8")) : null;
if (saved && (saved.renderer !== "finishExploreVideo" || saved.placement !== "bottom" || saved.examples.some(entry => entry.sourceHash !== sourceHash || entry.transcriptHash !== createHash("sha256").update(JSON.stringify(transcript)).digest("hex"))))
  throw new Error("Additive previews must use the same source and transcript as the saved examples.");
const manifests = saved ? saved.examples.filter(entry => entry.style !== selected) : [];
for (const style of styles) {
  const result = await finishExploreVideo({ sourcePath, workDir: join(work, style.id), tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") },
    subtitles: { language: "en", style: style.id, placement: "bottom", loadTranscript: async () => transcript } });
  const video = join(destination, `${style.id}.mp4`), poster = join(destination, `${style.id}.jpg`);
  await copyFile(result.outputPath, video, constants.COPYFILE_EXCL);
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-ss", "0.8", "-i", video, "-frames:v", "1", "-q:v", "3", poster], { windowsHide: true });
  const ass = await readFile(join(work, style.id, "subtitles/captions.ass"));
  manifests.push({ style: style.id, renderVersion: style.renderVersion, ...subtitlePreview(style.id), sourceHash,
    transcriptHash: createHash("sha256").update(JSON.stringify(transcript)).digest("hex"), assHash: createHash("sha256").update(ass).digest("hex"),
    videoHash: createHash("sha256").update(await readFile(video)).digest("hex"), bytes: (await stat(video)).size, durationMs: result.durationMs, width: result.width, height: result.height });
  console.log(`Rendered ${style.label}`);
}
const examples = SUBTITLE_STYLE_REGISTRY.flatMap(style => manifests.filter(entry => entry.style === style.id));
await writeFile(manifestPath, JSON.stringify({ version: 1, renderer: "finishExploreVideo", placement: "bottom", examples }, null, 2), { flag: selected ? "w" : "wx" });
