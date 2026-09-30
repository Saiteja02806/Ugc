import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { getCachedTranscript } from "./generate.js";
import { SUBTITLE_VERSION, SubtitleError, type SubtitleTranscript } from "./contracts.js";

const transcript: SubtitleTranscript = { schemaVersion: 1, provider: "fixture", model: "test", language: "en", durationMs: 1000,
  words: [{ text: "Hello", startMs: 100, endMs: 500 }] };

async function temporaryTest(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "ugc-subtitle-tests-"));
  try { await run(dir); } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("ugc-subtitle-tests-"));
    await rm(dir, { recursive: true, force: true });
  }
}

test("cached transcripts prevent paid calls on style changes and render retries", async () => temporaryTest(async (cacheDir) => {
  let calls = 0;
  const params = { sourceHash: "source", durationMs: 1000, cacheDir, audioPath: "unused", provider: { id: "test", transcribe: async () => { calls++; return transcript; } } };
  assert.equal((await getCachedTranscript(params)).cacheHit, false);
  assert.equal((await getCachedTranscript(params)).cacheHit, true);
  assert.equal(calls, 1);
  await getCachedTranscript({ ...params, sourceHash: "new-source" });
  assert.equal(calls, 2);
}));

test("concurrent requests cannot submit the same video twice", async () => temporaryTest(async (cacheDir) => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const params = { sourceHash: "source", durationMs: 1000, cacheDir, audioPath: "unused", provider: { id: "test", transcribe: async () => { entered(); await wait; return transcript; } } };
  const first = getCachedTranscript(params);
  await started;
  await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "ALREADY_RUNNING");
  release();
  await first;
}));

test("uncertain upstream failure is not automatically submitted again", async () => temporaryTest(async (cacheDir) => {
  let calls = 0;
  const params = { sourceHash: "source", durationMs: 1000, cacheDir, audioPath: "unused", provider: { id: "test", transcribe: async (): Promise<SubtitleTranscript> => { calls++; throw new Error("network failure"); } } };
  await assert.rejects(getCachedTranscript(params));
  await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "TRANSCRIPTION_UNCERTAIN");
  assert.equal(calls, 1);
}));

test("no-speech result is terminal and cached", async () => temporaryTest(async (cacheDir) => {
  let calls = 0;
  const params = { sourceHash: "source", durationMs: 1000, cacheDir, audioPath: "unused", provider: { id: "test", transcribe: async (): Promise<SubtitleTranscript> => { calls++; throw new SubtitleError("NO_SPEECH", "No speech detected."); } } };
  for (let i = 0; i < 2; i++) await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "NO_SPEECH");
  assert.equal(calls, 1);
}));

test("a rejected provider response is cached without another paid attempt", async () => temporaryTest(async (cacheDir) => {
  let calls = 0;
  const params = { sourceHash: "source", durationMs: 1000, cacheDir, audioPath: "unused", provider: { id: "test", transcribe: async (): Promise<SubtitleTranscript> => { calls++; throw new SubtitleError("WORD_TIMINGS_UNRELIABLE", "Bad timings"); } } };
  await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "WORD_TIMINGS_UNRELIABLE");
  await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "TRANSCRIPT_REJECTED");
  assert.equal(calls, 1);
}));

test("corrupt and mismatched caches fail closed before calling the provider", async () => temporaryTest(async (cacheDir) => {
  const cacheKey = createHash("sha256").update(JSON.stringify([SUBTITLE_VERSION, "source", "test"])).digest("hex");
  const path = join(cacheDir, `${cacheKey}.json`);
  const params = { sourceHash: "source", durationMs: 1000, cacheDir, audioPath: "unused", provider: { id: "test", transcribe: async () => { assert.fail("Must not call provider"); return transcript; } } };
  await writeFile(path, "broken");
  await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "CACHE_INVALID");
  await writeFile(path, JSON.stringify({ version: SUBTITLE_VERSION, sourceHash: "other", providerId: "test", status: "completed", transcript }));
  await assert.rejects(getCachedTranscript(params), (e) => e instanceof SubtitleError && e.code === "CACHE_INVALID");
  assert.ok((await readFile(path, "utf8")).includes("other"));
}));
