import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { beforeEach, mock, test } from "node:test";
import { AudioError, resolveAudioAccount } from "../../worker/src/lib/audio-contract.ts";
import { getElevenLabsApiKey, toAudioVoice } from "../../worker/src/lib/elevenlabs-audio.ts";

registerHooks({ resolve(specifier, context, nextResolve) { return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context); } });
class AuthError extends Error { constructor() { super("Sign in to continue."); this.status = 401; } }
class BillingError extends Error { constructor() { super("Billing unavailable."); this.status = 503; } }
let owner, account, subscription, billingError, calls, tables, failAuth, quotaError, emptyCatalogue, providerDeleteError, storageDeleteError, voiceMetadata, onVoiceRead, voiceReadError, onAssetInsert, onSaveAudio, bookmarkDbError;
const voices = [
  { voice_id: "default", name: "Default", category: "premade" },
  { voice_id: "community", name: "Community", category: "professional", sharing: { status: "enabled", enabled_in_library: true, review_status: "allowed" } },
  { voice_id: "alice-clone", name: "Alice", category: "cloned" },
  { voice_id: "bob-clone", name: "Bob", category: "cloned" },
  { voice_id: "workspace-private", name: "Private workspace PVC", category: "professional" },
];
const model = { id: "eleven_flash_v2_5", name: "Flash v2.5", languages: ["en"] };
class Provider {
  async account() { calls.accounts++; return account; }
  async models() { return [model]; }
  async voices(type) { return emptyCatalogue ? [] : type === "default" ? voices.slice(0, 1) : voices; }
  async voice(id) { calls.voiceReads.push(id); onVoiceRead?.(id); if (voiceReadError) throw voiceReadError; return voiceMetadata.get(id) ?? voices.find(voice => voice.voice_id === id); }
  async deleteVoice(id) { calls.events.push("provider.delete"); calls.deleted.push(id); if (providerDeleteError) throw providerDeleteError; }
}
function query(table) {
  const filters = []; const predicates = []; let single = false; let mutation = null;
  const result = () => {
    if (table === "audio_voice_bookmarks" && bookmarkDbError) return { data: null, error: new Error("Database unavailable") };
    const rows = (tables[table] ?? []).filter(row => filters.every(([field, value, negate]) => negate ? row[field] !== value : row[field] === value) && predicates.every(predicate => predicate(row)));
    if (mutation?.type === "insert") {
      if (table === "audio_assets") {
        const injected = onAssetInsert?.(mutation.value); if (injected) return injected;
        if (tables[table]?.some(row => row.id === mutation.value.id)) return { data: null, error: new Error("Duplicate primary key") };
      }
      tables[table] ??= []; tables[table].push(mutation.value);
    }
    if (mutation?.type === "delete") tables[table] = (tables[table] ?? []).filter(row => !rows.includes(row));
    if (mutation?.type === "upsert") {
      tables[table] ??= [];
      if (!tables[table].some(row => row.user_id === mutation.value.user_id && row.voice_id === mutation.value.voice_id)) tables[table].push(mutation.value);
    }
    if (mutation?.type === "update") rows.forEach(row => Object.assign(row, mutation.value));
    return { data: single ? rows[0] ?? null : rows, error: null };
  };
  const chain = { select() { return chain; }, eq(field, value) { filters.push([field,value,false]); return chain; }, neq(field, value) { filters.push([field,value,true]); return chain; }, in(field, values) { predicates.push(row => values.includes(row[field])); return chain; }, or(expression) { const conditions = expression.split(",").map(part => part.split(".")); predicates.push(row => conditions.some(([field,operator,value]) => operator === "is" && value === "null" ? row[field] == null : operator === "neq" ? row[field] !== value : row[field] === value)); return chain; }, order() { return chain; }, limit() { return chain; }, maybeSingle() { single = true; return chain; }, insert(value) { mutation = { type: "insert", value }; return chain; }, upsert(value, options) { assert.equal(options.onConflict, "user_id,voice_id"); assert.equal(options.ignoreDuplicates, true); mutation = { type: "upsert", value }; return chain; }, update(value) { mutation = { type: "update", value }; return chain; }, delete() { mutation = { type: "delete" }; return chain; }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
  return chain;
}
const db = { from: query, storage: { from: () => ({ remove: async keys => { calls.events.push("storage.remove"); calls.removed.push(...keys); return { error: storageDeleteError }; } }) } };
async function runRpc(name, args) {
  calls.rpc.push({ name, args });
  if (name === "retire_audio_voice") {
    const profile = tables.audio_voice_profiles.find(row => row.id === args.p_id && row.user_id === args.p_user_id);
    if (!profile) throw new AudioError("Voice not found.", 404);
    if (profile.status === "creating" || tables.audio_generation_requests.some(row => row.user_id === args.p_user_id && row.voice_id === profile.provider_voice_id && ["queued","processing","streaming","uncertain"].includes(row.status))) throw new AudioError("Voice in use.", 409);
    profile.status = "deleted"; calls.events.push("retire.voice"); return { ...profile };
  }
  if (name === "retire_audio_asset") {
    const asset = tables.audio_assets.find(row => row.id === args.p_id && row.user_id === args.p_user_id);
    if (!asset) throw new AudioError("Audio not found.", 404);
    const requests = tables.audio_generation_requests.filter(row => row.user_id === args.p_user_id && [row.source_asset_id,row.output_asset_id,row.id].includes(args.p_id));
    if (asset.status === "processing" || tables.audio_voice_profiles.some(row => row.user_id === args.p_user_id && row.source_asset_id === args.p_id && (["creating","ready","verification_required"].includes(row.status) || row.provider_voice_id)) || requests.some(row => ["queued","processing","streaming","uncertain"].includes(row.status))) throw new AudioError("Recording in use.", 409);
    asset.status = "deleted"; calls.events.push("retire.asset"); return { asset: { ...asset }, chunk_count: requests.find(row => row.id === asset.generation_id)?.chunk_count ?? 0 };
  }
  if (quotaError) throw quotaError;
  return { id: args.p_id, job_id: "job", status: "queued", test_only: args.p_payload.testOnly, credits: args.p_credits };
}
mock.module("next/server", { namedExports: { NextResponse: { json: (body, options) => Response.json(body, options) } } });
mock.module("../firebase/server-auth.ts", { namedExports: { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (failAuth) throw new AuthError(); return { uid: owner, emailVerified: true }; } } });
mock.module("../billing/subscription-db.ts", { namedExports: { BillingAccessError: BillingError, getUserSubscription: async (_uid, options) => { calls.subscriptionOptions.push(options); if (billingError) throw billingError; return subscription; } } });
mock.module("../jobs/background-jobs.ts", { namedExports: { getBackgroundJobById: async () => ({ id: "job", userId: owner, jobType: "generate_audio", status: "queued" }) } });
mock.module("../jobs/background-job-service.ts", { namedExports: { dispatchQueuedBackgroundJobForRecovery: async () => { calls.dispatches++; } } });
mock.module("../queues/job-queue.ts", { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module("../../worker/src/lib/elevenlabs-audio.ts", { namedExports: { ElevenLabsAudio: Provider, getElevenLabsApiKey, toAudioVoice } });
mock.module("./public-voice-catalogue.ts", { namedExports: { publicElevenLabsCatalogue: { voices: async () => [{ id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", category: "premade", labels: { accent: "american" }, description: "", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/sample.mp3", private: false, available: false }] } } });
mock.module("../../worker/src/lib/audio-store.ts", { namedExports: {
  audioDb: () => db, audioRpc: runRpc,
  getAudioRequest: async (id, uid) => tables.audio_generation_requests.find(row => row.id === id && row.user_id === uid) ?? null,
  readPrivateAudio: async key => { calls.reads.push(key); return new Uint8Array([1,2,3,4]); }, savePrivateAudio: async (key, bytes) => { calls.writes++; calls.saved.set(key, new Uint8Array(bytes)); await onSaveAudio?.(); },
} });
const api = await import("./api.ts");
const bookmarkApi = await import("../../app/api/audio/bookmarks/route.ts");
const bookmarkRequest = (body) => new Request("https://www.getugcpilot.com/api/audio/bookmarks?userId=bob", {
  ...(body === undefined ? {} : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
});

test("Free accounts can persist and remove bookmarks without provider or generation calls", async () => {
  subscription = { isActive: false, planKey: "free" };
  assert.deepEqual(await (await bookmarkApi.GET(bookmarkRequest())).json(), { voiceIds: [] });
  for (let i = 0; i < 2; i++) {
    const response = await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: true }));
    assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private, no-store/);
    assert.deepEqual(await response.json(), { voiceId: "default", bookmarked: true });
  }
  assert.equal(tables.audio_voice_bookmarks.length, 1);
  assert.deepEqual(await (await bookmarkApi.GET(bookmarkRequest())).json(), { voiceIds: ["default"] });
  await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: false }));
  await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: false }));
  assert.deepEqual(await (await bookmarkApi.GET(bookmarkRequest())).json(), { voiceIds: [] });
  assert.equal(calls.accounts, 0); assert.equal(calls.dispatches, 0); assert.equal(calls.rpc.length, 0); assert.equal(calls.writes, 0); assert.equal(calls.subscriptionOptions.length, 0);
});

