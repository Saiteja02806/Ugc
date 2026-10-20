import assert from 'node:assert/strict';
import test from 'node:test';
import { registerMutationMcpTools } from '../lib/mcp/mutation-tools.ts';
import { registerUploadRecoveryMcpTools } from '../lib/mcp/upload-recovery-tools.ts';
import { gcsStorageProvider } from '../lib/storage/gcs.ts';
import { uploadProbe } from '../lib/mcp/upload-probe.ts';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://recovery-fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='offline-recovery-fixture';
process.env.GCP_STORAGE_BUCKET='offline-bucket';
process.env.GCP_STORAGE_PUBLIC_BASE_URL='https://cdn.example.test';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const code=r=>JSON.parse(r.content[0].text).code;
function harness() {
  const rows=new Map(), calls=[], tools=new Map();
  const state={head:'missing',signError:false,databaseError:false,race:false,probeError:false};
  const row=(key,owner='owner-a')=>({id:key,user_id:owner,collection:'image',source_type:'upload',source_record_id:key,
    status:'uploading',mime_type:'image/png',file_size_bytes:1024,file_name:'test.png',title:'Image',
    width:null,height:null,duration_seconds:null,ratio:'other',storage_key:`media/${owner}/image/${key}.png`,
    url:`https://cdn.example.test/${key}`,thumbnail_url:null,deleted_at:null,
    created_at:'2026-10-11T00:00:00Z',updated_at:'2026-10-11T00:00:00Z',metadata:{mcpUpload:true}});
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    const body=init?.body?JSON.parse(init.body):null;
    calls.push({path:url.pathname,query:url.searchParams,body});
    if(state.databaseError) return Response.json({message:'private-database-secret'}, {status:400});
    if(url.pathname.endsWith('/rpc/mcp_claim_deleted_upload_cleanup')) return Response.json([]);
    if(url.pathname.endsWith('/rpc/mcp_reserve_upload')) {
      const existing=[...rows.values()].find(r=>r.user_id===body.p_user_id&&r.metadata.mcpUploadRequestKey===body.p_request_id);
      if(existing) {
        if(existing.metadata.mcpUploadFingerprint!==body.p_fingerprint) return Response.json({message:'mcp_upload_request_conflict'},{status:400});
        if(existing.deleted_at) return Response.json({message:'mcp_upload_deleted'},{status:400});
        return Response.json(existing);
      }
      const r={...row(body.p_asset_id,body.p_user_id),collection:body.p_collection,source_type:body.p_source_type,
        title:body.p_title,file_name:body.p_file_name,file_size_bytes:body.p_file_size_bytes,mime_type:body.p_mime_type,
        storage_key:body.p_storage_key,url:body.p_url,
        metadata:{mcpUpload:true,mcpUploadRequestKey:body.p_request_id,mcpUploadFingerprint:body.p_fingerprint}};
      rows.set(r.id,r);return Response.json(r);
    }
    if(url.pathname.endsWith('/rpc/mcp_lease_upload_url')) {
      const r=rows.get(body.p_asset_id);
      if(!r||r.deleted_at||r.user_id!==body.p_user_id) return Response.json({message:'mcp_upload_not_found'},{status:400});
      if(r.status!=='uploading') return Response.json({message:'mcp_upload_already_confirmed'},{status:400});
      r.metadata.mcpUploadUrlExpiresAt=new Date(Date.now()+600000).toISOString();
      return Response.json(r);
    }
    assert.ok(url.pathname.endsWith('/media_assets'),url.pathname);
    assert.equal(url.searchParams.get('deleted_at'),'is.null');
    const owner=url.searchParams.get('user_id')?.slice(3), assetId=url.searchParams.get('id')?.slice(3);
    let matches=[...rows.values()].filter(r=>r.user_id===owner&&!r.deleted_at);
    if(assetId) matches=matches.filter(r=>r.id===assetId);
    if(url.searchParams.get('metadata->>mcpUpload')) {
      assert.equal(url.searchParams.get('metadata->>mcpUpload'),'eq.true');matches=matches.filter(r=>r.metadata.mcpUpload===true);
    }
    if(url.searchParams.get('metadata->>mcpUploadRequestKey')) matches=matches.filter(r=>r.metadata.mcpUploadRequestKey===url.searchParams.get('metadata->>mcpUploadRequestKey').slice(3));
    const contains=url.searchParams.getAll('metadata');
    for(const condition of contains) {
      const fields=JSON.parse(condition.slice(3));matches=matches.filter(r=>Object.entries(fields).every(([k,v])=>r.metadata[k]===v));
    }
    const status=url.searchParams.get('status')?.slice(3);
    if(status) matches=matches.filter(r=>r.status===status);
    if(init?.method==='PATCH') {
      const r=matches[0];if(!r)return Response.json(null);
      Object.assign(r,body);return Response.json(state.race?null:r);
    }
    if(url.searchParams.get('or')) matches=matches.filter(r=>r.id!==id(1));
    return Response.json(assetId||url.searchParams.get('limit')===null?matches[0]??null:matches.slice(0,Number(url.searchParams.get('limit'))));
  };
  gcsStorageProvider.createSignedPutUrl=async params=>{
    calls.push({sign:params});if(state.signError)throw new Error('provider-private-secret');
    return `https://storage.example.test/${params.key}?signature=fixture`;
  };
  gcsStorageProvider.headObject=async params=>{
    calls.push({head:params});if(state.head==='missing')throw Object.assign(new Error('missing'),{name:'NoSuchKey'});
    if(state.head==='error')throw new Error('provider-private-secret');
    const r=[...rows.values()].find(r=>r.storage_key===params.key);
    return {ContentType:r.mime_type,ContentLength:r.file_size_bytes};
  };
  uploadProbe.run=async r=>{calls.push({probe:r.id});if(state.probeError)throw new Error('probe-private-secret');
    return {width:640,height:640,durationSeconds:null};};
  const server={registerTool:(name,config,callback)=>tools.set(name,{config,callback})};
  registerMutationMcpTools(server);registerUploadRecoveryMcpTools(server);
  const call=async(name,input,owner='owner-a',scopes=['assets:read','assets:write'])=>{
    const t=tools.get(name);const result=await t.callback(t.config.inputSchema.parse(input),{http:{authInfo:{scopes,extra:{firebaseUid:owner}}}});
    if(!result.isError)t.config.outputSchema.parse(result.structuredContent);
    return result;
  };
  return {rows,calls,tools,state,row,call};
}
const createArgs={request_id:id(99),collection:'image',file_name:'test.png',file_size_bytes:1024,mime_type:'image/png'};
test('request-key create recovers a lost signed-URL response and rejects changed inputs without new identity',async()=>{
  const h=harness();h.state.signError=true;
  assert.equal(code(await h.call('create_upload',createArgs)),'STORAGE_UNAVAILABLE');assert.equal(h.rows.size,1);
  const recovered=(await h.call('get_upload',{request_id:id(99)})).structuredContent.upload;
  h.state.signError=false;const retried=(await h.call('create_upload',createArgs)).structuredContent;
  assert.equal(retried.upload_id,recovered.upload_id);assert.equal(h.rows.size,1);
  assert.equal(code(await h.call('create_upload',{...createArgs,title:'different'})),'UPLOAD_REQUEST_CONFLICT');
  const signed=h.calls.filter(c=>c.sign).at(-1).sign;
  assert.equal(signed.createOnly,true);assert.ok(signed.expiresInSeconds>0&&signed.expiresInSeconds<=600);
});
test('recovery tools reject forged identity and enforce correct read/write scopes before storage calls',async()=>{
  const h=harness();h.rows.set(id(1),h.row(id(1)));
  for(const [name,input] of [['get_upload',{upload_id:id(1)}],['list_uploads',{}],['renew_upload',{upload_id:id(1)}]]){
    const before=h.calls.length;assert.equal(code(await h.call(name,input,'owner-a',[])),'INSUFFICIENT_SCOPE');assert.equal(h.calls.length,before);
    assert.equal(h.tools.get(name).config.inputSchema.safeParse({...input,user_id:'owner-b'}).success,false);
  }
  assert.equal(h.tools.get('get_upload').config.inputSchema.safeParse({upload_id:id(1),request_id:id(2)}).success,false);
  assert.equal(h.tools.get('get_upload').config.inputSchema.safeParse({}).success,false);
  assert.equal(code(await h.call('get_upload',{upload_id:id(1)},'owner-b')),'NOT_FOUND');
});
test('legacy pending uploads are discoverable and pagination is account/filter bound without private fields',async()=>{
  const h=harness();for(const n of [1,2,3])h.rows.set(id(n),h.row(id(n)));
  const first=(await h.call('list_uploads',{limit:1})).structuredContent;
  assert.equal(first.items.length,1);assert.equal(first.items[0].request_id,null);assert.ok(first.next_cursor);
  assert.doesNotMatch(JSON.stringify(first),/storage_key|signature|cdn\.example|metadata|owner-a/);
  const next=(await h.call('list_uploads',{limit:1,cursor:first.next_cursor})).structuredContent;
  assert.equal(next.items[0].upload_id,id(2));
  const before=h.calls.length;
  assert.equal(code(await h.call('list_uploads',{cursor:first.next_cursor},'owner-b')),'INVALID_CURSOR');
  assert.equal(code(await h.call('list_uploads',{cursor:first.next_cursor,status:'all'})),'INVALID_CURSOR');
  assert.equal(h.calls.length,before);
});
test('renewal never overwrites bytes or signs for foreign, confirmed, deleted or uncertain reservations',async()=>{
  const h=harness();h.rows.set(id(1),h.row(id(1)));
  const renewed=(await h.call('renew_upload',{upload_id:id(1)})).structuredContent;
  assert.equal(renewed.upload_id,id(1));assert.equal(h.rows.size,1);
  h.state.head='ready';assert.equal(code(await h.call('renew_upload',{upload_id:id(1)})),'UPLOAD_ALREADY_TRANSFERRED');
  h.state.head='error';assert.equal(code(await h.call('renew_upload',{upload_id:id(1)})),'STORAGE_UNAVAILABLE');
  assert.equal(code(await h.call('renew_upload',{upload_id:id(1)},'owner-b')),'NOT_FOUND');
  h.rows.get(id(1)).status='ready';assert.equal(code(await h.call('renew_upload',{upload_id:id(1)})),'UPLOAD_ALREADY_CONFIRMED');
  h.rows.get(id(1)).deleted_at='2026-10-11T00:00:00Z';assert.equal(code(await h.call('renew_upload',{upload_id:id(1)})),'NOT_FOUND');
  assert.equal(h.calls.filter(c=>c.sign).length,1);
});
test('confirmation rejects client dimensions, persists probe results and recovers a concurrent confirmation',async()=>{
  const h=harness();h.rows.set(id(1),h.row(id(1)));h.state.head='ready';
  assert.equal(code(await h.call('confirm_upload',{upload_id:id(1),width:800,height:640})),'UPLOAD_MISMATCH');
  assert.equal(h.rows.get(id(1)).status,'uploading');
  h.state.race=true;const result=(await h.call('confirm_upload',{upload_id:id(1),width:640,height:640})).structuredContent;
  assert.equal(result.asset.width,640);assert.equal(result.asset.id,id(1));
  const probes=h.calls.filter(c=>c.probe).length;
  await h.call('confirm_upload',{upload_id:id(1),width:640,height:640});
  assert.equal(h.calls.filter(c=>c.probe).length,probes);
});
test('database/provider errors do not leak and private rollout fails before reservation/storage writes',async()=>{
  const h=harness();h.state.databaseError=true;
  const failed=await h.call('get_upload',{upload_id:id(1)});
  assert.equal(code(failed),'UPLOADS_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(failed),/private-database-secret/);
  h.state.databaseError=false;const before=h.calls.length;
  process.env.PRIVATE_USER_MEDIA_ENABLED='true';
  try{assert.equal((await h.call('create_upload',createArgs)).isError,true);assert.equal(h.calls.length,before);}
  finally{delete process.env.PRIVATE_USER_MEDIA_ENABLED;}
});
