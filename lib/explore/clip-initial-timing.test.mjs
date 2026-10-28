import assert from 'node:assert/strict';
import {mock,test} from 'node:test';
import {hookKeyframeGenerationInputKey} from '../../worker/src/lib/hook-keyframe-generation-contract.ts';
import {createHookSourceTimeline} from '../../worker/src/lib/hook-source-timeline.ts';
mock.module('@supabase/supabase-js',{namedExports:{createClient:()=>{throw Error('No hosted DB permitted');}}});
const {ExploreClipDraftStore}=await import('./clip-draft-store.ts');
const assetId='11111111-1111-4111-8111-111111111111',jobId='22222222-2222-4222-8222-222222222222';
const person='33333333-3333-4333-8333-333333333333';
const frame={index:0,timeSeconds:0,width:720,height:1280,sha256:'b'.repeat(64)};
const prep={version:4,ownerId:'owner',draftId:jobId,referenceId:'hook-fixture',sourceSha256:'a'.repeat(64),sourceFrame:frame,imageAssetIds:[person],instructions:'',imageModel:'gemini_3_pro'};
const receipt={version:5,purpose:'hook_starting_frame',ownerId:'owner',draftId:jobId,referenceId:'hook-fixture',sourceSha256:'a'.repeat(64),sourceFrame:frame,personImageAssetIds:[person],instructions:'',imageModel:'gemini_3_pro',promptVersion:7,preparationInputKey:JSON.stringify(prep),promptSha256:'c'.repeat(64)};
receipt.inputKey=hookKeyframeGenerationInputKey(receipt);
const timeline=createHookSourceTimeline(receipt,73/30,3);
const edit={version:1,format:'hook',trimStartMs:0,trimEndMs:2433,originalVolume:1,musicVolume:.2,text:null};
function fixture(){const rows={media_assets:{id:assetId,user_id:'owner',source_record_id:jobId,status:'ready',collection:'video',deleted_at:null},background_jobs:{id:jobId,user_id:'owner',job_type:'generate_hook_video',status:'completed',input_json:{exploreFormat:'hook',startingFrameReceipt:receipt,hookSourceTimeline:timeline,durationSeconds:3},output_json:{mediaAssetId:assetId,initialHookEdit:edit}}};const calls=[];const db={from(table){const q={select(){return q;},eq(k,v){calls.push([table,k,v]);return q;},async maybeSingle(){return{data:rows[table],error:null};}};return q;}};return{rows,calls,store:new ExploreClipDraftStore(db)};}
test('initial trim is an owned completed output suggestion, not a synthetic saved revision',async()=>{
 const f=fixture();const result=await f.store.initialContent('owner',assetId,'hook');assert.deepEqual(result.editing,edit);assert.equal(result.sourceAssetId,assetId);assert.equal(result.revision,undefined);
 assert.ok(f.calls.some(c=>c[0]==='background_jobs'&&c[1]==='user_id'&&c[2]==='owner'));
 f.rows.background_jobs.output_json.automaticHookText={status:'ready',editing:{...edit,textOverlays:[{value:'Exact text',font:'proximanovaa',fontWeight:600,width:.94,fontSize:54,y:.18,color:'#ffffff',startMs:0,endMs:2433}]}};
 assert.equal((await f.store.initialContent('owner',assetId,'hook')).editing.textOverlays[0].value,'Exact text');
});
test('foreign owners, unfinished outputs, legacy receipts and non-Hook scopes cannot seed trims',async()=>{
 for(const mutate of [f=>f.rows.media_assets.user_id='other',f=>f.rows.background_jobs.user_id='other',f=>f.rows.background_jobs.status='processing',f=>f.rows.background_jobs.output_json.mediaAssetId=person,f=>f.rows.background_jobs.input_json.startingFrameReceipt={...receipt,version:4},f=>delete f.rows.background_jobs.input_json.hookSourceTimeline]){const f=fixture();mutate(f);assert.equal(await f.store.initialContent('owner',assetId,'hook'),null);}
 const f=fixture();assert.equal(await f.store.initialContent('owner',assetId,'hook:demo'),null);assert.equal(f.calls.length,0);
});

test('Wall initialization uses only the owned completed automatic result and keeps its full duration',async()=>{
 const f=fixture(),row=f.rows.background_jobs;
 const editing={...edit,format:'wall_text',trimEndMs:12000,textOverlays:[{value:'Four\neditable\nWall text\nlines',font:'proximanovaa',fontWeight:600,width:.65,fontSize:58,lineHeight:1.12,y:.53,color:'#ffffff',startMs:0,endMs:12000}]};
 row.input_json={exploreFormat:'wall_text',referenceId:'wall-test',automaticHookText:{version:1,requestKey:'key',source:{format:'wall_text',referenceId:'wall-test',sourceSha256:'a'.repeat(64)},wallLayout:{version:1,referenceId:'wall-test',sourceSha256:'a'.repeat(64)}}};
 row.output_json={mediaAssetId:assetId,durationSeconds:12,automaticHookText:{requestKey:'key',status:'ready',editing}};
 const initial=await f.store.initialContent('owner',assetId,'wall_text');assert.deepEqual(initial.editing,editing);assert.equal(initial.revision,undefined);
 for(const mutate of [()=>row.output_json.automaticHookText.requestKey='other',()=>row.input_json.automaticHookText.wallLayout.sourceSha256='b'.repeat(64),()=>row.output_json.automaticHookText.editing.trimEndMs=3000]){
  const saved=structuredClone(row);mutate();assert.equal(await f.store.initialContent('owner',assetId,'wall_text'),null);Object.assign(row,saved);
 }
 row.user_id='foreign';assert.equal(await f.store.initialContent('owner',assetId,'wall_text'),null);
});