test("bookmark identities come from verified auth and one account cannot read or remove another's", async () => {
  tables.audio_voice_bookmarks = [{ user_id: "bob", voice_id: "default" }];
  assert.deepEqual(await (await bookmarkApi.GET(bookmarkRequest())).json(), { voiceIds: [] });
  await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: true }));
  assert.deepEqual(await (await bookmarkApi.GET(bookmarkRequest())).json(), { voiceIds: ["default"] });
  await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: false }));
  assert.deepEqual(tables.audio_voice_bookmarks, [{ user_id: "bob", voice_id: "default" }]);
  owner = "bob";
  assert.deepEqual(await (await bookmarkApi.GET(bookmarkRequest())).json(), { voiceIds: ["default"] });
});

test("bookmark API rejects unauthenticated reads and writes and malformed or ownership-forging input", async () => {
  failAuth = true;
  assert.equal((await bookmarkApi.GET(bookmarkRequest())).status, 401);
  assert.equal((await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: true }))).status, 401);
  failAuth = false;
  for (const body of [{ voiceId: "default", bookmarked: true, userId: "bob" }, { voiceId: "default", bookmarked: "true" }, { voiceId: "default" }, { voiceId: "https://example.invalid/voice", bookmarked: true }, { voiceId: "x".repeat(101), bookmarked: true }, null, []]) {
    assert.equal((await bookmarkApi.PUT(bookmarkRequest(body))).status, 400);
  }
  assert.equal((await bookmarkApi.PUT(new Request("https://www.getugcpilot.com/api/audio/bookmarks", { method: "PUT", body: "{" }))).status, 400);
  assert.equal(tables.audio_voice_bookmarks?.length ?? 0, 0);
});

