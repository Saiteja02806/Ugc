import assert from 'node:assert/strict';
import {beforeEach,afterEach,after,test} from 'node:test';
import {fixture,id} from './mcp-account-settings-fixture.mjs';
import {createMcpHandler,McpServer} from '@modelcontextprotocol/server';
let h,requests=[],loseAck=false;
const envKeys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MCP_ACCOUNT_SETTINGS_WRITES_ENABLED'],oldEnv=envKeys.map(k=>[k,process.env[k]]),oldFetch=globalThis.fetch;
Object.assign(process.env,{SUPABASE_URL:'https://account-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'offline-fixture',MCP_ACCOUNT_SETTINGS_WRITES_ENABLED:'true'});
globalThis.fetch=async(input,init)=>{
 const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);assert.equal(url.hostname,'account-fixture.supabase.co');requests.push({path:url.pathname,method:request.method});
 if(url.pathname.includes('/rpc/')){
   const p=await request.json();let data;
   try{if(url.pathname.endsWith('/mcp_read_account_settings'))data=await h.read(p.p_user_id);
     else if(url.pathname.endsWith('/mcp_mutate_account_settings'))data=await h.mutate(p.p_user_id,p.p_request_id,p.p_operation,p.p_input);
     else throw Error('Unexpected RPC');
   }catch(error){return Response.json({message:error.message,code:error.code??'P0001'},{status:400});}
   if(loseAck&&url.pathname.endsWith('/mcp_mutate_account_settings')){loseAck=false;throw Error('Lost response after commit');}
   return Response.json(data);
 }
 if(url.pathname==='/rest/v1/user_publishing_preferences') {
   const columns=['user_id','contains_synthetic_media','tiktok_privacy_level','tiktok_allow_comments','tiktok_brand_organic','youtube_privacy_status','youtube_made_for_kids','youtube_notify_subscribers','updated_at'];
   if(request.method==='POST') {
     const values=await request.json(),keys=Object.keys(values);assert.ok(keys.every(key=>columns.includes(key)));assert.equal(request.headers.get('prefer').includes('resolution=merge-duplicates'),true);
     const placeholders=keys.map((_,index)=>'$'+(index+1));
     const assignments=keys.filter(key=>key!=='user_id').map(key=>`${key}=excluded.${key}`);
     const rows=(await h.db.query(`insert into public.user_publishing_preferences(${keys.join(',')}) values(${placeholders.join(',')}) on conflict(user_id) do update set ${assignments.join(',')} returning *`,keys.map(key=>values[key]))).rows;
     return Response.json(request.headers.get('accept')?.includes('vnd.pgrst.object')?rows[0]:rows);
   }
   assert.equal(request.method,'GET');const owner=url.searchParams.get('user_id')?.replace(/^eq\./,'');assert.ok(owner);
   return Response.json((await h.db.query('select * from public.user_publishing_preferences where user_id=$1',[owner])).rows);
 }
 assert.equal(url.pathname,'/rest/v1/mcp_account_settings_requests');assert.equal(request.method,'GET');
 const owner=url.searchParams.get('user_id')?.replace(/^eq\./,'');assert.ok(owner);
 const params=[owner];let sql='select request_id,operation,created_at,result_json from public.mcp_account_settings_requests where user_id=$1';
 const key=url.searchParams.get('request_id');if(key){params.push(key.slice(3));sql+=' and request_id=$2';}
 const or=url.searchParams.get('or');if(or){const found=or.match(/created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),request_id\.lt\.([^)]*)/);assert.ok(found);assert.equal(found[1],found[2]);params.push(found[1],found[3]);sql+=` and (created_at < $${params.length-1}::timestamptz or (created_at = $${params.length-1}::timestamptz and request_id < $${params.length}::uuid))`;}
 sql+=' order by created_at desc,request_id desc';const limit=url.searchParams.get('limit');if(limit){params.push(Number(limit));sql+=` limit $${params.length}`;}
 const rows=(await h.db.query(sql,params)).rows;
 return Response.json(rows.map(row=>key?{result_json:row.result_json}:{request_id:row.request_id,operation:row.operation,created_at:row.created_at}));
};
const {getPublishingPreferences,savePublishingPreferences}=await import('../lib/scheduling/publishing-preferences-db.ts');
const {registerAccountSettingsMcpTools,registeredAccountSettingsMcpTools}=await import('../lib/mcp/account-settings-tools.ts');
const handler=createMcpHandler(()=>{const server=new McpServer({name:'fixture',version:'1'});registerAccountSettingsMcpTools(server);return server;},{legacy:'stateless'});
beforeEach(async()=>{h=await fixture();requests=[];loseAck=false;process.env.MCP_ACCOUNT_SETTINGS_WRITES_ENABLED='true';});
afterEach(async()=>{await h.db.close();});after(()=>{globalThis.fetch=oldFetch;for(const[k,v]of oldEnv){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
async function rpc(method,params,owner='owner-a',scopes=['account:read','account:write']){
 const response=await handler.fetch(new Request('https://mcp.getugcpilot.com/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),{authInfo:{token:'fixture',clientId:'fixture',scopes,extra:{firebaseUid:owner}}});
 const text=await response.text(),line=text.split('\n').find(l=>l.startsWith('data: '));return JSON.parse(line?line.slice(6):text);
}
async function call(name,args={},owner,scopes){const body=await rpc('tools/call',{name,arguments:args},owner,scopes);return body.result??{isError:true,content:[{type:'text',text:JSON.stringify(body.error)}]};}
function error(result){assert.equal(result.isError,true,JSON.stringify(result));try{return JSON.parse(result.content[0].text);}catch{return {message:result.content[0].text};}}

test('actual six-tool discovery has explicit fresh write scopes and a pure disabled capability read',async()=>{
 const tools=(await rpc('tools/list',{})).result.tools;assert.deepEqual(tools.map(t=>t.name).sort(),[...registeredAccountSettingsMcpTools].sort());
 for(const t of tools){assert.ok(t.outputSchema);assert.equal(t.annotations.openWorldHint,false);assert.deepEqual(t._meta.securitySchemes[0].scopes,[t.annotations.readOnlyHint?'account:read':'account:write']);}
 process.env.MCP_ACCOUNT_SETTINGS_WRITES_ENABLED='false';const cap=(await call('get_account_settings_capabilities')).structuredContent;
 assert.equal(cap.write_enabled,false);assert.equal(cap.timezone_policy,'initialize_once');assert.equal(cap.existing_posts_unchanged,true);assert.equal(requests.length,0);
});

test('old consent, unknown fields and disabled writes stop before any database access',async()=>{
 const args={request_id:id(1),expected_revision:'a'.repeat(64),preferences:{youtubePrivacyStatus:'private'}};
 error(await call('update_publishing_preferences',args,'owner-a',['account:read','assets:write','creative:write']));
 error(await call('update_publishing_preferences',{...args,user_id:'owner-b'}));error(await call('update_publishing_preferences',{...args,preferences:{unknown:true}}));
 process.env.MCP_ACCOUNT_SETTINGS_WRITES_ENABLED='false';assert.equal(error(await call('update_publishing_preferences',args)).code,'SETTINGS_WRITES_DISABLED');assert.equal(requests.length,0);
});

test('adapter preserves owner/defaults and recovers lost committed updates without touching later website choices',async()=>{
 const before=(await call('get_account_settings')).structuredContent,args={request_id:id(1),expected_revision:before.publishing_revision,preferences:{youtubePrivacyStatus:'private'}};
 loseAck=true;error(await call('update_publishing_preferences',args));
 const saved=(await call('get_account_settings_request',{request_id:id(1)})).structuredContent.receipt;assert.equal(saved.state.publishing_preferences.youtubePrivacyStatus,'private');
 await h.db.query("update public.user_publishing_preferences set youtube_privacy_status='unlisted',updated_at=clock_timestamp() where user_id='owner-a'");
 process.env.MCP_ACCOUNT_SETTINGS_WRITES_ENABLED='false';assert.deepEqual((await call('get_account_settings_request',{request_id:id(1)})).structuredContent.receipt,saved);
 process.env.MCP_ACCOUNT_SETTINGS_WRITES_ENABLED='true';assert.equal((await call('update_publishing_preferences',args)).structuredContent.replayed,true);
 assert.equal((await call('get_account_settings')).structuredContent.publishing_preferences.youtubePrivacyStatus,'unlisted');
 assert.equal(error(await call('get_account_settings_request',{request_id:id(1)},'owner-b')).code,'NOT_FOUND');
});

test('timezone initialization returns persisted policy, rejects invalid zones and does not grant publishing access',async()=>{
 const before=(await call('get_account_settings')).structuredContent;
 const args={request_id:id(1),expected_revision:before.timezone_revision,timezone:'Asia/Calcutta'};
 const first=(await call('initialize_account_timezone',args)).structuredContent;assert.equal(first.receipt.initialized,true);assert.equal(first.receipt.state.timezone,'Asia/Calcutta');
 const second=(await call('initialize_account_timezone',{...args,request_id:id(2),expected_revision:first.receipt.state.timezone_revision,timezone:'UTC'})).structuredContent;assert.equal(second.receipt.initialized,false);assert.equal(second.receipt.state.timezone,'Asia/Calcutta');
 const count=requests.length;assert.equal(error(await call('initialize_account_timezone',{...args,timezone:'Mars/Nowhere'})).code,'INVALID_INPUT');assert.equal(requests.length,count);
});

test('request history has stable tie paging and owner-bound opaque cursors',async()=>{
 for(let n=1;n<=3;n++){const state=(await call('get_account_settings')).structuredContent;await call('update_publishing_preferences',{request_id:id(n),expected_revision:state.publishing_revision,preferences:{youtubeMadeForKids:n%2===0}});}
 await h.db.query("update public.mcp_account_settings_requests set created_at='2026-10-13T00:00:00Z'");
 const first=(await call('list_account_settings_requests',{limit:1})).structuredContent;assert.equal(first.items[0].request_id,id(3));assert.ok(first.next_cursor);
 const second=(await call('list_account_settings_requests',{limit:1,cursor:first.next_cursor})).structuredContent;assert.equal(second.items[0].request_id,id(2));
 assert.equal(error(await call('list_account_settings_requests',{cursor:first.next_cursor},'owner-b')).code,'INVALID_CURSOR');
 assert.equal((await call('list_account_settings_requests',{},'owner-b')).structuredContent.items.length,0);
});

test('actual website partial saves and MCP share defaults, reject stale revisions and preserve selected fields',async()=>{
 const initial=(await call('get_account_settings')).structuredContent;
 assert.deepEqual(initial.publishing_preferences,await getPublishingPreferences('owner-a'));
 await savePublishingPreferences('owner-a',{tiktokPrivacyLevel:'SELF_ONLY',youtubeMadeForKids:true});
 assert.equal(error(await call('update_publishing_preferences',{request_id:id(1),expected_revision:initial.publishing_revision,preferences:{containsSyntheticMedia:false}})).code,'SETTINGS_CONFLICT');
 const current=(await call('get_account_settings')).structuredContent;
 const accepted=(await call('update_publishing_preferences',{request_id:id(2),expected_revision:current.publishing_revision,preferences:{containsSyntheticMedia:false}})).structuredContent.receipt;
 assert.deepEqual(accepted.state.publishing_preferences,await getPublishingPreferences('owner-a'));
 assert.equal(accepted.state.publishing_preferences.youtubeMadeForKids,true);assert.equal(accepted.state.publishing_preferences.tiktokPrivacyLevel,'SELF_ONLY');
 await savePublishingPreferences('owner-a',{youtubePrivacyStatus:'unlisted'});
 const historical=(await call('get_account_settings_request',{request_id:id(2)})).structuredContent.receipt;
 assert.deepEqual(historical,accepted);const final=(await call('get_account_settings')).structuredContent;
 assert.equal(final.publishing_preferences.containsSyntheticMedia,false);assert.equal(final.publishing_preferences.youtubePrivacyStatus,'unlisted');assert.equal(final.publishing_preferences.tiktokPrivacyLevel,'SELF_ONLY');
});
