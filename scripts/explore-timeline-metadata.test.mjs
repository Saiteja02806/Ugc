import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test, { mock } from "node:test";
import * as media from "../worker/dist/subtitles/media.js";

let metadata;
const encodeReached = new Error("fixture reached encoding after input validation");
mock.module("../worker/dist/subtitles/media.js", { namedExports: { ...media,
  runMediaCommand: async (program) => {
    if (program === "fixture-probe") return { stdout: JSON.stringify(metadata), stderr: "" };
    throw encodeReached;
  },
} });
const { composeExploreVideo } = await import("../worker/dist/lib/explore-video-composition.js");
const fixture = () => ({ streams: [
  { index: 0, codec_type: "video", width: 128, height: 128, start_time: "0.025", duration: "3.431" },
  { index: 1, codec_type: "audio", start_time: "0", duration: "3.456" },
], format: { duration: "3.456" } });

async function workspace(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "explore-timeline-metadata-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("explore-timeline-metadata-"));
    await rm(dir, { recursive: true, force: true });
  });
  const sourcePath = join(dir, "local-fixture"); await writeFile(sourcePath, "owned local snapshot");
  return { sourcePath, workDir: join(dir, "render"), tools: { ffmpeg: "fixture-encode", ffprobe: "fixture-probe" } };
}

test("negative, nonfinite, excessive and inconsistent track timing fails before encoding", async t => {
  for (const start of ["-0.025", "0.101", "NaN", "Infinity", "N/A"]) {
    metadata = fixture(); metadata.streams[0].start_time = start;
    await assert.rejects(composeExploreVideo(await workspace(t)), { code: "COMPOSITION_TIMELINE_UNSUPPORTED" });
  }
  metadata = fixture(); metadata.streams[0].index = .5;
  await assert.rejects(composeExploreVideo(await workspace(t)), { code: "COMPOSITION_TIMELINE_UNSUPPORTED" });
  metadata = fixture(); metadata.streams[0].duration = "120"; metadata.format.duration = "120.025";
  await assert.rejects(composeExploreVideo(await workspace(t)), { code: "COMPOSITION_TIMELINE_UNSUPPORTED" });
  metadata = fixture(); metadata.streams[1].duration = "4"; metadata.format.duration = "4";
  await assert.rejects(composeExploreVideo(await workspace(t)), { code: "COMPOSITION_TIMELINE_UNSUPPORTED" });
  metadata = fixture(); metadata.streams[0].duration = "4";
  await assert.rejects(composeExploreVideo(await workspace(t)), { code: "COMPOSITION_TIMELINE_UNSUPPORTED" });
});

test("missing optional metadata, video-only uploads and short common origins retain compatibility", async t => {
  for (const variant of ["missing-start", "container-duration", "video-only", "common-origin"]) {
    metadata = fixture();
    if (variant === "missing-start") metadata.streams.forEach(stream => { delete stream.start_time; });
    if (variant === "container-duration") metadata.streams.forEach(stream => { delete stream.duration; });
    if (variant === "video-only") metadata.streams.pop();
    if (variant === "common-origin") {
      metadata.streams.forEach(stream => { stream.start_time = ".05"; stream.duration = "3"; });
      metadata.format.duration = "3.05";
    }
    await assert.rejects(composeExploreVideo(await workspace(t)), error => error === encodeReached);
  }
});