test("bookmark database failure returns a retryable error without impacting speech bootstrap", async () => {
  bookmarkDbError = true;
  for (const response of [await bookmarkApi.GET(bookmarkRequest()), await bookmarkApi.PUT(bookmarkRequest({ voiceId: "default", bookmarked: true }))]) {
    assert.equal(response.status, 503); assert.match((await response.json()).error, /bookmark.*Try again/);
  }
  const bootstrap = await api.handleAudioBootstrap(request("bootstrap?refresh=1"));
  assert.equal(bootstrap.status, 200); assert.equal((await bootstrap.json()).canGenerate, true);
});
beforeEach(() => {
  owner = "alice"; failAuth = false; quotaError = null; emptyCatalogue = false; providerDeleteError = null; storageDeleteError = null; voiceMetadata = new Map(); onVoiceRead = null; voiceReadError = null; onAssetInsert = null; onSaveAudio = null;
  account = resolveAudioAccount({ tier: "free", status: "active", character_limit: 10000, can_use_instant_voice_cloning: true });
  subscription = { isActive: true, planKey: "starter" }; billingError = null;
  bookmarkDbError = false;
  calls = { accounts: 0, dispatches: 0, rpc: [], deleted: [], reads: [], voiceReads: [], writes: 0, saved: new Map(), removed: [], events: [], subscriptionOptions: [] };
  tables = { audio_assets: [], audio_generation_requests: [], audio_voice_profiles: [{ id: randomUUID(), user_id: "alice", provider_voice_id: "alice-clone", name: "My voice", status: "ready" }, { id: randomUUID(), user_id: "bob", provider_voice_id: "bob-clone", name: "Bob", status: "ready" }] };
  process.env.ELEVENLABS_API_KEY = "offline-test"; process.env.AUDIO_GENERATION_ENABLED = "true"; process.env.ELEVENLABS_ALLOWED_VOICE_IDS = "community,bob-clone,workspace-private";
  process.env.AUDIO_GENERATION_ALLOWED_USER_IDS = "alice"; process.env.AUDIO_GENERATION_PUBLIC_ENABLED = "false"; process.env.NODE_ENV = "production";
});
const request = (path, body, headers) => new Request(`https://offline.invalid/api/audio/${path}`, body ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } } : { headers });
const input = () => ({ requestKey: randomUUID(), script: "hello", voiceId: "default", modelId: model.id, speed: 1, name: "Test" });
test("the provider Free tier lists defaults for an eligible UGC plan while hiding community and every private clone", async () => {
  const response = await api.handleAudioBootstrap(request("bootstrap?refresh=1")); const body = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(body.voices.map(v => v.id), ["default"]); assert.equal(body.canClone, false); assert.equal(body.canGenerate, true);
});

test("UGC Free can browse connected Starter voices but cannot create audio, even when invited", async () => {
  subscription = { isActive: false, planKey: "free", trial: { isActive: true }, creditsRemaining: 100 };
  account = resolveAudioAccount({ tier: "starter", status: "active", character_limit: 30000, can_use_instant_voice_cloning: true });
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(body.generationAccess, "upgrade_required"); assert.equal(body.canGenerate, false); assert.equal(body.canClone, false); assert.equal(body.canUpload, false);
  assert.deepEqual(body.voices.map(v => v.id), ["default", "community", "alice-clone"]); assert.equal(body.models.length, 1); assert.match(body.message, /Starter and Growth/);
  calls.accounts = 0;
  assert.equal((await api.handleAudioGeneration(request("generations", { ...input(), planKey: "growth", isActive: true }))).status, 403);
  assert.equal((await api.handleAudioClone(request("voices", { requestKey: randomUUID(), assetId: randomUUID(), name: "Voice", consent: true }))).status, 403);
  assert.equal((await api.handleAudioUpload(uploadRequest(randomUUID()))).status, 403);
  assert.equal(calls.accounts, 0); assert.equal(calls.rpc.length, 0); assert.equal(calls.dispatches, 0); assert.equal(calls.writes, 0);
});

