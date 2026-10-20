import assert from "node:assert/strict";
import { mock, test } from "node:test";

const records = new Map(), providerCalls = [], claims = [];
let owner = "owner-a", authFails = false, providerFails = false, saveFails = false, claimFails = "";
class AuthError extends Error { status = 403; }
const result = () => ({ version: 1, prompt: 'Change the heading to "Start A SaaS". Place the actual uploaded screenshot as requested and preserve everything else.', clarifications: [] });
class AI {
  constructor(options) { assert.equal(options.maxRetries, 0); }
  chat = { completions: { parse: async options => { providerCalls.push(options); if (providerFails) throw Error("provider failed"); return { choices: [{ message: { parsed: result() } }] }; } } };
}
const db = {
  async rpc(name, args) {
    assert.equal(name, "explore_claim_slideshow_prompt"); claims.push(args);
    if (claimFails) return { error: { message: claimFails } };
    const key = args.p_user_id + ":" + args.p_request_key, saved = records.get(key);
    if (saved) return saved.hash !== args.p_payload_hash ? { error: { message: "prompt_request_conflict" } } : { data: { claimed: false, status: saved.status, output: saved.output_json } };
    records.set(key, { hash: args.p_payload_hash, status: "pending", input: args.p_input });
    return { data: { claimed: true } };
  },
  from(table) {
    assert.equal(table, "explore_slideshow_prompts");
    return { update(patch) {
      const filters = {};
      const apply = () => { if (saveFails) return { error: { message: "save failed" } }; const saved = records.get(filters.user_id + ":" + filters.request_key); if (saved?.status === filters.status) Object.assign(saved, patch); return { data: { request_key: filters.request_key }, error: null }; };
      const query = { eq(key, value) { filters[key] = value; return query; }, select() { return query; }, single: async () => apply(), then(resolve) { return Promise.resolve(apply()).then(resolve); } };
      return query;
    } };
  },
};
mock.module("openai", { defaultExport: AI });
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => db } });
mock.module(new URL("../lib/ai-studio/server-access.ts", import.meta.url), { namedExports: { requireAIStudioProUser: async () => { if (authFails) throw new AuthError("Pro access required"); return { uid: owner }; } } });
mock.module(new URL("../lib/firebase/server-auth.ts", import.meta.url), { namedExports: { FirebaseAuthRequestError: AuthError } });
process.env.EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED = "true";
process.env.OPENAI_API_KEY = "fixture-only";
process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
const { handleSlideshowPromptImprovement: handle } = await import("../lib/explore/slideshow-prompt-api.ts");
const input = { prompt: 'Change the heading to "Start A SaaS". Place my uploaded screenshot as requested.' };
const post = (body = input, key = crypto.randomUUID()) => new Request("https://www.getugcpilot.com/api/explore/slideshows/improve-prompt", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("one rewritten prompt saves original provenance and replays without a second provider call", async () => {
  const key = crypto.randomUUID(), before = providerCalls.length;
  const response = await handle(post(input, key));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).output, result());
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(providerCalls.length, before + 1);
  const call = providerCalls.at(-1);
  assert.equal(call.messages.length, 2); assert.ok(call.messages.every(message => typeof message.content === "string"));
  const content = JSON.parse(call.messages[1].content);
  assert.equal(content.originalRequest, input.prompt); assert.deepEqual(Object.keys(content), ["originalRequest"]);
  assert.equal("businessContext" in content, false);
  assert.equal("businessProfile" in claims.at(-1).p_input, false);
  assert.equal(records.get(owner + ":" + key).input.prompt, input.prompt);
  assert.equal((await handle(post(input, key))).status, 200);
  assert.equal(providerCalls.length, before + 1);
});

test("owner separation and changed-request conflicts do not return another owner's suggestion", async () => {
  const key = crypto.randomUUID(); await handle(post(input, key)); const before = providerCalls.length;
  assert.equal((await handle(post({ ...input, prompt: "different" }, key))).status, 409);
  assert.equal(providerCalls.length, before);
  owner = "owner-b";
  assert.equal((await handle(post(input, key))).status, 200);
  assert.equal(providerCalls.length, before + 1);
  owner = "owner-a";
});

test("images/reference metadata, auth, malformed JSON and disabled rollout fail before provider calls", async () => {
  const before = providerCalls.length;
  for (const body of [{ ...input, images: ["data:image/png;base64,pixels"] }, { ...input, imageUrl: "https://secret.test/image.png" }, { ...input, businessContext: { businessName: "Never send this profile" } }, { ...input, slides: [{ selectedIndex: 2, referenceNumber: 4 }] }, "{"]) assert.equal((await handle(post(body))).status, 400);
  assert.equal((await handle(post(" ".repeat(32769)))).status, 413);
  authFails = true; assert.equal((await handle(post())).status, 403); authFails = false;
  process.env.EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED = "false";
  assert.equal((await handle(post())).status, 503);
  process.env.EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED = "true";
  assert.equal(providerCalls.length, before);
});

test("provider failure, daily limit and uncertain saving do not silently resubmit a paid request", async () => {
  providerFails = true; let key = crypto.randomUUID();
  assert.equal((await handle(post(input, key))).status, 502);
  let before = providerCalls.length;
  assert.equal((await handle(post(input, key))).status, 409); assert.equal(providerCalls.length, before);
  providerFails = false; claimFails = "prompt_daily_limit";
  assert.equal((await handle(post())).status, 429); assert.equal(providerCalls.length, before);
  claimFails = ""; saveFails = true; key = crypto.randomUUID();
  assert.equal((await handle(post(input, key))).status, 503);
  before = providerCalls.length; saveFails = false;
  assert.equal((await handle(post(input, key))).status, 409); assert.equal(providerCalls.length, before);
});
