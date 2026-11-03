import assert from 'node:assert/strict';import {test,mock} from 'node:test';
mock.module('../firebase/auth.ts',{namedExports:{getCurrentUserIdToken:async()=> 'token'}});
const {prepareStudioReferenceAssets}=await import('./studio-preparation-client.ts');
const uuid='12345678-1234-5123-a123-123456789012';
const good=()=>Response.json({ok:true,references:[{traitId:'char_extreme',assetId:uuid}]});
test('client retries only idempotent preparation and sends exact selected ids',async()=>{
 let calls=0;const result=await prepareStudioReferenceAssets('owner',['char_extreme'],{token:async owner=>{assert.equal(owner,'owner');return'token'},fetch:async(url,init)=>{assert.equal(url,'/api/characters/studio-references');assert.deepEqual(JSON.parse(init.body),{traitIds:['char_extreme']});if(++calls===1)throw new TypeError('Failed to fetch');return good()},timeoutMs:100});assert.deepEqual(result,[uuid]);assert.equal(calls,2);
});
test('client bounds stalled response bodies and preserves safe retry wording',async()=>{
 let n=0;await assert.rejects(prepareStudioReferenceAssets('owner',['char_extreme'],{token:async()=> 'token',fetch:async()=>{n++;return new Response(new ReadableStream({start(){}}))},timeoutMs:5}),/interrupted/);assert.equal(n,2);
});
test('client never retries auth or input rejection, and rejects wrong order, duplicated or malformed receipts',async()=>{
 let n=0;await assert.rejects(prepareStudioReferenceAssets('owner',['char_extreme'],{token:async()=> 'token',fetch:async()=>{n++;return Response.json({ok:false,error:'Sign in again'},{status:401})},timeoutMs:100}),/Sign in again/);assert.equal(n,1);
 for(const references of [[],[{traitId:'wrong',assetId:uuid}],[{traitId:'char_extreme',assetId:'https://evil.test'}]]){
 await assert.rejects(prepareStudioReferenceAssets('owner',['char_extreme'],{token:async()=> 'token',fetch:async()=>Response.json({ok:true,references}),timeoutMs:100}),/verified/);
 }
});