test("an invite or development environment never grants audio generation to UGC Free", async () => {
  subscription = { isActive: false, planKey: "free" }; process.env.NODE_ENV = "development";
  assert.equal((await api.handleAudioGeneration(request("generations", input()))).status, 403);
  process.env.NODE_ENV = "production"; process.env.AUDIO_GENERATION_PUBLIC_ENABLED = "true"; process.env.AUDIO_GENERATION_ALLOWED_USER_IDS = "";
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(body.canGenerate, false); assert.equal(body.voices.length, 1);
  assert.equal((await api.handleAudioGeneration(request("generations", input()))).status, 403);
  assert.equal(calls.rpc.length, 0); assert.equal(calls.dispatches, 0);
});

test("only active UGC Starter and Growth plans can submit a new generation", async () => {
  for (const planKey of ["starter", "growth"]) {
    subscription = { isActive: true, planKey };
    const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
    assert.equal(body.generationAccess, "allowed"); assert.equal(body.canGenerate, true);
    assert.equal((await api.handleAudioGeneration(request("generations", input()))).status, 202);
  }
  const created = calls.rpc.length;
  for (const subscriptionState of [{ isActive: false, planKey: "starter" }, { isActive: false, planKey: "growth" }, { isActive: true, planKey: "free" }, { isActive: true, planKey: "enterprise" }]) {
    subscription = subscriptionState; assert.equal((await api.handleAudioGeneration(request("generations", input()))).status, 403);
  }
  assert.equal(calls.rpc.length, created);
  assert.ok(calls.subscriptionOptions.every(options => options.strict === true && options.refreshCredits === false));
});

test("public Starter/Growth subscribers pass the gate and retain existing credit reservations", async () => {
  process.env.AUDIO_GENERATION_ALLOWED_USER_IDS = ""; process.env.AUDIO_GENERATION_PUBLIC_ENABLED = "true";
  account = resolveAudioAccount({ tier: "starter", status: "active", character_limit: 30000 });
  for (const planKey of ["starter", "growth"]) {
    subscription = { isActive: true, planKey };
    const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
    assert.equal(body.canGenerate, true); assert.equal(body.generationAccess, "allowed"); assert.ok(body.creditCostPer1000 > 0);
    assert.equal((await api.handleAudioGeneration(request("generations", input()))).status, 202);
    assert.ok(calls.rpc.at(-1).args.p_credits > 0);
  }
});

test("downgraded Free owners retain existing recording playback, download, history and cleanup", async () => {
  subscription = { isActive: false, planKey: "free" };
  const id = randomUUID(); tables.audio_assets.push({ id, user_id: owner, name: "Existing voiceover", status: "ready", object_key: `alice/${id}/final.mp3`, mime_type: "audio/mpeg", purpose: "generated", generation_id: null, test_only: false });
  assert.equal((await api.handleAudioHistory(request("history"))).status, 200);
  assert.equal((await api.handleAudioAsset(request(`assets/${id}`), id)).status, 200);
  const download = await api.handleAudioAsset(request(`assets/${id}?download=1`), id); assert.equal(download.status, 200); assert.match(download.headers.get("content-disposition"), /attachment/);
  assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 200);
  assert.equal(calls.accounts, 0); assert.equal(calls.dispatches, 0);
});

test("a billing outage keeps the library usable and fails closed for generation", async () => {
  billingError = new Error("ENTITLEMENTS_UNAVAILABLE");
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(body.generationAccess, "unavailable"); assert.equal(body.canGenerate, false); assert.equal(body.voices.length, 1); assert.match(body.message, /could not be checked/);
  calls.accounts = 0; const response = await api.handleAudioGeneration(request("generations", input())); assert.equal(response.status, 503);
  assert.equal(calls.accounts, 0); assert.equal(calls.rpc.length, 0); assert.equal(calls.dispatches, 0);
});

