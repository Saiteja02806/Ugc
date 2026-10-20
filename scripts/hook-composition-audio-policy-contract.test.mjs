import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const matcher = readProjectFile("lib/trending/hook-audio-matcher.ts");
const audioResolver = readProjectFile("lib/trending/hook-audio-db.ts");
const scheduleRoute = readProjectFile(
  "app/api/schedules/[scheduleId]/render/route.ts",
);
const savedRender = readProjectFile(
  "lib/trending/hook-video-library-render.ts",
);
const workerRender = readProjectFile("worker/src/lib/render-engine.ts");
const migration = readProjectFile(
  "supabase/migrations/20260916102534_allow_approved_loopable_hook_audio.sql",
);
const soundtrackBuilder = getSection(
  workerRender,
  "export function buildScheduleCombinationSoundtrackArgs",
  "async function inputHasAudio",
);

test("allows looping only after the Hook audio asset passed the existing approval gate", () => {
  assert.match(
    migration,
    /drop constraint if exists hook_audio_assets_loopable_check/u,
  );
  assert.match(
    migration,
    /Human review and active status remain[\s\S]+mandatory/u,
  );
  assert.match(matcher, /asset\.loopable === true/u);
});

test("uses a direct fit before a loop and never pads a short non-looping track", () => {
  assert.match(matcher, /const directFitAssets = params\.assets\.filter/u);
  assert.match(matcher, /const fitMode = directFitAssets\.length > 0 \? "trim" : "loop"/u);
  assert.match(soundtrackBuilder, /audioFitMode === "loop"/u);
  assert.match(soundtrackBuilder, /"-stream_loop", "-1"/u);
  assert.doesNotMatch(soundtrackBuilder, /apad/u);
});

test("audio availability cannot block a scheduled or saved Hook video", () => {
  assert.match(scheduleRoute, /Could not resolve Hook composition audio/u);
  assert.match(scheduleRoute, /combinedSoundtrackStatus: hookAudio\?\.fitMode \?\? "unavailable"/u);
  assert.match(savedRender, /Could not resolve saved Hook composition audio/u);
  assert.match(workerRender, /Could not download composition soundtrack/u);
  assert.match(workerRender, /Skipping short composition soundtrack/u);
  assert.match(workerRender, /Skipping unusable composition soundtrack/u);
});

test("a final composition replaces Hook source audio instead of limiting audio policy to silent Hooks", () => {
  assert.match(
    audioResolver,
    /video\.has_audio !== false && !params\.allowSourceAudioReplacement/u,
  );
  const compositionResolver = getSection(
    audioResolver,
    "export async function resolveHookAudioForComposition",
    "export async function resolveHookAudioForPreview",
  );
  assert.match(compositionResolver, /allowSourceAudioReplacement: true/u);
});

test("the composition audio version invalidates previously broken MP4s", () => {
  assert.match(scheduleRoute, /HOOK_COMPOSITION_AUDIO_RENDER_VERSION/u);
  assert.match(savedRender, /HOOK_COMPOSITION_AUDIO_RENDER_VERSION/u);
});

function readProjectFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function getSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}
