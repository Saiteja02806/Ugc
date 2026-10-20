import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { getTextCheckpoint, digest } from "./subtitle-pilot/cache.mjs";
import { startSubtitlePilot } from "./subtitle-pilot/server.mjs";
import { runPilotGeneration, alignmentEnvironment } from "./subtitle-pilot/pipeline.mjs";
import { SubtitleError } from "../worker/dist/subtitles/contracts.js";

async function workspace(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, "subtitle-pilot-test-"));
  t.after(async () => { if (dirname(resolve(path)) === parent && basename(path).startsWith("subtitle-pilot-test-")) await rm(path, { recursive: true, force: true }); });
  return path;
}

test("alignment subprocess receives runtime settings without application credentials", () => {
  const env = alignmentEnvironment({ PATH: "runtime-path", SystemRoot: "windows", OPENAI_API_KEY: "private", SUPABASE_SERVICE_ROLE_KEY: "private", GOOGLE_APPLICATION_CREDENTIALS: "private", PYTHONPATH: "untrusted" });
  assert.equal(env.PATH, "runtime-path"); assert.equal(env.SystemRoot, "windows");
  for (const key of ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "PYTHONPATH"]) assert.equal(env[key], undefined);
  assert.equal(env.PYTHONNOUSERSITE, "1"); assert.equal(env.HF_HUB_OFFLINE, "1");
});

test("paid text is reused and uncertain requests are never resubmitted", async t => {
  const dir = await workspace(t); let calls = 0;
  const params = { cacheDir: dir, audioHash: digest("audio"), submit: async () => { calls++; return "Hello world."; } };
  assert.equal((await getTextCheckpoint(params)).cacheHit, false);
  assert.equal((await getTextCheckpoint(params)).cacheHit, true); assert.equal(calls, 1);
  const uncertain = { ...params, audioHash: digest("uncertain"), submit: async () => { calls++; throw new Error("Network timeout after submission"); } };
  await assert.rejects(getTextCheckpoint(uncertain), /timeout/);
  await assert.rejects(getTextCheckpoint(uncertain), error => error.code === "TRANSCRIPTION_UNCERTAIN");
  assert.equal(calls, 2);
});

test("concurrent requests are locked; completed response survives late cancellation", async t => {
  const dir = await workspace(t); let accept, started;
  const begun = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { accept = resolve; });
  const controller = new AbortController();
  const params = { cacheDir: dir, audioHash: digest("shared"), signal: controller.signal, submit: async () => { started(); await gate; controller.abort(); return "Saved response."; } };
  const first = getTextCheckpoint(params); await begun;
  await assert.rejects(getTextCheckpoint(params), error => error.code === "ALREADY_RUNNING");
  accept(); await first;
  assert.equal((await getTextCheckpoint({ ...params, signal: undefined })).cacheHit, true);
});

test("no speech and unusable responses are terminal without more charges", async t => {
  const dir = await workspace(t); let calls = 0;
  for (const [value, code, secondCode] of [["", "NO_SPEECH", "NO_SPEECH"], [null, "PROVIDER_RESPONSE_INVALID", "TRANSCRIPT_REJECTED"]]) {
    const params = { cacheDir: dir, audioHash: digest(String(value)), submit: async () => { calls++; return value; } };
    await assert.rejects(getTextCheckpoint(params), e => e.code === code);
    await assert.rejects(getTextCheckpoint(params), e => e.code === secondCode);
  }
  assert.equal(calls, 2);
});

test("alignment failure retains paid text; subsequent presets reuse text and alignment", async t => {
  const dir = await workspace(t), inputPath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x568:r=24:d=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", inputPath]);
  const original = digest(await readFile(inputPath)); let submitted = 0, aligned = 0;
  const shared = { inputPath, cacheDir: join(dir, "cache"), submitText: async () => { submitted++; return "Hello world."; },
    align: async ({ durationMs }) => { aligned++; return { schemaVersion: 1, provider: "openai", model: "test-alignment", language: "en", durationMs,
      words: [{ text: "Hello", startMs: 200, endMs: 600 }, { text: "world.", startMs: 700, endMs: 1200 }] }; } };
  await assert.rejects(runPilotGeneration({ ...shared, style: "clean", jobDir: join(dir, "failed"), align: async () => { throw new SubtitleError("ALIGNMENT_REVIEW_REQUIRED", "Failed alignment"); } }), /Failed alignment/);
  for (const style of ["clean", "bold-box", "active-word"]) {
    const result = await runPilotGeneration({ ...shared, style, jobDir: join(dir, style) });
    assert.equal(result.transcriptionCacheHit, true);
    assert.equal(result.alignmentCacheHit, style !== "clean");
    assert.equal(result.sourceHash, original); assert.equal(result.wordCount, 2);
  }
  assert.equal(submitted, 1); assert.equal(aligned, 1); assert.equal(digest(await readFile(inputPath)), original);
  const cache = join(dir, "cache/alignment", (await readdir(join(dir, "cache/alignment"))).find(name => name.endsWith(".json")));
  const saved = JSON.parse(await readFile(cache, "utf8")); saved.transcript.words[0].text = "Changed";
  await writeFile(cache, JSON.stringify(saved));
  await assert.rejects(runPilotGeneration({ ...shared, style: "clean", jobDir: join(dir, "corrupt-cache") }), e => e.code === "CACHE_INVALID");
  assert.equal(submitted, 1); assert.equal(aligned, 1);
});

