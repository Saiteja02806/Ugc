import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

process.env.NEXT_PUBLIC_SUPABASE_URL='https://operation-fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='operation-offline-test-key';
let active;
mock.module('../lib/jobs/gcp-cloud-tasks.ts',{namedExports:{
  getMissingBackgroundJobCloudTasksEnvVars:()=>active?.configurationMissing?['offline-config']:[],
  enqueueBackgroundJobCloudTask:async job=>{
    active.dispatches.push(job.id);
    if(active.deliveryFailed)throw new Error('private-delivery-secret');
    return {messageId:`offline-task:${job.id}:${job.attemptCount}`,provider:'gcp',queueName:'ai-generation'};
  }
}});
const {registerOperationMcpTools}=await import('../lib/mcp/operation-tools.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const code=r=>JSON.parse(r.content[0].text).code;
function harness(){
  const h={rows:new Map(),assets:new Map(),receipts:new Map(),calls:[],dispatches:[],configurationMissing:false,deliveryFailed:false,outage:false};active=h;
  h.row=(n,owner='owner-a')=>({id:id(n),user_id:owner,job_type:'generate_image',status:'completed',
    queue_name:'ai-generation',queue_provider:'gcp',queue_message_id:null,attempt_count:1,max_attempts:3,
    created_at:`2026-10-11T00:00:00.${String(n).padStart(6,'0')}Z`,updated_at:'2026-10-11T00:00:00.123456Z',
    input_json:{prompt:'private-input-secret'},output_json:{mediaAssetId:id(80),private:'private-output-secret'},
    idempotency_key:'private-generation-key',input_reference:'private-input-reference',output_reference:'private-output-reference',
    progress:100,stage:'completed',project_id:'ai-studio',cancel_requested_at:null,completed_at:null,error_code:null,error_message:null});
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input)),body=init?.body?JSON.parse(init.body):null;
    h.calls.push({path:url.pathname,query:url.searchParams,body,method:init?.method});
    if(h.outage)return Response.json({message:'private-database-secret'},{status:400});
    if(url.pathname.endsWith('/rpc/mcp_control_background_job')){
      const key=`${body.p_user_id}:${body.p_request_id}`,old=h.receipts.get(key),row=h.rows.get(body.p_job_id);
      const failure=m=>Response.json({message:m},{status:400});
      if(old){if(old.job_id!==body.p_job_id||old.action!==body.p_action||old.version!==body.p_expected_updated_at)return failure('mcp_operation_request_conflict');
        return Response.json({job_id:old.job_id,request_id:body.p_request_id,replayed:true,accepted_at:'2026-10-11T00:00:01Z'});}
      if(!row||row.user_id!==body.p_user_id)return failure('mcp_operation_not_found');
      if(row.updated_at!==body.p_expected_updated_at)return failure('mcp_operation_changed');
      if(body.p_action==='retry'&&!body.p_retry_allowed)return failure('mcp_operation_not_retryable');
      row.status=body.p_action==='retry'?'queued':row.status==='processing'?'cancel_requested':'cancelled';row.stage=row.status;
      row.updated_at='2026-10-11T00:00:01.654321Z';
      h.receipts.set(key,{job_id:body.p_job_id,action:body.p_action,version:body.p_expected_updated_at});
      return Response.json({job_id:body.p_job_id,request_id:body.p_request_id,replayed:false,accepted_at:row.updated_at});
    }
    const owner=url.searchParams.get('user_id')?.slice(3),key=url.searchParams.get('id')?.slice(3);
    if(url.pathname.endsWith('/mcp_job_control_requests')){
      assert.ok(owner);return Response.json(h.receipts.has(`${owner}:${url.searchParams.get('request_id').slice(3)}`)?{request_id:id(99)}:null);
    }
    if(url.pathname.endsWith('/media_assets')){
      assert.equal(url.searchParams.get('deleted_at'),'is.null');const a=h.assets.get(key);
      return Response.json(a?.user_id===owner?a:null);
    }
    assert.ok(url.pathname.endsWith('/background_jobs'),url.pathname);
    if(init?.method==='PATCH'){
      const row=h.rows.get(key);Object.assign(row,body);return Response.json(row);
    }
    assert.ok(owner,'owner predicate is mandatory');
    let rows=[...h.rows.values()].filter(r=>r.user_id===owner);
    if(key)return Response.json(rows.find(r=>r.id===key)??null);
    const types=url.searchParams.get('job_type');if(types)rows=rows.filter(r=>types.slice(3).includes(r.job_type));
    const statuses=url.searchParams.get('status');if(statuses)rows=rows.filter(r=>statuses.slice(3).includes(r.status));
    const project=url.searchParams.get('project_id');if(project)rows=rows.filter(r=>r.project_id===project.slice(3));
    assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');
    rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
    const after=url.searchParams.get('or');if(after){const last=/id\.lt\.([^)]*)/.exec(after)?.[1];rows=rows.filter(r=>r.id!==last);}
    return Response.json(rows.slice(0,Number(url.searchParams.get('limit'))));
  };
  const tools=new Map();registerOperationMcpTools({registerTool:(name,config,callback)=>tools.set(name,{config,callback})});
  h.tools=tools;h.call=async(name,args={},owner='owner-a',scopes=['jobs:read','jobs:write'])=>{
    const t=tools.get(name),result=await t.callback(t.config.inputSchema.parse(args),{http:{authInfo:{scopes,extra:{firebaseUid:owner}}}});
    if(!result.isError)t.config.outputSchema.parse(result.structuredContent);return result;
  };return h;
}
test('all operation tools reject caller identity and insufficient read/write scopes before database work',async()=>{
  const h=harness();h.rows.set(id(1),h.row(1));
  for(const[name,args]of[['list_operations',{}],['get_operation',{operation_id:id(1)}],
    ['cancel_operation',{operation_id:id(1),request_id:id(99),expected_updated_at:h.row(1).updated_at}],
    ['retry_operation',{operation_id:id(1),request_id:id(99),expected_updated_at:h.row(1).updated_at}]]){
    assert.equal(code(await h.call(name,args,'owner-a',[])),'INSUFFICIENT_SCOPE');assert.equal(h.calls.length,0);
    for(const field of ['user_id','p_retry_allowed','input','output'])assert.equal(h.tools.get(name).config.inputSchema.safeParse({...args,[field]:'forged'}).success,false);
  }
  assert.equal(code(await h.call('cancel_operation',{operation_id:id(1),request_id:id(99),expected_updated_at:h.row(1).updated_at},'owner-a',['generation:write','creative:write'])),'INSUFFICIENT_SCOPE');
});
test('history includes website jobs, filters before pagination, preserves microseconds and binds every cursor filter',async()=>{
  const h=harness();for(const n of [1,2,3])h.rows.set(id(n),{...h.row(n),job_type:n===3?'render_demo_video':'generate_image',project_id:'explore',status:'queued'});
  h.rows.set(id(4),{...h.row(4),job_type:'test_worker_job'});h.rows.set(id(5),h.row(5,'other-owner'));
  const first=(await h.call('list_operations',{type:'image_generation',status:'active',project_id:'explore',limit:1})).structuredContent;
  assert.equal(first.items[0].id,id(2));assert.equal(first.items[0].expected_updated_at,'2026-10-11T00:00:00.123456Z');assert.ok(first.next_cursor);
  assert.doesNotMatch(JSON.stringify(first.items),/private-|input_json|output_json|queue_name|owner-a/);
  const next=(await h.call('list_operations',{type:'image_generation',status:'active',project_id:'explore',limit:1,cursor:first.next_cursor})).structuredContent;
  assert.equal(next.items[0].id,id(1));assert.equal(next.next_cursor,null);
  const before=h.calls.length;
  for(const[args,owner]of[[{type:'image_generation',status:'active',project_id:'explore'},'other-owner'],
    [{type:'video_generation',status:'active',project_id:'explore'},'owner-a'],[{type:'image_generation',status:'all',project_id:'explore'},'owner-a'],
    [{type:'image_generation',status:'active',project_id:'other'},'owner-a']])
    assert.equal(code(await h.call('list_operations',{...args,cursor:first.next_cursor},owner)),'INVALID_CURSOR');
  assert.equal(h.calls.length,before);
});
test('operation details verify every output owner and recover finishing handles without exposing raw inputs/output',async()=>{
  const h=harness();h.rows.set(id(1),{...h.row(1),job_type:'render_demo_video',project_id:'explore',idempotency_key:`explore-finish:${id(90)}`,
    input_json:{version:1,userId:'owner-a',requestKey:id(90),fingerprint:'private-fingerprint'},output_json:{mediaAssetId:id(80),mediaAssetIds:[id(81)],private:'private-output-secret'}});
  h.assets.set(id(80),{id:id(80),user_id:'owner-a',status:'ready'});h.assets.set(id(81),{id:id(81),user_id:'owner-b',status:'ready'});
  const details=(await h.call('get_operation',{operation_id:id(1)})).structuredContent;
  assert.deepEqual(details.output_asset_ids,[id(80)]);assert.equal(details.finishing_request_id,id(90));assert.doesNotMatch(JSON.stringify(details),/private-|input_json|output_json|owner-a/);
  assert.equal(code(await h.call('get_operation',{operation_id:id(1)},'owner-b')),'NOT_FOUND');
  h.rows.get(id(1)).job_type='test_worker_job';assert.equal(code(await h.call('get_operation',{operation_id:id(1)})),'NOT_FOUND');
});
test('terminal provider errors are not retried and their diagnostics never escape',async()=>{
  const h=harness();for(const[codeValue,message]of[['provider_submission_uncertain','private-provider-secret'],
    ['PROVIDER_INSUFFICIENT_CREDITS','private-provider-secret'],['JOB_FAILED','Runway task failed: blocked by content moderation system token=private-provider-secret']]){
    h.rows.set(id(1),{...h.row(1),job_type:'generate_hook_video',status:'failed',error_code:codeValue,error_message:message});
    const status=(await h.call('get_operation',{operation_id:id(1)})).structuredContent;
    assert.equal(status.operation.can_retry,false);assert.doesNotMatch(JSON.stringify(status),/private-provider-secret/);
    assert.equal(code(await h.call('retry_operation',{operation_id:id(1),request_id:id(99),expected_updated_at:h.row(1).updated_at})),'OPERATION_NOT_RETRYABLE');
    assert.equal(h.dispatches.length,0);
  }
});
test('lost retry response recovers its receipt, preserves funded dispatch failures and never retries a later failed revision',async()=>{
  const h=harness();h.rows.set(id(1),{...h.row(1),status:'failed',error_code:'OUTPUT_UPLOAD_FAILED'});h.deliveryFailed=true;
  const args={operation_id:id(1),request_id:id(99),expected_updated_at:h.row(1).updated_at};
  const first=(await h.call('retry_operation',args)).structuredContent;assert.equal(first.replayed,false);assert.equal(first.operation.status,'queued');assert.equal(h.receipts.size,1);
  h.configurationMissing=true;h.deliveryFailed=false;
  const replay=(await h.call('retry_operation',args)).structuredContent;assert.equal(replay.replayed,true);assert.equal(h.rows.get(id(1)).queue_message_id,`offline-task:${id(1)}:1`);
  h.rows.get(id(1)).status='failed';h.rows.get(id(1)).error_code='provider_submission_uncertain';
  const dispatches=h.dispatches.length;assert.equal((await h.call('retry_operation',args)).structuredContent.replayed,true);assert.equal(h.dispatches.length,dispatches);
  assert.equal(code(await h.call('cancel_operation',args)),'REQUEST_CONFLICT');
});
test('missing queue config or changed revisions fail before action; outages stay sanitized and preserve recovery identity',async()=>{
  const h=harness();h.rows.set(id(1),{...h.row(1),status:'failed',error_code:'OUTPUT_UPLOAD_FAILED'});h.configurationMissing=true;
  const args={operation_id:id(1),request_id:id(99),expected_updated_at:h.row(1).updated_at};
  assert.equal(code(await h.call('retry_operation',args)),'OPERATION_DISPATCH_UNAVAILABLE');assert.equal(h.receipts.size,0);
  h.configurationMissing=false;assert.equal(code(await h.call('retry_operation',{...args,expected_updated_at:'2026-10-10T00:00:00Z'})),'OPERATION_CHANGED');
  assert.equal(h.receipts.size,0);h.outage=true;const r=await h.call('get_operation',{operation_id:id(1)});assert.equal(code(r),'OPERATIONS_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(r),/private-database-secret/);
});
