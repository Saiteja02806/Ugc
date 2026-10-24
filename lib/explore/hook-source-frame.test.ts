import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, test } from "node:test";

import { createHookSourceFrameService, decodeHookFirstFrame } from "./hook-source-frame.ts";

const require = createRequire(import.meta.url);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytes = Buffer.from("canonical reviewed Hook source fixture bytes");
const source = (id = "hook-01", video = bytes) => ({ id, videoSha256: hash(video),
  videoStorageKey: `explore/hooks/${hash(video)}.mp4`, width: 96, height: 160 });
function frame(width = 96, height = 160) {
  const png = Buffer.alloc(80);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12); png.writeUInt32BE(width, 16); png.writeUInt32BE(height, 20);
  return png;
}

test("preparation binds frame zero to the active canonical source and never uses poster URLs", async () => {
  const reads: string[] = [], decodes: Uint8Array[] = [];
  const get = createHookSourceFrameService({ items: () => [source()], sourceUrl: key => `https://media.example.test/${key}`,
    download: async url => { reads.push(url); return bytes; }, decode: async video => { decodes.push(video); return frame(); } });
  const result = await get("hook-01");
  assert.deepEqual(reads, [`https://media.example.test/explore/hooks/${hash(bytes)}.mp4`]);
  assert.deepEqual(decodes, [bytes]);
  assert.equal(result.frameIndex, 0); assert.equal(result.frameTimeSeconds, 0);
  assert.equal(result.referenceId, "hook-01"); assert.equal(result.sourceSha256, hash(bytes));
  assert.equal(result.frameSha256, hash(frame())); assert.equal(result.width, 96); assert.equal(result.height, 160);
  const second = await get("hook-01");
  assert.equal(reads.length, 1);
  result.png.fill(0);
  assert.deepEqual(second.png, frame(), "callers cannot corrupt a cached frame");
});

test("unknown, retired, non-Hook IDs and source URLs cannot trigger downloads", async () => {
  const get = createHookSourceFrameService({ items: () => [source()], download: async () => assert.fail("must not download") });
  for (const id of ["wall-text-01", "retired-hook", "https://127.0.0.1/video.mp4", "../hook-01"]) {
    await assert.rejects(get(id), error => [400, 404].includes((error as { status: number }).status));
  }
});

test("legacy Wall sources keep canonical hashes and derive bounded dimensions from decoded frame zero", async () => {
  const wall = { ...source("explore-wall-text-02"), width: 0, height: 0, workflow: "wall_text" as const };
  const get = createHookSourceFrameService({ items: () => [wall], sourceUrl: key => key, download: async () => bytes, decode: async () => frame(720, 1280) });
  const result = await get(wall.id);
  assert.equal(result.workflow, "wall_text"); assert.equal(result.width, 720); assert.equal(result.height, 1280);
  assert.equal(result.sourceSha256, hash(bytes));
  for (const shape of [[0, 1280], [8192, 8192]]) {
    const invalid = createHookSourceFrameService({ items: () => [wall], sourceUrl: key => key, download: async () => bytes, decode: async () => frame(...shape) });
    await assert.rejects(invalid(wall.id), /dimensions/);
  }
});

test("changed source bytes, invalid catalogue hashes and mismatched full dimensions fail closed", async () => {
  let decoded = 0;
  const get = createHookSourceFrameService({ items: () => [source()], sourceUrl: key => key,
    download: async () => Buffer.from("changed bytes"), decode: async () => { decoded++; return frame(); } });
  await assert.rejects(get("hook-01"), { status: 409 });
  assert.equal(decoded, 0);
  const invalid = createHookSourceFrameService({ items: () => [{ ...source(), videoStorageKey: "explore/hooks/old.mp4" }],
    download: async () => assert.fail("must not download") });
  await assert.rejects(invalid("hook-01"), { status: 409 });
  const wrongDimensions = createHookSourceFrameService({ items: () => [source()], sourceUrl: key => key,
    download: async () => bytes, decode: async () => frame(48, 80) });
  await assert.rejects(wrongDimensions("hook-01"), { status: 409 });
});

