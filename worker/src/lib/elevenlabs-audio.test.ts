import assert from "node:assert/strict";
import test from "node:test";
import { audioCostMicros, isVoiceEligible, parseAudioSpeech, resolveAudioAccount } from "./audio-contract.ts";
import { ElevenLabsAudio, ElevenLabsError, getElevenLabsApiKey, toAudioVoice } from "./elevenlabs-audio.ts";

test("the canonical uppercase key takes precedence over the existing lowercase alias", () => {
  assert.equal(getElevenLabsApiKey({ ELEVENLABS_API_KEY: "canonical-test", elevenlabs_api_key: "alias-test" }), "canonical-test");
});

test("voice-generation credentials take precedence without changing Scribe's separate key setting", () => {
  assert.equal(getElevenLabsApiKey({ ELEVENLABS_VOICE_API_KEY: " voice-only ", ELEVENLABS_API_KEY: "scribe-key", elevenlabs_api_key: "legacy" }), "voice-only");
  assert.equal(getElevenLabsApiKey({ ELEVENLABS_VOICE_API_KEY: " ", ELEVENLABS_API_KEY: "scribe-key" }), "scribe-key");
});
test("server key lookup trims whitespace and accepts the existing lowercase alias", () => {
  assert.equal(getElevenLabsApiKey({ ELEVENLABS_API_KEY: "  canonical-test \n", elevenlabs_api_key: "alias-test" }), "canonical-test");
  assert.equal(getElevenLabsApiKey({ ELEVENLABS_API_KEY: " \n ", elevenlabs_api_key: "  alias-test  " }), "alias-test");
  assert.equal(getElevenLabsApiKey({ elevenlabs_api_key: " alias-test " }), "alias-test");
});
test("missing or blank server key settings leave generation unconfigured", () => {
  assert.equal(getElevenLabsApiKey({}), "");
  assert.equal(getElevenLabsApiKey({ ELEVENLABS_API_KEY: " ", elevenlabs_api_key: "\n" }), "");
});

test("Free remains noncommercial and cloning stays locked even with a stale capability flag", () => {
  assert.equal(resolveAudioAccount({ tier: "free", status: "active", can_use_instant_voice_cloning: true }).cloning, false);
  assert.equal(resolveAudioAccount({ tier: "starter", status: "inactive", can_use_instant_voice_cloning: true }).paid, false);
  assert.equal(resolveAudioAccount({ tier: "starter", status: "active", can_use_instant_voice_cloning: true }).cloning, true);
  for (const value of [NaN, 0, 2]) assert.throws(() => parseAudioSpeech({ script: "hello", voiceId: "voice", modelId: "eleven_flash_v2_5", speed: value }));
  assert.throws(() => parseAudioSpeech({ script: "a".repeat(1501), voiceId: "voice", modelId: "eleven_flash_v2_5" }));
});
test("tier restrictions, retired voices and custom rates are excluded", () => {
  const account = resolveAudioAccount({ tier: "free", status: "active" });
  assert.equal(isVoiceEligible({ available_for_tiers: ["starter"] }, account), false);
  assert.equal(isVoiceEligible({ sharing: { disable_at_unix: 1 } }, account), false);
  assert.equal(isVoiceEligible({ sharing: { rate: 0.1 } }, account), false);
  assert.equal(isVoiceEligible({ sharing: { review_status: "blocked" } }, account), false);
  assert.equal(isVoiceEligible({ voice_verification: { requires_verification: true, is_verified: false } }, account), false);
  assert.equal(isVoiceEligible({ sharing: { live_moderation_enabled: true, review_status: "allowed" } }, account), false);
});
test("paid spending reservations use the current public API rates", () => {
  assert.equal(audioCostMicros("eleven_flash_v2_5", 1000), 50000);
  assert.equal(audioCostMicros("eleven_multilingual_v2", 1000), 100000);
});
test("private voice previews never expose provider audio URLs", () => {
  const record = { voice_id: "private", name: "Owner", preview_url: "https://example.invalid/private.mp3", labels: { accent: "British", unsafe: {} } };
  const voice = toAudioVoice(record, resolveAudioAccount({ tier: "starter", status: "active" }), true);
  assert.equal(voice.previewUrl, null); assert.deepEqual(voice.labels, { accent: "British" });
});
test("voice catalogue follows pagination and preserves the default filter", async () => {
  let calls = 0;
  const provider = new ElevenLabsAudio("offline-test", async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, "https://api.elevenlabs.io");
    assert.equal(url.searchParams.get("voice_type"), "default"); assert.equal(url.searchParams.get("include_custom_rates"), "false");
    assert.equal((init?.headers as Record<string,string>)["xi-api-key"], "offline-test"); calls++;
    if (calls === 1) return Response.json({ voices: [{ voice_id: "a", name: "A" }], has_more: true, next_page_token: "next" });
    assert.equal(url.searchParams.get("next_page_token"), "next"); return Response.json({ voices: [{ voice_id: "b", name: "B" }], has_more: false });
  });
  assert.deepEqual((await provider.voices("default")).map(v => v.voice_id), ["a","b"]); assert.equal(calls, 2);
});
test("billable provider rejection is masked and never retried", async () => {
  let calls = 0;
  const provider = new ElevenLabsAudio("offline-test", async (input, init) => {
    calls++; assert.match(String(input), /output_format=mp3_44100_128/);
    assert.equal(JSON.parse(String(init?.body)).model_id, "eleven_flash_v2_5");
    return Response.json({ secret: "do-not-expose" }, { status: 429 });
  });
  await assert.rejects(provider.speech({ script: "hello", voiceId: "voice", modelId: "eleven_flash_v2_5", speed: 1 }), (error: unknown) => error instanceof ElevenLabsError && error.status === 429 && !error.uncertain && !error.message.includes("do-not-expose"));
  assert.equal(calls, 1);
});
test("an interrupted POST is marked uncertain without a second submission", async () => {
  let calls = 0; const provider = new ElevenLabsAudio("offline-test", async () => { calls++; throw new Error("network lost"); });
  await assert.rejects(provider.speech({ script: "hello", voiceId: "voice", modelId: "eleven_flash_v2_5", speed: 1 }), (error: unknown) => error instanceof ElevenLabsError && error.uncertain);
  assert.equal(calls, 1);
});
