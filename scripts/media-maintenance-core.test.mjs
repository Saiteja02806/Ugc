import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { keysetPages, missingVideoDetails, parseMaintenanceOptions, cleanMediaKey,
  copyMediaObject, updateMissingDetails, boundedMediaDownload } from "./media-maintenance-core.mjs";

test("inspection downloads are bounded, complete, time-limited and exclusive", async t => {
  const directory = await mkdtemp(join(tmpdir(), "ugc-maintenance-test-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("ugc-maintenance-test-"));
    await rm(directory, { recursive: true, force: true });
  });
  const file = chunks => ({ createReadStream: () => Readable.from(chunks) });
  const path = join(directory, "ok");
  await boundedMediaDownload(file([Buffer.from("mp4")]), path, 3);
  assert.equal((await readFile(path)).toString(), "mp4");
  await assert.rejects(boundedMediaDownload(file([Buffer.from("other")]), path, 5), { code: "EEXIST" });
  await assert.rejects(boundedMediaDownload(file([Buffer.from("toolong")]), join(directory, "oversize"), 3), /recorded size/);
  await assert.rejects(boundedMediaDownload(file([Buffer.from("mp")]), join(directory, "short"), 3), /incomplete/);
  const stalled = { createReadStream: () => new Readable({ read() {} }) };
  // Keep the test process alive while AbortSignal's unref'd timeout elapses.
  const timer = setTimeout(() => {}, 200);
  try { await assert.rejects(boundedMediaDownload(stalled, join(directory, "stalled"), 3, 20), { code: "ABORT_ERR" }); }
  finally { clearTimeout(timer); }
});

test("keyset visits all 62 records while eligibility shrinks after updates", async () => {
  let eligible = Array.from({ length: 62 }, (_, i) => ({ id: String(i).padStart(3, "0") }));
  const visited = [];
  for await (const row of keysetPages(async (after, limit) =>
    eligible.filter(row => after === null || row.id > after).slice(0, limit))) {
    visited.push(row.id); eligible = eligible.filter(item => item.id !== row.id);
  }
  assert.equal(visited.length, 62); assert.equal(new Set(visited).size, 62);
});
test("keyset fails closed on repeated cursor", async () => {
  await assert.rejects(async () => { for await (const row of keysetPages(async () => [{ id: "a" }], 1)) void row; }, /cursor/);
});
test("dry-run is default; destructive/ambiguous/unsupported flags fail", () => {
  assert.deepEqual(parseMaintenanceOptions([], ["inspect", "copy"]), { mode: "inspect", execute: false });
  for (const args of [["--execute", "--yes"], ["--delete-source"], ["--mode=copy"], ["--mode=switch", "--execute", "--yes"],
    ["--mode=inspect", "--mode=copy", "--execute", "--yes"], ["--inspect", "--mode=copy", "--execute", "--yes"]]) {
    assert.throws(() => parseMaintenanceOptions(args, ["inspect", "copy"]));
  }
});

test("incomplete source metadata fails before copying any object", async () => {
  let copies = 0;
  const sourceBucket = { file: () => ({ getMetadata: async () => [{ size: "12", crc32c: "hash" }], copy: async () => { copies++; } }) };
  const privateBucket = { file: () => ({ exists: async () => [false] }) };
  await assert.rejects(copyMediaObject(sourceBucket, privateBucket, "source.mp4", true), /verification/);
  assert.equal(copies, 0);
});
test("repair only fills null details, preserving existing values", () => {
  const asset = { storage_key: "videos/final.mp4", duration_seconds: 8, width: null, height: null, file_name: null, file_size_bytes: 900 };
  assert.deepEqual(missingVideoDetails(asset, { durationSeconds: 7.25, width: 1080, height: 1920, fileSizeBytes: 2048 }),
    { width: 1080, height: 1920, file_name: "final.mp4" });
});
test("invalid keys cannot cross storage boundaries", () => {
  for (const key of ["../secret", "/root", "a/../b", "a\\b", "gs://bucket", " a", "a//b"]) assert.throws(() => cleanMediaKey(key));
});
function buckets({ targetExists = false, changed = false } = {}) {
  const calls = [];
  const metadata = { generation: "1", size: "2048", crc32c: "checksum", contentType: "video/mp4" };
  let reads = 0;
  const source = { getMetadata: async () => [{ ...metadata, generation: changed && reads++ ? "2" : "1" }],
    copy: async (_target, options) => calls.push(options) };
  const target = { exists: async () => [targetExists], getMetadata: async () => [{ ...metadata, generation: "3" }] };
  return { calls, sourceBucket: { file: (_key, opts) => { if (opts) calls.push(opts); return source; } },
    privateBucket: { file: () => target } };
}
test("inspect makes no copy and copy-only pins generation and prevents overwrite", async () => {
  const dry = buckets(); assert.equal((await copyMediaObject(dry.sourceBucket, dry.privateBucket, "video.mp4", false)).state, "would_copy");
  assert.equal(dry.calls.length, 0);
  const live = buckets(); await copyMediaObject(live.sourceBucket, live.privateBucket, "video.mp4", true);
  assert.deepEqual(live.calls, [{ generation: "1" }, { preconditionOpts: { ifGenerationMatch: 0 } }]);
});
test("resume verifies an existing destination and rejects changed sources", async () => {
  const existing = buckets({ targetExists: true });
  assert.equal((await copyMediaObject(existing.sourceBucket, existing.privateBucket, "video.mp4", true)).state, "verified_existing");
  assert.equal(existing.calls.length, 0);
  const changed = buckets({ targetExists: true, changed: true });
  await assert.rejects(copyMediaObject(changed.sourceBucket, changed.privateBucket, "video.mp4", true), /changed/);
});
test("zero affected rows is a conflict, not a successful repair", async () => {
  const filters = [];
  const query = { update: () => query, eq: (...args) => { filters.push(args); return query; },
    is: (...args) => { filters.push(args); return query; }, select: () => query, maybeSingle: async () => ({ data: null }) };
  await assert.rejects(updateMissingDetails({ from: () => query }, { id: "id", updated_at: "version", storage_key: "key" }, { width: 1080 }), /changed/);
  assert.ok(filters.some(([name, value]) => name === "updated_at" && value === "version"));
  assert.ok(filters.some(([name, value]) => name === "width" && value === null));
});