test("downgraded users cannot replay a queued request to dispatch a generation", async () => {
  const value = input(); const { requestKey, ...payload } = value;
  tables.audio_generation_requests.push({ id: randomUUID(), user_id: owner, request_key: requestKey, fingerprint: createHash("sha256").update(JSON.stringify({ kind: "speech", ...payload, testOnly: undefined })).digest("hex"), job_id: "job", status: "queued" });
  subscription = { isActive: false, planKey: "starter" };
  assert.equal((await api.handleAudioGeneration(request("generations", value))).status, 403); assert.equal(calls.dispatches, 0); assert.equal(calls.accounts, 0);
  assert.equal((await api.handleAudioHistory(request("history"))).status, 200);
});
test("Starter lists approved community voices and only the owner's clone", async () => {
  account = resolveAudioAccount({ tier: "starter", status: "active", can_use_instant_voice_cloning: true });
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.deepEqual(body.voices.map(v => v.id), ["default","community","alice-clone"]); assert.equal(body.voices[2].name, "My voice");
  assert.equal(body.voices[2].previewUrl, null); assert.equal(body.canClone, true);
});

test("refresh safely reconciles a genuinely verified private clone and its activity state", async () => {
  account = resolveAudioAccount({ tier:"starter",status:"active",can_use_instant_voice_cloning:true });
  const profile = tables.audio_voice_profiles[0]; profile.status = "verification_required";
  tables.audio_generation_requests.push({ id:profile.id,user_id:owner,kind:"clone",status:"completed",voice_profile_id:profile.id });
  voiceMetadata.set("alice-clone",{ voice_id:"alice-clone",name:"Provider name",category:"cloned",preview_url:"https://example.invalid/private.mp3",voice_verification:{ is_verified:true,requires_verification:false } });
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(profile.status,"ready"); assert.equal(body.requests[0].voiceStatus,"ready");
  assert.equal(body.voices.find(voice => voice.id === "alice-clone").profileId,profile.id);
  assert.equal(body.voices.find(voice => voice.id === "alice-clone").previewUrl,null);
  assert.deepEqual(calls.voiceReads,["alice-clone"]); assert.equal(calls.rpc.length,0); assert.equal(calls.deleted.length,0);
});

test("verification refresh stays closed for pending, unknown, mismatched and moderated provider records", async () => {
  account = resolveAudioAccount({ tier:"starter",status:"active",can_use_instant_voice_cloning:true });
  const profile = tables.audio_voice_profiles[0]; profile.status = "verification_required";
  const confirmed = { voice_id:"alice-clone",name:"Private",category:"cloned",voice_verification:{ is_verified:true,requires_verification:false } };
  for (const fields of [
    { voice_verification:undefined }, { voice_verification:{ is_verified:false,requires_verification:false } },
    { voice_verification:{ is_verified:true,requires_verification:true } }, { voice_verification:{ is_verified:true } },
    { voice_id:"wrong-voice" }, { category:"premade" }, { sharing:{ review_status:"blocked" } },
    { sharing:{ live_moderation_enabled:true } }, { sharing:{ rate:0.1 } }, { available_for_tiers:["enterprise"] },
  ]) {
    voiceMetadata.set("alice-clone",{ ...confirmed,...fields });
    const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
    assert.equal(profile.status,"verification_required"); assert.equal(body.voices.some(voice => voice.id === "alice-clone"),false);
  }
});

test("verification reconciliation cannot revive concurrent deletion or a changed provider ID", async () => {
  account = resolveAudioAccount({ tier:"starter",status:"active",can_use_instant_voice_cloning:true });
  const profile = tables.audio_voice_profiles[0]; profile.status = "verification_required";
  voiceMetadata.set("alice-clone",{ voice_id:"alice-clone",name:"Private",category:"cloned",voice_verification:{ is_verified:true,requires_verification:false } });
  onVoiceRead = () => { profile.status = "deleted"; };
  let body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(profile.status,"deleted"); assert.equal(body.voices.some(voice => voice.id === "alice-clone"),false);
  profile.status = "verification_required"; profile.provider_voice_id = "alice-clone";
  onVoiceRead = () => { profile.provider_voice_id = "changed-clone"; };
  body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(profile.status,"verification_required"); assert.equal(body.voices.some(voice => voice.private),false);
});

