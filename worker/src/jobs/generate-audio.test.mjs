import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, mock, test } from "node:test";
import { resolveAudioAccount } from "../lib/audio-contract.ts";
import { ElevenLabsError, getElevenLabsApiKey } from "../lib/elevenlabs-audio.ts";
let request, job, calls, files, acquired, failFinalization, account, interrupted, profiles, assets, subscriptions, grants, billingFailure, onVoice, releaseFails, cloneRejection;
function query(table) {
  let change, upsert = false; const filters = []; let single = false;
  const result = () => {
    if (["billing_subscriptions", "complimentary_plan_grants"].includes(table) && billingFailure) return { data: null, error: new Error("Billing offline") };
    if (table === "audio_generation_requests") {
      if (filters.some(filter => !filter(request))) return { data: null, error: null };
      if (change) Object.assign(request, change); return { data: single ? request : [request], error: null };
    }
    const records = table === "audio_assets" ? assets : table === "billing_subscriptions" ? subscriptions : table === "complimentary_plan_grants" ? grants : profiles;
    if (upsert) {
      if (table === "audio_assets" && failFinalization) { failFinalization = false; return { data: null, error: new Error("offline") }; }
      const record = records.find(row => row.id === change.id);
      if (record) Object.assign(record, change); else records.push({ provider_voice_id: null, ...change });
      if (table === "audio_assets") calls.assets.push(change);
      return { data: null, error: null };
    }
    const selected = records.filter(record => filters.every(filter => filter(record)));
    if (change) selected.forEach(record => Object.assign(record, change));
    return { data: single ? selected[0] || null : selected, error: null };
  };
  const chain = { select() { return chain; }, eq(field, value) { filters.push(record => record[field] === value); return chain; }, in(field, values) { filters.push(record => values.includes(record[field])); return chain; }, is(field, value) { return chain.eq(field,value); }, or() { filters.push(record => record.expires_at == null || Date.parse(record.expires_at) > Date.now()); return chain; }, order() { return chain; }, limit() { return chain; }, maybeSingle() { single = true; return chain; }, single() { single = true; return chain; }, update(value) { change = value; return chain; }, upsert(value) { change = value; upsert = true; return chain; }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } }; return chain;
}
const db = { from: query, storage: { from: () => ({ download: async key => files.has(key) ? { data: new Blob([files.get(key)]), error: null } : { data: null, error: { statusCode: "404", message: "not found" } } }) } };
class Provider {
  async account() { calls.accounts++; return account; }
  async voice() { onVoice?.(); return { category: "premade" }; }
  async speech() { calls.speech++; if (interrupted) throw new ElevenLabsError("Unknown response", 503, true); return new Response(new Uint8Array(40000).fill(7)); }
  async clone() { calls.clone++; if (cloneRejection) throw new ElevenLabsError("Clone unavailable", 403, false); return { voice_id: "private-voice" }; }
}
mock.module("../lib/audio-store.ts", { namedExports: {
  audioDb: () => db, audioRpc: async (name, args) => {
    if (name === "claim_audio_provider") return acquired;
    if (name === "start_audio_provider_submission") {
      if (args.p_id !== request.id || args.p_user_id !== request.user_id || request.provider_started_at || request.usage_released || !["queued","processing"].includes(request.status)) return false;
      Object.assign(request,{ provider_started_at:new Date().toISOString(),status:"processing" }); return true;
    }
    calls.releases++; if (releaseFails) throw new Error("lease release offline");
  },
  getAudioRequest: async (id, uid) => id === request.id && uid === request.user_id ? { ...request } : null,
  patchAudioRequest: async (_id, patch) => Object.assign(request, patch),
  readPrivateAudio: async key => files.get(key), readOptionalPrivateAudio: async key => files.get(key) ?? null, savePrivateAudio: async (key, bytes) => { files.set(key, bytes); },
} });
mock.module("../lib/audio-media.ts", { namedExports: { probeAudio: async () => 2 } });
mock.module("../lib/elevenlabs-audio.ts", { namedExports: { ElevenLabsAudio: Provider, ElevenLabsError, getElevenLabsApiKey } });
const { runGenerateAudioJob } = await import("./generate-audio.ts");
const context = { checkpoint: async () => {} };
beforeEach(() => {
  request = { id: randomUUID(), user_id: "owner", job_id: randomUUID(), kind: "speech", status: "queued", provider_started_at: null, usage_released: false, script: "hello", characters: 5, voice_id: "default", model_id: "eleven_flash_v2_5", speed: 1, name: "Test", test_only: true, chunk_count: 0 };
  job = { id: request.job_id, user_id: "owner", input_json: { audioRequestId: request.id } };
  calls = { accounts: 0, speech: 0, clone: 0, releases: 0, assets: [] }; files = new Map(); profiles = []; assets = []; acquired = true; failFinalization = false; interrupted = false; onVoice = null; releaseFails = false; cloneRejection = false;
  subscriptions = [{ user_id: "owner", plan_key: "starter", status: "active" }]; grants = []; billingFailure = false;
  account = resolveAudioAccount({ tier: "free", status: "active", character_limit: 10000 }); process.env.AUDIO_GENERATION_ENABLED = "true";
});
test("generation persists live chunks and a private final file, then completes once", async () => {
  const result = await runGenerateAudioJob(job, context); assert.equal(result.audioAssetId, request.id); assert.equal(calls.speech, 1); assert.equal(request.status, "completed");
  assert.equal(files.get(`owner/${request.id}/final.mp3`).length, 40000); assert.ok(files.has(`owner/${request.id}/chunks/0.mp3`)); assert.equal(calls.assets[0].test_only, true);
  await runGenerateAudioJob(job, context); assert.equal(calls.speech, 1);
});
test("a saved provider result survives finalization failure without another paid call", async () => {
  failFinalization = true; await assert.rejects(runGenerateAudioJob(job, context), { code: "audio_finalization_pending" });
  assert.equal(calls.speech, 1); assert.equal(request.status, "streaming");
  subscriptions = [];
  await runGenerateAudioJob(job, context); assert.equal(calls.speech, 1); assert.equal(request.status, "completed");
});

