import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { silenceGeneratedVideo } from "../../dist/lib/silent-video.js";

test("silent output has exactly one unchanged video stream and no audio; temporary files are recoverable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ugc-audio-test-"));
  const old = process.env.FFMPEG_PATH;
  try {
    process.env.FFMPEG_PATH = ffmpeg;
    const source = join(dir, "source.mp4"), output = join(dir, "silent.mp4");
    execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-c:a", "aac", "-shortest", source], { windowsHide: true });
    const probe = file => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8", windowsHide: true })).streams;
    assert.ok(probe(source).some(s => s.codec_type === "audio"));
    writeFileSync(output, await silenceGeneratedVideo(readFileSync(source)));
    const streams = probe(output);
    assert.equal(streams.length, 1); assert.equal(streams[0].codec_type, "video");
    const hashes = file => execFileSync(ffmpeg, ["-v", "error", "-i", file, "-map", "0:v:0", "-f", "framemd5", "-"], { encoding: "utf8", windowsHide: true });
    assert.equal(hashes(output), hashes(source));
    await assert.rejects(silenceGeneratedVideo(Buffer.from("invalid video")));
    assert.ok((await silenceGeneratedVideo(readFileSync(source))).length > 0);
  } finally {
    if (old === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
