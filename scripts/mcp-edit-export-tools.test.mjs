import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const draft=text=>({trimStartSeconds:1,trimEndSeconds:8,textOverlays:[{id:'title',position:'top',style:'clean',text}]});
let h;
mock.module('../lib/jobs/background-jobs.ts',{namedExports:{getMissingBackgroundJobStorageEnvVars:()=>[],getBackgroundJobForUser:async({jobId,userId})=>{
  h.jobReads++;const job=h.jobs.get(jobId);return job?.userId===userId?job:null;
}}});
mock.module('../lib/jobs/background-job-service.ts',{namedExports:{dispatchQueuedBackgroundJobForRecovery:async job=>{
  if(job.status==='queued'&&!job.queueMessageId){h.dispatches++;if(!h.queueDown)job.queueMessageId='safe-fixture-delivery';}return job;
}}});
mock.module('../lib/jobs/gcp-cloud-tasks.ts',{namedExports:{getMissingBackgroundJobCloudTasksEnvVars:()=>h.configured?[]:['fixture-missing']}});
mock.module('../lib/edit/saved-drafts.ts',{namedExports:{getSavedEditDraftForOwner:async(owner,target)=>{
  const row=h.rows.get(target);if(!row||row.user_id!==owner||row.deleted_at)throw new (await import('../lib/edit/draft-contract.ts')).EditDraftError('NOT_FOUND','Draft not found.',404);return structuredClone(row);
}}});
mock.module('../lib/media/media-storage.ts',{namedExports:{listMediaAssetsPage:async()=>{throw new Error('Unexpected asset listing');},serializeMediaAsset:row=>({id:row.id,collection:row.collection,sourceType:row.source_type,status:row.status}),
  getMediaAssetForOwner:async({userId,assetId})=>{const a=h.assets.get(assetId);return a?.user_id===userId&&!a.deleted_at?a:null;}}});
