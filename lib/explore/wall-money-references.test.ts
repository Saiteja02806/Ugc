import assert from "node:assert/strict";
import { formatGeneratedMotionPhases } from "./motion-phase-display.ts";
import test from "node:test";
import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
import release from "../../worker/src/lib/explore-wall-money-reference-release.json" with { type: "json" };
import reviews from "./wall-money-reference-prompts.json" with { type: "json" };
import catalog from "./wall-reference-motion-catalog.json" with { type: "json" };
import { getWallMoneyMotion, getWallReferenceMotion } from "./wall-money-motion.ts";
import { buildStartingFrameAnimationPrompt } from "./starting-frame-workflow.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { createHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getRecreateReferences } from "./recreate-catalog.ts";
import { filterReferences, referenceCategories } from "./recreate-types.ts";
import { getAdditionalStartingFrameSources } from "./starting-frame-reference-source.ts";
import { getExplorePairedReference, getGenerationReferenceSoundtrack } from "../../worker/src/lib/explore-reference-soundtrack.ts";
import { ReferenceTextSchema } from "./reference-text.ts";
import { getReferenceVideoPrompt } from "./reference-video-prompts.ts";
nextEnv.loadEnvConfig(process.cwd());

test("six reviews bind distinct IDs, full frame clocks, source provenance and exact text", () => {
  assert.equal(reviews.entries.length, 6);
  assert.equal(new Set(reviews.entries.map(row => row.referenceId)).size, 6);
  assert.equal(reviews.entries.reduce((n, row) => n + row.reviewedFrameCount, 0), 1100);
  const texts = JSON.parse(readFileSync(new URL("./reference-text-catalog.json", import.meta.url), "utf8"));
  for (const row of reviews.entries) {
    assert.equal(row.animationOpeningSourceTime, 0);
    assert.equal(row.sourceDurationSeconds, row.sourceFrameCount / row.sourceFps);
    assert.equal(row.visualQualification, "not_tested");
    const record = ReferenceTextSchema.parse(texts.items.find((item: { referenceId: string }) => item.referenceId === row.referenceId));
    assert.equal(record.sourceSha256, row.sourceSha256);
    assert.equal(record.blocks[0].text, row.exactText);
    assert.equal(record.blocks[0].startMs, 0);
    assert.equal(record.blocks[0].endMs, Math.round(row.sourceDurationSeconds * 1000));
    const performance = getReferenceVideoPrompt(row.referenceId, `https://media.test/${row.sourceSha256}.mp4`)!;
    assert.ok(performance.includes(row.beats.at(-1)!.action));
    assert.equal(getReferenceVideoPrompt(row.referenceId, `https://media.test/${"a".repeat(64)}.mp4`), undefined);
    assert.match(row.sourceUrl, /^https:\/\/www.tiktok.com\/@[^/]+\/video\/\d+$/);
  }
});

test("duration changes cover full Wall motion without placeholders or stale source seconds", () => {
  for (const row of reviews.entries) {
    const directions = getWallMoneyMotion(row.referenceId, row.sourceSha256)!;
    assert.ok(directions);
    assert.equal(getWallMoneyMotion(row.referenceId, "a".repeat(64)), undefined);
    assert.equal(getWallMoneyMotion(row.referenceId, row.sourceSha256, 1), undefined);
    for (const durationSeconds of [3, 4, 6, 8, 15]) {
      const prompt = buildStartingFrameAnimationPrompt({ workflow: "wall_text", directions, durationSeconds, generateAudio: false });
      assert.ok(!prompt.includes("PHASE ["));
      assert.match(prompt, /0–/);
      assert.ok(prompt.includes(`–${durationSeconds}s`));
      assert.ok(prompt.includes(row.beats.at(-1)!.action));
      assert.match(prompt, /completely silent/);
      assert.match(prompt, /Overlay text is added separately/);
      assert.ok(!prompt.includes(row.exactText));
    }
  }
  assert.throws(() => buildStartingFrameAnimationPrompt({ workflow: "wall_text", directions: "PHASE [0–0.5]: hold", durationSeconds: 4, generateAudio: false }), /complete ending/);
  // Talking Head scripts and ordinary manually edited Wall prose remain literal.
  for (const workflow of ["talking_head", "wall_text"] as const) {
    assert.ok(buildStartingFrameAnimationPrompt({ workflow, directions: "Look toward the window.", durationSeconds: 4, generateAudio: true }).includes("Look toward the window."));
  }
});

