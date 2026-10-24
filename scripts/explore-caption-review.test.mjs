import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { parseExploreFinishDraft } from "../worker/dist/lib/explore-finishing-contract.js";
import { correctSubtitleTranscript, parseSubtitleCorrections } from "../worker/dist/subtitles/corrections.js";
import { exploreInteractiveDispatchUrl } from "../lib/jobs/explore-interactive-dispatch.ts";
import { parseFinishStatus } from "../lib/explore/workflow-finishing-client.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const speech = durationMs => ({ schemaVersion: 1, provider: "elevenlabs", model: "scribe_v2", language: "en", durationMs,
  words: [{ text: "personally", startMs: 100, endMs: 600 }, { text: "outreach", startMs: 1100, endMs: 1600 }] });
const draft = { version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2), demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: { language: "en", style: "clean" } };

test("corrections preserve every timing and the original transcript, reject injected timing and invalid indices", () => {
  const original = speech(2000), before = structuredClone(original);
  const corrected = correctSubtitleTranscript(original, [{ index: 0, text: "personalized" }]);
  assert.equal(corrected.words[0].text, "personalized");
  assert.deepEqual(corrected.words.map(({ startMs, endMs }) => [startMs, endMs]), original.words.map(({ startMs, endMs }) => [startMs, endMs]));
  assert.deepEqual(original, before);
  for (const values of [[{ index: -1, text: "x" }], [{ index: 2, text: "x" }], [{ index: 0, text: "" }], [{ index: 0, text: "x\n" }], [{ index: 0, text: "x", startMs: 200 }], [{ index: 0, text: "x" }, { index: 0, text: "y" }]]) {
    if (values[0].text === "x\n") values[0].text = "x\ny";
    assert.throws(() => correctSubtitleTranscript(original, values));
  }
});

test("legacy drafts keep their exact shape; caption-only mode and corrections require version 2", () => {
  assert.deepEqual(parseExploreFinishDraft(draft), draft);
  assert.throws(() => parseExploreFinishDraft({ ...draft, captionPreview: true }));
  assert.throws(() => parseExploreFinishDraft({ ...draft, subtitles: { ...draft.subtitles, corrections: [] } }));
  const next = { ...draft, captionPreview: true, subtitles: { ...draft.subtitles, version: 2, corrections: [{ index: 0, text: "personalized" }] } };
  assert.deepEqual(parseExploreFinishDraft(next), next);
  assert.throws(() => parseSubtitleCorrections([{ index: 2000, text: "x" }]));
});

test("warm routing is opt-in and cannot reroute heavy, unrelated, or forged jobs", () => {
  const env = { GCP_EXPLORE_FINISH_TASK_URL: "https://explore-worker-test-uc.a.run.app/tasks/jobs" };
  const job = { jobType: "render_demo_video", projectId: "explore", userId: "owner", idempotencyKey: `explore-finish:${id(3)}`, input: { version: 1, interactiveFinishingVersion: 1, userId: "owner", requestKey: id(3) } };
  assert.equal(exploreInteractiveDispatchUrl(job, env), env.GCP_EXPLORE_FINISH_TASK_URL);
  for (const change of [{ jobType: "final_render" }, { projectId: "other" }, { userId: null }, { idempotencyKey: "other" }, { input: { ...job.input, userId: "other" } }, { input: { ...job.input, interactiveFinishingVersion: null } }]) assert.equal(exploreInteractiveDispatchUrl({ ...job, ...change }, env), null);
  assert.equal(exploreInteractiveDispatchUrl(job, {}), null);
  for (const url of ["http://explore-worker-test-uc.a.run.app/tasks/jobs", "https://example.com/tasks/jobs", "https://explore-worker-test-uc.a.run.app/", "https://explore-worker-test-uc.a.run.app/tasks/jobs?secret=x"]) assert.throws(() => exploreInteractiveDispatchUrl(job, { GCP_EXPLORE_FINISH_TASK_URL: url }));
});

test("caption-only readiness cannot masquerade as a finished publishing asset", () => {
  const result = { ok: true, receiptVersion: 1, requestKey: id(3), jobId: id(4), outcome: "captions_ready", mediaAssetId: null, captionTranscript: speech(2000) };
  assert.equal(parseFinishStatus(result, id(3)).outcome, "captions_ready");
  assert.throws(() => parseFinishStatus({ ...result, mediaAssetId: id(5) }, id(3)));
  assert.throws(() => parseFinishStatus({ ...result, captionTranscript: undefined }, id(3)));
  assert.throws(() => parseFinishStatus({ ...result, captionTranscript: { ...speech(2000), language: "fr" } }, id(3)));
});

