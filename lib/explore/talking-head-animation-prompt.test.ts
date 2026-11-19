import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildTalkingHeadAnimationPrompt } from "./talking-head-animation-prompt.ts";

const base = { directions: "Keep the camera stable. End with a skeptical gaze.", durationSeconds: 4, generateAudio: true, spokenScript: "Is this really possible?" };

test("voice guidance follows selected, replaced, cleared and restored draft inputs", () => {
  const plain = buildTalkingHeadAnimationPrompt(base);
  const selected = buildTalkingHeadAnimationPrompt({ ...base, voiceReference: true });
  assert.match(plain, /VOICE DELIVERY: Keep one natural human voice/u);
  assert.match(plain, /pitch, pace, emphasis and pauses to fit the emotion/u);
  assert.doesNotMatch(plain, /Audio 1/u);
  assert.match(selected, /VOICE DELIVERY: Follow Audio 1's vocal character, rhythm, emphasis, pauses and emotional delivery/u);
  assert.match(selected, /Ignore its words and music/u);
  assert.doesNotMatch(selected, /VOICE DELIVERY: Keep/u);
  assert.match(selected, /as a visual reference/u);
  assert.equal(buildTalkingHeadAnimationPrompt({ ...base, voiceReference: true }), selected, "replacing only audio bytes retains the same role guidance");
  assert.equal(buildTalkingHeadAnimationPrompt({ ...base, voiceReference: false }), plain, "clearing audio restores no-reference guidance");
  assert.equal(buildTalkingHeadAnimationPrompt(JSON.parse(JSON.stringify(base))), plain, "restored draft resolves the same guidance");
  for (const prompt of [plain, selected]) {
    assert.equal(prompt.split("VOICE DELIVERY:").length - 1, 1);
    assert.equal(prompt.split(JSON.stringify(base.spokenScript)).length - 1, 1);
    assert.ok(prompt.includes(base.directions));
    assert.match(prompt, /Never speak scene directions or add words/u);
  }
});

test("Sound off adds no voice-delivery instructions; legacy dialogue and identity roles survive", () => {
  for (const voiceReference of [false, true]) {
    const silent = buildTalkingHeadAnimationPrompt({ ...base, spokenScript: undefined, generateAudio: false, voiceReference });
    assert.match(silent, /SOUND SETTING: OFF/u);
    assert.doesNotMatch(silent, /VOICE DELIVERY:/u);
  }
  const directions = 'Speak this line out loud: "Old words.". Hold the final gaze.';
  const legacy = buildTalkingHeadAnimationPrompt({ ...base, directions, spokenScript: undefined });
  assert.ok(legacy.includes(directions));
  const reviewed = buildTalkingHeadAnimationPrompt({ ...base, directions, identityPhotoCount: 2 });
  assert.doesNotMatch(reviewed, /Old words/u);
  assert.match(reviewed, /Hold the final gaze/u);
  assert.match(reviewed, /Image 2 is the main face identity reference/u);
});

test("all short catalog defaults retain their full directions within the tightest applicable character safeguard", () => {
  const catalog = JSON.parse(readFileSync(new URL("./talking-head-reference-catalog.json", import.meta.url), "utf8"));
  const items = catalog.items.filter((item: { durationSeconds: number }) => item.durationSeconds <= 4);
  assert.ok(items.length >= 9);
  for (const item of items) for (const voiceReference of [false, true]) for (const count of [0, 1, 5]) for (const spokenScript of [undefined, base.spokenScript]) {
    const prompt = buildTalkingHeadAnimationPrompt({ directions: item.generationPrompt, durationSeconds: 4, generateAudio: true, voiceReference, identityPhotoCount: count, voiceIdentityPhotoCount: count, spokenScript });
    if (spokenScript === undefined) assert.ok(prompt.includes(item.generationPrompt), item.id);
    else assert.equal(prompt.split(JSON.stringify(spokenScript)).length - 1, 1, item.id);
    assert.ok(prompt.length <= (voiceReference ? 10_000 : 2_000), `${item.id}: ${prompt.length} characters`);
  }
});