test("Free, foreign and deleted profiles never reconcile, while provider read outages keep defaults usable", async () => {
  tables.audio_voice_profiles[0].status = "verification_required";
  await api.handleAudioBootstrap(request("bootstrap?refresh=1")); assert.equal(calls.voiceReads.length,0);
  account = resolveAudioAccount({ tier:"starter",status:"active",can_use_instant_voice_cloning:true });
  tables.audio_voice_profiles[0].status = "deleted"; tables.audio_voice_profiles[1].status = "verification_required";
  await api.handleAudioBootstrap(request("bootstrap?refresh=1")); assert.equal(calls.voiceReads.length,0);
  tables.audio_voice_profiles[0].status = "verification_required"; voiceReadError = new Error("Provider unavailable");
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(body.canGenerate,true); assert.deepEqual(body.voices.map(voice => voice.id),["default","community"]);
  assert.equal(tables.audio_voice_profiles[0].status,"verification_required");
});
test("an identical speech retry returns its original request even after quota runs out", async () => {
  const value = input(); const { requestKey, ...payload } = value;
  const id = randomUUID(); const fingerprint = createHash("sha256").update(JSON.stringify({ kind: "speech", ...payload, testOnly: undefined })).digest("hex");
  tables.audio_generation_requests.push({ id, user_id: owner, request_key: requestKey, fingerprint, job_id: "job", status: "completed", test_only: true, credits: 0 }); account.remaining = 0;
  const response = await api.handleAudioGeneration(request("generations", value)); assert.equal(response.status, 202); assert.equal((await response.json()).id, id);
  assert.equal(calls.accounts, 0); assert.equal(calls.rpc.length, 0);
  const conflict = await api.handleAudioGeneration(request("generations", { ...value, script: "different" })); assert.equal(conflict.status, 409);
});
test("private speech uses the server-selected owner profile, ignoring a client profile ID", async () => {
  account = resolveAudioAccount({ tier: "starter", status: "active", character_limit: 10000, can_use_instant_voice_cloning: true });
  const response = await api.handleAudioGeneration(request("generations", { ...input(), voiceId: "alice-clone", privateVoiceProfileId: tables.audio_voice_profiles[1].id }));
  assert.equal(response.status, 202); assert.equal(calls.rpc[0].args.p_payload.privateVoiceProfileId, tables.audio_voice_profiles[0].id);
});
test("private speech replays its original fingerprint after the voice was retired", async () => {
  const value = { ...input(), voiceId: "alice-clone" }; const { requestKey, ...payload } = value;
  const profile = tables.audio_voice_profiles[0]; profile.status = "deleted"; profile.provider_voice_id = null;
  const fingerprint = createHash("sha256").update(JSON.stringify({ kind: "speech", ...payload, privateVoiceProfileId: profile.id, testOnly: undefined })).digest("hex");
  const id = randomUUID(); tables.audio_generation_requests.push({ id, user_id: owner, request_key: requestKey, fingerprint, voice_profile_id: profile.id, job_id: "job", status: "completed", test_only: false, credits: 0 });
  const response = await api.handleAudioGeneration(request("generations", value));
  assert.equal(response.status, 202); assert.equal((await response.json()).id, id); assert.equal(calls.accounts, 0); assert.equal(calls.rpc.length, 0);
});
test("another user's clone cannot be generated even when its ID is submitted directly", async () => {
  account = resolveAudioAccount({ tier: "starter", status: "active", character_limit: 10000, can_use_instant_voice_cloning: true });
  const response = await api.handleAudioGeneration(request("generations", { ...input(), voiceId: "bob-clone" })); assert.equal(response.status, 403); assert.equal(calls.rpc.length, 0);
});
test("an approved ID cannot expose an unrelated private workspace professional voice", async () => {
  account = resolveAudioAccount({ tier: "starter", status: "active", character_limit: 10000, can_use_instant_voice_cloning: true });
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(body.voices.some(voice => voice.id === "workspace-private"), false);
  assert.equal((await api.handleAudioGeneration(request("generations", { ...input(), voiceId: "workspace-private" }))).status, 403);
  assert.equal(calls.rpc.length, 0);
});
test("Free cloning, noninvited production users and unauthenticated access are blocked", async () => {
  assert.equal((await api.handleAudioClone(request("voices", { requestKey: randomUUID(), assetId: randomUUID(), name: "Voice", consent: true }))).status, 403);
  owner = "bob"; assert.equal((await api.handleAudioGeneration(request("generations", input()))).status, 403);
  failAuth = true; assert.equal((await api.handleAudioHistory(request("history"))).status, 401); assert.equal(calls.rpc.length, 0);
});
test("private playback is owner checked and supports byte ranges", async () => {
  const id = randomUUID(); tables.audio_assets.push({ id, user_id: "bob", status: "ready", object_key: "bob/private", mime_type: "audio/mpeg", test_only: true });
  assert.equal((await api.handleAudioAsset(request(`assets/${id}`), id)).status, 404); assert.equal(calls.reads.length, 0);
  owner = "bob"; const response = await api.handleAudioAsset(request(`assets/${id}`, null, { Range: "bytes=1-2" }), id);
  assert.equal(response.status, 206); assert.equal(response.headers.get("content-range"), "bytes 1-2/4"); assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [2,3]);
  assert.match(response.headers.get("content-disposition"), /free-test-audio/);
  assert.equal((await api.handleAudioAsset(request(`assets/${id}`, null, { Range: "bytes=999-" }), id)).status, 416);
});
test("missing configuration leaves a useful disabled screen without provider calls", async () => {
  delete process.env.ELEVENLABS_API_KEY; process.env.AUDIO_GENERATION_ENABLED = "false";
  const response = await api.handleAudioBootstrap(request("bootstrap")); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.canGenerate, false); assert.match(body.message, /not been connected/); assert.equal(calls.accounts, 0);
  assert.equal(body.catalogueSource, "public-preview"); assert.equal(body.voices.length, 1); assert.equal(body.voices[0].available, false); assert.equal(body.account, null);
});