test("queued Free users cannot reach the provider even with an invite", async () => {
  subscriptions = []; process.env.AUDIO_GENERATION_ALLOWED_USER_IDS = "owner";
  await assert.rejects(runGenerateAudioJob(job, context), /Starter and Growth/);
  assert.equal(calls.accounts, 0); assert.equal(calls.speech, 0); assert.equal(request.provider_started_at, null); assert.equal(request.status, "failed");
});

test("the worker checks active Starter and Growth ownership, never another user's plan", async () => {
  for (const fields of [{ plan_key: "starter", status: "cancelled" }, { plan_key: "growth", status: "expired" }, { plan_key: "free", status: "active" }, { plan_key: null, status: "active" }, { plan_key: "enterprise", status: "active" }, { user_id: "another", plan_key: "growth", status: "active" }]) {
    subscriptions = [{ user_id: "owner", ...fields }]; request.status = "queued";
    await assert.rejects(runGenerateAudioJob(job, context), /Starter and Growth/);
    assert.equal(calls.accounts, 0); assert.equal(calls.speech, 0);
  }
  subscriptions = [{ user_id: "owner", plan_key: "growth", status: "active" }]; request.status = "queued";
  await runGenerateAudioJob(job, context); assert.equal(calls.speech, 1);
});

test("billing outages defer a queued job without submitting or ending the reservation", async () => {
  billingFailure = true;
  await assert.rejects(runGenerateAudioJob(job, context), { code: "audio_entitlements_unavailable" });
  assert.equal(calls.accounts, 0); assert.equal(calls.speech, 0); assert.equal(request.status, "queued"); assert.equal(request.provider_started_at, null);
  billingFailure = false; await runGenerateAudioJob(job, context); assert.equal(calls.speech, 1);
});

test("active complimentary Starter/Growth access works while expired, revoked and foreign grants do not", async () => {
  subscriptions = [];
  const grant = { user_id: "owner", plan_key: "starter", revoked_at: null, expires_at: null };
  for (const fields of [{ expires_at: "2000-01-01T00:00:00Z" }, { revoked_at: new Date().toISOString() }, { user_id: "another" }, { plan_key: "free" }]) {
    grants = [{ ...grant, ...fields }]; request.status = "queued";
    await assert.rejects(runGenerateAudioJob(job, context), /Starter and Growth/); assert.equal(calls.speech, 0);
  }
  grants = [grant]; request.status = "queued"; await runGenerateAudioJob(job, context); assert.equal(calls.speech, 1);
});

