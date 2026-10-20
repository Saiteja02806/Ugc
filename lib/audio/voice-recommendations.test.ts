import test from "node:test";
import assert from "node:assert/strict";
import { getStudioVoiceShortlist, rankVoicesForPurpose, rankVoicesForLibraryFocus, selectInitialVoice } from "./voice-recommendations.ts";
import type { AudioVoice } from "./types";

const voice = (id: string, useCase: string, available = true, description = ""): AudioVoice => ({ id, name: id, category: "premade", labels: { use_case: useCase }, description, previewUrl: null, private: false, available });
test("Social media metadata outranks conflicting prose and provider order", () => {
  const voices = [voice("A conversational", "conversational", true, "Ideal for social media"), voice("Z social", "social_media", true, "A conversational delivery")];
  const ranked = rankVoicesForPurpose(voices, "social");
  assert.equal(ranked[0].voice.id, "Z social");
  assert.equal(ranked[0].match, "direct");
  assert.equal(selectInitialVoice(voices), "Z social");
});
test("A shared voice can suit multiple native purposes without duplicate records", () => {
  const voices = [voice("Education", "informative_educational"), voice("Conversation", "conversational"), voice("Ad", "advertisement")];
  assert.equal(rankVoicesForPurpose(voices, "ugc_ad")[0].voice.id, "Ad");
  assert.equal(rankVoicesForPurpose(voices, "product_demo")[0].voice.id, "Education");
  for (const purpose of ["ugc_ad", "product_demo", "social"] as const) {
    assert.ok(rankVoicesForPurpose(voices, purpose).find(row => row.voice.id === "Conversation")!.score > 0);
  }
  assert.equal(rankVoicesForPurpose(voices, "ugc_ad").length, voices.length);
});
test("Preview-only matches cannot displace a voice usable by the account", () => {
  const voices = [voice("Social demo", "social_media", false), voice("Usable", "conversational")];
  assert.equal(selectInitialVoice(voices), "Usable");
  assert.equal(rankVoicesForPurpose(voices, "social")[1].voice.available, false);
  assert.equal(selectInitialVoice([voices[0]]), "Social demo");
});
test("Provider refresh and purpose changes preserve an existing manual selection", () => {
  const voices = [voice("Social", "social_media"), voice("Education", "informative_educational")];
  assert.equal(selectInitialVoice(voices, "social", "Education"), "Education");
  assert.equal(selectInitialVoice([...voices].reverse(), "ugc_ad", "Education"), "Education");
  assert.equal(selectInitialVoice(voices, "social", "Deleted"), "Social");
  assert.equal(selectInitialVoice([]), "");
});
test("Ranking stays deterministic when the provider reorders equal matches", () => {
  const voices = [voice("Z", "social_media"), voice("A", "social_media"), { ...voice("B", "social_media"), name: "A" }];
  assert.deepEqual(rankVoicesForPurpose(voices, "social").map(row => row.voice.id), ["A", "B", "Z"]);
  assert.deepEqual(rankVoicesForPurpose([...voices].reverse(), "social"), rankVoicesForPurpose(voices, "social"));
});
test("Missing metadata has honest fallback labels and lower confidence", () => {
  const voices = [voice("Unknown", "", true, "Warm tone"), voice("Prose", "", true, "Conversational social media voice"), voice("Structured", "conversational")];
  const ranked = rankVoicesForPurpose(voices, "social");
  assert.equal(ranked[0].voice.id, "Structured");
  assert.equal(ranked[1].match, "supporting");
  assert.match(ranked[1].reason, /description/);
  assert.equal(ranked[2].match, "other");
});
test("Multiple structured tags are supported without mutating the catalogue", () => {
  const voices = [voice("Shared", "conversational, social_media"), voice("Story", "narrative_story")];
  const original = structuredClone(voices); Object.freeze(voices);
  assert.equal(rankVoicesForPurpose(voices, "social")[0].match, "direct");
  assert.equal(rankVoicesForPurpose(voices, "storytelling")[0].voice.id, "Story");
  assert.deepEqual(voices, original);
});

test("Every library focus retains the complete catalogue while promoting the matching niche", () => {
  const voices = [voice("Character", "characters_animation"), voice("Education", "informative_educational"), voice("Social", "social_media"), voice("Ad", "advertisement"), voice("Conversation", "conversational"), voice("Story", "narrative_story"), voice("Other", "entertainment_tv")];
  const firstByFocus = { social: "Social", ugc_ad: "Ad", product_demo: "Education", storytelling: "Story", conversational: "Conversation", advertisement: "Ad", characters: "Character", all: "Social" } as const;
  for (const [focus, first] of Object.entries(firstByFocus)) {
    const ranked = rankVoicesForLibraryFocus(voices, focus as keyof typeof firstByFocus);
    assert.equal(ranked[0].voice.id, first);
    assert.deepEqual(ranked.map(row => row.voice.id).sort(), voices.map(row => row.id).sort());
  }
});

test("Studio offers at most two small groups without changing the full catalogue", () => {
  const voices = Array.from({ length: 20 }, (_, index) => voice(`Social ${String(index).padStart(2, "0")}`, "social_media"));
  const original = structuredClone(voices); Object.freeze(voices);
  const shortlist = getStudioVoiceShortlist(voices, "social");
  assert.equal(shortlist.length, 12);
  assert.deepEqual(getStudioVoiceShortlist([...voices].reverse(), "social"), shortlist);
  assert.deepEqual(voices, original);
  assert.equal(rankVoicesForLibraryFocus(voices, "social").length, 20);
});

test("Studio recommendations use purpose metadata and keep weak matches in the full library", () => {
  const voices = [voice("Ad", "advertisement"), voice("Social", "social_media"), voice("Conversation", "conversational"), voice("Education", "informative_educational"), voice("Unknown", ""), voice("Description only", "", true, "Perfect for social media ads and demos")];
  assert.deepEqual(getStudioVoiceShortlist(voices, "social").map(row => row.id), ["Social", "Conversation", "Ad"]);
  assert.deepEqual(getStudioVoiceShortlist(voices, "ugc_ad").map(row => row.id), ["Ad", "Conversation", "Social"]);
  assert.deepEqual(getStudioVoiceShortlist(voices, "product_demo").map(row => row.id), ["Education", "Conversation"]);
  assert.equal(getStudioVoiceShortlist(voices.slice(4), "social").length, 0);
});

test("Studio excludes private voices and inaccessible presets when usable presets exist", () => {
  const voices = [voice("Public sample", "social_media", false), voice("Usable", "conversational"), { ...voice("Private", "social_media"), private: true }];
  assert.deepEqual(getStudioVoiceShortlist(voices, "social").map(row => row.id), ["Usable"]);
  assert.equal(rankVoicesForLibraryFocus(voices, "social").length, 3);
});

test("Studio can display public samples without granting generation access", () => {
  const voices = [voice("Social sample", "social_media", false), voice("Conversational sample", "conversational", false), { ...voice("Private", "social_media"), private: true }];
  const shortlist = getStudioVoiceShortlist(voices, "social");
  assert.deepEqual(shortlist.map(row => row.id), ["Social sample", "Conversational sample"]);
  assert.ok(shortlist.every(row => !row.available));
  assert.deepEqual(getStudioVoiceShortlist([], "social"), []);
});
