import assert from "node:assert/strict";
import { test } from "node:test";
import { assertVideoEditDuration, downloadVideoReference, readMp4DurationSeconds, OMNI_EDIT_MAX_VIDEO_BYTES } from "./video-reference-input.js";

function mp4(seconds: number, version = 0) {
  const payload = Buffer.alloc(version ? 32 : 20);
  payload[0] = version;
  payload.writeUInt32BE(1000, version ? 20 : 12);
  if (version) payload.writeBigUInt64BE(BigInt(Math.round(seconds * 1000)), 24);
  else payload.writeUInt32BE(Math.round(seconds * 1000), 16);
  const mvhd = Buffer.alloc(8); mvhd.writeUInt32BE(payload.length + 8); mvhd.write("mvhd", 4);
  const moov = Buffer.alloc(8); moov.writeUInt32BE(payload.length + 16); moov.write("moov", 4);
  return Buffer.concat([moov, mvhd, payload]);
}

test("gallery movie headers report exact duration for both MP4 versions and reject invalid metadata", () => {
  assert.equal(readMp4DurationSeconds(mp4(6.25)), 6.25);
  assert.equal(readMp4DurationSeconds(mp4(10, 1)), 10);
  for (const value of [Buffer.alloc(0), Buffer.from("not an mp4"), mp4(0), mp4(5).subarray(0, 19)]) {
    assert.throws(() => readMp4DurationSeconds(value), /verify.*duration/);
  }
});

test("edit output keeps a ten-second or fractional source timeline and rejects shortened or unreadable results", () => {
  assert.equal(assertVideoEditDuration(mp4(10), 10), 10);
  assert.equal(assertVideoEditDuration(mp4(6.25), 6.25), 6.25);
  assert.equal(assertVideoEditDuration(mp4(10.04), 10), 10.04);
  assert.throws(() => assertVideoEditDuration(mp4(3), 10), /could not preserve/);
  assert.throws(() => assertVideoEditDuration(mp4(12), 10), /could not preserve/);
  assert.throws(() => assertVideoEditDuration(Buffer.from("invalid"), 10), /verify.*duration/);
});

test("reference downloads preserve video bytes, reject redirects and bound streaming bodies without content length", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_url, options) => {
      assert.equal(options?.redirect, "error");
      return new Response(mp4(6.25), { headers: { "Content-Type": "video/mp4" } });
    }) as typeof fetch;
    assert.equal(readMp4DurationSeconds((await downloadVideoReference("https://trusted.test/clip.mp4")).buffer), 6.25);
    globalThis.fetch = (async () => new Response("bad", { headers: { "Content-Type": "text/html" } })) as typeof fetch;
    await assert.rejects(downloadVideoReference("https://trusted.test/clip.mp4"), /video file/);
    globalThis.fetch = (async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(OMNI_EDIT_MAX_VIDEO_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close();
    } }), { headers: { "Content-Type": "video/mp4" } })) as typeof fetch;
    await assert.rejects(downloadVideoReference("https://trusted.test/clip.mp4"), /32 MB/);
  } finally { globalThis.fetch = originalFetch; }
});
