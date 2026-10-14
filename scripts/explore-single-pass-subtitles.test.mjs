import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { mock, test } from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
const media = await import("../worker/dist/subtitles/media.js");
const encodes = [];
mock.module("../worker/dist/subtitles/media.js", { namedExports: { ...media,
  runMediaCommand: async (program, args, options) => { if (args.includes("libx264")) encodes.push(args); return media.runMediaCommand(program, args, options); },
  renderSubtitleVideo: async (...args) => { encodes.push(["caption-pass"]); return media.renderSubtitleVideo(...args); },
} });
const { finishExploreVideo } = await import("../worker/dist/lib/explore-video-finishing.js");
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
test("modern caption exports encode once, preserve mixed AAC audio and share speech identity with review", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(resolve(".tmp/single-pass-subtitles-")), sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "testsrc2=s=256x384:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const identities = [], original = await readFile(sourcePath);
  const transcript = identity => { identities.push([identity.sourceHash, identity.durationMs]); return { schemaVersion: 1, provider: "fixture", model: "offline", language: "en", durationMs: identity.durationMs, words: [{ text: "Readable", startMs: 200, endMs: 1000 }, { text: "captions", startMs: 1000, endMs: 1700 }] }; };
  const base = join(dir, "plain"); await mkdir(base);
  const plain = await finishExploreVideo({ sourcePath, tools, workDir: join(base, "render") });
  const audio = path => execFileSync(ffmpeg, ["-v", "error", "-i", path, "-vn", "-c:a", "copy", "-f", "adts", "-"], { windowsHide: true });
  const plainAudio = audio(plain.outputPath);
  for (const style of ["clean", "serif-box", "editorial", "word-pop"]) {
    const parent = join(dir, style); await mkdir(parent);
    encodes.length = 0;
    const result = await finishExploreVideo({ sourcePath, tools, workDir: join(parent, "render"), subtitles: { language: "en", version: 2, style, placement: "top", loadTranscript: transcript } });
    assert.equal(encodes.length, 1, style); assert.equal(result.durationMs, 2000); assert.equal(result.width, 256); assert.equal(result.height, 384);
    assert.deepEqual(audio(result.outputPath), plainAudio, "subtitle composition must preserve the exact expected AAC soundtrack");
    assert.match(await readFile(join(parent, "render/subtitles/captions.ass"), "utf8"), /Readable/);
    const frame = path => execFileSync(ffmpeg, ["-v", "error", "-ss", "0.5", "-i", path, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { windowsHide: true });
    assert.notDeepEqual(frame(result.outputPath), frame(plain.outputPath), "captions must be visible in the output");
  }
  const review = join(dir, "review"); await mkdir(review); encodes.length = 0;
  await finishExploreVideo({ sourcePath, tools, workDir: join(review, "render"), captionPreview: true, subtitles: { language: "en", version: 2, style: "clean", loadTranscript: transcript } });
  assert.equal(encodes.length, 0); assert.ok(identities.every(identity => JSON.stringify(identity) === JSON.stringify(identities[0])));
  assert.deepEqual(await readFile(sourcePath), original);
  let paidCalls = 0;
  await assert.rejects(finishExploreVideo({ sourcePath, tools, workDir: join(review, "render"), subtitles: { language: "en", version: 2, style: "clean", loadTranscript: () => { paidCalls++; } } }), /EEXIST/);
  assert.equal(paidCalls, 0);
});
