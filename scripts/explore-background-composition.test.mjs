import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { parseExploreFinishDraft } from "../worker/dist/lib/explore-finishing-contract.js";

const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const command = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 ** 2 });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const edit = patch => ({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3000, originalVolume: 1, musicVolume: .2, text: null, ...patch });
const draft = () => ({ version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2), demoAudioAssetId: id(3), demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null,
  composition: { version: 1, sourceEditing: edit({ trimStartMs: 500, trimEndMs: 1500 }), demoEditing: edit({ trimStartMs: 1000 }), sourceAudioAssetId: id(4), sourceAudioPlayback: "repeat" } });

test("whole clip snapshots validate exact asset IDs, trim/text/audio and keep legacy drafts unchanged", () => {
  const input = draft();
  assert.deepEqual(parseExploreFinishDraft(input), input);
  for (const invalid of [
    { ...input, editing: edit({}) },
    { ...input, demoAssetId: null, demoAudioAssetId: null },
    { ...input, composition: { ...input.composition, sourceAudioAssetId: "https://untrusted/audio.mp3" } },
    { ...input, composition: { ...input.composition, sourceEditing: null } },
    { ...input, composition: { ...input.composition, extra: true } },
    { ...input, composition: { ...input.composition, demoEditing: edit({ originalVolume: 3 }) } },
  ]) assert.throws(() => parseExploreFinishDraft(invalid));
  const legacy = { ...input }; delete legacy.composition;
  assert.deepEqual(parseExploreFinishDraft(legacy), legacy);
  assert.throws(() => parseExploreFinishDraft({ ...legacy, demoAssetId: null, demoAudioAssetId: null, editing: edit({}),
    subtitles: { language: "en", style: "clean", version: 2 } }), /Format editing uses one video and no subtitles/,
  "Single-clip editing with captions must use the supported composition contract, before worker dispatch");
});

