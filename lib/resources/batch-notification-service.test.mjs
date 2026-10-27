import assert from 'node:assert/strict';
import { test, mock, after } from 'node:test';
const original={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-private-key';
after(()=>{for(const [name,value] of [['NEXT_PUBLIC_SUPABASE_URL',original.url],['SUPABASE_SERVICE_ROLE_KEY',original.key]])if(value===undefined)delete process.env[name];else process.env[name]=value});
let allowed=true,rateError=false,saveError=false,records=[];
mock.module('@supabase/supabase-js',{namedExports:{createClient:(url,key,options)=>{
  assert.equal(url,'https://fixture.supabase.co');assert.equal(key,'fixture-private-key');assert.equal(options.auth.persistSession,false);
  return {async rpc(name,{p_buckets}){assert.equal(name,'consume_auth_email_limits');assert.deepEqual(p_buckets.map(b=>b.max_requests),[5,20,200]);for(const b of p_buckets){assert.match(b.key,/^[a-f0-9]{64}$/);assert.equal(b.window_seconds,3600)}return {data:{allowed},error:rateError?{}:null}},
    from(table){assert.equal(table,'resource_batch_notifications');return {async upsert(value,opts){assert.deepEqual(opts,{onConflict:'batch,email',ignoreDuplicates:true});if(!saveError)records.push(value);return {error:saveError?{}:null}}}}};
}}});
const {batchNotificationPOST:POST}=await import('./batch-notification-service.ts');
const request=()=>new Request('https://getugcpilot.com/api/resources/hook-video-bundle/notify',{method:'POST',headers:{origin:'https://getugcpilot.com','content-type':'application/json','x-vercel-forwarded-for':'203.0.113.1'},body:JSON.stringify({email:'OWNER@EXAMPLE.COM',consent:true})});
test('actual adapter saves only batch-specific consent; no email delivery',async()=>{
  const response=await POST(request());assert.equal(response.status,200);
  assert.deepEqual(records,[{batch:'hook-videos-2',email:'owner@example.com',consent_version:'batch-2-only-v1'}]);
});
test('adapter fails closed for rate denial, missing configuration and database errors',async()=>{
  records=[];allowed=false;assert.equal((await POST(request())).status,429);assert.equal(records.length,0);allowed=true;
  rateError=true;assert.equal((await POST(request())).status,503);assert.equal(records.length,0);rateError=false;
  saveError=true;assert.equal((await POST(request())).status,503);saveError=false;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;assert.equal((await POST(request())).status,503);process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-private-key';
});
