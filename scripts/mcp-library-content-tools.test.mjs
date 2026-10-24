import assert from "node:assert/strict";
import {after,beforeEach,afterEach,mock,test} from "node:test";
import { confirmToolResult } from "./mcp-confirm-client.mjs";
import {fixture,id} from "./mcp-library-content-fixture.mjs";
let h,requests=[],loseAck=false,sourceUnavailable=false,planAllowed=true,prepareCalls=0;
const envKeys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MCP_LIBRARY_WRITES_ENABLED','EXPLORE_SLIDESHOW_SAVING_ENABLED'],oldEnv=envKeys.map(k=>[k,process.env[k]]),oldFetch=globalThis.fetch;
Object.assign(process.env,{SUPABASE_URL:'https://library-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'offline-fixture',MCP_LIBRARY_WRITES_ENABLED:'true',EXPLORE_SLIDESHOW_SAVING_ENABLED:'true'});
mock.module('../lib/library/save-source.ts',{namedExports:{LibraryContentError:class extends Error{},prepareGeneratedCarouselLibrarySaveForOwner:async(owner,key)=>{
 prepareCalls++;if(sourceUnavailable)throw Error('fixture source no longer available');assert.equal(owner,'owner-a');assert.equal(key,id(100));
 return {userId:owner,title:'Shared ready edit',generation:{id:key,projectId:'project-a',businessProfileId:null,businessProfileVersion:null,candidateIndex:0,categorySlug:'test',generationBatchId:null,generationSource:'manual',selectedAngle:'Shared ready edit'},
   edit:{id:id(400),revision:2,slides:[1,2].map(slideNumber=>({slideNumber,textPosition:{x:.4,y:.6}}))},
   slides:[101,102].map((n,index)=>({id:id(n),carouselGenerationId:key,slideNumber:index+1,slideType:'image',headline:'Edited heading',subtext:'Edited body',ctaText:null,imageDirection:null,layoutPreset:null,textPosition:'center',renderedUrl:`https://trusted.test/edited-${n}.png`,renderedS3Key:`edited/${n}`}))};
}}});
mock.module('../lib/explore/slideshow-api.ts',{namedExports:{prepareSlideshowSaveForOwner:async(owner,input)=>{
 prepareCalls++;assert.equal(owner,'owner-a');return {p_user_id:owner,p_request_key:input.requestKey,p_fingerprint:'a'.repeat(64),p_title:'My slideshow',p_metadata:{referenceId:input.referenceId,slideshowDraftVersion:2},p_slides:input.slides.map((s,index)=>({slideNumber:index+1,mediaAssetId:s.mediaAssetId,referenceSlideId:s.referenceSlideId,renderedUrl:`https://trusted.test/${s.mediaAssetId}.png`}))};
}}});
mock.module('../lib/billing/subscription-db.ts',{namedExports:{getUserSubscription:async()=>({isActive:planAllowed,freeGenerationCredits:{granted:0}})}});
globalThis.fetch=async(input,init)=>{
 const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);requests.push({path:url.pathname,method:request.method});assert.equal(url.hostname,'library-fixture.supabase.co');
 if(url.pathname.includes('/rpc/')) {
   const p=await request.json(),name=url.pathname.split('/').at(-1);let data;
   try {
     if(name==='mcp_read_library_item')data=await h.state(p.p_user_id,p.p_item_id);
     else if(name==='mcp_library_source_revision')data=await h.source(p.p_user_id,p.p_source_id);
     else if(name==='mcp_library_destination')data=await h.destination(p.p_user_id,p.p_source_id);
     else if(name==='mcp_mutate_library')data=await h.mutate(p.p_user_id,p.p_request_id,p.p_operation,p.p_input,p.p_payload);
     else throw Error(`Unexpected RPC ${name}`);
   }catch(error){return Response.json({message:error.message,code:error.code},{status:400});}
   if(loseAck&&name==='mcp_mutate_library'){loseAck=false;throw Error('Lost acknowledgement after committed write');}
   return Response.json(data);
 }
 const table=url.pathname.split('/').at(-1);assert.ok(['library_items','mcp_library_requests','carousel_generations'].includes(table));assert.equal(request.method,'GET');
 const allowed=table==='library_items'?['id','updated_at']:table==='carousel_generations'?['id','project_id','status','slide_count','updated_at']:['request_id','operation','created_at','input_json','result_json'];
 const columns=url.searchParams.get('select').split(',');assert.ok(columns.every(c=>allowed.includes(c)));
 const owner=url.searchParams.get('user_id');assert.match(owner,/^eq\.owner-[ab]$/);
 const args=[owner.slice(3)],clauses=['user_id=$1'];
 for(const key of ['request_id','project_id','source_type','media_type','status']){const value=url.searchParams.get(key);if(value){assert.match(value,/^eq\./);args.push(value.slice(3));clauses.push(`${key}=$${args.length}`);}}
 if(url.searchParams.get('deleted_at')==='is.null')clauses.push('deleted_at is null');
 const time=table!=='mcp_library_requests'?'updated_at':'created_at',key=table!=='mcp_library_requests'?'id':'request_id',or=url.searchParams.get('or');
 if(or){const m=or.match(/^\((updated_at|created_at)\.lt\.([^,]+),and\(\1\.eq\.([^,]+),(id|request_id)\.lt\.([^()]+)\)\)$/);assert.ok(m,or);assert.equal(m[1],time);assert.equal(m[4],key);assert.equal(m[2],m[3]);args.push(m[2],m[5]);clauses.push(`(${time}<$${args.length-1}::timestamptz or (${time}=$${args.length-1}::timestamptz and ${key}<$${args.length}::uuid))`);}
 const limit=Number(url.searchParams.get('limit')??100);assert.ok(limit<=100);const rows=(await h.db.query(`select ${columns.join(',')} from public.${table} where ${clauses.join(' and ')} order by ${time} desc,${key} desc limit ${limit}`,args)).rows;
 return Response.json(request.headers.get('accept')?.includes('vnd.pgrst.object')?rows[0]??null:rows);
};
const {McpServer,createMcpHandler}=await import('@modelcontextprotocol/server');
const {registerLibraryContentMcpTools,registeredLibraryContentMcpTools}=await import('../lib/mcp/library-content-tools.ts');
const handler=createMcpHandler(()=>{const s=new McpServer({name:'Library fixture',version:'1'});registerLibraryContentMcpTools(s);return s;},{legacy:'stateless'});
beforeEach(async()=>{h=await fixture();requests=[];loseAck=false;sourceUnavailable=false;planAllowed=true;prepareCalls=0;process.env.MCP_LIBRARY_WRITES_ENABLED='true';});
afterEach(async()=>{await h.db.close();});
after(()=>{globalThis.fetch=oldFetch;for(const[k,v]of oldEnv){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
async function rpc(method,params,owner='owner-a',scopes=['account:read','assets:read','assets:write']){
 const response=await handler.fetch(new Request('https://mcp.getugcpilot.com/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),{authInfo:{token:'fixture',clientId:'fixture',scopes,extra:{firebaseUid:owner}}});
 const text=await response.text(),line=text.split('\n').find(l=>l.startsWith('data: '));return JSON.parse(line?line.slice(6):text);
}
async function call(name,args={},owner,scopes){return confirmToolResult(async(next)=>{const body=await rpc('tools/call',{name,arguments:next},owner,scopes);return body.result??{isError:true,content:[{type:'text',text:JSON.stringify(body.error)}]};},args);}
function error(result){assert.equal(result.isError,true,JSON.stringify(result));try{return JSON.parse(result.content[0].text);}catch{return {message:result.content[0].text};}}
async function inspection(){return(await call('inspect_carousel_library_save',{carousel_id:id(100)})).structuredContent;}
async function saveArgs(key=id(1)){const ready=await inspection();return{request_id:key,carousel_id:id(100),source_revision:ready.source_revision,destination_revision:ready.destination_revision};}
test('actual MCP discovery exposes ten scoped Library tools and pure honest capabilities',async()=>{
 const tools=(await rpc('tools/list',{})).result.tools;assert.deepEqual(tools.map(t=>t.name).sort(),[...registeredLibraryContentMcpTools].sort());
 for(const tool of tools){assert.equal(tool._meta.securitySchemes[0].scopes.length,1);assert.equal(tool.annotations.openWorldHint,false);assert.ok(tool.outputSchema);}
 process.env.MCP_LIBRARY_WRITES_ENABLED='false';const cap=(await call('get_library_capabilities')).structuredContent;assert.equal(cap.write_enabled,false);assert.equal(cap.slideshow_text_rendering_available,false);assert.equal(cap.schema_verification_required,true);assert.equal(requests.length,0);
});
test('real save uses shared ready-edit payload/positions and lost ack recovers before gates/source resolution',async()=>{
 const args=await saveArgs();loseAck=true;assert.equal(error(await call('save_carousel_to_library',args)).code,'LIBRARY_UNAVAILABLE');
 const rows=(await h.db.query('select * from public.library_items')).rows;assert.equal(rows.length,1);
 const saved=await h.state('owner-a',rows[0].id);assert.equal(saved.item.slides[0].headline,'Edited heading');assert.deepEqual(saved.item.slides[0].metadata.normalizedTextPosition,{x:.4,y:.6});
 const calls=prepareCalls;sourceUnavailable=true;planAllowed=false;process.env.MCP_LIBRARY_WRITES_ENABLED='false';
 const replay=(await call('save_carousel_to_library',args)).structuredContent;assert.equal(replay.replayed,true);assert.equal(prepareCalls,calls);
 await h.db.query("update public.library_items set title='Website later' where id=$1",[rows[0].id]);assert.equal((await call('save_carousel_to_library',args)).structuredContent.receipt.state.item.title,'Shared ready edit');
 assert.equal((await call('get_library_item',{item_id:rows[0].id})).structuredContent.item.title,'Website later');
 const receipt=(await call('get_library_request',{request_id:id(1)})).structuredContent;assert.equal(receipt.receipt.item_id,rows[0].id);
 assert.equal((await call('list_library_requests')).structuredContent.items.length,1);
});
test('stale source/destination and changed UUID intent reject without overwriting website edits',async()=>{
 const args=await saveArgs();const saved=(await call('save_carousel_to_library',args)).structuredContent;
 assert.equal(error(await call('save_carousel_to_library',{...args,allow_recreate_removed:true})).code,'LIBRARY_CONFLICT');
 const next=await saveArgs(id(2));await h.db.query("update public.library_items set title='New website title' where id=$1",[saved.receipt.item_id]);
 assert.equal(error(await call('save_carousel_to_library',next)).code,'LIBRARY_CONFLICT');assert.equal((await h.state('owner-a',saved.receipt.item_id)).item.title,'New website title');
 const newer=await saveArgs(id(3));await h.db.query("update public.carousel_slides set headline='Source changed' where id=$1",[id(101)]);
 assert.equal(error(await call('save_carousel_to_library',newer)).code,'LIBRARY_CONFLICT');
});
test('owner/filter-bound keyset pages include ordered Carousel/slideshow snapshots and optional tombstones',async()=>{
 const first=(await call('save_carousel_to_library',await saveArgs())).structuredContent;
 const slideshow=(await call('save_slideshow_to_library',{request_id:id(2),slides:[301,302].map(n=>({position_id:String(n),asset_id:id(n)}))})).structuredContent;
 assert.equal(slideshow.receipt.state.item.kind,'slideshow');
 const page=(await call('list_library_items',{limit:1})).structuredContent;assert.equal(page.items.length,1);assert.ok(page.next_cursor);
 const next=(await call('list_library_items',{limit:1,cursor:page.next_cursor})).structuredContent;assert.equal(next.items.length,1);assert.notEqual(next.items[0].item.id,page.items[0].item.id);assert.equal(next.next_cursor,null);
 assert.equal(error(await call('list_library_items',{limit:1,cursor:page.next_cursor,include_removed:true})).code,'INVALID_CURSOR');
 assert.equal(error(await call('list_library_items',{limit:1,cursor:page.next_cursor},'owner-b')).code,'INVALID_CURSOR');
 assert.equal(error(await call('get_library_item',{item_id:first.receipt.item_id},'owner-b')).code,'NOT_FOUND');
 const removed=(await call('remove_library_item',{request_id:id(3),item_id:first.receipt.item_id,expected_revision:first.receipt.state.revision})).structuredContent;assert.ok(removed.receipt.state.deleted_at);
 const history=(await call('list_library_requests',{limit:1})).structuredContent;
 assert.ok(history.next_cursor);const older=(await call('list_library_requests',{limit:1,cursor:history.next_cursor})).structuredContent;
 assert.notEqual(history.items[0].request_id,older.items[0].request_id);
 assert.equal(error(await call('list_library_requests',{cursor:history.next_cursor},'owner-b')).code,'INVALID_CURSOR');
 assert.equal((await call('list_library_items')).structuredContent.items.length,1);assert.equal((await call('list_library_items',{include_removed:true})).structuredContent.items.length,2);
});
test('scope and input validation occur before database/provider access; disabled new writes do not resolve sources',async()=>{
 error(await call('get_library_item',{item_id:id(1)},'owner-a',[]));error(await call('save_carousel_to_library',{request_id:id(1),carousel_id:id(100),source_revision:'a'.repeat(64),destination_revision:'b'.repeat(64)},'owner-a',['assets:read']));
 error(await call('save_slideshow_to_library',{request_id:id(1),slides:[{position_id:'x',asset_id:'wrong'}]}));assert.equal(requests.length,0);assert.equal(prepareCalls,0);
 process.env.MCP_LIBRARY_WRITES_ENABLED='false';assert.equal(error(await call('remove_library_item',{request_id:id(1),item_id:id(1),expected_revision:'a'.repeat(64)})).code,'LIBRARY_WRITES_DISABLED');assert.equal(prepareCalls,0);assert.ok(requests.every(r=>r.method==='GET'));
});
test('slideshow recovery survives removal/plan loss and changed ordered input conflicts',async()=>{
 const args={request_id:id(1),slides:[301,302].map(n=>({position_id:String(n),asset_id:id(n)}))};const saved=(await call('save_slideshow_to_library',args)).structuredContent;
 await h.db.query("update public.library_items set status='archived',deleted_at=now() where id=$1",[saved.receipt.item_id]);
 planAllowed=false;sourceUnavailable=true;const calls=prepareCalls;assert.equal((await call('save_slideshow_to_library',args)).structuredContent.replayed,true);assert.equal(prepareCalls,calls);
 assert.equal(error(await call('save_slideshow_to_library',{...args,slides:[...args.slides].reverse()})).code,'LIBRARY_CONFLICT');
 assert.equal(error(await call('save_slideshow_to_library',{...args,request_id:id(2)})).code,'ACCESS_REQUIRED');
 assert.ok((await h.state('owner-a',saved.receipt.item_id)).deleted_at);
});

test('owned unsaved Carousel sources are discoverable with stable tie paging and owner-bound cursors',async()=>{
 await h.db.query("insert into public.carousel_generations(id,user_id,project_id,status,slide_count) values($1,'owner-a','project-a','completed',2)",[id(110)]);
 const page=(await call('list_carousel_library_sources',{limit:1})).structuredContent;assert.equal(page.items.length,1);assert.ok(page.next_cursor);
 const next=(await call('list_carousel_library_sources',{limit:1,cursor:page.next_cursor})).structuredContent;assert.equal(next.items.length,1);assert.notEqual(page.items[0].id,next.items[0].id);assert.equal(next.next_cursor,null);
 assert.equal(error(await call('list_carousel_library_sources',{cursor:page.next_cursor},'owner-b')).code,'INVALID_CURSOR');
 assert.equal(error(await call('list_carousel_library_sources',{cursor:page.next_cursor,project_id:'project-a'})).code,'INVALID_CURSOR');
 assert.equal((await call('list_carousel_library_sources',{},'owner-b')).structuredContent.items[0].id,id(200));
});
