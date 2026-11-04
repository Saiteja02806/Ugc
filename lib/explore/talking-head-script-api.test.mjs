import assert from "node:assert/strict";
import { test, mock, beforeEach, after } from "node:test";

let owner, profile, calls, providerRequest, saveFails, providerFails, providerText;
const rows = new Map();
const source = { referenceId: "talking-test", sourceSha256: "a".repeat(64), transcriptSha256: "b".repeat(64), fullText: "Try this. Then the demo.", hookText: "Try this.", hookEndMs: 4000, extractedAt: "2026-11-04T00:00:00Z" };
class FirebaseAuthRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => { if (!owner) throw new FirebaseAuthRequestError("Sign in", 401); return { uid: owner }; } } });
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => { if (!owner) throw new FirebaseAuthRequestError("Sign in", 401); return { uid: owner }; } } });
mock.module("@/lib/business-profiles/db", { namedExports: { getBusinessProfileForUser: async () => profile } });
mock.module("./talking-head-script-store.ts", { namedExports: { getTalkingHeadScript: id => { if (id !== source.referenceId) throw Error("Source unavailable"); return source; } } });
mock.module("openai", { defaultExport: class { responses = { create: async body => { calls++; providerRequest = body; if (providerFails) throw Error("Provider failed"); return { id: "response-one", model: body.model, status: "completed", output_text: JSON.stringify({ script: providerText }), usage: { input_tokens: 20, output_tokens: 5 } }; } }; } });
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({
  from(table) {
    assert.equal(table, "explore_text_remixes"); const filters = {}; let update;
    const run = () => {
      const row = rows.get(`${filters.user_id}:${filters.request_key}`);
      if (!update) return { data: row ?? null, error: null };
      if (saveFails && update.status === "completed") return { data: null, error: { message: "Save failed" } };
      if (row && (!filters.status || row.status === filters.status)) Object.assign(row, update);
      return { data: row ? { request_key: filters.request_key } : null, error: null };
    };
    const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query; }, update: value => { update = value; return query; }, maybeSingle: async () => run(), single: async () => run(), then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject) }; return query;
  },
  async rpc(name, args) {
    assert.equal(name, "explore_claim_text_remix");
    rows.set(`${args.p_user_id}:${args.p_request_key}`, { payload_hash: args.p_payload_hash, input_json: args.p_input, status: "pending", output_json: null });
    return { data: { claimed: true }, error: null };
  },
}) } });
const envNames = ["EXPLORE_TEXT_REMIX_ENABLED", "OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_TALKING_HEAD_SCRIPT_MODEL"];
const original = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
beforeEach(() => { owner = "owner"; profile = { id: "business", profileVersion: 2, context: { businessName: "Example", productSummary: "Speaking practice" } }; calls = 0; rows.clear(); saveFails = false; providerFails = false; providerText = "Try this!";
  Object.assign(process.env, { EXPLORE_TEXT_REMIX_ENABLED: "true", OPENAI_API_KEY: "fake-test-only", SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "fake-test-only" }); delete process.env.OPENAI_TALKING_HEAD_SCRIPT_MODEL;
});
after(() => { for (const key of envNames) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; } });
const api = await import("./talking-head-script-api.ts");
const id = "11111111-1111-4111-8111-111111111111";
const body = () => ({ requestKey: id, referenceId: source.referenceId, sourceSha256: source.sourceSha256, transcriptSha256: source.transcriptSha256, businessProfileVersion: 2, script: "Try this.", reviewed: true });
const post = async (value = body()) => api.handleTalkingHeadScriptPost(new Request("https://example.test/api/explore/talking-head-script", { method: "POST", headers: { "Idempotency-Key": value.requestKey }, body: JSON.stringify(value) }));
test("loading transcript and business context never invokes the provider", async () => {
  const result = await api.handleTalkingHeadScriptGet(new Request("https://example.test/api/explore/talking-head-script?referenceId=talking-test"));
  assert.equal(result.status, 200); assert.equal((await result.json()).source.fullText, source.fullText); assert.equal(calls, 0);
});
test("paid request freezes Terra medium, exact script and current business; duplicate recovers", async () => {
  assert.equal((await post()).status, 200); assert.equal(calls, 1);
  assert.equal(providerRequest.model, "gpt-6.1-terra"); assert.equal(providerRequest.reasoning.effort, "medium");
  assert.equal(JSON.parse(providerRequest.input).sourceScript, "Try this.");
  assert.equal(rows.get(`owner:${id}`).input_json.purpose, "talking_head_script");
  profile.profileVersion = 3;
  assert.equal((await post()).status, 200); assert.equal(calls, 1);
  process.env.EXPLORE_TEXT_REMIX_ENABLED = "false";
  const recovered = await api.handleTalkingHeadScriptGet(new Request(`https://example.test/api/explore/talking-head-script?requestKey=${id}`));
  assert.equal((await recovered.json()).script, "Try this!"); assert.equal(calls, 1);
});
test("source/hash, review, changed-business and authentication failures happen before provider call", async () => {
  for (const patch of [{ sourceSha256: "c".repeat(64) }, { transcriptSha256: "c".repeat(64) }, { reviewed: false }, { businessProfileVersion: 1 }]) assert.ok((await post({ ...body(), ...patch })).status >= 400);
  owner = null; assert.equal((await post()).status, 401); assert.equal(calls, 0);
});
test("owned recovery and different request payload cannot disclose or regenerate a saved script", async () => {
  await post(); assert.equal((await post({ ...body(), script: "Different words" })).status, 409);
  owner = "other"; assert.equal((await api.handleTalkingHeadScriptGet(new Request(`https://example.test/api/explore/talking-head-script?requestKey=${id}`))).status, 404); assert.equal(calls, 1);
});
test("save uncertainty and provider failure never run the same paid claim twice", async () => {
  saveFails = true; assert.equal((await post()).status, 503); assert.equal((await post()).status, 409); assert.equal(calls, 1);
  rows.clear(); calls = 0; saveFails = false; providerFails = true;
  assert.equal((await post()).status, 502); assert.equal((await post()).status, 409); assert.equal(calls, 1);
});
test("long spoken scripts keep compatible private receipts without truncating words or becoming overlays", async () => {
  providerText = "Practice a short conversation at your own pace. ".repeat(24).trim();
  const result = await post({ ...body(), script: providerText });
  assert.equal(result.status, 200); assert.equal((await result.json()).script, providerText);
  const row = rows.get(`owner:${id}`);
  assert.ok(row.output_json.blocks.length > 1); assert.ok(row.output_json.blocks.every(block => block.length <= 600));
  assert.equal(row.input_json.purpose, "talking_head_script"); assert.equal(row.input_json.originalScript, providerText);
});
