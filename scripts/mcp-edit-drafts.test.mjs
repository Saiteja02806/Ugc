import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
import { confirmToolResult } from './mcp-confirm-client.mjs';
class FixtureAuthError extends Error {constructor(message,status=401){super(message);this.status=status;}}
mock.module('../lib/firebase/server-auth.ts',{namedExports:{FirebaseAuthRequestError:FixtureAuthError,requireFirebaseUser:async request=>{
  const user=request.headers.get('authorization')?.replace('Bearer fixture-','');
  if(!user)throw new FixtureAuthError('Sign in first.');return {uid:user};
}}});
mock.module('../lib/edit/private-video-delivery.ts',{namedExports:{withPrivateEditDelivery:async video=>video}});
process.env.NEXT_PUBLIC_SUPABASE_URL='https://draft-fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='offline-draft-test-key';
const {POST:websiteOpen}=await import("../app/api/edit/videos/route.ts");
const {GET:websiteGet,PATCH:websiteSave}=await import('../app/api/edit/videos/[sourceVideoId]/route.ts');
const {registerEditDraftMcpTools}=await import('../lib/mcp/edit-draft-tools.ts');
const {EditDraftSaveSession}=await import('../lib/edit/draft-save-session.ts');
const {EditDraftError,parseEditDraft}=await import('../lib/edit/draft-contract.ts');
const {normalizeEditableVideoDraftForDuration}=await import('../lib/edit/editor-draft.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const content=text=>({trimStartSeconds:0,trimEndSeconds:null,textOverlays:[{id:'title',position:'top',style:'clean',text}]});
function harness(){
  const h={calls:[],rows:new Map(),receipts:new Map(),assets:new Map(),openCalls:0};
  const r=n=>({id:id(n),user_id:'owner-a',project_id:'project-a',source_video_id:id(100+n),source:'hook',title:'Hook',ratio:'9:16',status:'draft',
    draft_json:content('original'),draft_revision:0,duration_seconds:10,created_at:`2026-10-11T00:00:00.${String(n).padStart(6,'0')}Z`,updated_at:'2026-10-11T00:00:00.123456Z',deleted_at:null,
    source_video_url:'private-source-secret',thumbnail_url:'private-thumb-secret',rendered_video_url:'private-output-secret',latest_render_id:id(500)});
  h.row=r;
  globalThis.fetch=async(input,init)=>{
    const req=input instanceof Request?input:new Request(input,init),url=new URL(req.url);h.calls.push(url);
    const body=req.method==='POST'?await req.json():null;
    if(url.pathname.endsWith('/rpc/edit_open_draft')){
      h.openCalls++;
      const asset=h.assets.get(body.p_asset_id);
      if(!asset||asset.user_id!==body.p_user_id||asset.deleted_at)return Response.json({message:'edit_open_not_found'},{status:400});
      if(asset.status!=='ready')return Response.json({message:'edit_open_not_ready'},{status:400});
      const existing=[...h.rows.values()].find(row=>row.user_id===body.p_user_id&&row.source_video_id===body.p_asset_id&&!row.deleted_at);
      if(existing)return Response.json({video:existing,reused:true});
      const created={...r(900),source_video_id:asset.id,user_id:body.p_user_id,title:asset.title,project_id:asset.project_id??'test-project-001',draft_json:body.p_initial_draft,draft_revision:0,status:body.p_initial_draft?'draft':'ready'};
      h.rows.set(created.id,created);return Response.json({video:created,reused:false});
    }
    if(url.pathname.endsWith('/rpc/edit_save_draft')){
      const old=h.receipts.get(body.p_user_id+body.p_request_id);
      if(old){if(old.inputs!==JSON.stringify(body))return Response.json({message:'edit_draft_request_conflict private-secret'},{status:400});return Response.json({...old.result,replayed:true});}
      const row=h.rows.get(body.p_draft_id);
      if(!row||row.user_id!==body.p_user_id||row.deleted_at)return Response.json({message:'edit_draft_not_found'},{status:400});
      if(row.draft_revision!==body.p_expected_revision)return Response.json({message:'edit_draft_changed'},{status:400});
      row.draft_json=body.p_draft;row.draft_revision++;const result={video:structuredClone(row),replayed:false};
      h.receipts.set(body.p_user_id+body.p_request_id,{inputs:JSON.stringify(body),result});return Response.json(result);
    }
    if(url.pathname.endsWith('/media_assets')){
      const asset=h.assets.get(url.searchParams.get('id')?.slice(3));
      return Response.json(asset&&asset.user_id===url.searchParams.get('user_id')?.slice(3)&&!asset.deleted_at?asset:null);
    }
    if(!url.pathname.endsWith('/editable_videos'))throw new Error('Unexpected database call');
    const source=url.searchParams.get('source_video_id')?.slice(3);
    const owner=url.searchParams.get('user_id')?.slice(3),target=url.searchParams.get('id')?.slice(3);
    let rows=[...h.rows.values()].filter(x=>x.user_id===owner&&!x.deleted_at);
    if(target)return Response.json(rows.find(x=>x.id===target)??null);
    if(source)return Response.json(rows.filter(x=>x.source_video_id===source).slice(0,1));
    assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');
    const project=url.searchParams.get('project_id');if(project)rows=rows.filter(x=>x.project_id===project.slice(3));
    rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
    const after=url.searchParams.get('or');if(after){const last=/id\.lt\.([^)]*)/.exec(after)?.[1];rows=rows.filter(x=>x.id<last);}
    return Response.json(rows.slice(0,Number(url.searchParams.get('limit'))));
  };
  const tools=new Map();registerEditDraftMcpTools({registerTool:(name,config,callback)=>tools.set(name,{config,callback})});h.tools=tools;
  h.call=async(name,args={},owner='owner-a',scopes=['assets:read','creative:write'])=>{
    const tool=tools.get(name);
    return confirmToolResult(async(next)=>{
      const result=await tool.callback(tool.config.inputSchema.parse(next),{http:{authInfo:{scopes,extra:{firebaseUid:owner}}}});
      if(!result.isError)tool.config.outputSchema.parse(result.structuredContent);return result;
    },args);
  };return h;
}
const code=result=>JSON.parse(result.content[0].text).code;
test('list/get/update enforce read and write consent before any database call and reject caller ownership fields',async()=>{
  const h=harness();
  for(const [name,args]of[['open_edit_draft',{asset_id:id(101)}],['list_edit_drafts',{}],['get_edit_draft',{draft_id:id(1)}],['update_edit_draft',{draft_id:id(1),request_id:id(9),expected_revision:0,content:content('new')}]]){
    assert.equal(code(await h.call(name,args,'owner-a',[])),'INSUFFICIENT_SCOPE');assert.equal(h.calls.length,0);
    assert.equal(h.tools.get(name).config.inputSchema.safeParse({...args,user_id:'foreign'}).success,false);
  }
});
test('stable paged discovery hides foreign/deleted rows and binds cursors to account and project',async()=>{
  const h=harness();for(const n of [1,2,3])h.rows.set(id(n),h.row(n));
  h.rows.set(id(4),{...h.row(4),user_id:'other'});h.rows.set(id(5),{...h.row(5),deleted_at:'deleted'});
  const first=(await h.call('list_edit_drafts',{limit:1,project_id:'project-a'})).structuredContent;
  assert.equal(first.items[0].draft_id,id(3));assert.ok(first.next_cursor);
  assert.equal((await h.call('list_edit_drafts',{limit:1,project_id:'project-a',cursor:first.next_cursor})).structuredContent.items[0].draft_id,id(2));
  assert.equal(code(await h.call('list_edit_drafts',{limit:1,cursor:first.next_cursor})),'INVALID_CURSOR');
  assert.equal(code(await h.call('list_edit_drafts',{limit:1,project_id:'project-a',cursor:first.next_cursor},'other')),'INVALID_CURSOR');
  assert.doesNotMatch(JSON.stringify(first),/private-.*secret|latest_render_id|user_id/);
});
test('draft reads and writes use the website row, preserve blank text and safely recover a lost write',async()=>{
  const h=harness();h.rows.set(id(1),h.row(1));
  const read=(await h.call('get_edit_draft',{draft_id:id(1)})).structuredContent;
  assert.deepEqual(read.content,content('original'));assert.equal(read.source_asset_id,null);assert.equal(read.can_edit,false);
  assert.doesNotMatch(JSON.stringify(read),/private-.*secret|latest_render_id/);
  const args={draft_id:id(1),request_id:id(9),expected_revision:0,content:content('')};
  const saved=(await h.call('update_edit_draft',args)).structuredContent;
  assert.equal(saved.draft.revision,1);assert.equal(saved.content.textOverlays[0].text,'');
  assert.equal((await h.call('update_edit_draft',args)).structuredContent.replayed,true);
  assert.equal(code(await h.call('update_edit_draft',{...args,request_id:id(8)})),'DRAFT_CHANGED');
  assert.equal(code(await h.call('update_edit_draft',{...args,content:content('changed')})),'DRAFT_REQUEST_CONFLICT');
  assert.equal(code(await h.call('get_edit_draft',{draft_id:id(1)},'other')),'NOT_FOUND');
});
test('strict draft validation rejects unsupported edits and invalid trims, while browser metadata is excluded',()=>{
  for(const bad of [{...content(''),trimStartSeconds:-1},{...content(''),trimEndSeconds:0},
    {...content(''),music:'unsupported'},content('x'.repeat(101)),{...content(''),textOverlays:[...content('').textOverlays,...content('two').textOverlays]}])
    assert.throws(()=>parseEditDraft(bad));
  assert.throws(()=>parseEditDraft({...content(''),trimEndSeconds:11},10));
  const browser=normalizeEditableVideoDraftForDuration({...content(''),updatedAt:'display-only'},10);
  assert.deepEqual(parseEditDraft(browser),content(''));
});
test('browser recovers pending save before newer edits, advances its revision and keeps one request UUID for recovery',async()=>{
  let uuid=0;const session=new EditDraftSaveSession(0,()=>id(++uuid));const calls=[];let fail=true;
  const send=async request=>{calls.push(structuredClone(request));if(fail){fail=false;throw new Error('lost response');}return {draftRevision:request.expectedRevision+1};};
  await assert.rejects(session.save(content('first'),send));
  const result=await session.save(content('latest'),send);
  assert.equal(calls.length,3);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[2].expectedRevision,1);
  assert.notEqual(calls[2].requestId,calls[0].requestId);assert.equal(result.draftRevision,2);
});
test('browser conflict blocks further autosave attempts until explicit reload; render status changes do not supply draft revisions',async()=>{
  const session=new EditDraftSaveSession(0);let calls=0;
  const send=async()=>{calls++;throw new EditDraftError('DRAFT_CHANGED','conflict',409);};
  await assert.rejects(session.save(content('local'),send));await assert.rejects(session.save(content('local newer'),send));assert.equal(calls,1);
  const fresh=new EditDraftSaveSession(2);assert.equal((await fresh.save(content('reconciled'),async()=>({draftRevision:3}))).draftRevision,3);
});

