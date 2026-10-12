import test from "node:test";
import assert from "node:assert/strict";
import { createSequencePreviewTimeline, sequencePreviewPosition, sequencePreviewOverlays, sequencePreviewAudioPosition, sequencePreviewProjection,
  validateSequencePreviewAudio, mapSequencePreviewDemoReference, type SequencePreviewSegment } from "./sequence-preview.ts";
import type { ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

const edit = (start: number, end: number, value: string): ExploreFormatEdit => ({ version: 1, format: "hook", trimStartMs: start, trimEndMs: end,
  originalVolume: .6, musicVolume: .3, text: { value, width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: end - start } });
const hook: SequencePreviewSegment = { id: "hook", label: "Hook", url: "blob:hook", durationSeconds: 10, width: 1080, height: 1920, editing: edit(2000, 7000, "Only the hook") };
const demo: SequencePreviewSegment = { id: "demo", label: "Demo", url: "blob:demo", durationSeconds: 12, width: 1920, height: 1080, editing: edit(1000, 8000, "Only the demo") };

test("total seeking includes independent trims and switches to Demo at the exact Hook endpoint", () => {
  const timeline = createSequencePreviewTimeline([hook, demo]);
  assert.equal(timeline.durationMs, 12000);
  const before = sequencePreviewPosition(timeline, 4999), boundary = sequencePreviewPosition(timeline, 5000), middle = sequencePreviewPosition(timeline, 8500);
  assert.deepEqual([before.index, before.localMs, before.sourceMs], [0, 4999, 6999]);
  assert.deepEqual([boundary.index, boundary.localMs, boundary.sourceMs], [1, 0, 1000]);
  assert.deepEqual([middle.index, middle.localMs, middle.sourceMs], [1, 3500, 4500]);
  assert.deepEqual([sequencePreviewPosition(timeline, -100).sourceMs, sequencePreviewPosition(timeline, Infinity).sourceMs], [2000, 2000]);
  const ended = sequencePreviewPosition(timeline, 20000);
  assert.deepEqual([ended.index, ended.sourceMs, ended.ended], [1, 8000, true]);
});
test("reference/remix text cannot cross the Hook boundary or replace independent Demo text", () => {
  const timeline = createSequencePreviewTimeline([hook, demo]);
  assert.equal(sequencePreviewOverlays(timeline.entries[0], 4999)[0].value, "Only the hook");
  assert.deepEqual(sequencePreviewOverlays(timeline.entries[0], 5000), []);
  const boundary = sequencePreviewPosition(timeline, 5000);
  assert.equal(sequencePreviewOverlays(boundary.entry, boundary.localMs)[0].value, "Only the demo");
  const noDemoText = createSequencePreviewTimeline([hook, { ...demo, editing: { ...demo.editing!, text: null } }]);
  const cleanBoundary = sequencePreviewPosition(noDemoText, 5000);
  assert.deepEqual(sequencePreviewOverlays(cleanBoundary.entry, cleanBoundary.localMs), []);
  assert.deepEqual(sequencePreviewOverlays(timeline.entries[1], 7000), []);
});
test("once audio ends, repeat follows the unified clock, and fades match export at sequence edges", () => {
  assert.deepEqual(sequencePreviewAudioPosition(3000, 12000, 5000, "once"), { audible: false, positionMs: 3000, gain: 0 });
  assert.deepEqual(sequencePreviewAudioPosition(3000, 12000, 5000, "repeat"), { audible: true, positionMs: 2000, gain: 1 });
  assert.equal(sequencePreviewAudioPosition(3000, 12000, 100, "repeat").gain, .5);
  assert.equal(sequencePreviewAudioPosition(3000, 12000, 11900, "repeat").gain, .5);
  assert.equal(sequencePreviewAudioPosition(3000, 12000, 12000, "repeat").audible, false);
  // Demo-only audio is driven by the local clock, rather than starting five seconds into its track.
  const boundary = sequencePreviewPosition(createSequencePreviewTimeline([hook, demo]), 5000);
  assert.equal(sequencePreviewAudioPosition(3000, boundary.entry.durationMs, boundary.localMs, "once").positionMs, 0);
});
test("contain fits a landscape demo without stretching and recorded pan follows original source timestamps", () => {
  const entry = createSequencePreviewTimeline([demo]).entries[0];
  assert.deepEqual(sequencePreviewProjection(entry, 1000, 1080, 1920), { width: 100, height: 31.640625, left: 0, top: 34.1796875 });
  const cropped = createSequencePreviewTimeline([{ ...demo, framing: { version: 1, width: .315, height: 1, points: [[0, .1, 0], [8000, .5, 0]] } }]).entries[0];
  const start = sequencePreviewProjection(cropped, 1000, 1080, 1920), later = sequencePreviewProjection(cropped, 5000, 1080, 1920);
  assert.ok(Math.abs(start.width - 316.05) < .01);
  assert.ok(later.left < start.left);
  assert.ok(Math.abs((start.left - later.left) - 63.21) < .01);
  assert.throws(() => sequencePreviewProjection(cropped, 0, 1920, 1080), /crop/);
});
test("invalid media cannot become a plausible preview and empty UI text blocks are ignored", () => {
  assert.throws(() => createSequencePreviewTimeline([]), /Choose an opening/);
  assert.throws(() => createSequencePreviewTimeline([hook, hook]), /valid clips/);
  assert.throws(() => createSequencePreviewTimeline([{ ...hook, durationSeconds: 3 }]), /trim/);
  assert.throws(() => createSequencePreviewTimeline([{ ...hook, addedAudio: { url: "blob:audio", volume: 2, playback: "once" } }]), /volume/);
  const withBlank = createSequencePreviewTimeline([{ ...hook, editing: { ...hook.editing!, text: null, textOverlays: [{ ...hook.editing!.text!, value: "  " }] } }]);
  assert.deepEqual(sequencePreviewOverlays(withBlank.entries[0], 0), []);
});
test("custom Hook audio preserves the pre-trim source clock and fades at its original mix endpoint", () => {
  const track = validateSequencePreviewAudio({ url: "blob:custom", volume: .3, playback: "once", timelineOffsetMs: 2000, mixDurationMs: 10000 });
  assert.deepEqual(sequencePreviewAudioPosition(15000, track.mixDurationMs!, track.timelineOffsetMs!, track.playback), { audible: true, positionMs: 2000, gain: 1 });
  assert.equal(sequencePreviewAudioPosition(15000, track.mixDurationMs!, 4900 + track.timelineOffsetMs!, track.playback).gain, 1);
  assert.equal(sequencePreviewAudioPosition(15000, track.mixDurationMs!, 7900 + track.timelineOffsetMs!, track.playback).gain, .5);
  assert.throws(() => validateSequencePreviewAudio({ ...track, timelineOffsetMs: NaN }), /timing/);
  assert.throws(() => validateSequencePreviewAudio({ ...track, timelineOffsetMs: 10000 }), /timing/);
});
const paired = { referenceId: "paired-demo", title: "Demo soundtrack", audioUrl: "blob:demo-reference", cleanVideoUrl: "blob:demo-clean", volume: .3 };
test("paired opening removes the Demo's paired track while keeping independently selected Demo audio", () => {
  const addedAudio = { url: "blob:extra", volume: .6, playback: "once" as const };
  const result = mapSequencePreviewDemoReference({ ...demo, addedAudio }, paired, { openingHasReference: true, requiresPreparation: true });
  assert.equal(result.url, "blob:demo-clean"); assert.equal(result.editing?.originalVolume, .6);
  assert.equal(result.addedAudio, addedAudio); assert.equal(result.referenceAudio, null);
  const noClean = mapSequencePreviewDemoReference({ ...demo, addedAudio }, { ...paired, cleanVideoUrl: null }, { openingHasReference: true, requiresPreparation: true });
  assert.equal(noClean.url, "blob:demo"); assert.equal(noClean.editing?.originalVolume, 0); assert.equal(noClean.addedAudio, addedAudio);
});
test("prepared paired Demo with plain opening restarts its own music after trim and retains a separate added track", () => {
  const addedAudio = { url: "blob:extra", volume: .6, playback: "once" as const };
  const result = mapSequencePreviewDemoReference({ ...demo, addedAudio }, paired, { openingHasReference: false, requiresPreparation: true, referenceVolume: .2 });
  assert.equal(result.url, "blob:demo-clean"); assert.equal(result.editing?.trimStartMs, 1000);
  assert.deepEqual(result.referenceAudio, { url: "blob:demo-reference", volume: .2, playback: "repeat" });
  assert.equal(result.addedAudio, addedAudio);
  assert.equal(sequencePreviewAudioPosition(3000, 7000, 0, result.referenceAudio!.playback).positionMs, 0);
  const unchangedWithExtra = mapSequencePreviewDemoReference({ ...demo, addedAudio }, paired, { openingHasReference: false, requiresPreparation: false });
  assert.equal(unchangedWithExtra.referenceAudio?.volume, paired.volume);
});
test("unchanged paired Demo keeps its baked original track and avoids a duplicate live reference layer", () => {
  const untouched: SequencePreviewSegment = { ...demo, editing: { ...demo.editing!, trimStartMs: 0, trimEndMs: 12000, originalVolume: 1, text: null } };
  const result = mapSequencePreviewDemoReference(untouched, paired, { openingHasReference: false, requiresPreparation: false });
  assert.equal(result, untouched); assert.equal(result.url, "blob:demo"); assert.equal(result.referenceAudio, undefined);
  assert.equal(mapSequencePreviewDemoReference(untouched, null, { openingHasReference: true, requiresPreparation: true }), untouched);
});
