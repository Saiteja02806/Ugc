import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
let activeState={}, privateCalls=[];
mock.module("@google-cloud/storage",{namedExports:{Storage:class{bucket(name){privateCalls.push({bucket:name});return {
 async getMetadata(){return [{iamConfiguration:{publicAccessPrevention:activeState.prevention??"enforced"}}];},
 file(key){return {
  async getSignedUrl(options){privateCalls.push({sign:{key,...options}});if(activeState.signError)throw new Error("private signing secret");
   return [`https://storage.googleapis.com/${name}/${key}?signature=fixture`];},
  async getMetadata(){privateCalls.push({head:key});if(activeState.head==="missing")throw {code:404};
   if(activeState.head==="error")throw {code:503};return [{size:"1024",contentType:"image/png",generation:"7"}];},
 };},};}}}});
mock.module("@/lib/gcp/credentials",{namedExports:{getGoogleServiceAccountCredentials:()=>null,getMissingVercelGcpCredentialEnvVars:()=>[]}});
const {registerMutationMcpTools}=await import("../lib/mcp/mutation-tools.ts");
const {registerUploadRecoveryMcpTools}=await import("../lib/mcp/upload-recovery-tools.ts");
const {gcsStorageProvider}=await import("../lib/storage/gcs.ts");
const {uploadProbe}=await import("../lib/mcp/upload-probe.ts");
const names=["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","GCP_STORAGE_BUCKET","GCP_STORAGE_PUBLIC_BASE_URL",
 "GCP_PRIVATE_MEDIA_BUCKET","PRIVATE_USER_MEDIA_ENABLED","MCP_PRIVATE_UPLOADS_ENABLED","MEDIA_DELIVERY_SIGNING_SECRET"];