test("Free users cannot start a private voice clone through a queued job", async () => {
  subscriptions = []; request.kind = "clone"; account = resolveAudioAccount({ tier: "starter", status: "active", can_use_instant_voice_cloning: true });
  await assert.rejects(runGenerateAudioJob(job, context), /Starter and Growth/); assert.equal(calls.accounts, 0); assert.equal(calls.clone, 0);
});
test("an uncertain response never sends the script again", async () => {
  interrupted = true; await assert.rejects(runGenerateAudioJob(job, context)); assert.equal(request.status, "uncertain"); assert.equal(calls.speech, 1);
  await assert.rejects(runGenerateAudioJob(job, context)); assert.equal(calls.speech, 1);
});
test("provider concurrency waits without submitting", async () => {
  acquired = false; await assert.rejects(runGenerateAudioJob(job, context), { code: "audio_provider_busy" }); assert.equal(calls.speech, 0); assert.equal(calls.accounts, 0);
});
test("ended requests cannot bypass the quota released on failure", async () => {
  request.status = "failed"; request.usage_released = true; await assert.rejects(runGenerateAudioJob(job, context)); assert.equal(calls.accounts, 0); assert.equal(calls.speech, 0);
});
test("a downgrade blocks previously commercial jobs before a provider submission", async () => {
  request.test_only = false; await assert.rejects(runGenerateAudioJob(job, context), /downgraded/); assert.equal(calls.speech, 0); assert.equal(request.provider_started_at, null);
});
test("foreign job ownership is rejected before provider or storage access", async () => {
  job.user_id = "other"; await assert.rejects(runGenerateAudioJob(job, context), /does not belong/); assert.equal(calls.accounts, 0); assert.equal(files.size, 0);
});

test("cancellation during preparation cannot submit against released usage", async () => {
  onVoice = () => { request.status = "cancelled"; request.usage_released = true; };
  await assert.rejects(runGenerateAudioJob(job, context), { code: "audio_submission_already_started" });
  assert.equal(calls.speech, 0); assert.equal(request.provider_started_at, null); assert.equal(request.status, "cancelled");
});

test("a cancellation requested during provider preflight stops before the billable submission", async () => {
  let cancellationRequested = false; onVoice = () => { cancellationRequested = true; };
  const cancelled = new Error("Cancellation requested");
  await assert.rejects(runGenerateAudioJob(job, { checkpoint: async () => { if (cancellationRequested) throw cancelled; } }), error => error === cancelled);
  assert.equal(calls.speech, 0); assert.equal(request.provider_started_at, null);
});

test("a lease release outage preserves a completed saved result", async () => {
  releaseFails = true; const result = await runGenerateAudioJob(job, context);
  assert.equal(result.audioAssetId, request.id); assert.equal(request.status, "completed"); assert.equal(calls.speech, 1);
});

test("a persisted clone is finalized without another provider call, even after downgrade", async () => {
  request.kind = "clone"; request.provider_started_at = new Date().toISOString();
  profiles.push({ id: request.id, user_id: "owner", provider_voice_id: "stored-private", status: "verification_required" });
  const result = await runGenerateAudioJob(job, context);
  assert.equal(result.voiceProfileId, request.id); assert.equal(result.verificationRequired, true);
  assert.equal(request.status, "completed"); assert.equal(calls.accounts, 0); assert.equal(calls.clone, 0);
});

test("an uncertain clone keeps its reference reserved and is not resubmitted", async () => {
  request.kind = "clone"; request.provider_started_at = new Date().toISOString();
  profiles.push({ id: request.id, user_id: "owner", provider_voice_id: null, status: "creating" });
  await assert.rejects(runGenerateAudioJob(job, context), /reconciliation/);
  assert.equal(request.status, "uncertain"); assert.equal(profiles[0].status, "creating"); assert.equal(calls.accounts, 0); assert.equal(calls.clone, 0);
});

test("a definite clone rejection releases its reference profile for an explicit new attempt", async () => {
  request.kind = "clone"; request.source_asset_id = randomUUID(); cloneRejection = true;
  account = resolveAudioAccount({ tier: "starter", status: "active", can_use_instant_voice_cloning: true, voice_limit: 10 });
  assets.push({ id: request.source_asset_id, user_id: "owner", status: "ready", purpose: "reference", object_key: "owner/sample", mime_type: "audio/mpeg" });
  files.set("owner/sample", new Uint8Array(64));
  await assert.rejects(runGenerateAudioJob(job, context), /Clone unavailable/);
  assert.equal(calls.clone, 1); assert.equal(request.status, "failed"); assert.equal(profiles[0].status, "failed");
});
