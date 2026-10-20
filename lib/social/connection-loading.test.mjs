import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mock, test } from "node:test";

process.env.SUPABASE_URL="https://fixture.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY="fixture-service-key";
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY="fixture-encryption-key-for-tests-only";
function encrypt(text) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY).digest(),iv);
  const value=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),value.toString('base64url')].join('.');
}
const at="2026-10-01T00:00:00Z";
let rows = ["instagram","tiktok","youtube"].map((platform,i)=>({id:`connection-${i}`,user_id:"owner",platform,provider:platform==="instagram"?"meta":platform==="tiktok"?"tiktok":"google",status:"connected",revoked_at:null,connected_at:at,updated_at:at,expires_at:null,refresh_expires_at:null,refresh_token_ciphertext:null,token_refreshed_at:at,
  platform_account_id:`platform-${i}`,platform_account_name:platform,platform_account_username:platform,scopes:["video.publish"],metadata:platform==="instagram"?{accountType:"BUSINESS",profilePictureSyncedAt:at,authorizationRevision:"consent-1"}:{},access_token_ciphertext:encrypt("fixture-access-token")}));
let writes=0,providerReads=0;
mock.module('@supabase/supabase-js',{namedExports:{createClient:()=>({from:()=>{
  let filters=[],patch;
  const query={select(){return query},eq(k,v){filters.push([k,v]);return query},is(k,v){filters.push([k,v]);return query},filter(k,op,v){filters.push([k,v]);return query},order(){return query},update(value){patch=value;return query},
    then(resolve){assert.ok(filters.some(([k,v])=>k==='user_id'&&v==='owner'));let matching=rows.filter(row=>filters.every(([k,v])=>row[k]===v));if(patch){writes++;for(const row of matching)Object.assign(row,patch);}return Promise.resolve({data:matching,error:null}).then(resolve);}};return query;
}})}});
const {listSocialConnections,refreshSocialConnectionProfilesForOwner}=await import('./oauth.ts');
test('account display is a pure owner-scoped read even with a stale Instagram profile',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>{providerReads++;throw Error('No provider reads allowed')};
  try{const result=await listSocialConnections('owner');assert.equal(result.length,3);assert.equal(providerReads,0);assert.equal(writes,0);assert.equal(result[0].authorizationRevision,'consent-1');assert.equal(result[0].profileNeedsRefresh,true);assert.ok(result.every(row=>!('access_token_ciphertext' in row)));}finally{globalThis.fetch=original;}
});
test('background profile failures use backoff and do not mutate the authorization revision',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async(_url,init)=>{providerReads++;assert.ok(init.signal);return Response.json({error:{message:'Temporary error'}},{status:503})};
  try{await refreshSocialConnectionProfilesForOwner('owner');assert.equal(providerReads,1);assert.equal(writes,1);assert.ok(Date.parse(rows[0].metadata.profileLookupRetryAt)>Date.now());
    await refreshSocialConnectionProfilesForOwner('owner');assert.equal(providerReads,1);assert.equal(rows[0].metadata.authorizationRevision,'consent-1');
  }finally{globalThis.fetch=original;}
});
