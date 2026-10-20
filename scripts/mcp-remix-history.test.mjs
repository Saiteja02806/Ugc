import assert from "node:assert/strict";
import {after,beforeEach,mock,test} from "node:test";
const envKeys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","MCP_TEXT_REMIX_ENABLED","EXPLORE_TEXT_REMIX_ENABLED"],oldEnv=envKeys.map(k=>[k,process.env[k]]),oldFetch=globalThis.fetch;
Object.assign(process.env,{SUPABASE_URL:"https://history-fixture.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"offline-fixture-key",MCP_TEXT_REMIX_ENABLED:"false",EXPLORE_TEXT_REMIX_ENABLED:"false"});
mock.module("@/lib/ai-studio/server-access",{namedExports:{requireAIStudioProUser:async()=>{throw Error("History must not check creation access");}}});
mock.module("@/lib/billing/subscription-db",{namedExports:{getUserSubscription:async()=>{throw Error("History must not initialize/check credits");}}});
mock.module("@/lib/business-profiles/db",{namedExports:{getBusinessProfileForUser:async()=>{throw Error("History must not read business grounding");},isBusinessProfileOnboardingComplete:()=>false}});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const records=[{owner:"owner-a",request_key:id(4),status:"pending",created_at:"2026-10-12T14:00:00.000Z",updated_at:"2026-10-12T14:00:00.000Z"},
{owner:"owner-a",request_key:id(3),status:"completed",created_at:"2026-10-12T14:00:00.000Z",updated_at:"2026-10-12T14:02:00.000Z"},
{owner:"owner-a",request_key:id(2),status:"failed",created_at:"2026-10-12T13:00:00.000Z",updated_at:"2026-10-12T13:00:00.000Z"},
{owner:"owner-b",request_key:id(5),status:"completed",created_at:"2026-10-12T15:00:00.000Z",updated_at:"2026-10-12T15:00:00.000Z"}];
let requests=[],offline=false;
globalThis.fetch=async(input,init)=>{
  const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);requests.push(url);
  assert.equal(request.method,"GET");assert.equal(url.pathname,"/rest/v1/explore_text_remixes");
  assert.equal(url.searchParams.get("select"),"request_key,status,created_at,updated_at");assert.equal(url.searchParams.get("order"),"created_at.desc,request_key.desc");
  const owner=url.searchParams.get("user_id");assert.match(owner,/^eq\.owner-[ab]$/);
  if(offline)return Response.json({message:"private-storage-failure-detail"},{status:503});
  let rows=records.filter(row=>row.owner===owner.slice(3));
  const or=url.searchParams.get("or");
  if(or){const match=or.match(/^\(created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),request_key\.lt\.([0-9a-f-]+)\)\)$/);assert.ok(match,or);assert.equal(match[1],match[2]);
    rows=rows.filter(row=>row.created_at<match[1]||row.created_at===match[1]&&row.request_key<match[3]);}
  rows=rows.slice(0,Number(url.searchParams.get("limit")));
  return Response.json(rows.map(({owner,...row})=>row));
};
after(()=>{globalThis.fetch=oldFetch;for(const[k,v]of oldEnv){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
beforeEach(()=>{requests=[];offline=false;});
const {createMcpHandler,McpServer}=await import("@modelcontextprotocol/server");
const {registerReferenceMcpTools}=await import("../lib/mcp/reference-tools.ts");
const handler=createMcpHandler(()=>{const server=new McpServer({name:"history-fixture",version:"1"});registerReferenceMcpTools(server);return server;},{legacy:"stateless"});
let sequence=0;
async function call(args={},owner="owner-a",scopes=["jobs:read"]){
 const request=new Request("https://mcp.getugcpilot.com/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:++sequence,method:"tools/call",params:{name:"list_text_remixes",arguments:args}})});
 const response=await handler.fetch(request,{authInfo:{token:"fixture",clientId:"fixture",scopes,extra:{firebaseUid:owner}}});const text=await response.text(),line=text.split("\n").find(l=>l.startsWith("data: "));const body=JSON.parse(line?line.slice(6):text);return body.result??{isError:true,content:[{type:"text",text:JSON.stringify(body.error)}]};
}
test("actual PostgREST owner/keyset queries discover lost IDs across equal timestamps",async()=>{
 const first=(await call({limit:1})).structuredContent;assert.equal(first.items[0].request_key,id(4));assert.ok(first.next_cursor);
 const second=(await call({limit:1,cursor:first.next_cursor})).structuredContent;assert.equal(second.items[0].request_key,id(3));
 const third=(await call({limit:1,cursor:second.next_cursor})).structuredContent;assert.equal(third.items[0].request_key,id(2));assert.equal(third.next_cursor,null);
 assert.equal((await call({limit:1},"owner-b")).structuredContent.items[0].request_key,id(5));
 assert.ok(requests.every(url=>url.searchParams.get("user_id")));assert.equal(JSON.stringify(first).includes("businessContext"),false);
});
test("foreign and injected cursors, missing scope and oversized pages cannot read history",async()=>{
 const first=(await call({limit:1})).structuredContent;requests=[];
 for(const args of [{cursor:first.next_cursor},{cursor:Buffer.from(JSON.stringify({version:1,owner:"a".repeat(64),createdAt:"now),user_id.eq.owner-a",requestKey:id(1)})).toString("base64url")}])
  assert.equal((await call(args,"owner-b")).isError,true);
 assert.equal((await call({limit:51})).isError,true);assert.equal((await call({},"owner-a",["assets:read"])).isError,true);assert.equal(requests.length,0);
});
test("history outages are reported without leaking database details or submitting work",async()=>{
 offline=true;const result=await call();assert.equal(result.isError,true);const error=JSON.parse(result.content[0].text);assert.equal(error.code,"REMIX_UNAVAILABLE");assert.equal(error.retryable,true);assert.equal(JSON.stringify(result).includes("private-storage-failure-detail"),false);
});
