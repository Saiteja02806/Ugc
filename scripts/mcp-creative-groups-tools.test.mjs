import assert from "node:assert/strict";
import {after,beforeEach,afterEach,mock,test} from "node:test";
import {fixture} from "./mcp-creative-groups-fixture.mjs";
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let h,requests=[],loseAck=false,offline=false;
const oldFetch=globalThis.fetch,envKeys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","MCP_CREATIVE_GROUPS_ENABLED"],savedEnv=envKeys.map(k=>[k,process.env[k]]);
Object.assign(process.env,{SUPABASE_URL:"https://creative-group-fixture.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"offline-fixture-key",MCP_CREATIVE_GROUPS_ENABLED:"true"});
mock.module("../lib/media/media-storage.ts",{namedExports:{listMediaAssetsPage:async()=>{throw Error("Unexpected generic listing");},getMediaAssetForOwner:async({userId,assetId})=>{
 const{rows}=await h.db.query("select * from public.media_assets where id=$1 and user_id=$2 and deleted_at is null",[assetId,userId]);return rows[0]?{...rows[0],title:"Owned fixture"}:null;
}}});
globalThis.fetch=async(input,init)=>{
 const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);requests.push({path:url.pathname,method:request.method,query:url.search});
 assert.equal(url.hostname,"creative-group-fixture.supabase.co");
 if(offline)return Response.json({message:"private-fixture-database-detail"},{status:503});
 if(url.pathname.includes("/rpc/")){
  assert.equal(request.method,"POST");const p=await request.json();let data;
  try{
   if(url.pathname.endsWith("/mcp_mutate_creative_asset_group"))data=await h.mutate(p.p_user_id,p.p_request_id,p.p_operation,p.p_input);
   else if(url.pathname.endsWith("/mcp_read_creative_asset_group"))data=await h.snapshot(p.p_user_id,p.p_group_id);
   else throw Error("Unknown RPC");
  }catch(error){return Response.json({message:error.message,code:error.code},{status:400});}
  if(loseAck&&url.pathname.endsWith("/mcp_mutate_creative_asset_group")){loseAck=false;throw Error("Fixture lost acknowledgement after commit");}
  return Response.json(data);
 }
 const table=url.pathname.split("/").at(-1),definitions={
  creative_asset_groups:{cols:["id","name","media_type","created_at","updated_at"],time:"updated_at",key:"id"},
  creative_asset_group_items:{cols:["media_asset_id","created_at"],time:"created_at",key:"media_asset_id"},
  mcp_creative_group_requests:{cols:["request_id","operation","created_at","result_json"],time:"created_at",key:"request_id"},
 };
 assert.equal(request.method,"GET");const def=definitions[table];assert.ok(def,table);
 const columns=url.searchParams.get("select").split(",");assert.ok(columns.every(c=>def.cols.includes(c)));
 const owner=url.searchParams.get("user_id");assert.match(owner,/^eq\.owner-[ab]$/);
 const params=[owner.slice(3)],clauses=["user_id=$1"];
 for(const key of ["id","group_id","request_id","media_type"]){const value=url.searchParams.get(key);if(value){assert.ok(value.startsWith("eq."));params.push(value.slice(3));clauses.push(`${key}=$${params.length}`);}}
 const or=url.searchParams.get("or");if(or){const pattern=new RegExp(`^\\(${def.time}\\.lt\\.([^,]+),and\\(${def.time}\\.eq\\.([^,]+),${def.key}\\.lt\\.([0-9a-f-]+)\\)\\)$`);const m=or.match(pattern);assert.ok(m,or);assert.equal(m[1],m[2]);params.push(m[1],m[3]);clauses.push(`(${def.time}<$${params.length-1} or (${def.time}=$${params.length-1} and ${def.key}<$${params.length}))`);}
 const order=url.searchParams.get("order");if(order)assert.equal(order,`${def.time}.desc,${def.key}.desc`);
 let sql=`select ${columns.join(",")} from public.${table} where ${clauses.join(" and ")}`;
 if(order)sql+=` order by ${def.time} desc,${def.key} desc`;
 const limit=url.searchParams.get("limit");if(limit){assert.ok(Number(limit)<=51);params.push(Number(limit));sql+=` limit $${params.length}`;}
 const{rows}=await h.db.query(sql,params);const data=request.headers.get("accept")?.includes("object")?rows[0]??null:rows;
 return Response.json(data);
};
beforeEach(async()=>{h=await fixture();requests=[];loseAck=false;offline=false;process.env.MCP_CREATIVE_GROUPS_ENABLED="true";});
afterEach(async()=>{await h.db.close();});after(()=>{globalThis.fetch=oldFetch;for(const[k,v]of savedEnv){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
const{McpServer,createMcpHandler}=await import("@modelcontextprotocol/server");
const{registerCreativeGroupMcpTools,registeredCreativeGroupMcpTools}=await import("../lib/mcp/creative-group-tools.ts");
const handler=createMcpHandler(()=>{const s=new McpServer({name:"group-fixture",version:"1"});registerCreativeGroupMcpTools(s);return s;},{legacy:"stateless"});
let sequence=0;
async function rpc(method,params,owner="owner-a",scopes=["account:read","assets:read","assets:write"]){const request=new Request("https://mcp.getugcpilot.com/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:++sequence,method,params})});
 const response=await handler.fetch(request,{authInfo:{token:"offline-fixture",clientId:"fixture",scopes,extra:{firebaseUid:owner}}});const text=await response.text(),line=text.split("\n").find(l=>l.startsWith("data: "));return JSON.parse(line?line.slice(6):text);}
async function call(name,args={},owner,scopes){const body=await rpc("tools/call",{name,arguments:args},owner,scopes);return body.result??{isError:true,content:[{type:"text",text:JSON.stringify(body.error)}]};}
function error(r){assert.equal(r.isError,true,JSON.stringify(r));try{return JSON.parse(r.content[0].text);}catch{return{message:r.content[0].text};}}
async function create(key=id(1),name="My group"){return(await call("create_asset_group",{request_id:key,name,media_type:"image"})).structuredContent;}
async function state(group=id(1)){return(await call("get_asset_group",{group_id:group})).structuredContent;}
test("actual MCP discovery declares eleven scoped tools and pure disabled capabilities",async()=>{
 const tools=(await rpc("tools/list",{})).result.tools;assert.deepEqual(tools.map(t=>t.name).sort(),[...registeredCreativeGroupMcpTools].sort());
 for(const tool of tools){assert.equal(tool._meta.securitySchemes[0].scopes.length,1);assert.equal(tool.annotations.openWorldHint,false);if(tool.name.includes("request"))assert.equal(tool.annotations.readOnlyHint,true);}
 process.env.MCP_CREATIVE_GROUPS_ENABLED="false";const cap=(await call("get_asset_group_capabilities")).structuredContent;assert.equal(cap.write_enabled,false);assert.equal(cap.storage_configured,true);assert.equal(cap.schema_verification_required,true);assert.equal(cap.deleting_group_preserves_media,true);assert.equal(requests.length,0);
 error(await call("create_asset_group",{request_id:id(1),name:"x",media_type:"image"}));assert.equal(requests.length,0);
});
test("create/replay and rename share application records and preserve later website edits",async()=>{
 const accepted=await create();assert.equal(accepted.receipt.group_id,id(1));assert.equal((await create()).replayed,true);
 const current=await state();const args={request_id:id(2),group_id:id(1),expected_revision:current.revision,name:"Agent name"};
 assert.equal((await call("rename_asset_group",args)).structuredContent.receipt.state.group.name,"Agent name");
 await h.db.query("update public.creative_asset_groups set name='Website later' where id=$1",[id(1)]);
 assert.equal((await call("rename_asset_group",args)).structuredContent.replayed,true);assert.equal((await state()).group.name,"Website later");
 assert.equal(error(await call("rename_asset_group",{...args,request_id:id(3)})).code,"GROUP_CONFLICT");
});
test("atomic full-batch membership has owner/type/visibility guards and exact revision",async()=>{
 await create();const args={request_id:id(2),group_id:id(1),expected_revision:(await state()).revision,asset_ids:[id(100),id(102)]};
 assert.equal(error(await call("add_assets_to_group",args)).code,"ASSET_UNAVAILABLE");assert.equal((await state()).member_count,0);
 const added=(await call("add_assets_to_group",{...args,asset_ids:[id(100),id(101)]})).structuredContent;assert.equal(added.receipt.changed_count,2);
 assert.equal(error(await call("remove_assets_from_group",{...args,request_id:id(3),asset_ids:[id(100)]})).code,"GROUP_CONFLICT");
 error(await call("add_assets_to_group",{...args,request_id:id(4),asset_ids:[id(100),id(100)]}));
});
test("membership paging and availability preserve IDs while hiding deleted metadata",async()=>{
 await create();await call("add_assets_to_group",{request_id:id(2),group_id:id(1),expected_revision:(await state()).revision,asset_ids:[id(100),id(101)]});
 await h.db.query("update public.media_assets set deleted_at=now() where id=$1",[id(101)]);
 const args={group_id:id(1),expected_revision:(await state()).revision,limit:1},first=(await call("list_asset_group_items",args)).structuredContent;
 assert.equal(first.items.length,1);assert.ok(first.next_cursor);
 const second=(await call("list_asset_group_items",{...args,cursor:first.next_cursor})).structuredContent;
 assert.equal(second.next_cursor,null);const unavailable=[...first.items,...second.items].find(i=>!i.available);assert.equal(unavailable.title,null);assert.equal(unavailable.asset_id,id(101));
 assert.equal(error(await call("list_asset_group_items",{...args,cursor:first.next_cursor},"owner-b")).code,"NOT_FOUND");
});
test("lost acknowledged commits recover after gates close; history discovers immutable receipts",async()=>{
 loseAck=true;error(await call("create_asset_group",{request_id:id(1),name:"My group",media_type:"image"}));
 process.env.MCP_CREATIVE_GROUPS_ENABLED="false";
 const saved=(await call("get_asset_group_request",{request_id:id(1)})).structuredContent;assert.equal(saved.receipt.group_id,id(1));
 const history=(await call("list_asset_group_requests",{limit:1})).structuredContent;assert.equal(history.items[0].request_id,id(1));
 assert.equal(error(await call("get_asset_group_request",{request_id:id(1)},"owner-b")).code,"NOT_FOUND");
 assert.equal(Number((await h.db.query("select count(*) from public.creative_asset_groups")).rows[0].count),1);
});
test("list groups/history uses account-bound cursor and equal timestamp keysets",async()=>{
 await create(id(1),"First");await create(id(2),"Second");const first=(await call("list_asset_groups",{media_type:"image",limit:1})).structuredContent;
 assert.ok(first.next_cursor);const second=(await call("list_asset_groups",{media_type:"image",limit:1,cursor:first.next_cursor})).structuredContent;assert.equal(second.next_cursor,null);assert.notEqual(first.items[0].id,second.items[0].id);
 assert.equal(error(await call("list_asset_groups",{media_type:"video",cursor:first.next_cursor})).code,"INVALID_CURSOR");
 const history=(await call("list_asset_group_requests",{limit:1})).structuredContent;assert.ok(history.next_cursor);assert.equal(error(await call("list_asset_group_requests",{cursor:history.next_cursor},"owner-b")).code,"INVALID_CURSOR");
 assert.equal((await call("list_asset_group_requests",{limit:1,cursor:history.next_cursor})).structuredContent.next_cursor,null);
});
test("delete group removes links while retaining all media; replay never recreates or reapplies",async()=>{
 await create();await call("add_assets_to_group",{request_id:id(2),group_id:id(1),expected_revision:(await state()).revision,asset_ids:[id(100)]});
 const args={request_id:id(3),group_id:id(1),expected_revision:(await state()).revision};assert.equal((await call("delete_asset_group",args)).structuredContent.receipt.group_exists,false);
 assert.equal((await call("delete_asset_group",args)).structuredContent.replayed,true);assert.equal(error(await call("get_asset_group",{group_id:id(1)})).code,"NOT_FOUND");
 assert.equal(Number((await h.db.query("select count(*) from public.media_assets")).rows[0].count),6);
});
test("missing scopes and forged caller fields cannot reach storage; outages do not leak secrets",async()=>{
 error(await call("create_asset_group",{request_id:id(1),name:"x",media_type:"image"},"owner-a",["assets:read"]));
 error(await call("create_asset_group",{request_id:id(1),name:"x",media_type:"image",user_id:"owner-b"}));assert.equal(requests.length,0);
 offline=true;const failure=await call("list_asset_groups",{media_type:"image"});assert.equal(error(failure).code,"LIBRARY_UNAVAILABLE");assert.equal(JSON.stringify(failure).includes("private-fixture-database-detail"),false);
});
