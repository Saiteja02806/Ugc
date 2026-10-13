import assert from 'node:assert/strict';
import {beforeEach,afterEach,after,test} from 'node:test';
import {fixture,id,context,input,applyInput} from './mcp-business-context-fixture.mjs';
import {createMcpHandler,McpServer} from '@modelcontextprotocol/server';
let h,requests=[],loseAck=false;
const envKeys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MCP_BUSINESS_CONTEXT_WRITES_ENABLED'],oldEnv=envKeys.map(k=>[k,process.env[k]]),oldFetch=globalThis.fetch;
Object.assign(process.env,{SUPABASE_URL:'https://business-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'offline-fixture',MCP_BUSINESS_CONTEXT_WRITES_ENABLED:'true'});
globalThis.fetch=async(inputArg,init)=>{
 const request=inputArg instanceof Request?inputArg:new Request(inputArg,init),url=new URL(request.url);assert.equal(url.hostname,'business-fixture.supabase.co');requests.push({path:url.pathname,method:request.method});
 if(url.pathname.includes('/rpc/')){
  const p=await request.json();let data;try{
   if(url.pathname.endsWith('/mcp_read_business_context'))data=await h.read(p.p_user_id);
   else if(url.pathname.endsWith('/mcp_mutate_business_context'))data=(await h.db.query('select public.mcp_mutate_business_context($1,$2,$3,$4::jsonb,$5::jsonb,$6) result',[p.p_user_id,p.p_request_id,p.p_operation,JSON.stringify(p.p_input),JSON.stringify(p.p_context),p.p_content_hash])).rows[0].result;
   else if(url.pathname.endsWith('/apply_business_context_v1'))data=(await h.db.query('select * from public.apply_business_context_v1($1,$2::jsonb,$3,$4,$5)',[p.p_content_hash,JSON.stringify(p.p_context_json),p.p_expected_draft_updated_at,p.p_expected_profile_version,p.p_user_id])).rows;
   else throw Error('Unexpected RPC');
  }catch(error){return Response.json({message:error.message,code:error.code??'P0001'},{status:400});}
  if(loseAck&&url.pathname.endsWith('/mcp_mutate_business_context')){loseAck=false;throw Error('Lost response after commit');}
  return Response.json(data);
 }
 const owner=url.searchParams.get('user_id')?.replace(/^eq\./,'');assert.ok(owner);
 if(url.pathname==='/rest/v1/business_profiles'){
  let rows;if(request.method==='PATCH'){
   const values=await request.json(),keys=Object.keys(values),params=keys.map(k=>values[k]);params.push(owner);
   let where=`user_id=$${params.length}`;const version=url.searchParams.get('profile_version');if(version){params.push(Number(version.slice(3)));where+=` and profile_version=$${params.length}`;}
   const timestamp=url.searchParams.get('business_context_draft_updated_at');if(timestamp==='is.null')where+=' and business_context_draft_updated_at is null';else if(timestamp){params.push(timestamp.slice(3));where+=` and business_context_draft_updated_at=$${params.length}::timestamptz`;}
   const assignments=keys.map((key,i)=>{assert.ok(['business_context_draft_json','business_context_draft_base_version','business_context_draft_source','business_context_draft_updated_at','updated_at'].includes(key));return `${key}=$${i+1}`;});
   rows=(await h.db.query(`update public.business_profiles set ${assignments.join(',')} where ${where} returning *`,params.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;
  }else{assert.equal(request.method,'GET');rows=(await h.db.query('select * from public.business_profiles where user_id=$1',[owner])).rows;}
  return Response.json(request.headers.get('accept')?.includes('vnd.pgrst.object')?rows[0]:rows);
 }
 assert.equal(url.pathname,'/rest/v1/mcp_business_context_requests');assert.equal(request.method,'GET');const params=[owner];let sql='select request_id,operation,input_json,result_json,created_at from public.mcp_business_context_requests where user_id=$1';
 const key=url.searchParams.get('request_id');if(key){params.push(key.slice(3));sql+=' and request_id=$2';}
 const or=url.searchParams.get('or');if(or){const found=or.match(/created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),request_id\.lt\.([^)]*)/);assert.ok(found);assert.equal(found[1],found[2]);params.push(found[1],found[3]);sql+=` and (created_at < $${params.length-1}::timestamptz or (created_at = $${params.length-1}::timestamptz and request_id < $${params.length}::uuid))`;}
 sql+=' order by created_at desc,request_id desc';const limit=url.searchParams.get('limit');if(limit){params.push(Number(limit));sql+=` limit $${params.length}`;}
 const rows=(await h.db.query(sql,params)).rows;return Response.json(rows.map(row=>key?{operation:row.operation,input_json:row.input_json,result_json:row.result_json}:{request_id:row.request_id,operation:row.operation,created_at:row.created_at}));
};
const {getBusinessProfileForUser,saveBusinessContextDraft,applyBusinessContext}=await import('../lib/business-profiles/db.ts');
const {registerBusinessContextMcpTools,registeredBusinessContextMcpTools}=await import('../lib/mcp/business-context-tools.ts');
const handler=createMcpHandler(()=>{const server=new McpServer({name:'fixture',version:'1'});registerBusinessContextMcpTools(server);return server;},{legacy:'stateless'});
beforeEach(async()=>{h=await fixture();requests=[];loseAck=false;process.env.MCP_BUSINESS_CONTEXT_WRITES_ENABLED='true';});afterEach(async()=>{await h.db.close();});after(()=>{globalThis.fetch=oldFetch;for(const[k,v]of oldEnv){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
async function rpc(method,params,owner='owner-a',scopes=['brand:read','brand:write']){
 const response=await handler.fetch(new Request('https://mcp.getugcpilot.com/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),{authInfo:{token:'fixture',clientId:'fixture',scopes,extra:{firebaseUid:owner}}});const text=await response.text(),line=text.split('\n').find(l=>l.startsWith('data: '));return JSON.parse(line?line.slice(6):text);
}
async function call(name,args={},owner,scopes){const body=await rpc('tools/call',{name,arguments:args},owner,scopes);return body.result??{isError:true,content:[{type:'text',text:JSON.stringify(body.error)}]};}
function error(result){assert.equal(result.isError,true,JSON.stringify(result));try{return JSON.parse(result.content[0].text);}catch{return {message:result.content[0].text};}}
function args(state,next=context,operation='save_draft',key=id(1)){return {request_id:key,...(operation==='apply'?applyInput(state,next):input(state,next))};}

test('six real registrations expose separate fresh brand-write consent and pure capabilities',async()=>{
 const tools=(await rpc('tools/list',{})).result.tools;assert.deepEqual(tools.map(t=>t.name).sort(),[...registeredBusinessContextMcpTools].sort());for(const t of tools){assert.deepEqual(t._meta.securitySchemes[0].scopes,[t.annotations.readOnlyHint?'brand:read':'brand:write']);assert.equal(t.annotations.openWorldHint,false);}
 const cap=(await call('get_business_context_capabilities')).structuredContent;assert.equal(cap.reanalyze_available,false);assert.equal(cap.onboarding_available,false);assert.equal(requests.length,0);assert.equal((await call('get_business_context')).structuredContent.profile,null);
});
test('old consent, disabled gate and malformed input stop before storage or provider work',async()=>{
 await h.seed();const state=await h.read('owner-a'),a=args(state);error(await call('save_business_context_draft',a,'owner-a',['brand:read','account:write','generation:write']));error(await call('save_business_context_draft',{...a,user_id:'owner-b'}));error(await call('apply_business_context',{...a,source:'not an apply field'}));
 process.env.MCP_BUSINESS_CONTEXT_WRITES_ENABLED='false';assert.equal(error(await call('save_business_context_draft',a)).code,'BUSINESS_CONTEXT_WRITES_DISABLED');assert.equal(requests.length,0);
});
test('lost acknowledgement recovers original intent even after website goals/context change',async()=>{
 await h.seed();const state=(await call('get_business_context')).structuredContent,a=args(state,{...context,businessName:'First'},'apply');loseAck=true;error(await call('apply_business_context',a));const saved=(await call('get_business_context_request',{request_id:a.request_id})).structuredContent.receipt;
 await h.db.query("update public.business_profiles set primary_goals=array['increase_revenue'],context_json=$1::jsonb,profile_version=profile_version+1,updated_at=clock_timestamp() where user_id='owner-a'",[JSON.stringify({...saved.state.profile.active_context,businessName:'Later website'})]);
 const before=await h.read('owner-a');process.env.MCP_BUSINESS_CONTEXT_WRITES_ENABLED='false';assert.deepEqual((await call('get_business_context_request',{request_id:a.request_id})).structuredContent.receipt,saved);process.env.MCP_BUSINESS_CONTEXT_WRITES_ENABLED='true';assert.equal((await call('apply_business_context',a)).structuredContent.replayed,true);assert.deepEqual(await h.read('owner-a'),before);assert.equal(error(await call('get_business_context_request',{request_id:a.request_id},'owner-b')).code,'NOT_FOUND');
});
test('real website save/apply and MCP share draft revisions, facts and content hash',async()=>{
 await h.seed();const state=(await call('get_business_context')).structuredContent,profile=await getBusinessProfileForUser('owner-a');const next={...context,businessName:'Website draft'};
 const website=await saveBusinessContextDraft({context:next,expectedDraftUpdatedAt:null,profile,source:'Website source'});
 assert.equal(error(await call('save_business_context_draft',args(state))).code,'BUSINESS_CONTEXT_CONFLICT');const current=(await call('get_business_context')).structuredContent;assert.equal(current.profile.draft.context.businessName,'Website draft');assert.equal(current.draft_readiness.status,'ready');
 const changed={...next,businessName:'MCP applied'};const accepted=(await call('apply_business_context',args(current,changed,'apply'))).structuredContent.receipt;assert.equal((await getBusinessProfileForUser('owner-a')).context.businessName,'MCP applied');assert.equal(accepted.state.profile.active_profile_version,website.profileVersion+1);assert.equal(accepted.state.profile.draft,null);
 const after=await getBusinessProfileForUser('owner-a');await applyBusinessContext({context:{...after.context,businessName:'Website applied later'},expectedDraftUpdatedAt:null,expectedProfileVersion:after.profileVersion,profile:after});assert.equal((await call('get_business_context')).structuredContent.profile.active_context.businessName,'Website applied later');assert.deepEqual((await call('get_business_context_request',{request_id:id(1)})).structuredContent.receipt,accepted);
});
test('apply needs real facts and preserves goals instead of granting onboarding or overwriting them',async()=>{
 await h.seed();const state=(await call('get_business_context')).structuredContent;
 const empty={...context,productSummary:null,valueProps:[],differentiators:[],mainProblem:null,painPoints:[],mainPromise:null,targetAudience:[]};assert.equal(error(await call('apply_business_context',args(state,empty,'apply'))).code,'BUSINESS_CONTEXT_NEEDS_FACTS');
 const saved=(await call('save_business_context_draft',args(state,empty))).structuredContent.receipt;assert.equal((await call('get_business_context')).structuredContent.draft_readiness.status,'needs_facts');assert.deepEqual(saved.state.profile.active_context,state.profile.active_context);
 const current=(await call('get_business_context')).structuredContent,accepted=(await call('apply_business_context',args(current,{...context,campaignPurposes:['education']},'apply',id(2)))).structuredContent.receipt;assert.deepEqual(accepted.state.profile.active_context.campaignPurposes,['conversion']);assert.deepEqual(accepted.state.profile.primary_goals,['increase_signups']);
});
test('owner-bound history ties page stably without repeating accepted mutations',async()=>{
 await h.seed();for(let n=1;n<=3;n++){const state=(await call('get_business_context')).structuredContent;await call('save_business_context_draft',args(state,{...context,businessName:'Draft '+n},'save_draft',id(n)));}
 await h.db.exec("update public.mcp_business_context_requests set created_at='2026-10-13T00:00:00Z'");const first=(await call('list_business_context_requests',{limit:1})).structuredContent;assert.equal(first.items[0].request_id,id(3));const second=(await call('list_business_context_requests',{limit:1,cursor:first.next_cursor})).structuredContent;assert.equal(second.items[0].request_id,id(2));assert.equal(error(await call('list_business_context_requests',{cursor:first.next_cursor},'owner-b')).code,'INVALID_CURSOR');assert.equal((await call('list_business_context_requests',{},'owner-b')).structuredContent.items.length,0);
});
