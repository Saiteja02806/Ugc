import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { createStoredHookFrames } from "../lib/explore/hook-source-frame-store.ts";
import { createHookOpeningSourceFrameService, decodeHookFirstFrame } from "../lib/explore/hook-source-frame.ts";
import { preparePublishedSourceFrames } from "./prepare-published-source-frames.mjs";
import { prepareTalkingHeadPublishedFrames } from "./prepare-talking-head-published-frames.mjs";
const hash = b => createHash("sha256").update(b).digest("hex");
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ugc-auto-frame-"));
  t.after(() => { assert.equal(dirname(root), tmpdir()); return rm(root, { recursive: true, force: true }); });
  const filePath = join(root, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=red:s=96x160:r=2:d=1", "-f", "lavfi", "-i", "color=blue:s=96x160:r=2:d=1", "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0", "-c:v", "libx264", "-pix_fmt", "yuv420p", filePath], { windowsHide: true });
  const video = await readFile(filePath), files = new Map(), writes = [];
  const objects = { read: async key => files.get(key) ?? null, create: async (key, bytes) => { writes.push(key); if (!files.has(key)) files.set(key, Buffer.from(bytes)); } };
  return { root, filePath, video, files, writes, objects, source: { id: "public-01", videoSha256: hash(video), filePath, width: 96, height: 160 } };
}
test("all workflows prepare real frame zero once and cold consumers work with MP4/decoder unavailable", async t => {
  const f = await fixture(t); let decodes = 0;
  const decode = async video => { decodes++; return decodeHookFirstFrame(video); };
  for (const workflow of ["hook", "wall_text", "talking_head"]) {
    const source = { ...f.source, id: `public-${workflow}`, workflow, videoStorageKey: `explore/tests/${f.source.videoSha256}.mp4` };
    await preparePublishedSourceFrames([source], { store: createStoredHookFrames(f.objects), decode });
    const opening = createHookOpeningSourceFrameService({ items: () => [source], readStoredFrame: createStoredHookFrames(f.objects).read,
      download: async () => assert.fail("Recreate must not read MP4"), decode: async () => assert.fail("Recreate must not decode") });
    const frame = await opening(source.id);
    const pixel = await sharp(frame.png).extract({ left: 40, top: 40, width: 1, height: 1 }).raw().toBuffer();
    assert(pixel[0] > 200 && pixel[2] < 30, "red opening, not later blue frame");
    assert.equal(frame.frameTimeSeconds ?? 0, 0);
  }
  assert.equal(decodes, 1); assert.equal(f.writes.length, 2);
  await preparePublishedSourceFrames([{ ...f.source, filePath: join(f.root, "offline.mp4") }], { store: createStoredHookFrames(f.objects), decode: () => assert.fail("replay cannot extract") });
});
test("upload/readback failure blocks activation and a retry converges without replacing objects", async t => {
  const f = await fixture(t); let fail = true, activated = false;
  const store = createStoredHookFrames({ ...f.objects, create: async (...args) => { if (fail) throw Error("storage unavailable"); return f.objects.create(...args); } });
  const publish = async () => { await preparePublishedSourceFrames([f.source], { store }); activated = true; };
  await assert.rejects(publish(), /storage unavailable/); assert.equal(activated, false); assert.equal(f.files.size, 0);
  fail = false; await publish(); assert.equal(activated, true); assert.equal(f.files.size, 2);
  const key = f.writes.find(k => k.endsWith(".png")); f.files.get(key)[40] ^= 1;
  activated = false; await assert.rejects(publish(), /verified/); assert.equal(activated, false);
});
test("invalid hashes, private IDs, wrong dimensions and changed source bytes cannot activate", async t => {
  const f = await fixture(t); const store = createStoredHookFrames(f.objects);
  for (const change of [{ id: "creator-account-private" }, { videoSha256: "invalid" }, { videoSha256: "b".repeat(64) }]) {
    await assert.rejects(preparePublishedSourceFrames([{ ...f.source, ...change }], { store }));
  }
  assert.equal(f.writes.length, 0);
  await assert.rejects(preparePublishedSourceFrames([{ ...f.source, width: 200 }], { store }), /published source/);
  await assert.rejects(preparePublishedSourceFrames([f.source, { ...f.source, videoSha256: "c".repeat(64) }], { store }), /Conflicting/);
});
test("Talking Head produces matching local and backend frames before returning activation receipts", async t => {
  const f = await fixture(t); const file = "/explore/talking-head-references/v1/talking-new.mp4";
  await mkdir(join(f.root, "public/explore/talking-head-references/v1"), { recursive: true });
  await writeFile(join(f.root, "public", file), f.video);
  const frames = await prepareTalkingHeadPublishedFrames([{ id: "talking-new", file, sourceSha256: f.source.videoSha256 }], { root: f.root, store: createStoredHookFrames(f.objects) });
  assert.equal(frames.length, 1); assert.equal(frames[0].frameTimeSeconds, 0);
  assert.equal(hash(await readFile(join(f.root, "public", frames[0].path))), frames[0].frameSha256);
  await assert.rejects(prepareTalkingHeadPublishedFrames([{ id: "talking-new", file: "/../../private.mp4" }], { root: f.root, store: createStoredHookFrames(f.objects) }), /path/);
});

test("disk-backed preparation survives a new process cache and changed video hashes use a different immutable index", async t => {
  const f = await fixture(t);
  const disk = { read: async key => { try { return await readFile(join(f.root, "objects", key)); } catch (e) { if (e.code === "ENOENT") return null; throw e; } },
    create: async (key, bytes) => { const file = join(f.root, "objects", key); await mkdir(dirname(file), { recursive: true }); try { await writeFile(file, bytes, { flag: "wx" }); } catch (e) { if (e.code !== "EEXIST") throw e; } } };
  const first = await preparePublishedSourceFrames([f.source], { store: createStoredHookFrames(disk) });
  const again = await preparePublishedSourceFrames([f.source], { store: createStoredHookFrames(disk), decode: () => assert.fail("saved opening must survive a fresh helper") });
  assert.deepEqual(again, first);
  const other = join(f.root, "changed.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=green:s=96x160:r=2:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", other], { windowsHide: true });
  const changed = { ...f.source, id: "new-version", filePath: other, videoSha256: hash(await readFile(other)) };
  const second = await preparePublishedSourceFrames([changed], { store: createStoredHookFrames(disk) });
  assert.notEqual(first[0].sourceSha256, second[0].sourceSha256); assert.notEqual(first[0].frameSha256, second[0].frameSha256);
  assert.equal((await createStoredHookFrames(disk).read(first[0].sourceSha256)).frameSha256, first[0].frameSha256);
});