test("caption review skips video encoding; export reuses exact speech and burns corrected words across both clips", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(resolve(".tmp/caption-review-test-"));
  const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
  const sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4");
  for (const [file, hz] of [[sourcePath, 440], [demoPath, 660]]) execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=1", "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=1`, "-c:v", "libx264", "-c:a", "aac", file], { windowsHide: true });
  let submits = 0; const saved = new Map();
  const identities = [];
  const loadTranscript = async identity => {
    identities.push({ hash: identity.sourceHash, duration: identity.durationMs });
    const key = `${identity.sourceHash}:${identity.durationMs}`;
    if (!saved.has(key)) { submits++; saved.set(key, speech(identity.durationMs)); }
    return saved.get(key);
  };
  for (const [name, captionPreview] of [["review", true], ["export", false]]) {
    const parent = join(dir, name); await mkdir(parent);
    const result = await finishExploreVideo({ sourcePath, demoPath, tools, workDir: join(parent, "render"), captionPreview,
      subtitles: { language: "en", style: "clean", version: 2, corrections: [{ index: 0, text: "personalized" }], loadTranscript } });
    if (captionPreview) {
      assert.ok(result.outputPath.endsWith("speech.wav"));
      assert.ok(!(await readdir(parent)).includes("render"), "speech review must not encode composed.mp4");
    } else {
      const ass = await readFile(join(parent, "render/subtitles/captions.ass"), "utf8");
      assert.match(ass, /personalized/); assert.match(ass, /outreach/); assert.doesNotMatch(ass, /personally/);
      assert.equal(result.durationMs, 2000); assert.equal(result.subtitleWordCount, 2);
    }
  }
  assert.equal(submits, 1, "preview and export must share one paid speech result");
  assert.deepEqual(identities[0], identities[1]);
  assert.equal([...saved.values()][0].words[0].text, "personally", "provider cache must remain original");
});

test("demo-only and continuous music mixes share exact speech between review and export", async () => {
  const dir = await mkdtemp(resolve(".tmp/caption-review-mix-test-"));
  const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
  const sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), music = join(dir, "music.wav");
  for (const [file, hz] of [[sourcePath, 440], [demoPath, 660]]) execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=1", "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=1`, "-c:v", "libx264", "-c:a", "aac", file], { windowsHide: true });
  execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "sine=frequency=220:duration=0.3", music], { windowsHide: true });
  let submits = 0; const cache = new Map(), identities = [], speechPaths = [];
  const loadTranscript = async identity => {
    identities.push([identity.sourceHash, identity.durationMs]); speechPaths.push(identity.audioPath);
    if (!cache.has(identity.sourceHash)) { submits++; cache.set(identity.sourceHash, speech(identity.durationMs)); }
    return cache.get(identity.sourceHash);
  };
  for (const captionPreview of [true, false]) {
    const parent = join(dir, captionPreview ? "review" : "export"); await mkdir(parent);
    const result = await finishExploreVideo({ sourcePath, demoPath, demoAudioPath: music, demoAudioPlayback: "once", backgroundMusicPath: music, backgroundMusicPlayback: "repeat",
      tools, workDir: join(parent, "render"), captionPreview, subtitles: { language: "en", style: "clean", version: 2, loadTranscript } });
    assert.equal(result.hasDemoBackgroundAudio, true); assert.equal(result.hasBackgroundMusic, true);
    if (!captionPreview) assert.deepEqual(await readFile(speechPaths[0]), await readFile(result.subtitleAudioPath));
  }
  assert.equal(submits, 1); assert.deepEqual(identities[0], identities[1]);
});

test("paired reference soundtrack fallback preserves its exact speech cache and clean audio base", async () => {
  const dir = await mkdtemp(resolve(".tmp/caption-review-reference-test-"));
  const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
  const sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), referenceAudioPath = join(dir, "reference.mp3");
  for (const [file, hz] of [[sourcePath, 440], [demoPath, 660]]) execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=1", "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=1`, "-c:v", "libx264", "-c:a", "aac", file], { windowsHide: true });
  execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "sine=frequency=220:duration=0.3", referenceAudioPath], { windowsHide: true });
  let submits = 0; const cache = new Map(), identities = [];
  const loadTranscript = async identity => {
    identities.push([identity.sourceHash, identity.durationMs]);
    if (!cache.has(identity.sourceHash)) { submits++; cache.set(identity.sourceHash, speech(identity.durationMs)); }
    return cache.get(identity.sourceHash);
  };
  for (const captionPreview of [true, false]) {
    const parent = join(dir, captionPreview ? "review" : "export"); await mkdir(parent);
    const result = await finishExploreVideo({ sourcePath, demoPath, referenceAudioPath, referenceAudioVolume: .2, sourceOriginalVolume: 0,
      tools, workDir: join(parent, "render"), captionPreview, subtitles: { language: "en", style: "clean", version: 2, loadTranscript } });
    assert.equal(result.durationMs, 2000); assert.equal(result.hasBackgroundMusic, true);
    assert.ok(result.referenceAudioBasePath, "A future edit must not stack reference music on already mixed speech");
    if (captionPreview) assert.ok(result.outputPath.endsWith("reference-audio.mp4"), "Paired references deliberately retain their verified mixing pipeline");
    else assert.ok(result.referenceAudioBasePath.endsWith("captioned.mp4"));
  }
  assert.equal(submits, 1); assert.deepEqual(identities[0], identities[1]);
});