test("cache is source-hash bound, expires, and obeys entry and byte bounds", async () => {
  let clock = 0, downloads = 0;
  const videos = [bytes, Buffer.from("a different canonical reviewed Hook source fixture")];
  const items = [source("hook-01", videos[0]), source("hook-02", videos[1])];
  const get = createHookSourceFrameService({ items: () => items, sourceUrl: key => key, now: () => clock,
    maxCacheEntries: 1, maxCacheBytes: 80, cacheTtlMs: 20,
    download: async url => { downloads++; return videos[url.includes(hash(videos[0])) ? 0 : 1]; }, decode: async () => frame() });
  await get("hook-01"); await get("hook-01"); assert.equal(downloads, 1);
  await get("hook-02"); await get("hook-01"); assert.equal(downloads, 3, "old entry is evicted");
  clock = 21; await get("hook-01"); assert.equal(downloads, 4, "expired frame is decoded again");
  const uncached = createHookSourceFrameService({ items: () => [source()], sourceUrl: key => key, maxCacheBytes: 79,
    download: async () => { downloads++; return bytes; }, decode: async () => frame() });
  await uncached("hook-01"); await uncached("hook-01"); assert.equal(downloads, 6, "oversize cache entry is never retained");
});

test("duplicate requests share work, global decoding is bounded and failed work can be requested again", async () => {
  let finish!: (value: Buffer) => void, reads = 0;
  const second = Buffer.from("another approved Hook source with different bytes");
  const get = createHookSourceFrameService({ items: () => [source(), source("hook-02", second)], sourceUrl: key => key,
    maxConcurrent: 1, download: async () => { reads++; return new Promise(resolve => { finish = resolve; }); }, decode: async () => frame() });
  const a = get("hook-01"), b = get("hook-01");
  await assert.rejects(get("hook-02"), { status: 429 });
  finish(bytes); await Promise.all([a, b]); assert.equal(reads, 1);
  let attempt = 0;
  const retry = createHookSourceFrameService({ items: () => [source()], sourceUrl: key => key,
    download: async () => { if (++attempt === 1) throw Error("interrupted"); return bytes; }, decode: async () => frame() });
  await assert.rejects(retry("hook-01")); await retry("hook-01"); assert.equal(attempt, 2);
});

test("download has a streaming size limit and refuses redirects, wrong containers and empty bodies", async () => {
  let response = new Response(bytes, { headers: { "content-type": "video/mp4" } });
  const fetch = mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => {
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store"); assert.ok(options?.signal);
    return response;
  });
  const make = () => createHookSourceFrameService({ items: () => [source()], sourceUrl: key => `https://media.example.test/${key}`, decode: async () => frame() });
  try {
    await make()("hook-01");
    response = new Response(bytes, { headers: { "content-type": "video/mp4", "content-length": String(65 * 1024 ** 2) } });
    await assert.rejects(make()("hook-01"));
    response = new Response(bytes, { headers: { "content-type": "text/html" } });
    await assert.rejects(make()("hook-01"));
    response = new Response(null, { headers: { "content-type": "video/mp4" } });
    await assert.rejects(make()("hook-01"));
    response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65 * 1024 ** 2)); controller.close(); } }), { headers: { "content-type": "video/mp4" } });
    await assert.rejects(make()("hook-01"));
  } finally { fetch.mock.restore(); }
});

test("real local FFmpeg extraction decodes the first picture at source resolution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ugc-frame-test-"));
  try {
    const ffmpeg = require("ffmpeg-static") as string;
    const path = join(directory, "two-colors.mp4");
    const created = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=red:s=96x160:r=1:d=1",
      "-f", "lavfi", "-i", "color=c=blue:s=96x160:r=1:d=1",
      "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0", "-c:v", "libx264", "-crf", "0", path],
    { windowsHide: true, timeout: 30_000 });
    assert.equal(created.status, 0, String(created.stderr));
    const video = await readFile(path);
    const png = await decodeHookFirstFrame(video, ffmpeg);
    assert.equal(png.readUInt32BE(16), 96); assert.equal(png.readUInt32BE(20), 160);
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    assert.ok(data[0] > 240 && data[1] < 12 && data[2] < 12, "frame zero is red; later picture is blue");
    await assert.rejects(decodeHookFirstFrame(Buffer.alloc(40), ffmpeg), /could not be decoded/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
