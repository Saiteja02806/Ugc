import assert from "node:assert/strict";
import test from "node:test";
import { PublicElevenLabsCatalogue } from "./public-voice-catalogue.ts";

const voiceId = "CwhRBWXzGAHq8TQ4Fs17";
const record = { voice_id: voiceId, name: "Roger - Laid-Back, Casual, Resonant", category: "premade", labels: { accent: "american", use_case: "conversational" }, preview_url: `https://storage.googleapis.com/eleven-public-prod/premade/voices/${voiceId}/sample.mp3`, is_legacy: false };

test("public demos use a credential-free GET and never authorize generation", async () => {
  process.env.ELEVENLABS_API_KEY = "must-never-be-forwarded";
  const catalogue = new PublicElevenLabsCatalogue(async (url, init) => {
    assert.equal(String(url), "https://api.elevenlabs.io/v1/voices"); assert.equal(init?.method, "GET");
    const headers = new Headers(init?.headers); assert.equal(headers.has("xi-api-key"), false); assert.equal(headers.has("authorization"), false);
    return Response.json({ voices: [record] });
  });
  const voices = await catalogue.voices();
  assert.equal(voices.length, 1); assert.equal(voices[0].id, voiceId); assert.equal(voices[0].previewUrl, record.preview_url);
  assert.equal(voices[0].private, false); assert.equal(voices[0].available, false);
});

test("public catalogue excludes cloned, community, retired and tier-restricted records", async () => {
  const catalogue = new PublicElevenLabsCatalogue(async () => Response.json({ voices: [
    record, { ...record, voice_id: "clone", category: "cloned" }, { ...record, voice_id: "community", sharing: { review_status: "allowed" } },
    { ...record, voice_id: "legacy", is_legacy: true }, { ...record, voice_id: "paid", available_for_tiers: ["starter"] },
    { ...record, voice_id: "invalid/id" }, { ...record, voice_id: "blank", name: " " }, record,
  ] }));
  assert.deepEqual((await catalogue.voices()).map(voice => voice.id), [voiceId]);
});

test("preview URLs must belong to the provider's public premade storage or preview endpoint", async () => {
  const records = [
    { ...record, voice_id: "one", preview_url: "https://example.invalid/private.mp3" },
    { ...record, voice_id: "two", preview_url: "https://storage.googleapis.com/private-recordings/two.mp3" },
    { ...record, voice_id: "three", preview_url: "https://api.us.elevenlabs.io/v1/voices/other/previews/audio" },
    { ...record, voice_id: "four", preview_url: "http://api.us.elevenlabs.io/v1/voices/four/previews/audio" },
    { ...record, voice_id: "five", preview_url: "https://api.us.elevenlabs.io/v1/voices/five/previews/audio?payload=demo" },
  ];
  const voices = await new PublicElevenLabsCatalogue(async () => Response.json({ voices: records })).voices();
  assert.deepEqual(voices.map(voice => voice.previewUrl), [null, null, null, null, records[4].preview_url]);
});

test("concurrent catalogue reads share one request and refresh after the cache expires", async () => {
  let requests = 0; let now = 0;
  const catalogue = new PublicElevenLabsCatalogue(async () => { requests++; return Response.json({ voices: [record] }); }, () => now);
  const results = await Promise.all([catalogue.voices(), catalogue.voices(), catalogue.voices()]);
  assert.equal(requests, 1); assert.equal(results[0].length, 1);
  now = 14 * 60 * 1000; await catalogue.voices(); assert.equal(requests, 1);
  now = 16 * 60 * 1000; await catalogue.voices(); assert.equal(requests, 2);
});

test("an unavailable or changed public endpoint fails closed and briefly caches failures", async () => {
  let now = 0; let requests = 0;
  const catalogue = new PublicElevenLabsCatalogue(async () => { requests++; return Response.json({ detail: "authentication now required" }, { status: 401 }); }, () => now);
  assert.deepEqual(await catalogue.voices(), []); assert.deepEqual(await catalogue.voices(), []); assert.equal(requests, 1);
  now = 61000; assert.deepEqual(await catalogue.voices(), []); assert.equal(requests, 2);
  assert.deepEqual(await new PublicElevenLabsCatalogue(async () => Response.json({ private_voices: [record] })).voices(), []);
});
