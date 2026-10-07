// Run after worker:build. Examples use the actual owned finishing renderer with
// a frozen offline transcript. There are no uploads or transcription requests.
import { mkdir, readFile, copyFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { SUBTITLE_STYLE_REGISTRY } from "../worker/dist/subtitles/styles.js";

const fixture = resolve("scripts/fixtures/subtitle-preview"), destination = resolve(process.argv[2] ?? "public/subtitle-previews/v1");
const work = resolve(process.argv[3] ?? `.tmp/subtitle-previews-${Date.now()}`);
const transcript = JSON.parse(await readFile(join(fixture, "transcript.json"), "utf8"));
const sourcePath = join(fixture, "source.mp4"), sourceHash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
await mkdir(dirname(destination), { recursive: true });
await mkdir(destination, { recursive: false }); await mkdir(work, { recursive: false });
const manifests = [];
for (const style of SUBTITLE_STYLE_REGISTRY) {
  const result = await finishExploreVideo({ sourcePath, workDir: join(work, style.id), tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") },
    subtitles: { language: "en", style: style.id, placement: "bottom", loadTranscript: async () => transcript } });
  const video = join(destination, `${style.id}.mp4`), poster = join(destination, `${style.id}.jpg`);
  await copyFile(result.outputPath, video);
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-ss", "0.8", "-i", video, "-frames:v", "1", "-q:v", "3", poster], { windowsHide: true });
  const ass = await readFile(join(work, style.id, "subtitles/captions.ass"));
  manifests.push({ style: style.id, renderVersion: style.renderVersion, sourceHash,
    transcriptHash: createHash("sha256").update(JSON.stringify(transcript)).digest("hex"), assHash: createHash("sha256").update(ass).digest("hex"),
    videoHash: createHash("sha256").update(await readFile(video)).digest("hex"), bytes: (await stat(video)).size, durationMs: result.durationMs, width: result.width, height: result.height });
  console.log(`Rendered ${style.label}`);
}
await writeFile(join(destination, "manifest.json"), JSON.stringify({ version: 1, renderer: "finishExploreVideo", placement: "bottom", examples: manifests }, null, 2), { flag: "wx" });
