import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import { PrivateAudioStorage, validatePrivateAudioKey } from "../worker/src/lib/audio-storage.ts";
import { AUDIO_MAX_OUTPUT_BYTES } from "../worker/src/lib/audio-contract.ts";

const key = `owner/${randomUUID()}/final.mp3`;
const bytes = Buffer.from("offline-audio-fixture");
const checksum = createHash("sha256").update(bytes).digest("hex");
function harness({ prevention = "enforced", metadata = {}, chunks = [bytes], saveError, metadataError, bucketError } = {}) {
  const calls = [];
  const info = { size: bytes.length, generation: "42", contentType: "audio/mpeg", metadata: { checksum }, ...metadata };
  const file = { async getMetadata() { if (metadataError) throw metadataError; return [info]; }, async save(data, options) { calls.push(["save", data, options]); if (saveError) throw saveError; }, async delete(options) { calls.push(["delete", options]); }, createReadStream(options) { calls.push(["stream", options]); return (async function* () { for (const chunk of chunks) yield chunk; })(); } };
  const bucket = { async getMetadata() { calls.push(["bucket-metadata"]); if (bucketError) throw bucketError; return [{ iamConfiguration: { publicAccessPrevention: prevention } }]; }, file(name, options) { calls.push(["file", name, options]); return file; } };
  const client = { bucket(name) { calls.push(["bucket", name]); return bucket; } };
  return { storage: new PrivateAudioStorage(client, "separate-private-audio"), calls };
}
test("private object identities exclude traversal, URLs and arbitrary objects", () => {
  assert.equal(validatePrivateAudioKey(key), key);
  for (const bad of ["../secret", "https://host/audio.mp3", "owner/file.mp3", key.replace("final.mp3", "other.mp3"), key.replace("owner", "owner/path"), key.replace("final.mp3", "chunks/10000.mp3")]) assert.throws(() => validatePrivateAudioKey(bad));
});
test("Audio refuses any bucket that could be made publicly readable", async () => {
  for (const prevention of ["inherited", null, ""]) {
    const h = harness({ prevention });
    await assert.rejects(h.storage.save(key, bytes), /public access prevention/);
    assert.equal(h.calls.some(c => c[0] === "save"), false);
  }
});
test("save is immutable and duplicate acknowledgements only accept identical bytes and type", async () => {
  const h = harness(); await h.storage.save(key, bytes);
  const options = h.calls.find(c => c[0] === "save")[2];
  assert.equal(options.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(options.validation, "crc32c"); assert.equal(options.metadata.cacheControl, "private, no-store");
  await harness({ saveError: { code: 412 } }).storage.save(key, bytes);
  for (const metadata of [{ size: 1 }, { contentType: "audio/wav" }, { metadata: { checksum: "different" } }]) await assert.rejects(harness({ saveError: { code: 412 }, metadata }).storage.save(key, bytes), /different audio object/);
});
test("reads pin the checked generation and verify checksum, bounds and complete size", async () => {
  const h = harness(); assert.deepEqual(await h.storage.read(key), bytes);
  assert.equal(h.calls.find(c => c[0] === "file" && c[2])[2].generation, "42");
  assert.equal(h.calls.find(c => c[0] === "stream")[1].validation, "crc32c");
  for (const metadata of [{ size: 0 }, { size: AUDIO_MAX_OUTPUT_BYTES + 1 }, { generation: "" }]) await assert.rejects(harness({ metadata }).storage.read(key), /unsupported/);
  await assert.rejects(harness({ chunks: [Buffer.alloc(bytes.length + 1)] }).storage.read(key), /exceeded/);
  await assert.rejects(harness({ chunks: [Buffer.alloc(bytes.length - 1)] }).storage.read(key), /incomplete/);
});
test("only object-level not-found is absence; transient failures are not treated as a new provider request", async () => {
  assert.equal(await harness({ metadataError: { code: 404 } }).storage.read(key), null);
  for (const failure of [{ metadataError: { code: 503 } }, { bucketError: { code: 404 } }]) await assert.rejects(harness(failure).storage.read(key), e => e.code === "audio_storage_unavailable");
  await assert.rejects(harness({ saveError: { code: 503 } }).storage.save(key, bytes), /may be saved/);
});
test("cleanup validates every exact key before deleting and never enumerates the bucket", async () => {
  const h = harness(); await assert.rejects(h.storage.remove([key, "../anything"]));
  assert.equal(h.calls.length, 0);
  await h.storage.remove([key]); assert.equal(h.calls.filter(c => c[0] === "delete").length, 1);
  assert.equal(h.calls.find(c => c[0] === "delete")[1].ignoreNotFound, true);
});