const frame = (path, time) => command(["-ss", String(time), "-i", path, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
function whitePixels(buffer) {
  let count = 0;
  for (let i = 0; i < buffer.length; i += 3) if (buffer[i] > 190 && buffer[i + 1] > 190 && buffer[i + 2] > 190) count++;
  return count;
}
function power(path, time, frequency) {
  const buffer = command(["-ss", String(time), "-i", path, "-t", "0.2", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
  let real = 0, imaginary = 0;
  for (let i = 0; i < buffer.length / 4; i++) {
    const phase = 2 * Math.PI * frequency * i / 16000, value = buffer.readFloatLE(i * 4);
    real += value * Math.cos(phase); imaginary += value * Math.sin(phase);
  }
  return real ** 2 + imaginary ** 2;
}

test("one worker composition preserves both independent edits, exact text timing and per-clip sound", async t => {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "explore-background-composition-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("explore-background-composition-"));
    await rm(dir, { recursive: true, force: true });
  });
  const opening = join(dir, "opening.mp4"), demo = join(dir, "demo.mp4"), sourceAudio = join(dir, "source.wav"), demoAudio = join(dir, "demo.wav");
  for (const [path, color, frequency] of [[opening, "blue", 440], [demo, "red", 660]]) command(["-n", "-f", "lavfi", "-i", `color=c=${color}:s=256x384:r=30:d=3`, "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=3`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path]);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=3", sourceAudio]);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=220:duration=1", "-f", "lavfi", "-i", "sine=frequency=1100:duration=2", "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]", demoAudio]);
  const inputs = [opening, demo, sourceAudio, demoAudio];
  const hashes = await Promise.all(inputs.map(async path => createHash("sha256").update(await readFile(path)).digest("hex")));
  const text = { color: "#ffffff", width: .8, y: .1, fontSize: 60 };
  const result = await finishExploreVideo({ sourcePath: opening, demoPath: demo, demoAudioPath: demoAudio, demoAudioPlayback: "once", tools, workDir: join(dir, "final"),
    clipComposition: { version: 1, sourceEditing: edit({ trimStartMs: 500, trimEndMs: 1500, originalVolume: .4, musicVolume: .1, textOverlays: [{ ...text, value: "HOOK", startMs: 100, endMs: 700 }] }),
      demoEditing: edit({ trimStartMs: 1000, originalVolume: .5, musicVolume: .6, textOverlays: [{ ...text, value: "DEMO", startMs: 300, endMs: 1200 }] }),
      sourceAudioPath: sourceAudio, sourceAudioPlayback: "repeat" },
  });
  assert.ok(Math.abs(result.durationMs - 3000) < 100);
  assert.deepEqual(result.segments.map(segment => segment.durationMs), [1000, 2000]);
  assert.ok(whitePixels(frame(result.outputPath, .3)) > 20);
  assert.equal(whitePixels(frame(result.outputPath, .85)), 0);
  assert.equal(whitePixels(frame(result.outputPath, 1.1)), 0);
  assert.ok(whitePixels(frame(result.outputPath, 1.6)) > 20);
  assert.equal(whitePixels(frame(result.outputPath, 2.5)), 0);
  assert.ok(power(result.outputPath, .3, 440) > power(result.outputPath, .3, 660) * 100);
  assert.ok(power(result.outputPath, .3, 880) > power(result.outputPath, .3, 220) * 100);
  assert.ok(power(result.outputPath, 1.4, 660) > power(result.outputPath, 1.4, 440) * 100);
  assert.ok(power(result.outputPath, 1.4, 220) > power(result.outputPath, 1.4, 1100) * 100, "demo soundtrack starts at its beginning after the trim");
  assert.ok(power(result.outputPath, 2.4, 1100) > power(result.outputPath, 2.4, 220) * 100);
  assert.deepEqual(await Promise.all(inputs.map(async path => createHash("sha256").update(await readFile(path)).digest("hex"))), hashes);
});

test("Talking Head captions review and export support trimmed opening and demo without optional opening audio", async t => {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "explore-caption-no-opening-audio-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("explore-caption-no-opening-audio-"));
    await rm(dir, { recursive: true, force: true });
  });
  const opening = join(dir, "opening.mp4"), demo = join(dir, "demo.mp4");
  for (const [path, color, frequency] of [[opening, "blue", 440], [demo, "red", 660]]) command(["-n", "-f", "lavfi", "-i", `color=c=${color}:s=256x384:r=30:d=3`, "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=3`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path]);
  const originalHashes = await Promise.all([opening, demo].map(async path => createHash("sha256").update(await readFile(path)).digest("hex")));
  for (const withDemo of [false, true]) {
    let submissions = 0;
    const speech = new Map(), identities = [];
    const loadTranscript = async identity => {
      identities.push([identity.sourceHash, identity.durationMs]);
      if (!speech.has(identity.sourceHash)) {
        submissions++;
        speech.set(identity.sourceHash, { schemaVersion: 1, provider: "elevenlabs", model: "scribe_v2", language: "en", durationMs: identity.durationMs,
          words: [{ text: "personally", startMs: 100, endMs: 600 }, ...(withDemo ? [{ text: "Demo", startMs: 1200, endMs: 1700 }] : [])] });
      }
      return speech.get(identity.sourceHash);
    };
    for (const captionPreview of [true, false]) {
      const path = join(dir, `${withDemo ? "with-demo" : "opening-only"}-${captionPreview ? "review" : "export"}`); await mkdir(path);
      const result = await finishExploreVideo({ sourcePath: opening, ...(withDemo ? { demoPath: demo } : {}), captionPreview, tools, workDir: join(path, "render"),
        clipComposition: { version: 1, sourceEditing: edit({ trimStartMs: 500, trimEndMs: 1500 }), demoEditing: withDemo ? edit({ trimStartMs: 1000 }) : null,
          sourceAudioPlayback: "once" },
        subtitles: { language: "en", style: "clean", placement: "bottom", version: 2, corrections: [{ index: 0, text: "personalized" }], loadTranscript } });
      assert.ok(Math.abs(result.durationMs - (withDemo ? 3000 : 1000)) <= 100);
      assert.deepEqual(result.segments.map(segment => segment.durationMs), withDemo ? [1000, 2000] : [1000]);
      assert.equal(result.hasBackgroundMusic, false); assert.equal(result.subtitleWordCount, withDemo ? 2 : 1);
      if (captionPreview) assert.ok(result.outputPath.endsWith("speech.wav"));
      else {
        // The single-pass renderer may compose and burn captions into the same
        // MP4. Verify its actual pixels/audio below instead of an internal name.
        assert.ok(result.outputPath.endsWith(".mp4"));
        const ass = await readFile(join(path, "render", "subtitles", "captions.ass"), "utf8");
        assert.match(ass, /personalized/); assert.doesNotMatch(ass, /personally/);
        assert.ok(whitePixels(frame(result.outputPath, .3)) > 20);
        if (withDemo) {
          assert.ok(whitePixels(frame(result.outputPath, 1.4)) > 20);
          assert.ok(power(result.outputPath, .3, 440) > power(result.outputPath, .3, 660) * 100);
          assert.ok(power(result.outputPath, 1.4, 660) > power(result.outputPath, 1.4, 440) * 100);
        }
      }
    }
    assert.equal(submissions, 1, "Review and export reuse the same exact trimmed speech result");
    assert.deepEqual(identities[0], identities[1]);
    assert.equal(speech.values().next().value.words[0].text, "personally", "Corrections leave the original transcript intact");
  }
  assert.deepEqual(await Promise.all([opening, demo].map(async path => createHash("sha256").update(await readFile(path)).digest("hex"))), originalHashes);
});

test("nested opening audio keeps explicitly selected once and repeat playback", async t => {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "explore-opening-audio-playback-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("explore-opening-audio-playback-"));
    await rm(dir, { recursive: true, force: true });
  });
  const opening = join(dir, "opening.mp4"), audio = join(dir, "music.wav");
  command(["-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", opening]);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=0.35", audio]);
  const powers = new Map();
  for (const playback of ["once", "repeat"]) {
    const path = join(dir, playback); await mkdir(path);
    const result = await finishExploreVideo({ sourcePath: opening, tools, workDir: join(path, "render"),
      clipComposition: { version: 1, sourceEditing: edit({ trimEndMs: 1000, musicVolume: .6 }), demoEditing: null, sourceAudioPath: audio, sourceAudioPlayback: playback } });
    assert.ok(Math.abs(result.durationMs - 1000) <= 100);
    assert.ok(power(result.outputPath, .05, 880) > 1, "The selected track is audible at the opening");
    powers.set(playback, power(result.outputPath, .55, 880));
  }
  assert.ok(powers.get("repeat") > powers.get("once") * 100, "Repeat covers the opening; once stops after the short track");
});
