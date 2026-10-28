import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { REMIX_TEXT_SYSTEM_PROMPT } from "./remix-text-prompt.ts";
import { hookBrandRemixSystemPrompt } from "./hook-remix-brand-prompt.ts";

let owner, authError, source, profile, providerOutput, providerError, providerWait, providerCalls, providerOptions, providerRequest, readError, saveError, quotaError, reviewOutput, reviewError;
let creatorActorEmail = null;
const providerRequests=[],providerCallOptions=[];
const receipts = new Map(), queries = [], profileOwners = [];
const id = "00000000-0000-4000-8000-000000000001";
const originalSource = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "A better way to save your time", startMs: 0, endMs: 4000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => { if (authError) throw authError; return { uid: owner, email: creatorActorEmail, emailVerified: true }; } } });
mock.module("@/lib/business-profiles/db", { namedExports: { getBusinessProfileForUser: async uid => { profileOwners.push(uid); return profile; } } });
mock.module("./reference-text-store.ts", { namedExports: { getReferenceText: (ref, slide, format) => { if (ref !== (source?.referenceId ?? "hook-a") || slide !== null || format && format !== (source?.format ?? "hook")) throw new Error("Foreign source"); return source; } } });
mock.module("openai", { defaultExport: class OpenAI {
  constructor(options) { providerOptions = options; }
  chat = { completions: { parse: async (request,options) => { providerCalls++; providerRequest = request; providerRequests.push(request);providerCallOptions.push(options); if (providerWait) await providerWait; if (providerError) throw providerError; const reviewing=request.response_format?.json_schema?.name==="hook_remix_review"; if(reviewing&&reviewError)throw reviewError; return { choices: [{ message: { parsed: reviewing?reviewOutput:providerOutput } }] }; } } };
} });
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({
  from: table => {
    assert.equal(table, "explore_text_remixes"); const filters = {}; let update;
    const run = async () => {
      queries.push({ ...filters }); assert.ok(filters.user_id); assert.ok(filters.request_key);
      const row = receipts.get(JSON.stringify([filters.user_id, filters.request_key]));
      if (!update) return { data: row ?? null, error: readError };
      if (saveError && update.status === "completed") return { data: null, error: { message: "Unavailable save" } };
      if (row && (!filters.status || row.status === filters.status)) Object.assign(row, update);
      return { data: row ? { request_key: filters.request_key } : null, error: null };
    };
    const builder = { select: () => builder, eq: (k,v) => { filters[k] = v; return builder; }, update: value => { update = value; return builder; }, maybeSingle: run, single: run, then: (resolve,reject) => run().then(resolve,reject) };
    return builder;
  },
  rpc: async (name, input) => {
    assert.equal(name, "explore_claim_text_remix");
    if (quotaError) return { data: null, error: { message: "remix_daily_limit" } };
    const key = JSON.stringify([input.p_user_id, input.p_request_key]), row = receipts.get(key);
    if (row) return { data: { claimed: false, status: row.status, output: row.output_json, source: row.input_json.source }, error: null };
    receipts.set(key, { payload_hash: input.p_payload_hash, status: "pending", output_json: null, input_json: structuredClone(input.p_input) });
    return { data: { claimed: true }, error: null };
  },
}) } });
const { handleTextRemix, handleReferenceText } = await import("./remix-text-api.ts");
const envKeys = ["EXPLORE_TEXT_REMIX_ENABLED", "OPENAI_API_KEY", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "EXPLORE_HOOK_REMIX_REVIEW_ENABLED"], savedEnv = envKeys.map(k => [k, process.env[k]]);
after(() => { for (const [key,value] of savedEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
beforeEach(() => {
  creatorActorEmail = null;
  receipts.clear(); queries.length = 0; profileOwners.length = 0;
  owner = "owner-a"; authError = null; source = structuredClone(originalSource);
  profile = { id: "profile-a", profileVersion: 7, context: { businessName: "Acme", productSummary: "Calendar assistant", privateFact: "Owner only" } };
  providerOutput = { blocks: ["A better way to plan your time"], heading: "", body: "" };
  providerError = null; providerWait = null; providerCalls = 0; providerOptions = null; providerRequest = null; readError = null; saveError = false; quotaError = false;
  providerRequests.length=0;providerCallOptions.length=0;reviewError=null;
  reviewOutput={decision:"keep",output:structuredClone(providerOutput),checks:{meaning:"pass",sourceVoice:"pass",brand:"not_applicable",humanRoles:"not_applicable",grounding:"pass",instructions:"pass"},brandPolicy:"not_needed",namedToolEdits:[],reason:"The draft is acceptable."};
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="false";
  Object.assign(process.env, { EXPLORE_TEXT_REMIX_ENABLED: "true", OPENAI_API_KEY: "fixture-key", SUPABASE_URL: "https://fixture.test", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role" });
});
function request(extra = {}, key = id, headerKey = key) { return new Request("https://www.getugcpilot.com/api/explore/remix-text", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": headerKey }, body: JSON.stringify({ requestKey: key, referenceId: "hook-a", slideId: null, instructions: "Keep the structure", ...extra }) }); }
const row = () => receipts.get(JSON.stringify([owner,id]));

test("private creator Remix checks the pilot email before any receipt claim or AI call", async () => {
  source = { ...source, referenceId: "creator-account-1-01" };
  assert.equal((await handleTextRemix(request({ referenceId: source.referenceId }))).status, 404);
  assert.equal(providerCalls, 0); assert.equal(receipts.size, 0);
  creatorActorEmail = "vtu19403@veltech.edu.in";
  assert.equal((await handleTextRemix(request({ referenceId: source.referenceId }))).status, 200);
  assert.equal(providerCalls, 1); assert.equal(receipts.size, 1);
});

test("opt-in Hook review publishes only the reviewed correction and shares one immutable request",async()=>{
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="true";
  source={...source,blocks:[{text:"POV: how to use Claude for marketing",startMs:0,endMs:4000}]};
  profile.context={businessName:"UGCPilot",productSummary:"Marketing content"};
  providerOutput={blocks:["POV: how to use a marketing app for marketing"],heading:"",body:""};
  reviewOutput={...reviewOutput,decision:"revise",output:{...providerOutput,blocks:["POV: how to use UGCPilot for marketing"]},brandPolicy:"use_business_name",namedToolEdits:[{sourceName:"Claude",replacementName:"UGCPilot"}],checks:{...reviewOutput.checks,brand:"pass"}};
  const response=await handleTextRemix(request());assert.equal(response.status,200);
  assert.deepEqual((await response.json()).output,reviewOutput.output);
  assert.equal(providerCalls,2);assert.equal(providerOptions.maxRetries,0);assert.equal(row().input_json.qualityReviewVersion,3);
  const reviewInput=JSON.parse(providerRequests[1].messages[1].content);
  assert.deepEqual(reviewInput.draft,providerOutput);assert.deepEqual(reviewInput.businessFacts,profile.context);
  assert.match(providerRequests[1].messages[0].content,/DEFAULT TO KEEP/);
  assert.match(providerRequests[1].messages[0].content,/For marketing.*not a tautology/);
  assert.equal(providerRequests[1].reasoning_effort,"medium");
  assert.equal(providerOptions.timeout,35000);assert.ok(providerCallOptions[1].timeout>0&&providerCallOptions[1].timeout<=35000);
  source=null;profile=null;
  assert.equal((await handleTextRemix(request())).status,200);assert.equal(providerCalls,2,"Recovery never resubmits either phase");
});
test("review rejection never exposes the unreviewed draft or triggers a third call",async()=>{
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="true";
  reviewOutput={...reviewOutput,decision:"reject",checks:{...reviewOutput.checks,meaning:"fail"},output:{blocks:[],heading:"",body:""}};
  const response=await handleTextRemix(request());const body=await response.json();
  assert.equal(response.status,502);assert.equal(body.outcome,"failed");assert.equal(body.output,undefined);
  assert.equal(row().status,"failed");assert.equal(providerCalls,2);
  await handleTextRemix(request());assert.equal(providerCalls,2);
});
test("review transport failure preserves failed receipt and never falls back to the draft",async()=>{
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="true";reviewError=new Error("Unconfirmed provider result");
  const response=await handleTextRemix(request());assert.equal(response.status,502);
  assert.equal((await response.json()).output,undefined);assert.equal(row().status,"failed");assert.equal(providerCalls,2);
  await handleTextRemix(request());assert.equal(providerCalls,2);
});
test("an exhausted shared provider deadline never starts the paid reviewer",async()=>{
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="true";
  const originalNow=Date.now;let reads=0;
  Date.now=()=>reads++===0?1000:71001;
  try {
    const response=await handleTextRemix(request());assert.equal(response.status,502);
    assert.equal((await response.json()).output,undefined);assert.equal(row().status,"failed");assert.equal(providerCalls,1);
  }finally{Date.now=originalNow;}
});
test("enabling review does not regenerate an already completed single-pass receipt",async()=>{
  assert.equal((await handleTextRemix(request())).status,200);assert.equal(providerCalls,1);
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="true";profile=null;source=null;
  assert.equal((await handleTextRemix(request())).status,200);assert.equal(providerCalls,1);
});
test("review opt-in leaves Wall of Text on its original single-pass route",async()=>{
  process.env.EXPLORE_HOOK_REMIX_REVIEW_ENABLED="true";source={...source,format:"wall_text"};
  assert.equal((await handleTextRemix(request({format:"wall_text"}))).status,200);
  assert.equal(providerCalls,1);assert.equal(row().input_json.qualityReviewVersion,undefined);
});

test("Hook reference and new provider requests exclude the reviewed final-frame screen caption", async () => {
  source = { ...originalSource, referenceId: "explore-paired-hook-4585ee949081c4e5cd835cd3", blocks: [
    { text: "Computer Science students!!\nThis website is EVERYTHING", startMs: 0, endMs: 3067 },
    { text: "I used to think learning coding\nwould be so difficult", startMs: 3067, endMs: 3100 },
  ] };
  const original = structuredClone(source);
  const details = await (await handleReferenceText(new Request(`https://www.getugcpilot.com/api/explore/reference-text?referenceId=${source.referenceId}`))).json();
  assert.deepEqual(details.source.blocks, [{ ...source.blocks[0], endMs: 3100 }]);
  assert.equal(providerCalls, 0);
  const response = await handleTextRemix(request({ referenceId: source.referenceId, referenceBlocks: source.blocks.map(block => block.text) }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(providerRequest.messages[1].content).referenceText, [source.blocks[0].text]);
  assert.equal((await response.json()).source.blocks[0].endMs, 3100);
  assert.deepEqual(source, original);
  assert.equal(providerCalls, 1);
});

test("uses signed-in business context and exact saved source, then reuses its receipt", async () => {
  const response = await handleTextRemix(request()); assert.equal(response.status, 200);
  const result = await response.json(); assert.deepEqual(result.source, originalSource);
  const payload = JSON.parse(providerRequest.messages[1].content);
  assert.deepEqual(payload.referenceText, originalSource.blocks.map(b => b.text)); assert.deepEqual(payload.businessContext, profile.context);
  assert.deepEqual(profileOwners, ["owner-a"]); assert.equal(providerOptions.maxRetries, 0); assert.equal(providerOptions.timeout, 60000);
  assert.equal(row().status, "completed"); assert.equal(row().input_json.businessProfileVersion, 7);
  source = null; profile = null;
  assert.equal((await handleTextRemix(request())).status, 200); assert.equal(providerCalls, 1);
  assert.equal((await handleTextRemix(request({ instructions: "Changed" }))).status, 409); assert.equal(providerCalls, 1);
});

test("Claude-to-UGCPilot regression uses the supplied product name with Hook v9 and recovers saved v7 copy unchanged", async () => {
  source={...source,blocks:[{text:"POV: you finally understand\nhow to use Claude\nfor marketing",startMs:0,endMs:3800}]};
  profile.context={businessName:"UGCPilot",productSummary:"Marketing content for SaaS founders"};
  providerOutput={blocks:["POV: you finally understand\nhow to use UGCPilot\nfor marketing"],heading:"",body:""};
  const response=await handleTextRemix(request({instructions:""}));
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).output,providerOutput);
  assert.equal(row().input_json.promptVersion,9);
  assert.match(providerRequest.messages[0].content,/replace it with exact businessName/);
  assert.equal(JSON.parse(providerRequest.messages[1].content).businessContext.businessName,"UGCPilot");
  row().input_json.promptVersion=7;
  row().output_json={blocks:["POV: you finally understand\nhow to use a marketing app\nfor marketing"],heading:"",body:""};
  assert.deepEqual((await (await handleTextRemix(request({instructions:""}))).json()).output,row().output_json);
  assert.equal(providerCalls,1,"Historical receipts are recovered without rewriting or generating again");
});
for (const format of ["hook", "wall_text"]) {
  test(`${format}: provider receives its approved prompt with verbatim source and business context`, async () => {
    source = { ...structuredClone(originalSource), format, blocks: [{ text: "POV: you just found 100+ hook videos you can use for FREE 😭", startMs: 0, endMs: 4000 }] };
    profile.context = { businessName: "Acme", productSummary: "A library of 100+ free hook videos" };
    providerOutput = { blocks: ["POV: you just found 100+ hook videos you can use for FREE 🎉"], heading: "", body: "" };
    const response = await handleTextRemix(request({ format, instructions: "Match the excitement of finding free resources." }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.source, source, "The reference transcription keeps its original emoji");
    assert.deepEqual(result.output, providerOutput);
    const system = providerRequest.messages[0].content;
    assert.equal(providerRequest.reasoning_effort,"medium","Remix drafts use the user's selected reasoning effort");
    assert.equal(system, format === "hook" ? hookBrandRemixSystemPrompt(source, profile.context) : REMIX_TEXT_SYSTEM_PROMPT);
    if (format === "hook") {
      assert.match(system, /Keep human characters human/);
      assert.match(system, /copy it EXACTLY unchanged/);
    } else {
      assert.match(system, /replace or remove mismatched emojis/i);
      assert.match(system, /Honor explicit user requests to keep specific emojis or use no emojis/);
    }
    const payload = JSON.parse(providerRequest.messages[1].content);
    assert.equal(payload.format, format);
    assert.deepEqual(payload.referenceText, source.blocks.map(block => block.text));
    assert.deepEqual(payload.businessContext, profile.context);
    assert.equal(row().input_json.promptVersion, format === "hook" ? 9 : 2);
    // A saved result is recovered as-is, including receipts from earlier prompt versions.
    for (const version of [1, 2, 7]) {
      row().input_json.promptVersion = version;
      assert.deepEqual((await (await handleTextRemix(request({ format, instructions: "Match the excitement of finding free resources." }))).json()).output, providerOutput);
    }
    assert.equal(providerCalls, 1);
  });
}

test("authorization, rollout, source, context, size and client tampering fail before a paid call", async () => {
  authError = new FirebaseAuthRequestError("Sign in", 401); assert.equal((await handleTextRemix(request())).status, 401);
  authError = null; process.env.EXPLORE_TEXT_REMIX_ENABLED = "false"; assert.equal((await handleTextRemix(request())).status, 503);
  process.env.EXPLORE_TEXT_REMIX_ENABLED = "true";
  assert.equal((await handleTextRemix(request({}, id, "different"))).status, 400);
  assert.equal((await handleTextRemix(request({ businessContext: { businessName: "Injected" } }))).status, 400);
  assert.equal((await handleTextRemix(request({ referenceText: "Injected" }))).status, 400);
  assert.equal((await handleTextRemix(request({ slideId: "foreign-slide" }))).status, 400);
  source.status = "needs_review"; assert.equal((await handleTextRemix(request())).status, 409);
  source.status = "no_text"; source.blocks = [];
  assert.equal((await handleTextRemix(request())).status, 409);
  source = structuredClone(originalSource);
  source.status = "ready"; profile = null; assert.equal((await handleTextRemix(request())).status, 409);
  assert.equal((await handleTextRemix(request({ instructions: "x".repeat(9000) }))).status, 400);
  assert.equal((await handleTextRemix(request({ instructions: "x".repeat(33000) }))).status, 413);
  assert.equal(providerCalls, 0); assert.equal(receipts.size, 0);
});
test("same request in concurrent tabs claims the provider only once", async () => {
  let release; providerWait = new Promise(resolve => { release = resolve; });
  const first = handleTextRemix(request());
  while (!providerCalls) await new Promise(resolve => setImmediate(resolve));
  const second = await handleTextRemix(request()); assert.equal(second.status, 409); assert.equal((await second.json()).outcome, "uncertain");
  release(); assert.equal((await first).status, 200); assert.equal(providerCalls, 1);
});
test("failed, malformed and uncertain provider outcomes cannot silently resubmit", async () => {
  providerOutput = { blocks: ["x".repeat(500)], heading: "", body: "" };
  assert.equal((await handleTextRemix(request())).status, 502); assert.equal(row().status, "failed");
  assert.equal((await handleTextRemix(request())).status, 409); assert.equal(providerCalls, 1);
  receipts.clear(); providerOutput = { blocks: ["A better plan"], heading: "", body: "" }; saveError = true;
  const response = await handleTextRemix(request()); assert.equal(response.status, 503); assert.equal((await response.json()).outcome, "uncertain");
  assert.equal(row().status, "pending"); assert.equal((await handleTextRemix(request())).status, 409); assert.equal(providerCalls, 2);
});
test("account-scoped receipts, storage failures and quota never leak or duplicate calls", async () => {
  await handleTextRemix(request()); owner = "owner-b"; providerOutput = { blocks: ["A plan for owner B"], heading: "", body: "" };
  const other = await handleTextRemix(request()); assert.deepEqual((await other.json()).output, providerOutput); assert.equal(receipts.size, 2); assert.equal(providerCalls, 2);
  receipts.clear(); readError = { message: "Storage offline" }; assert.equal((await handleTextRemix(request())).status, 503); readError = null;
  quotaError = true; assert.equal((await handleTextRemix(request())).status, 429); assert.equal(providerCalls, 2);
  assert.ok(queries.every(q => q.user_id && q.request_key));
});
test("reference retrieval requires authorization and exact reference/slide association", async () => {
  const get = slide => handleReferenceText(new Request(`https://www.getugcpilot.com/api/explore/reference-text?referenceId=hook-a${slide ? "&slideId=" + slide : ""}`));
  const result = await (await get()).json();
  assert.deepEqual(result.source, source);
  assert.deepEqual(result.businessContext, { name: "Acme", ready: true });
  assert.equal(JSON.stringify(result).includes("Owner only"), false, "private business facts stay on the server");
  assert.deepEqual(profileOwners, ["owner-a"]);
  profile = null;
  assert.deepEqual((await (await get()).json()).businessContext, { name: null, ready: false });
  assert.equal((await get("foreign-slide")).status, 400);
  authError = new FirebaseAuthRequestError("Forbidden", 403); assert.equal((await get()).status, 403); assert.equal(providerCalls, 0);
});

test("reference readiness requires rollout, provider and receipt storage without calling AI", async () => {
  const get = async () => (await handleReferenceText(new Request("https://www.getugcpilot.com/api/explore/reference-text?referenceId=hook-a"))).json();
  assert.equal((await get()).enabled, true);
  for (const key of ["EXPLORE_TEXT_REMIX_ENABLED", "OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const value = process.env[key]; process.env[key] = "   ";
    const details = await get();
    assert.equal(details.enabled, false, `${key} must be configured`);
    assert.deepEqual(details.source, source, "Reviewed source text remains available");
    assert.deepEqual(details.businessContext, { name: "Acme", ready: true });
    process.env[key] = value;
  }
  delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal((await get()).enabled, false);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.test";
  assert.equal((await get()).enabled, true, "The existing URL fallback remains supported");
  delete process.env.OPENAI_API_KEY;
  assert.equal((await handleTextRemix(request())).status, 503);
  assert.equal(providerCalls, 0); assert.equal(receipts.size, 0);
});

test("edited reference copy is combined with the owner's saved business context and bound to its receipt", async () => {
  const edited = { format: "hook", referenceBlocks: ["Still juggling your daily tasks? Try a calmer way to plan."] };
  const response = await handleTextRemix(request(edited)); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source.referenceId, "hook-a"); assert.equal(result.source.blocks[0].text, edited.referenceBlocks[0]);
  assert.equal(result.source.blocks[0].endMs, 4000);
  const prompt = JSON.parse(providerRequest.messages[1].content);
  assert.deepEqual(prompt.referenceText, edited.referenceBlocks); assert.deepEqual(prompt.businessContext, profile.context);
  assert.equal((await handleTextRemix(request({ ...edited, referenceBlocks: ["Different idea"] }))).status, 409);
  assert.equal((await handleTextRemix(request(edited))).status, 200); assert.equal(providerCalls, 1);
});

test("custom details work without an extracted reference; blank, foreign and cross-format input cannot generate", async () => {
  const custom = { referenceId: null, format: "hook", referenceBlocks: ["I want a friendly opening about saving time with Acme."] };
  const setup = await handleReferenceText(new Request("https://www.getugcpilot.com/api/explore/reference-text?format=hook"));
  assert.deepEqual((await setup.json()).businessContext, { name: "Acme", ready: true });
  assert.equal((await handleTextRemix(request({ ...custom, referenceBlocks: [" "] }))).status, 400);
  assert.equal((await handleTextRemix(request({ ...custom, referenceBlocks: undefined }))).status, 400);
  assert.equal((await handleTextRemix(request({ ...custom, format: undefined }))).status, 400);
  assert.equal((await handleTextRemix(request({ ...custom, referenceId: "foreign" }))).status, 400);
  assert.equal((await handleTextRemix(request({ format: "wall_text", referenceBlocks: ["An idea" ] }))).status, 400);
  assert.equal(providerCalls, 0);
  const result = await (await handleTextRemix(request(custom))).json();
  assert.equal(result.source.referenceId, "manual:hook"); assert.equal(result.source.format, "hook");
  assert.deepEqual(JSON.parse(providerRequest.messages[1].content).referenceText, custom.referenceBlocks);
  assert.equal(providerCalls, 1);
});

test("user-written details can replace missing or unreviewed extraction without trusting OCR", async () => {
  for (const status of ["needs_review", "no_text"]) {
    receipts.clear(); source.status = status; source.blocks = status === "no_text" ? [] : originalSource.blocks;
    const result = await (await handleTextRemix(request({ format: "hook", referenceBlocks: ["My own reviewed details for this product."] }))).json();
    assert.equal(result.ok, true); assert.equal(result.source.model, "user-text");
    assert.equal(result.source.blocks[0].text, "My own reviewed details for this product.");
  }
  source = null; receipts.clear(); providerOutput={blocks:["A new product idea"],heading:"",body:""};
  assert.equal((await handleTextRemix(request({ format: "hook", referenceBlocks: ["An idea for this product"] }))).status, 200);
});


test("new Hook length overflow fails once and never rewrites an existing receipt or retries", async () => {
  source={...source,blocks:[{text:"Wait, this works?",startMs:0,endMs:4000}]};
  providerOutput={blocks:["Wait, UGCPilot creates all these marketing videos automatically?"],heading:"",body:""};
  const response=await handleTextRemix(request({instructions:""}));assert.equal(response.status,502);
  assert.equal(row().status,"failed");assert.equal(providerCalls,1);
  await handleTextRemix(request({instructions:""}));assert.equal(providerCalls,1);
});

test("manual Hook uses shared v9 KEEP and source-length budget without changing generic copy",async()=>{
  source={...source,blocks:[{text:"Wait… this was possible the whole time??",startMs:0,endMs:4000}]};
  providerOutput={blocks:[source.blocks[0].text],heading:"",body:""};
  const response=await handleTextRemix(request({instructions:""}));assert.equal(response.status,200);
  assert.equal(row().input_json.promptVersion,9);
  assert.equal(providerRequest.messages[0].content,hookBrandRemixSystemPrompt(source,profile.context));
  assert.deepEqual((await response.json()).output,providerOutput);assert.equal(providerCalls,1);
});
