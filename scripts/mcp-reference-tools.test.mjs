import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";

let owner, authError, source, profile, providerOutput, providerError, providerWait, providerCalls, providerOptions, providerRequest, readError, saveError, quotaError;
const receipts = new Map(), queries = [], profileOwners = [];
const id = "00000000-0000-4000-8000-000000000001";
const originalSource = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "A better way to save your time", startMs: 0, endMs: 4000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => { if (authError) throw authError; return { uid: owner }; } } });
mock.module("@/lib/business-profiles/db", { namedExports: { isBusinessProfileOnboardingComplete: () => true, getBusinessProfileForUser: async uid => { profileOwners.push(uid); return profile; } } });
mock.module("@/lib/explore/reference-text-store", { namedExports: { getReferenceText: (ref, slide, format) => { if (ref !== "hook-a" || slide !== null || format && format !== "hook") throw new Error("Foreign source"); return source; } } });
mock.module("openai", { defaultExport: class OpenAI {
  constructor(options) { providerOptions = options; }
  chat = { completions: { parse: async request => { providerCalls++; providerRequest = request; if (providerWait) await providerWait; if (providerError) throw providerError; return { choices: [{ message: { parsed: providerOutput } }] }; } } };
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
const { handleTextRemix } = await import("../lib/explore/remix-text-api.ts");
const envKeys = ["EXPLORE_TEXT_REMIX_ENABLED", "OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MCP_TEXT_REMIX_ENABLED"], savedEnv = envKeys.map(k => [k, process.env[k]]);
after(() => { for (const [key,value] of savedEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
beforeEach(() => {
  receipts.clear(); queries.length = 0; profileOwners.length = 0;
  owner = "owner-a"; authError = null; source = structuredClone(originalSource);
  profile = { id: "profile-a", profileVersion: 7, context: { businessName: "Acme", productSummary: "Calendar assistant", privateFact: "Owner only" } };
  providerOutput = { blocks: ["A better way to plan your time"], heading: "", body: "" };
  providerError = null; providerWait = null; providerCalls = 0; providerOptions = null; providerRequest = null; readError = null; saveError = false; quotaError = false;
  Object.assign(process.env, { EXPLORE_TEXT_REMIX_ENABLED: "true", MCP_TEXT_REMIX_ENABLED:"true", OPENAI_API_KEY: "fixture-key", SUPABASE_URL: "https://fixture.test", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role" });
});
function request(extra = {}, key = id, headerKey = key) { return new Request("https://www.getugcpilot.com/api/explore/remix-text", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": headerKey }, body: JSON.stringify({ requestKey: key, referenceId: "hook-a", slideId: null, instructions: "Keep the structure", ...extra }) }); }
const row = () => receipts.get(JSON.stringify([owner,id]));


let allowed=true, planError=false, initializationNeeded=false, allowanceInitializations=0;
const planReads=[];
mock.module("@/lib/billing/subscription-db",{ namedExports:{ getUserSubscription:async(uid,options) => {
  planReads.push({uid,options}); if (planError) throw Error("fixture-plan-error");
  if (options.initializeFreeCredits && initializationNeeded) { allowanceInitializations++; initializationNeeded=false; return {isActive:false,freeGenerationCredits:{granted:2}}; }
  return {isActive:allowed,freeGenerationCredits:{granted:0}};
} }});
let catalogue;
const hook={ id:"hook-a",format:"hook",title:"Hook for planning",category:null,categoryLabel:null,posterUrl:"https://cdn.example.test/poster.jpg",videoUrl:"https://cdn.example.test/"+"a".repeat(64)+".mp4",slides:[],durationSeconds:4,
  pairedAudio:{title:"Supplied track",url:"https://cdn.example.test/track.mp3",durationSeconds:12} };
const slideshow={ ...hook,id:"slide-a",format:"slideshow",title:"Planning slides",category:"productivity",categoryLabel:"Productivity",videoUrl:undefined,pairedAudio:undefined,slides:[{id:"slide-1",url:"https://cdn.example.test/slide.jpg",width:1080,height:1920}] };
mock.module("@/lib/explore/recreate-catalog",{namedExports:{getRecreateReferences:()=>catalogue}});
const { createMcpHandler, McpServer }=await import("@modelcontextprotocol/server");
const { registerReferenceMcpTools, registeredReferenceMcpTools }=await import("../lib/mcp/reference-tools.ts");
const handler=createMcpHandler(()=>{const server=new McpServer({name:"reference-fixture",version:"1.0.0"});registerReferenceMcpTools(server);return server;},{legacy:"stateless"});
let callId=0;
async function rpc(method,params,scopes=["account:read","assets:read","creative:write","jobs:read"],uid=owner) {
  const request=new Request("https://mcp.getugcpilot.com/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:++callId,method,params})});
  const response=await handler.fetch(request,{authInfo:{token:"fixture-not-a-real-token",clientId:"fixture-client",scopes,extra:{firebaseUid:uid}}});
  const text=await response.text(),line=text.split("\n").find(l=>l.startsWith("data: "));return JSON.parse(line?line.slice(6):text);
}
async function call(name,args={},scopes,uid) {const body=await rpc("tools/call",{name,arguments:args},scopes,uid);return body.result??{isError:true,content:[{type:"text",text:JSON.stringify(body.error)}]};}
function error(result){assert.equal(result.isError,true,JSON.stringify(result));try { return JSON.parse(result.content[0].text); } catch { return {message:result.content[0].text}; }}
const input=()=>({requestKey:id,referenceId:"hook-a",slideId:null,instructions:"Keep the structure"});
beforeEach(()=>{allowed=true;planError=false;initializationNeeded=false;allowanceInitializations=0;planReads.length=0;catalogue=[structuredClone(hook),structuredClone(slideshow)];});

test("actual MCP discovery declares six scoped tools and the provider write",async()=>{
  const discovered=(await rpc("tools/list",{})).result.tools;
  assert.deepEqual(discovered.map(t=>t.name).sort(),[...registeredReferenceMcpTools].sort());
  for(const tool of discovered){assert.equal(tool._meta.securitySchemes[0].type,"oauth2");assert.equal(tool._meta.securitySchemes[0].scopes.length,1);assert.equal(tool.annotations.readOnlyHint,tool.name!=="remix_reference_text");}
  const write=discovered.find(t=>t.name==="remix_reference_text");assert.equal(write.annotations.idempotentHint,true);assert.equal(write.annotations.openWorldHint,true);
  error(await call("remix_reference_text",input(),["assets:read"]));assert.equal(providerCalls,0);assert.equal(receipts.size,0);
});
test("capabilities are pure reads, report real gates and omit private facts",async()=>{
  const result=(await call("get_reference_capabilities")).structuredContent;assert.equal(result.remix_available,true);assert.equal(result.daily_request_limit,20);
  assert.equal(JSON.stringify(result).includes("Owner only"),false);assert.equal(receipts.size,0);assert.equal(providerCalls,0);
  assert.deepEqual(planReads[0],{uid:"owner-a",options:{strict:true,refreshCredits:false,initializeFreeCredits:false}});
  process.env.MCP_TEXT_REMIX_ENABLED="false";assert.equal((await call("get_reference_capabilities")).structuredContent.remix_available,false);
  allowed=false;assert.equal((await call("get_reference_capabilities")).structuredContent.text_access,"initialization_required");
  planError=true;assert.equal(error(await call("get_reference_capabilities")).code,"ENTITLEMENTS_UNAVAILABLE");
});
test("catalogue pagination is complete and binds filters and published media snapshot",async()=>{
  const first=(await call("list_references",{limit:1})).structuredContent;assert.equal(first.total,2);assert.equal(first.items[0].paired_audio.title,"Supplied track");
  const next=(await call("list_references",{limit:1,cursor:first.next_cursor})).structuredContent;assert.equal(next.items[0].slides[0].id,"slide-1");assert.equal(next.next_cursor,null);
  assert.equal(error(await call("list_references",{cursor:first.next_cursor,format:"hook"})).code,"INVALID_CURSOR");
  catalogue[0].videoUrl="https://cdn.example.test/changed.mp4";assert.equal(error(await call("list_references",{cursor:first.next_cursor})).code,"INVALID_CURSOR");
  assert.equal((await call("list_references",{query:"Planning",category:"productivity"})).structuredContent.total,1);
  error(await call("list_references",{cursor:"!invalid"}));error(await call("list_references",{limit:51}));
  assert.equal(providerCalls,0);assert.equal(receipts.size,0);assert.equal(planReads.length,0);
});
test("reference detail preserves reviewed timed text and refuses foreign slide/reference choices",async()=>{
  const detail=(await call("get_reference",{reference_id:"hook-a"})).structuredContent;assert.deepEqual(detail.source,originalSource);assert.equal(detail.text_status,"ready");
  assert.equal((await call("get_reference",{reference_id:"slide-a"})).structuredContent.text_status,"slide_required");
  assert.equal(error(await call("get_reference",{reference_id:"hook-a",slide_id:"slide-1"})).code,"INVALID_INPUT");
  assert.equal(error(await call("get_reference",{reference_id:"slide-a",slide_id:"foreign"})).code,"INVALID_INPUT");
  assert.equal(error(await call("get_reference",{reference_id:"foreign"})).code,"NOT_FOUND");
  source.status="needs_review";assert.equal((await call("get_reference",{reference_id:"hook-a"})).structuredContent.text_status,"needs_review");
  source=null;assert.equal((await call("get_reference",{reference_id:"hook-a"})).structuredContent.text_status,"not_prepared");
  allowed=false;assert.equal(error(await call("get_reference",{reference_id:"hook-a"})).code,"ACCESS_REQUIRED");assert.equal(providerCalls,0);
});
test("website and MCP use the same owner claim and exact receipt in both directions",async()=>{
  assert.equal((await handleTextRemix(request())).status,200);
  const replay=(await call("remix_reference_text",input())).structuredContent;assert.deepEqual(replay.output,providerOutput);assert.equal(providerCalls,1);
  assert.equal(error(await call("remix_reference_text",{...input(),instructions:"Different"})).code,"REMIX_CONFLICT");assert.equal(providerCalls,1);
  receipts.clear();providerCalls=0;
  assert.equal((await call("remix_reference_text",input())).structuredContent.outcome,"completed");assert.equal((await handleTextRemix(request())).status,200);assert.equal(providerCalls,1);
  const saved=(await call("get_text_remix",{request_key:id})).structuredContent;assert.equal(saved.source.blocks[0].text,originalSource.blocks[0].text);
  assert.equal(JSON.stringify(saved).includes("Owner only"),false);assert.equal(providerOptions.maxRetries,0);
});
test("concurrent uncertain submissions and status reads never submit twice",async()=>{
  let release;providerWait=new Promise(resolve=>{release=resolve;});const first=call("remix_reference_text",input());
  while(!providerCalls)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await call("remix_reference_text",input())).structuredContent.outcome,"uncertain");
  assert.equal((await call("get_text_remix",{request_key:id})).structuredContent.outcome,"uncertain");assert.equal(providerCalls,1);
  release();assert.equal((await first).structuredContent.outcome,"completed");
});
test("saved reads survive gate/plan/provider changes without checking access or requeuing",async()=>{
  await call("remix_reference_text",input());planReads.length=0;allowed=false;process.env.MCP_TEXT_REMIX_ENABLED="false";process.env.EXPLORE_TEXT_REMIX_ENABLED="false";delete process.env.OPENAI_API_KEY;
  const saved=(await call("get_text_remix",{request_key:id})).structuredContent;assert.equal(saved.outcome,"completed");assert.equal(planReads.length,0);assert.equal(providerCalls,1);
  assert.equal(error(await call("get_text_remix",{request_key:id},undefined,"owner-b")).code,"NOT_FOUND");
  assert.ok(queries.every(q=>q.user_id&&q.request_key));
});
test("invalid/manual/reference/oversized inputs and quota fail before provider calls",async()=>{
  error(await call("remix_reference_text",{...input(),businessContext:{businessName:"Injected"}}));
  error(await call("remix_reference_text",{...input(),referenceId:"https://arbitrary.example.test"}));
  error(await call("remix_reference_text",{...input(),referenceBlocks:["x".repeat(6001)]}));
  error(await call("remix_reference_text",{...input(),format:"wall_text"}));
  source.status="needs_review";error(await call("remix_reference_text",input()));source=structuredClone(originalSource);
  quotaError=true;assert.equal(error(await call("remix_reference_text",input())).code,"RATE_LIMITED");assert.equal(providerCalls,0);
});
test("requested manual copy shares website validation and saved business grounding",async()=>{
  const result=(await call("remix_reference_text",{...input(),referenceId:null,format:"hook",referenceBlocks:["Try calmer planning"]})).structuredContent;
  assert.equal(result.outcome,"completed");assert.equal(result.source.referenceId,"manual:hook");
  assert.deepEqual(JSON.parse(providerRequest.messages[1].content).businessContext,profile.context);assert.equal(providerCalls,1);
});
test("corrupt completed receipts and failed provider calls are terminal without silent retry",async()=>{
  await call("remix_reference_text",input());row().output_json={blocks:["x".repeat(500)],heading:"",body:""};
  assert.equal((await call("get_text_remix",{request_key:id})).structuredContent.outcome,"uncertain");assert.equal(providerCalls,1);
  receipts.clear();providerError=Error("fixture-provider-failure");
  assert.equal((await call("remix_reference_text",input())).structuredContent.outcome,"failed");
  assert.equal((await call("get_text_remix",{request_key:id})).structuredContent.outcome,"failed");
  await call("remix_reference_text",input());assert.equal(providerCalls,2);
});

test("first intended remix initializes the website allowance; capability/history reads never do",async()=>{
  allowed=false;initializationNeeded=true;
  const capability=(await call("get_reference_capabilities")).structuredContent;
  assert.equal(capability.text_access,"initialization_required");assert.equal(capability.remix_available,true);assert.equal(capability.quota_window_hours,24);
  assert.equal(allowanceInitializations,0);assert.equal(providerCalls,0);
  const submitted=(await call("remix_reference_text",input())).structuredContent;assert.equal(submitted.outcome,"completed");assert.equal(allowanceInitializations,1);assert.equal(providerCalls,1);
  const readsBefore=planReads.length;await call("get_text_remix",{request_key:id});assert.equal(allowanceInitializations,1);assert.equal(planReads.length,readsBefore);
  assert.ok(planReads.some(r=>r.options.initializeFreeCredits===true&&r.options.refreshCredits===false));
});
