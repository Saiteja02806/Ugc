import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { configuredScribeProvider, createScribeTranscriptionProvider, normalizeScribeTranscript,
  SCRIBE_MODEL, SCRIBE_PROVIDER_KEY, validateScribeAudio } from "./elevenlabs-provider.js";

function wav(ms = 1000, silent = false) {
  const dataBytes = ms * 32, buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF"); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40);
  if (!silent) buffer.fill(1, 44);
  return buffer;
}
const response = () => ({ language_code: "en", language_probability: 0.98, text: "Hello world!",
  words: [{ type: "word", text: "Hello", start: 0.1, end: 0.4 }, { type: "spacing", text: " " },
    { type: "word", text: "world!", start: 0.45, end: 0.8 }, { type: "audio_event", text: "(laughter)" }] });
async function input(t: TestContext, audio = wav()) {
  const dir = await mkdtemp(join(tmpdir(), "scribe-offline-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir())); assert.ok(basename(dir).startsWith("scribe-offline-"));
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "speech.wav"); await writeFile(path, audio, { flag: "wx" }); return path;
}

test("production configuration is off by default and requires a server-only key", () => {
  assert.equal(configuredScribeProvider({}), undefined);
  assert.equal(configuredScribeProvider({ EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED: "TRUE" }), undefined);
  assert.throws(() => configuredScribeProvider({ EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED: "true" }), /API key/);
  assert.throws(() => createScribeTranscriptionProvider("bad\nkey"), /API key/);
  assert.equal(configuredScribeProvider({ EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED: "true", ELEVENLABS_API_KEY: "offline-not-real" })?.id, SCRIBE_PROVIDER_KEY);
});

test("normalizes actual word timestamps, excluding spacing and audio events", () => {
  const transcript = normalizeScribeTranscript(response(), 1000);
  assert.equal(transcript.provider, "elevenlabs"); assert.equal(transcript.model, SCRIBE_MODEL); assert.equal(transcript.language, "en");
  assert.deepEqual(transcript.words, [{ text: "Hello", startMs: 100, endMs: 400 }, { text: "world!", startMs: 450, endMs: 800 }]);
  assert.equal(normalizeScribeTranscript({ ...response(), language_code: "eng" }, 1000).language, "en");
});

test("rejects non-English, missing language evidence, text-only and malformed provider results", () => {
  const bad = [null, [], { ...response(), language_code: "hi" }, { ...response(), language_code: undefined },
    { ...response(), language_probability: undefined }, { ...response(), language_probability: Infinity },
    { ...response(), words: undefined }, { ...response(), words: [] }, { ...response(), words: [{ type: "other" }] },
    { ...response(), words: [{ type: "word", text: "bad", start: 0, end: 0 }] },
    { ...response(), words: [{ type: "word", text: "bad", start: 0.1, end: 2 }] },
    { ...response(), words: [{ type: "word", text: "bad\ncommand", start: 0.1, end: 0.2 }] }];
  for (const value of bad) assert.throws(() => normalizeScribeTranscript(value, 1000));
});

test("validates measured PCM speech duration: at most 60 seconds, never silently trimmed", () => {
  validateScribeAudio(wav(60000), 60000);
  assert.throws(() => validateScribeAudio(wav(60001), 60000), /60 seconds/);
  assert.throws(() => validateScribeAudio(wav(), 60001), /60 seconds/);
  assert.throws(() => validateScribeAudio(wav(), 2000), /duration/);
  assert.throws(() => validateScribeAudio(wav(50), 50), /duration/);
  assert.throws(() => validateScribeAudio(wav(1000, true), 1000), /silent/);
  assert.throws(() => validateScribeAudio(Buffer.from("not audio"), 1000), /PCM WAV/);
  const wrongChannels = wav(); wrongChannels.writeUInt16LE(2, 22);
  assert.throws(() => validateScribeAudio(wrongChannels, 1000), /mono/);
  assert.throws(() => validateScribeAudio(wav().subarray(0, 100), 1000), /PCM WAV/);
});

test("preparation is free; submit sends only original PCM, approved model and word timing options, exactly once", async t => {
  const audio = wav(), path = await input(t, audio); let calls = 0;
  const provider = createScribeTranscriptionProvider("offline-not-real", (async (url, options) => {
    calls++; assert.equal(url, "https://api.elevenlabs.io/v1/speech-to-text"); assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error"); assert.equal((options?.headers as Record<string,string>)["xi-api-key"], "offline-not-real");
    const body = options?.body as FormData;
    assert.equal(body.get("model_id"), "scribe_v2"); assert.equal(body.get("timestamps_granularity"), "word");
    for (const key of ["tag_audio_events", "diarize", "use_multi_channel", "webhook"]) assert.equal(body.get(key), "false");
    for (const key of ["language_code", "source_url", "cloud_storage_url", "keyterms", "entity_detection", "transcript_edit"]) assert.equal(body.has(key), false);
    assert.deepEqual(Buffer.from(await (body.get("file") as Blob).arrayBuffer()), audio);
    return Response.json(response());
  }) as typeof fetch);
  const prepared = await provider.prepare(path, 1000); assert.equal(calls, 0);
  assert.equal(prepared.sourceHash, createHash("sha256").update(audio).digest("hex"));
  const first = prepared.submit(), second = prepared.submit(); assert.equal(first, second);
  assert.equal((await first).words.length, 2); assert.equal(calls, 1); assert.deepEqual(await readFile(path), audio);
});

test("silent and invalid local input fail before a paid call", async t => {
  let calls = 0;
  const provider = createScribeTranscriptionProvider("offline-not-real", (async () => { calls++; return Response.json(response()); }) as typeof fetch);
  await assert.rejects(provider.prepare(await input(t, wav(1000, true)), 1000), /silent/);
  await assert.rejects(provider.prepare(await input(t, Buffer.from("not audio")), 1000));
  assert.equal(calls, 0);
});

for (const status of [401, 403, 429, 500]) test(`HTTP ${status} makes one attempt, retains failure and does not expose the response body`, async t => {
  let calls = 0;
  const provider = createScribeTranscriptionProvider("offline-secret", (async () => { calls++; return new Response("private provider details", { status }); }) as typeof fetch);
  const prepared = await provider.prepare(await input(t), 1000);
  for (let i = 0; i < 2; i++) await assert.rejects(prepared.submit(), (error: Error) => error.message.includes(`HTTP ${status}`) && !/private|secret/.test(error.message));
  assert.equal(calls, 1);
});

test("an uncertain network response never retries automatically", async t => {
  let calls = 0;
  const provider = createScribeTranscriptionProvider("offline-not-real", (async () => { calls++; throw new Error("private network details"); }) as typeof fetch);
  const prepared = await provider.prepare(await input(t), 1000);
  for (let i = 0; i < 2; i++) await assert.rejects(prepared.submit(), (error: unknown) => (error as {code:string}).code === "PROVIDER_REQUEST_UNCERTAIN");
  assert.equal(calls, 1);
});

test("an aborted prepared request never starts a paid call", async t => {
  let calls = 0; const controller = new AbortController();
  const provider = createScribeTranscriptionProvider("offline-not-real", (async () => { calls++; return Response.json(response()); }) as typeof fetch);
  const prepared = await provider.prepare(await input(t), 1000, controller.signal); controller.abort();
  await assert.rejects(prepared.submit()); assert.equal(calls, 0);
});

test("invalid and oversized JSON responses are bounded and are never resubmitted", async t => {
  for (const text of ["not json", "x".repeat(1024 * 1024 + 1)]) {
    let calls = 0;
    const provider = createScribeTranscriptionProvider("offline-not-real", (async () => { calls++; return new Response(text); }) as typeof fetch);
    const prepared = await provider.prepare(await input(t), 1000);
    await assert.rejects(prepared.submit()); await assert.rejects(prepared.submit()); assert.equal(calls, 1);
  }
});
