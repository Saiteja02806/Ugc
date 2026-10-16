// Offline render verification only. Supply downloaded local media; this script
// has no database, provider, upload, scheduling or publishing calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";

const [sourceFile, demoFile, musicFile] = process.argv.slice(2);
assert.ok(sourceFile && demoFile && musicFile, "Usage: node scripts/verify-explore-timing-recovery.mjs <local-hook> <local-demo> <local-music>");
const files = [sourceFile, demoFile, musicFile].map(path => {
  assert.ok(!/^[a-z][a-z\d+.-]*:\/\//i.test(path), "Local files only");
  return resolve(path);
});
const hashes = () => Promise.all(files.map(async path => createHash("sha256").update(await readFile(path)).digest("hex")));
const before = await hashes();
const parent = resolve(".tmp");
await mkdir(parent, { recursive: true });
const dir = await mkdtemp(join(parent, "explore-timing-recovery-"));
const tools = { ffmpeg: process.env.FFMPEG_PATH || ffmpeg, ffprobe: process.env.FFPROBE_PATH || ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const result = await finishExploreVideo({ sourcePath: files[0], demoPath: files[1], backgroundMusicPath: files[2], backgroundMusicPlayback: "once", tools,
  workDir: join(dir, "render"), clipComposition: { version: 1,
    sourceEditing: { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3456, originalVolume: 1, musicVolume: .2, text: null,
      textOverlays: [{ y: .185, font: "inter", color: "#ffffff", startMs: 0, endMs: 3456,
        value: "POV: you just found 100+ hook videos you can use for FREE 😁", width: .8, fontSize: 57, fontWeight: 500 }] },
    demoEditing: { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 9210, originalVolume: 1, musicVolume: .2, text: null,
      textOverlays: [{ y: .9, font: "inter", color: "#ffffff", startMs: 0, endMs: 9200,
        value: "Comment UGCPilot to get the LInk", width: .8, fontSize: 48, fontWeight: 700 }] },
    sourceAudioPlayback: "once",
  } });
assert.deepEqual(await hashes(), before, "All three original files must be unchanged");
assert.ok(Math.abs(result.durationMs - 12666) < 150, "Preserve the selected hook + demo duration");
assert.equal(result.hasBackgroundMusic, true);
const summary = { outputPath: result.outputPath, durationMs: result.durationMs, measuredDurationMs: result.measuredDurationMs,
  width: result.width, height: result.height, segments: result.segments, originalsUnchanged: true, inputSha256: before,
  ffmpeg: tools.ffmpeg, ffprobe: tools.ffprobe };
await writeFile(join(dir, "verification.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