test("preview uses the matching Wall suggestion and preserves explicit user edits and generic fallbacks", () => {
  const row = reviews.entries[0];
  const draft = createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: row.referenceId, sourceSha256: row.sourceSha256 });
  const preview = getHookKeyframePromptPreview(draft, "wall_text");
  assert.equal(preview.suggestedDirections, formatGeneratedMotionPhases(getWallMoneyMotion(row.referenceId, row.sourceSha256)!));
  assert.ok(preview.animationPrompt?.includes("–4s"));
  assert.equal(preview.canSubmitPaidAnimation, false);
  assert.equal(preview.reviewedWallMotion, true);
  assert.equal(getHookKeyframePromptPreview({ ...draft, motionInstructions: "My edited movement." }, "wall_text").directions, "My edited movement.");
  assert.equal(getHookKeyframePromptPreview({ ...draft, motionInstructions: "" }, "wall_text").directions, "");
  const mismatch = getHookKeyframePromptPreview({ ...draft, scope: { ...draft.scope, sourceSha256: "0".repeat(64) } }, "wall_text");
  assert.match(mismatch.directions, /subtle natural movement/);
  assert.equal(mismatch.reviewedWallMotion, false);
});

test("each reviewed Wall prompt shown during preparation is the same compiled animation input", () => {
  for (const row of reviews.entries) {
    const draft = createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: row.referenceId, sourceSha256: row.sourceSha256 });
    for (const motionInstructions of [null, "Keep my saved custom direction.", ""]) {
      const preview = getHookKeyframePromptPreview({ ...draft, motionInstructions }, "wall_text");
      assert.equal(preview.reviewedWallMotion, true);
      if (motionInstructions === "") assert.equal(preview.animationPrompt, null);
      else assert.equal(preview.animationPrompt, buildStartingFrameAnimationPrompt({ workflow: "wall_text", directions: preview.directions, durationSeconds: preview.durationSeconds, generateAudio: preview.generateAudio, removePhysicalText: true }));
    }
    assert.equal(getHookKeyframePromptPreview(draft, "talking_head").reviewedWallMotion, false);
    assert.equal(getHookKeyframePromptPreview(draft, "hook").reviewedWallMotion, false);
  }
});

test("published batch appears in both galleries' existing category filter and canonical source/audio paths", () => {
  assert.equal(release.mediaStatus, "published", "Media must be verified before local gallery activation.");
  const all = getRecreateReferences();
  const category = referenceCategories(all, "wall_text").find(item => item.id === "investing-money");
  assert.deepEqual(category, { id: "investing-money", label: "Investing & Money", count: 6 });
  const selected = filterReferences(all, "wall_text", ["investing-money"]);
  assert.deepEqual(selected.map(item => item.id), release.items.map(item => item.id));
  assert.equal(filterReferences(all, "hook", ["investing-money"]).length, 0);
  assert.equal(filterReferences(all, "slideshow", ["investing-money"]).length, 0);
  assert.ok(filterReferences(all, "wall_text", []).length > 6);
  const sources = getAdditionalStartingFrameSources();
  for (const row of release.items) {
    const item = selected.find(item => item.id === row.id)!;
    assert.equal(item.sourceUrl, row.sourceUrl);
    assert.equal(item.sourcePlatform, "tiktok");
    assert.equal(item.isNew, true);
    assert.ok(item.pairedAudio?.url.includes(row.audioSha256));
    assert.ok(item.previewVideoUrl?.includes(row.previewSha256));
    assert.equal(sources.find(source => source.id === row.id)?.videoSha256, row.videoSha256);
    assert.equal(getExplorePairedReference(row.id)?.audioSha256, row.audioSha256);
    assert.equal(getGenerationReferenceSoundtrack({ referenceId: row.id, referenceType: "hook" }), null);
    assert.equal(getGenerationReferenceSoundtrack({ referenceId: row.id, referenceType: "wall_text", exploreFormat: "wall_text" })?.id, row.id);
  }
});

test("all 100 active Wall of Text references resolve compiled decimal motion directions", () => {
  assert.equal(catalog.entries.length, 100);
  assert.equal(new Set(catalog.entries.map(row => row.referenceId)).size, 100);
  for (const row of catalog.entries) {
    const directions = getWallReferenceMotion(row.referenceId, row.sourceSha256);
    assert.ok(directions, `Failed to compile directions for ${row.referenceId}`);
    assert.match(directions, /^OPENING COMPOSITION:/);
    assert.match(directions, /PHASE \[0–/);
    assert.match(directions, /–1\]:/);
    assert.ok(directions.includes(row.beats.at(-1)!.action));
  }
});