test("the existing lowercase hosted ElevenLabs key configures generation", async () => {
  delete process.env.ELEVENLABS_API_KEY; process.env.elevenlabs_api_key = "offline-lowercase";
  try {
    const response = await api.handleAudioBootstrap(request("bootstrap?refresh=1")); const body = await response.json();
    assert.equal(body.configured,true); assert.equal(body.canGenerate,true); assert.deepEqual(body.voices.map(voice => voice.id),["default"]);
    assert.equal(calls.accounts,1);
  } finally { delete process.env.elevenlabs_api_key; }
});
test("public demos do not enable generation when a connected account has no eligible voices", async () => {
  emptyCatalogue = true;
  const body = await (await api.handleAudioBootstrap(request("bootstrap?refresh=1"))).json();
  assert.equal(body.catalogueSource, "public-preview"); assert.equal(body.voices.length, 1); assert.equal(body.canGenerate, false); assert.match(body.message, /No eligible voices/);
  const response = await api.handleAudioGeneration(request("generations", { ...input(), voiceId: body.voices[0].id }));
  assert.equal(response.status, 403); assert.equal(calls.rpc.length, 0);
});
test("quota rejection removes the new recording instead of leaving private storage orphans", async () => {
  quotaError = new AudioError("The audio testing allowance has been reached.", 429);
  const form = new FormData(); const key = randomUUID(); form.append("requestKey", key); form.append("purpose", "reference"); form.append("file", new File([new Uint8Array(100)], "sample.mp3", { type: "audio/mpeg" }));
  const response = await api.handleAudioUpload(new Request("https://offline.invalid/api/audio/uploads", { method: "POST", body: form }));
  assert.equal(response.status, 429); assert.equal(calls.writes, 1); assert.equal(tables.audio_assets.length, 0); assert.equal(calls.removed.length, 1);
});
function uploadRequest(key, fill = 0) {
  const form = new FormData(); form.append("requestKey", key); form.append("purpose", "reference"); form.append("file", new File([new Uint8Array(100).fill(fill)], "sample.mp3", { type: "audio/mpeg" }));
  return new Request("https://offline.invalid/api/audio/uploads", { method: "POST", body: form });
}
test("concurrent conflicting uploads cannot overwrite or remove the winning recording", async () => {
  let release; const bothUploaded = new Promise(resolve => { release = resolve; });
  onSaveAudio = async () => { if (calls.saved.size === 2) release(); await bothUploaded; };
  const key = randomUUID(); const responses = await Promise.all([api.handleAudioUpload(uploadRequest(key, 1)), api.handleAudioUpload(uploadRequest(key, 2))]);
  assert.deepEqual(responses.map(response => response.status).sort(), [202, 409]); assert.equal(tables.audio_assets.length, 1);
  const asset = tables.audio_assets[0]; assert.equal(calls.saved.size, 2); assert.equal(calls.removed.length, 1); assert.equal(calls.removed.includes(asset.object_key), false);
  assert.equal(createHash("sha256").update(calls.saved.get(asset.object_key)).digest("hex"), asset.checksum); assert.equal(calls.dispatches, 1);
});
test("failed initial metadata persistence removes only its unreferenced upload", async () => {
  onAssetInsert = () => ({ data: null, error: new Error("Database unavailable") });
  const response = await api.handleAudioUpload(uploadRequest(randomUUID()));
  assert.equal(response.status, 503); assert.equal(tables.audio_assets.length, 0); assert.deepEqual(calls.removed, [...calls.saved.keys()]); assert.equal(calls.dispatches, 0);
});
test("a lost insert response keeps the committed recording and continues its validation job", async () => {
  onAssetInsert = row => { tables.audio_assets.push(row); return { data: null, error: new Error("Response lost after commit") }; };
  const response = await api.handleAudioUpload(uploadRequest(randomUUID()));
  assert.equal(response.status, 202); assert.equal(tables.audio_assets.length, 1); assert.equal(calls.removed.length, 0); assert.equal(calls.dispatches, 1);
});
test("a recovered initial upload is still removed when no request can reserve quota", async () => {
  onAssetInsert = row => { tables.audio_assets.push(row); return { data: null, error: new Error("Response lost after commit") }; };
  quotaError = new AudioError("Audio quota reached", 429);
  const response = await api.handleAudioUpload(uploadRequest(randomUUID()));
  assert.equal(response.status, 429); assert.equal(tables.audio_assets.length, 0); assert.deepEqual(calls.removed, [...calls.saved.keys()]); assert.equal(calls.dispatches, 0);
});
test("streaming reads persisted chunks only and rejects another owner's request", async () => {
  const id = randomUUID(); tables.audio_generation_requests.push({ id, user_id: "alice", kind: "speech", status: "completed", chunk_count: 2 });
  owner = "bob"; assert.equal((await api.handleAudioStream(request(`generations/${id}/stream`), id)).status, 404); assert.equal(calls.reads.length, 0);
  owner = "alice"; const response = await api.handleAudioStream(request(`generations/${id}/stream`), id);
  assert.equal((await response.arrayBuffer()).byteLength, 8); assert.equal(calls.accounts, 0); assert.deepEqual(calls.reads, [`alice/${id}/chunks/0.mp3`,`alice/${id}/chunks/1.mp3`]);
});
test("removing a recording is owner checked, protects active references and cleans up stream chunks", async () => {
  const id = randomUUID(); const asset = { id, user_id: "alice", status: "ready", object_key: `alice/${id}/final.mp3`, generation_id: id }; tables.audio_assets.push(asset);
  tables.audio_generation_requests.push({ id, user_id: "alice", status: "completed", chunk_count: 2, output_asset_id: id });
  owner = "bob"; assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 404); assert.equal(calls.removed.length, 0);
  owner = "alice"; tables.audio_voice_profiles.push({ id: randomUUID(), user_id: owner, source_asset_id: id, status: "ready" });
  assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 409);
  tables.audio_voice_profiles.pop(); assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 200);
  assert.deepEqual(calls.removed, [`alice/${id}/final.mp3`,`alice/${id}/chunks/0.mp3`,`alice/${id}/chunks/1.mp3`]); assert.equal(asset.status, "deleted");
});
test("private voice removal rejects foreign ownership and active generations", async () => {
  const profile = tables.audio_voice_profiles[0]; owner = "bob";
  assert.equal((await api.handleDeleteAudioVoice(request(`voices/${profile.id}`), profile.id)).status, 404);
  owner = "alice"; tables.audio_generation_requests.push({ user_id: owner, voice_id: profile.provider_voice_id, status: "streaming" });
  assert.equal((await api.handleDeleteAudioVoice(request(`voices/${profile.id}`), profile.id)).status, 409); assert.equal(calls.deleted.length, 0);
  tables.audio_generation_requests = [];
  assert.equal((await api.handleDeleteAudioVoice(request(`voices/${profile.id}`), profile.id)).status, 200); assert.deepEqual(calls.deleted, ["alice-clone"]); assert.equal(profile.status, "deleted");
  assert.deepEqual(calls.events, ["retire.voice","provider.delete"]);
});
test("failed provider removal stays retired and exposes an owner-only explicit cleanup retry", async () => {
  const profile = tables.audio_voice_profiles[0]; providerDeleteError = new AudioError("Provider rejected cleanup.", 500);
  assert.equal((await api.handleDeleteAudioVoice(request(`voices/${profile.id}`), profile.id)).status, 503);
  assert.equal(profile.status, "deleted"); assert.equal(profile.provider_voice_id, "alice-clone");
  const history = await (await api.handleAudioHistory(request("history"))).json();
  assert.deepEqual(history.cleanupPending, [{ id: profile.id, name: "My voice", kind: "voice" }]); assert.equal(JSON.stringify(history).includes("alice-clone"), false);
  owner = "bob"; assert.deepEqual((await (await api.handleAudioHistory(request("history"))).json()).cleanupPending, []);
  owner = "alice"; providerDeleteError = null;
  assert.equal((await api.handleDeleteAudioVoice(request(`voices/${profile.id}`), profile.id)).status, 200); assert.equal(profile.provider_voice_id, null);
  assert.deepEqual((await (await api.handleAudioHistory(request("history"))).json()).cleanupPending, []);
});
test("failed storage removal hides the recording and can resume cleanup after reload", async () => {
  const id = randomUUID(); const asset = { id, name: "Recording", user_id: owner, status: "ready", object_key: `alice/${id}/recording`, generation_id: null, cleanup_completed_at: null }; tables.audio_assets.push(asset);
  storageDeleteError = new Error("Temporary storage failure");
  assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 503); assert.equal(asset.status, "deleted");
  assert.equal((await api.handleAudioAsset(request(`assets/${id}`), id)).status, 404);
  const history = await (await api.handleAudioHistory(request("history"))).json();
  assert.equal(history.assets.length, 0); assert.deepEqual(history.cleanupPending, [{ id, name: "Recording", kind: "asset" }]); assert.equal(JSON.stringify(history).includes(asset.object_key), false);
  storageDeleteError = null;
  assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 200); assert.ok(asset.cleanup_completed_at);
  assert.deepEqual((await (await api.handleAudioHistory(request("history"))).json()).cleanupPending, []);
  assert.equal((await api.handleDeleteAudioAsset(request(`assets/${id}`), id)).status, 200); assert.equal(calls.removed.length, 2);
  assert.deepEqual(calls.events.slice(0,2), ["retire.asset","storage.remove"]);
});