mock.module('../lib/media/editable-video.ts',{namedExports:{isEditableMediaAsset:a=>['video','influencer'].includes(a.collection)&&['upload','influencer_upload','demo_upload','catalog_influencer','generated_video'].includes(a.sourceType)}});
mock.module('../lib/media/media-reference.ts',{namedExports:{isTrustedMediaReferenceUrl:url=>url==='https://owned.test/source'}});
process.env.NEXT_PUBLIC_SUPABASE_URL='https://export-fixture.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='offline-export-test-key';
const {registerEditExportMcpTools}=await import('../lib/mcp/edit-export-tools.ts');
function setup(){
  process.env.MCP_VIDEO_FINISHING_ENABLED='true';
  h={rows:new Map(),assets:new Map(),receipts:new Map(),jobs:new Map(),renders:new Map(),calls:0,starts:0,dispatches:0,jobReads:0,configured:true};
  h.rows.set(id(2),{id:id(2),user_id:'owner-a',project_id:'project-a',source_video_id:id(1),source_video_url:'https://owned.test/source',
    draft_revision:0,draft_json:draft('saved exact words'),ratio:'9:16',deleted_at:null});
  h.assets.set(id(1),{id:id(1),user_id:'owner-a',url:'https://owned.test/source',collection:'video',source_type:'upload',status:'ready',deleted_at:null,duration_seconds:10});
  globalThis.fetch=async(input,init)=>{
    h.calls++;const req=input instanceof Request?input:new Request(input,init),url=new URL(req.url);
    if(url.pathname.endsWith('/rpc/edit_start_export')){
      h.starts++;const p=await req.json();
      if(h.conflict)return Response.json({message:'edit_export_changed private-worker-secret'},{status:400});
      const r={user_id:p.p_user_id,request_id:p.p_request_id,draft_id:p.p_draft_id,expected_revision:p.p_expected_revision,
        render_id:id(5),job_id:id(6),output_asset_id:id(7),render_payload:{renderId:id(5),userId:p.p_user_id,projectId:'project-a',sourceVideoId:id(1),sourceVideoUrl:p.p_source_url,ratio:'9:16',draft:p.p_render_draft}};
      h.receipts.set(p.p_user_id+p.p_request_id,r);
      h.jobs.set(r.job_id,{id:r.job_id,userId:p.p_user_id,jobType:'render_edit_video',projectId:'project-a',idempotencyKey:'edit-export:'+p.p_request_id,
        status:'queued',progress:0,queueMessageId:null,input:structuredClone(r.render_payload)});
      h.renders.set(r.render_id,{status:'queued',ratio:'9:16',source_video_id:id(1),project_id:'project-a',draft_json:p.p_render_draft});
      if(h.loseResponse){h.loseResponse=false;throw new Error('fixture connection lost after commit');}
      return Response.json({receipt:r,replayed:false});
    }
    if(url.pathname.endsWith('/edit_export_requests'))return Response.json(h.receipts.get(url.searchParams.get('user_id')?.slice(3)+url.searchParams.get('request_id')?.slice(3))??null);
    if(url.pathname.endsWith('/video_render_jobs'))return Response.json(h.renders.get(url.searchParams.get('render_id')?.slice(3))??null);
    throw new Error('Unexpected export fixture request');
  };
  const tools=new Map();registerEditExportMcpTools({registerTool:(name,config,callback)=>tools.set(name,{config,callback})});h.tools=tools;
  h.call=async(name,args={},owner='owner-a',scopes=['account:read','creative:write','jobs:read'])=>{
    const t=tools.get(name),r=await t.callback(t.config.inputSchema.parse(args),{http:{authInfo:{scopes,extra:{firebaseUid:owner}}}});
    if(!r.isError)t.config.outputSchema.parse(r.structuredContent);return r;
  };return h;
}
const args=()=>({draft_id:id(2),request_id:id(4),expected_revision:0});
const code=r=>JSON.parse(r.content[0].text).code;
test('read/write scopes and strict schemas prevent database or dispatch activity before consent',async()=>{
  const h=setup();for(const [name,input]of [['get_edit_export_capabilities',{}],['export_edit_draft',args()],['get_edit_export',{request_id:id(4)}]]){
    assert.equal(code(await h.call(name,input,'owner-a',[])),'INSUFFICIENT_SCOPE');assert.equal(h.calls,0);assert.equal(h.dispatches,0);
    for(const field of ['user_id','project_id','url','content','ratio'])assert.equal(h.tools.get(name).config.inputSchema.safeParse({...input,[field]:'untrusted'}).success,false);
  }
  assert.equal((await h.call('get_edit_export_capabilities')).structuredContent.available,true);assert.equal(h.calls,0);
});
test('export freezes the website draft; a lost response/replay preserves newer edits and one job',async()=>{
  const h=setup();h.loseResponse=true;
  assert.equal(code(await h.call('export_edit_draft',args())),'EXPORT_UNAVAILABLE');assert.equal(h.starts,1);
  h.rows.get(id(2)).draft_json=draft('new website edit');h.rows.get(id(2)).draft_revision=1;
  process.env.MCP_VIDEO_FINISHING_ENABLED='false';h.queueDown=true;
  const replay=(await h.call('export_edit_draft',args())).structuredContent;
  assert.equal(replay.replayed,true);assert.equal(replay.outcome,'pending');assert.equal(replay.revision,0);assert.equal(h.starts,1);
  assert.deepEqual(h.jobs.get(id(6)).input.draft,draft('saved exact words'));
  assert.equal(code(await h.call('export_edit_draft',{...args(),expected_revision:1})),'EXPORT_REQUEST_CONFLICT');
  const count=h.dispatches;const read=(await h.call('get_edit_export',{request_id:id(4)})).structuredContent;
  assert.equal(read.revision,0);assert.equal(h.dispatches,count);assert.doesNotMatch(JSON.stringify(read),/owned\.test|sourceVideoUrl|render_payload|private-worker|userId/);
  assert.equal((await h.call('get_edit_export',{request_id:id(4)},'owner-b')).structuredContent.outcome,'unconfirmed');
});
test('conflicts/unready or foreign sources, invalid ranges and overflowing text never submit a render',async()=>{
  let h=setup();assert.equal(code(await h.call('export_edit_draft',args(),'owner-b')),'NOT_FOUND');assert.equal(h.starts,0);
  h=setup();h.rows.get(id(2)).draft_revision=1;assert.equal(code(await h.call('export_edit_draft',args())),'DRAFT_CHANGED');assert.equal(h.starts,0);
  for(const change of [{status:'uploading'},{user_id:'owner-b'},{deleted_at:'removed'},{source_type:'combined_render'}]){
    h=setup();Object.assign(h.assets.get(id(1)),change);assert.equal(code(await h.call('export_edit_draft',args())),'NOT_FOUND');assert.equal(h.starts,0);
  }
  h=setup();h.rows.get(id(2)).draft_json={...draft('bad'),trimEndSeconds:11};assert.equal(code(await h.call('export_edit_draft',args())),'INVALID_DRAFT');assert.equal(h.starts,0);
  h=setup();h.rows.get(id(2)).draft_json=draft(Array(30).fill('X').join('\n'));assert.equal(code(await h.call('export_edit_draft',args())),'TEXT_DOES_NOT_FIT');assert.equal(h.starts,0);
  h=setup();h.conflict=true;assert.equal(code(await h.call('export_edit_draft',args())),'DRAFT_CHANGED');assert.equal(h.dispatches,0);
});
test('safe completed output IDs are exact owned immutable artifacts; deletion and corrupted jobs stay unavailable',async()=>{
  const h=setup();await h.call('export_edit_draft',args());h.renders.get(id(5)).status='completed';h.jobs.get(id(6)).status='completed';
  h.assets.set(id(7),{id:id(7),user_id:'owner-a',collection:'video',source_type:'edit_export',source_record_id:id(5),parent_asset_id:id(1),status:'ready',deleted_at:null,url:'private-output-secret'});
  const get=()=>h.call('get_edit_export',{request_id:id(4)});
  const output=(await get()).structuredContent;assert.equal(output.outcome,'completed');assert.deepEqual(output.output_asset_ids,[id(7)]);assert.doesNotMatch(JSON.stringify(output),/private-output-secret/);
  for(const [key,value]of [['user_id','owner-b'],['deleted_at','removed'],['source_record_id',id(100)]]){
    const old=h.assets.get(id(7))[key];h.assets.get(id(7))[key]=value;assert.equal((await get()).structuredContent.outcome,'output_unavailable');h.assets.get(id(7))[key]=old;
  }
  h.jobs.get(id(6)).input.draft=draft('corrupted');assert.equal(code(await get()),'EXPORT_UNAVAILABLE');
});
test('creation readiness fails before writes while known receipt reads remain available',async()=>{
  let h=setup();h.configured=false;assert.equal((await h.call('get_edit_export_capabilities')).structuredContent.reason,'not_configured');
  assert.equal(code(await h.call('export_edit_draft',args())),'EXPORT_UNAVAILABLE');assert.equal(h.starts,0);
  h=setup();await h.call('export_edit_draft',args());h.configured=false;process.env.MCP_VIDEO_FINISHING_ENABLED='false';
  assert.equal((await h.call('get_edit_export',{request_id:id(4)})).structuredContent.outcome,'pending');
  h.jobs.get(id(6)).status='cancelled';assert.equal((await h.call('get_edit_export',{request_id:id(4)})).structuredContent.outcome,'cancelled');
  h.jobs.get(id(6)).status='failed';assert.equal((await h.call('get_edit_export',{request_id:id(4)})).structuredContent.outcome,'failed');
});
