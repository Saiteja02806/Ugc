import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import catalog from "../worker/src/lib/explore-paired-reference-catalog.json" with { type: "json" };
import { getGenerationReferenceSoundtrack, getAssetReferenceSoundtrack, getExplorePairedReferences, referenceAudioBaseStorageKey } from "../worker/dist/lib/explore-reference-soundtrack.js";
import { renderExploreReferenceAudio, verifyReferenceAudioFile } from "../worker/dist/lib/explore-reference-audio-render.js";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { scanPairFolders } from "./prepare-explore-paired-references.mjs";

const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const command = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 ** 2 });
async function workspace(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "reference-audio-test-"));
  t.after(async () => { assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("reference-audio-test-")); await rm(dir, { recursive: true, force: true }); });
  return dir;
}
function video(file, seconds, frequency) {
  command(["-n", "-f", "lavfi", "-i", `color=c=blue:s=256x384:r=30:d=${seconds}`, "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${seconds}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file]);
}
function soundtrack(file) {
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=220:duration=0.7", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.7",
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]", "-c:a", "libmp3lame", file]);
}
function samples(file) {
  const bytes = command(["-i", file, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
}
function amplitude(data, seconds, frequency) {
  const start = Math.floor(seconds * 16000), count = 3200;
  let real = 0, imaginary = 0;
  for (let i = 0; i < count; i++) { const angle = 2 * Math.PI * frequency * i / 16000; real += data[start + i] * Math.cos(angle); imaginary += data[start + i] * Math.sin(angle); }
  return 2 * Math.hypot(real, imaginary) / count;
}

test("every published pair has one immutable video/audio mapping and both formats enforce the selected reference", () => {
  assert.equal(getExplorePairedReferences().length, catalog.items.length);
  assert.equal(getExplorePairedReferences("hook").length, 9);
  assert.equal(getExplorePairedReferences("wall_text").length, 7);
  assert.equal(new Set(catalog.items.map(i => i.id)).size, catalog.items.length);
  for (const item of catalog.items) {
    assert.match(item.audioStorageKey, new RegExp(`${item.audioSha256}\\.mp3$`));
    assert.equal(getGenerationReferenceSoundtrack({ referenceId: item.id, exploreFormat: item.format, referenceType: item.format }).id, item.id);
    assert.equal(getGenerationReferenceSoundtrack({ referenceId: item.id, referenceType: item.format }).id, item.id);
    assert.equal(getGenerationReferenceSoundtrack({ referenceId: item.id, exploreFormat: "talking-head", referenceType: item.format }), null);
    assert.equal(getGenerationReferenceSoundtrack({ referenceId: item.id, exploreFormat: item.format, referenceType: "other" }), null);
  }
  assert.equal(getGenerationReferenceSoundtrack({ referenceId: "unknown", exploreFormat: "hook", referenceType: "hook" }), null);
});

test("pairing is by subfolder, rejects ambiguous MP3 mappings and skips only empty folders", async t => {
  const dir = await workspace(t); await mkdir(join(dir, "pair")); await mkdir(join(dir, "empty"));
  await writeFile(join(dir, "pair", "one.mp4"), "video"); await writeFile(join(dir, "pair", "specific.mp3"), "audio");
  const result = scanPairFolders(dir, "hook"); assert.equal(result.pairs.length, 1); assert.equal(result.skipped.length, 1);
  assert.equal(basename(result.pairs[0].audioPath), "specific.mp3");
  await writeFile(join(dir, "pair", "another.mp3"), "audio"); assert.throws(() => scanPairFolders(dir, "hook"), /exactly one/);
});

test("reload provenance resolves the same reference; changed audio hashes or invalid volumes fail", () => {
  const reference = catalog.items[0], key = referenceAudioBaseStorageKey("11111111-1111-4111-8111-111111111111");
  const state = { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .35, cleanStorageKey: key };
  assert.equal(getAssetReferenceSoundtrack({ exploreReferenceId: reference.id }).referenceId, reference.id);
  assert.deepEqual(getAssetReferenceSoundtrack(JSON.parse(JSON.stringify({ render: { referenceSoundtrack: state } }))), state);
  assert.throws(() => getAssetReferenceSoundtrack({ render: { referenceSoundtrack: { ...state, audioSha256: "bad" } } }), /mapping/);
  assert.throws(() => getAssetReferenceSoundtrack({ render: { referenceSoundtrack: { ...state, volume: 5 } } }), /volume/);
});

test("generated output replaces native sound with the exact MP3 and leaves decoded pictures unchanged", async t => {
  const dir = await workspace(t), source = join(dir, "generated.mp4"), music = join(dir, "reference.mp3");
  video(source, 1, 660); soundtrack(music);
  const sha = createHash("sha256").update(await readFile(music)).digest("hex");
  await verifyReferenceAudioFile(music, sha); await assert.rejects(verifyReferenceAudioFile(music, "0".repeat(64)), /registered audio/);
  const result = await renderExploreReferenceAudio({ sourcePath: source, audioPath: music, workDir: dir, volume: .2, replaceOriginal: true, tools });
  const data = samples(result.outputPath);
  assert.ok(amplitude(data, .25, 220) > .01); assert.ok(amplitude(data, .25, 660) < .001);
  const frames = file => command(["-i", file, "-map", "0:v:0", "-f", "framemd5", "pipe:1"]).toString();
  assert.equal(frames(result.outputPath), frames(source)); assert.equal(result.timing.fit, "trim");
});

test("the full hook/demo track continues across the join, loops after its end, and clean re-edits preserve demo speech without doubling music", async t => {
  const dir = await workspace(t), opening = join(dir, "opening.mp4"), demo = join(dir, "demo.mp4"), music = join(dir, "reference.mp3");
  video(opening, 1, 660); video(demo, 2, 880); soundtrack(music);
  const result = await finishExploreVideo({ sourcePath: opening, demoPath: demo, referenceAudioPath: music, sourceOriginalVolume: 0, referenceAudioVolume: .2, workDir: join(dir, "join"), tools });
  const joined = samples(result.outputPath), clean = samples(result.referenceAudioBasePath);
  assert.equal(result.durationMs, 3000); assert.equal(result.backgroundMusicTiming.fit, "loop");
  assert.ok(amplitude(joined, .25, 220) > .01); assert.ok(amplitude(joined, .25, 660) < .001);
  // At 1.1 seconds the MP3 is still in its second (440 Hz) half, rather than restarting at the demo boundary.
  assert.ok(amplitude(joined, 1.1, 440) > .01); assert.ok(amplitude(joined, 1.1, 220) < .003);
  assert.ok(amplitude(joined, 1.1, 880) > .05); assert.ok(amplitude(joined, 1.8, 220) > .01);
  assert.ok(amplitude(clean, 1.1, 440) < .001); assert.ok(amplitude(clean, 1.1, 880) > .05);
  const reedited = await finishExploreVideo({ sourcePath: result.referenceAudioBasePath, referenceAudioPath: music, referenceAudioVolume: .2,
    editing: { version: 1, format: "hook", trimStartMs: 400, trimEndMs: 2400, originalVolume: .5, musicVolume: .2, text: null }, workDir: join(dir, "edit"), tools });
  const data = samples(reedited.outputPath);
  assert.equal(reedited.durationMs, 2000); assert.ok(amplitude(data, .25, 220) > .01);
  assert.ok(amplitude(data, 1.1, 880) > .025);
  assert.ok(Math.abs(amplitude(data, 1.1, 440) / amplitude(joined, 1.1, 440) - 1) < .15, "Reference music is applied once, at the same level, after re-editing.");
});

test("subtitles use the final paired audio timeline and are also retained on the clean edit base", async t => {
  const dir = await workspace(t), opening = join(dir, "opening.mp4"), music = join(dir, "reference.mp3");
  video(opening, 2, 880); soundtrack(music);
  let requests = 0;
  const result = await finishExploreVideo({ sourcePath: opening, referenceAudioPath: music, referenceAudioVolume: .2, workDir: join(dir, "subtitles"), tools,
    subtitles: { language: "en", style: "clean", loadTranscript: async speech => {
      requests++;
      const data = samples(speech.audioPath); assert.ok(amplitude(data, .25, 220) > .01); assert.ok(amplitude(data, .25, 880) > .05);
      return { schemaVersion: 1, provider: "fixture", model: "offline-only", language: "en", durationMs: 2000, words: [{ text: "Demo", startMs: 100, endMs: 1500 }] };
    } } });
  assert.equal(requests, 1); assert.equal(basename(result.referenceAudioBasePath), "captioned.mp4");
  const main = samples(result.outputPath), clean = samples(result.referenceAudioBasePath);
  assert.ok(amplitude(main, .25, 220) > .01); assert.ok(amplitude(clean, .25, 220) < .001); assert.ok(amplitude(clean, .25, 880) > .05);
  assert.equal(result.subtitleWordCount, 1);
});

test("added demo audio survives a paired edit's clean base and final join without entering the hook or duplicating reference music", async t => {
  const dir = await workspace(t), opening = join(dir, "opening.mp4"), demo = join(dir, "demo.mp4"), music = join(dir, "reference.mp3"), narration = join(dir, "narration.wav");
  video(opening, 1, 660); video(demo, 3, 880); soundtrack(music);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=1100:duration=0.8", narration]);
  const prepared = await finishExploreVideo({ sourcePath: demo, referenceAudioPath: music, referenceAudioVolume: .2,
    editing: { version: 1, format: "hook", trimStartMs: 500, trimEndMs: 2500, originalVolume: .5, musicVolume: .2, text: null }, workDir: join(dir, "trim"), tools });
  const sounded = await finishExploreVideo({ sourcePath: prepared.referenceAudioBasePath, referenceAudioPath: music, referenceAudioVolume: .4,
    backgroundMusicPath: narration, backgroundMusicPlayback: "once",
    editing: { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 2000, originalVolume: 1, musicVolume: .4, text: null }, workDir: join(dir, "sound"), tools });
  const cleanDemo = samples(sounded.referenceAudioBasePath), pairedDemo = samples(sounded.outputPath), preparedDemo = samples(prepared.outputPath);
  assert.ok(amplitude(cleanDemo, .3, 1100) > .025, "explicit audio is stored in the clean demo base");
  assert.ok(amplitude(cleanDemo, .3, 880) > .025, "trimmed demo speech survives the mix");
  assert.ok(amplitude(cleanDemo, .3, 220) < .001, "paired music is excluded from the clean base");
  assert.ok(amplitude(cleanDemo, 1.2, 1100) < .001, "an uploaded recording plays once");
  assert.ok(Math.abs(amplitude(pairedDemo, .3, 220) / amplitude(preparedDemo, .3, 220) - 2) < .2,
    "the sound pass uses the selected music volume for the paired Demo preview");
  const result = await finishExploreVideo({ sourcePath: opening, demoPath: sounded.referenceAudioBasePath, referenceAudioPath: music,
    sourceOriginalVolume: 0, referenceAudioVolume: .2, workDir: join(dir, "join"), tools });
  const final = samples(result.outputPath);
  assert.equal(result.durationMs, 3000);
  assert.ok(amplitude(final, .3, 1100) < .001, "demo audio never enters the opening");
  assert.ok(amplitude(final, 1.3, 1100) > .025); assert.ok(amplitude(final, 1.3, 880) > .025);
  assert.ok(amplitude(final, 2.2, 1100) < .001);
  assert.ok(amplitude(final, 1.1, 440) > .01); assert.ok(amplitude(final, 1.1, 220) < .003, "paired music continues rather than restarting at the demo boundary");
  assert.ok(Math.abs(amplitude(final, .3, 220) / amplitude(pairedDemo, .3, 220) - .5) < .1, "the final join applies the opening's paired soundtrack once at its saved volume");
});