test("over-duration sources and silence are refused before paid transcription", async t => {
  const dir = await workspace(t); let submitted = 0;
  for (const [name, duration, frequency, code] of [["long", 31, 440, "VIDEO_DURATION_INVALID"], ["silent", 1, 0, "NO_SPEECH"]]) {
    const path = join(dir, `${name}.mp4`);
    execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-f", "lavfi", "-i", `color=c=blue:s=128x128:r=2:d=${duration}`, "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${duration}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", path]);
    await assert.rejects(runPilotGeneration({ inputPath: path, jobDir: join(dir, `job-${name}`), cacheDir: join(dir, "cache"), style: "clean", submitText: async () => { submitted++; return "Should not run"; } }), e => e.code === code);
  }
  assert.equal(submitted, 0);
});

async function waitState(origin, id, state) {
  for (let i = 0; i < 100; i++) {
    const job = await (await fetch(`${origin}/api/jobs/${id}`)).json();
    if (job.state === state) return job;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Job did not reach ${state}`);
}

test("local server validates origin, bounds uploads, deduplicates jobs and serves completed derivatives", async t => {
  const dir = await workspace(t); let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const key = "TEST_SECRET_MUST_NOT_REACH_BROWSER";
  const pilot = await startSubtitlePilot({ port: 0, dataDir: dir, samplePath: null, apiKey: key, maxBytes: 1024, runner: async params => {
    calls++; params.onStage("aligning_words"); await gate;
    const resultDir = join(params.jobDir, "result"); await mkdir(resultDir, { recursive: true });
    await writeFile(join(resultDir, "captioned.mp4"), "captioned-video"); await writeFile(join(resultDir, "captions.srt"), "1\n00:00:00,200 --> 00:00:00,600\nHello\n");
    return { wordCount: 1, durationMs: 1000, elapsedMs: 1, transcriptionCacheHit: true, alignmentCacheHit: true };
  } });
  t.after(() => pilot.close());
  const config = await fetch(`${pilot.origin}/api/config`); assert.equal(config.status, 200); assert.ok(!(await config.text()).includes(key));
  assert.equal((await fetch(`${pilot.origin}/api/config`, { headers: { Origin: "https://untrusted.example" } })).status, 403);
  const id = randomUUID(), post = { method: "POST", body: Buffer.alloc(100), headers: { Origin: pilot.origin, "X-Subtitle-Pilot": "1", "X-Request-Id": id } };
  assert.equal((await fetch(`${pilot.origin}/api/jobs`, { ...post, headers: { "X-Request-Id": id } })).status, 403);
  assert.equal((await fetch(`${pilot.origin}/api/jobs?style=invalid`, post)).status, 400);
  assert.equal((await fetch(`${pilot.origin}/api/jobs`, { ...post, body: Buffer.alloc(1025) })).status, 413);
  assert.equal((await fetch(`${pilot.origin}/api/jobs?style=active-word`, post)).status, 202);
  assert.equal((await fetch(`${pilot.origin}/api/jobs?style=active-word`, post)).status, 200);
  assert.equal((await fetch(`${pilot.origin}/api/jobs`, { ...post, headers: { ...post.headers, "X-Request-Id": randomUUID() } })).status, 409);
  assert.equal((await fetch(`${pilot.origin}/api/jobs/${id}/video`)).status, 404);
  release(); const completed = await waitState(pilot.origin, id, "completed"); assert.equal(calls, 1);
  assert.ok(!JSON.stringify(completed).includes(key)); assert.ok(!JSON.stringify(completed).includes(dir));
  const video = await fetch(`${pilot.origin}${completed.result.preview}`, { headers: { Range: "bytes=0-3" } });
  assert.equal(video.status, 206); assert.equal(await video.text(), "capt");
  assert.equal((await fetch(`${pilot.origin}${completed.result.preview}`, { headers: { Range: "bytes=999-" } })).status, 416);
  assert.equal((await fetch(`${pilot.origin}/api/jobs/${id}/../source.mp4`)).status, 404);
});

test("stopped jobs never expose a derivative", async t => {
  const dir = await workspace(t);
  const pilot = await startSubtitlePilot({ port: 0, dataDir: dir, samplePath: null, runner: async ({ signal }) => {
    await new Promise((_, reject) => { if (signal.aborted) reject(new Error("Stopped")); else signal.addEventListener("abort", () => reject(new Error("Stopped")), { once: true }); });
  } });
  t.after(() => pilot.close());
  const id = randomUUID();
  await fetch(`${pilot.origin}/api/jobs`, { method: "POST", body: Buffer.alloc(1), headers: { Origin: pilot.origin, "X-Subtitle-Pilot": "1", "X-Request-Id": id } });
  await fetch(`${pilot.origin}/api/jobs/${id}/cancel`, { method: "POST", headers: { Origin: pilot.origin, "X-Subtitle-Pilot": "1" } });
  const stopped = await waitState(pilot.origin, id, "cancelled"); assert.equal(stopped.result, undefined);
  assert.equal((await fetch(`${pilot.origin}/api/jobs/${id}/video`)).status, 404);
});

test("simultaneous uploads reserve only one active job", async t => {
  const dir = await workspace(t); let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const pilot = await startSubtitlePilot({ port: 0, dataDir: dir, samplePath: null, runner: async () => { calls++; await gate; return {}; } });
  t.after(async () => { release(); await pilot.close(); });
  const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(`${pilot.origin}/api/jobs`, {
    method: "POST", body: Buffer.alloc(100), headers: { Origin: pilot.origin, "X-Subtitle-Pilot": "1", "X-Request-Id": randomUUID() },
  })));
  assert.equal(responses.filter(response => response.status === 202).length, 1);
  assert.equal(responses.filter(response => response.status === 409).length, 7);
  assert.equal(calls, 1);
});