const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
process.env.NEXT_PUBLIC_SUPABASE_URL="https://recovery-fixture.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY="offline-recovery-fixture";
process.env.GCP_STORAGE_BUCKET="offline-bucket";
process.env.GCP_STORAGE_PUBLIC_BASE_URL="https://cdn.example.test";
process.env.GCP_PRIVATE_MEDIA_BUCKET="offline-private";
process.env.PRIVATE_USER_MEDIA_ENABLED="true";
process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";
process.env.MEDIA_DELIVERY_SIGNING_SECRET="offline-fixture-secret-with-at-least-32-characters";
after(()=>{mock.restoreAll();for(const[n,v]of Object.entries(previous)){if(v===undefined)delete process.env[n];else process.env[n]=v;}});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const code=r=>JSON.parse(r.content[0].text).code;
function harness() {
  const rows=new Map(), calls=[], tools=new Map();
  const state={head:'missing',signError:false,databaseError:false,race:false,probeError:false,lostReservation:false};
  activeState=state;
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
    if(url.pathname.endsWith('/rpc/mcp_reserve_upload') || url.pathname.endsWith('/rpc/mcp_reserve_private_upload')) {
      const existing=[...rows.values()].find(r=>r.user_id===body.p_user_id&&r.metadata.mcpUploadRequestKey===body.p_request_id);
      if(existing) {
        if(existing.metadata.mcpUploadFingerprint!==body.p_fingerprint) return Response.json({message:'mcp_upload_request_conflict'},{status:400});
        if(existing.deleted_at) return Response.json({message:'mcp_upload_deleted'},{status:400});
        return Response.json(existing);
      }
      const r={...row(body.p_asset_id,body.p_user_id),collection:body.p_collection,source_type:body.p_source_type,
        title:body.p_title,file_name:body.p_file_name,file_size_bytes:body.p_file_size_bytes,mime_type:body.p_mime_type,
        storage_key:body.p_storage_key,url:body.p_url,
        metadata:{mcpUpload:true,mcpUploadRequestKey:body.p_request_id,mcpUploadFingerprint:body.p_fingerprint,
          ...(url.pathname.endsWith('/rpc/mcp_reserve_private_upload') ? {storageLocation:'private_user_media'} : {})}};
      rows.set(r.id,r);if(state.lostReservation){state.lostReservation=false;return Response.json({message:'lost reservation response'},{status:503});}return Response.json(r);
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
test("MCP private reservation, lost response, renewal and probed confirmation retain one owned identity",async()=>{
 const h=harness();privateCalls=[];h.state.lostReservation=true;
 assert.equal((await h.call("create_upload",createArgs)).isError,true);assert.equal(h.rows.size,1);
 const summary=(await h.call("get_upload",{request_id:id(99)})).structuredContent.upload;
 assert.doesNotMatch(JSON.stringify(summary),/storageLocation|storage_key|storage.googleapis|signature/);
 const reserved=(await h.call("create_upload",createArgs)).structuredContent;
 assert.equal(reserved.upload_id,summary.upload_id);assert.equal(reserved.storage_bucket,"offline-private");
 const row=h.rows.get(reserved.upload_id);assert.equal(row.metadata.storageLocation,"private_user_media");
 assert.equal(privateCalls.filter(c=>c.sign).length,1);assert.equal(h.calls.filter(c=>c.sign).length,0);
 assert.equal(code(await h.call("create_upload",{...createArgs,title:"Changed"})),"UPLOAD_REQUEST_CONFLICT");
 const renewed=(await h.call("renew_upload",{upload_id:row.id})).structuredContent;assert.equal(renewed.upload_id,row.id);
 h.state.head="ready";const signed=privateCalls.filter(c=>c.sign).length;
 assert.equal(code(await h.call("renew_upload",{upload_id:row.id})),"UPLOAD_ALREADY_TRANSFERRED");
 assert.equal(privateCalls.filter(c=>c.sign).length,signed);
 assert.equal(code(await h.call("confirm_upload",{upload_id:row.id,width:600,height:640})),"UPLOAD_MISMATCH");
 assert.equal(row.status,"uploading");
 const ready=(await h.call("confirm_upload",{upload_id:row.id,width:640,height:640})).structuredContent.asset;
 assert.equal(ready.id,row.id);assert.equal(ready.width,640);assert.match(ready.url,/\/api\/media\/delivery\//);
 assert.doesNotMatch(ready.url,/storage.googleapis/);
 const probes=h.calls.filter(c=>c.probe).length;
 await h.call("confirm_upload",{upload_id:row.id,width:640,height:640});assert.equal(h.calls.filter(c=>c.probe).length,probes);
 assert.equal(h.calls.filter(c=>c.head).length,0);
});
test("OAuth and bucket-policy rejection precede private reservation; failed signing retains the committed receipt",async()=>{
 const h=harness();privateCalls=[];
 assert.equal(code(await h.call("create_upload",createArgs,"owner-a",[])),"INSUFFICIENT_SCOPE");
 assert.equal(h.calls.length,0);assert.equal(privateCalls.length,0);
 h.state.prevention="inherited";
 assert.equal(code(await h.call("create_upload",createArgs)),"PRIVATE_UPLOAD_UNAVAILABLE");assert.equal(h.rows.size,0);
 assert.equal(privateCalls.some(c=>c.sign),false);
 h.state.prevention="enforced";h.state.signError=true;
 const rejected=await h.call("create_upload",createArgs);assert.equal(code(rejected),"STORAGE_UNAVAILABLE");
 assert.doesNotMatch(JSON.stringify(rejected),/private signing secret/);assert.equal(h.rows.size,1);
 const saved=(await h.call("get_upload",{request_id:id(99)})).structuredContent.upload;
 h.state.signError=false;assert.equal((await h.call("renew_upload",{upload_id:saved.upload_id})).structuredContent.upload_id,saved.upload_id);
 assert.equal(code(await h.call("renew_upload",{upload_id:saved.upload_id},"other")),"NOT_FOUND");
});
test("an in-flight public reservation is not moved by private-rollout retry",async()=>{
 const h=harness();delete process.env.PRIVATE_USER_MEDIA_ENABLED;delete process.env.MCP_PRIVATE_UPLOADS_ENABLED;
 try{
  const first=(await h.call("create_upload",createArgs)).structuredContent;
  process.env.PRIVATE_USER_MEDIA_ENABLED="true";process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";privateCalls=[];
  const replay=(await h.call("create_upload",createArgs)).structuredContent;
  assert.equal(replay.upload_id,first.upload_id);assert.equal(replay.storage_bucket,undefined);
  assert.equal(h.rows.get(first.upload_id).metadata.storageLocation,undefined);
  assert.equal(privateCalls.some(c=>c.sign),false);
 }finally{process.env.PRIVATE_USER_MEDIA_ENABLED="true";}
});