test('actual website GET/PATCH and MCP get/update share one draft and reject stale website revisions',async()=>{
  const h=harness();h.rows.set(id(1),h.row(1));
  const context={params:Promise.resolve({sourceVideoId:id(101)})};
  const request=body=>new Request('https://example.test/api/edit/videos/'+id(101),{
    method:body?'PATCH':'GET',headers:{authorization:'Bearer fixture-owner-a','content-type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})});
  const initial=await(await websiteGet(request(),context)).json();
  assert.equal(initial.video.draftRevision,0);assert.equal(initial.video.draftId,id(1));
  const input={draftId:id(1),draft:content('website'),requestId:id(10),expectedRevision:0};
  const accepted=await(await websiteSave(request(input),context)).json();assert.equal(accepted.video.draftRevision,1);
  assert.deepEqual((await h.call('get_edit_draft',{draft_id:id(1)})).structuredContent.content,content('website'));
  await h.call('update_edit_draft',{draft_id:id(1),request_id:id(11),expected_revision:1,content:content('IDE')});
  assert.deepEqual((await(await websiteGet(request(),context)).json()).video.draft.textOverlays,content('IDE').textOverlays);
  const conflict=await websiteSave(request({...input,requestId:id(12),draft:content('stale website')}),context);
  assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'DRAFT_CHANGED');
  assert.equal((await websiteSave(request({draft:content('legacy browser')}),context)).status,428);
  const replay=await(await websiteSave(request(input),context)).json();assert.equal(replay.video.draftRevision,1);
  assert.equal(h.rows.get(id(1)).draft_json.textOverlays[0].text,'IDE');
});

test('a definitely rejected draft can be corrected without replaying invalid edits or losing its revision',async()=>{
  const session=new EditDraftSaveSession(2);let calls=0;
  await assert.rejects(session.save(content('rejected'),async()=>{calls++;throw new EditDraftError('INVALID_DRAFT','bad trim',400);}));
  const saved=await session.save(content('corrected'),async request=>{calls++;assert.equal(request.expectedRevision,2);assert.equal(request.draft.textOverlays[0].text,'corrected');return {draftRevision:3};});
  assert.equal(calls,2);assert.equal(saved.draftRevision,3);
});

test('website saves target the opened draft even when legacy projects share a source; mismatched source/draft IDs fail closed',async()=>{
  const h=harness();h.rows.set(id(1),h.row(1));h.rows.set(id(2),{...h.row(2),source_video_id:id(101),project_id:'legacy'});
  const context={params:Promise.resolve({sourceVideoId:id(101)})};
  const request=(draftId,revision=0)=>new Request('https://example.test/api/edit/videos/'+id(101),{
    method:'PATCH',headers:{authorization:'Bearer fixture-owner-a','content-type':'application/json'},
    body:JSON.stringify({draftId,draft:content('selected'),requestId:id(50),expectedRevision:revision})});
  const saved=await websiteSave(request(id(2)),context);assert.equal(saved.status,200);
  assert.equal(h.rows.get(id(2)).draft_json.textOverlays[0].text,'selected');assert.equal(h.rows.get(id(1)).draft_json.textOverlays[0].text,'original');
  h.rows.set(id(3),h.row(3));assert.equal((await websiteSave(request(id(3)),context)).status,404);
  assert.equal((await websiteSave(request(id(2)),{params:Promise.resolve({sourceVideoId:id(103)})})).status,404);
});

function source(n,overrides={}){return {id:id(n),user_id:'owner-a',collection:'video',source_type:'upload',status:'ready',project_id:'project-a',title:'Source',
  storage_key:'private-source-secret',url:'https://example.test/source',thumbnail_url:null,mime_type:'video/mp4',metadata:{},ratio:'9:16',width:720,height:1280,duration_seconds:10,
  created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z',deleted_at:null,...overrides};}
test('MCP open and website open return the same draft, replay preserves edits and no output leaks storage details',async()=>{
  const h=harness();h.assets.set(id(101),source(101,{metadata:{draft:content('initial')}}));
  const first=(await h.call('open_edit_draft',{asset_id:id(101)})).structuredContent;
  assert.equal(first.reused,false);assert.equal(first.draft.revision,0);assert.deepEqual(first.content,content('initial'));
  await h.call('update_edit_draft',{draft_id:first.draft.draft_id,request_id:id(600),expected_revision:0,content:content('IDE edit')});
  const request=new Request('https://example.test/api/edit/videos',{method:'POST',headers:{authorization:'Bearer fixture-owner-a','content-type':'application/json'},body:JSON.stringify({sourceVideoId:id(101)})});
  const response=await websiteOpen(request),web=await response.json();assert.equal(response.status,200);assert.equal(web.video.draftId,first.draft.draft_id);
  assert.equal(web.video.draft.textOverlays[0].text,'IDE edit');assert.equal(web.video.draftRevision,1);
  const replay=(await h.call('open_edit_draft',{asset_id:id(101)})).structuredContent;assert.equal(replay.reused,true);assert.equal(replay.draft.revision,1);
  assert.equal(h.rows.size,1);assert.doesNotMatch(JSON.stringify(replay),/private-source-secret|storage_key|source_video_url|latest_render_id|user_id/);
});
test('opening rejects insufficient consent, forged metadata and unowned/unready/unsupported sources before creation',async()=>{
  const h=harness();const tool=h.tools.get('open_edit_draft');
  for(const field of ['user_id','title','project_id','draft','source_video_url'])assert.equal(tool.config.inputSchema.safeParse({asset_id:id(101),[field]:'forged'}).success,false);
  assert.equal(code(await h.call('open_edit_draft',{asset_id:id(101)},'owner-a',['assets:read'])),'INSUFFICIENT_SCOPE');assert.equal(h.calls.length,0);
  for(const [n,overrides,expected]of [[101,{user_id:'other'},'NOT_FOUND'],[102,{deleted_at:'removed'},'NOT_FOUND'],[103,{status:'uploading'},'SOURCE_NOT_READY'],
    [104,{source_type:'edit_export'},'UNSUPPORTED_SOURCE'],[105,{collection:'image',mime_type:'image/png'},'UNSUPPORTED_SOURCE']]){
    h.assets.set(id(n),source(n,overrides));assert.equal(code(await h.call('open_edit_draft',{asset_id:id(n)})),expected);
  }
  assert.equal(h.openCalls,0);assert.equal(h.rows.size,0);
});
