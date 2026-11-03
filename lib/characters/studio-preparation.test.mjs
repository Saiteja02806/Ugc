import assert from 'node:assert/strict';
import test from 'node:test';
import {ensureCharacterCatalogCache,readCatalogImage} from '../../scripts/character-catalog-test-cache.mjs';
await ensureCharacterCatalogCache();
import {createHash} from 'node:crypto';
import {ALL_TRAITS} from './influencer-registry.ts';
import fingerprints from './studio-image-fingerprints.json' with {type:'json'};
import {createStudioPreparer,studioReferenceIdentity,encodeStudioImage,fetchStudioImage,studioDeadline} from './studio-preparation.ts';
const source=id=>readCatalogImage(studioReferenceIdentity('owner',id).path);
function fixture(){
 const rows=new Map(),objects=new Map(),calls={fetch:0,upload:0,save:0};
 const dep={
  async get({userId,assetId}){const row=rows.get(assetId);return row?.user_id===userId?row:null},
  async fetchImage(path){calls.fetch++;return readCatalogImage(path)},
  encode:encodeStudioImage,
  url:key=>'https://storage.example/'+key,
  async upload({key,buffer}){calls.upload++;if(objects.has(key))throw Error('412');objects.set(key,buffer);return{key,url:dep.url(key)}},
  async readObject(key){if(!objects.has(key))throw Error('404');return objects.get(key)},
  async save(input){calls.save++;const row={id:input.assetId,user_id:input.userId,status:'ready',deleted_at:null,collection:input.collection,project_id:input.projectId,storage_key:input.storageKey,url:input.url,mime_type:input.mimeType,width:input.width,height:input.height,source_record_id:input.sourceRecordId,source_type:input.sourceType};rows.set(row.id,row);return row},
 };
 return{dep,rows,objects,calls,prepare:createStudioPreparer(dep)};
}
test('catalog fingerprints cover exact registered bytes; changed assets cannot reuse old receipts',()=>{
 for(const trait of ALL_TRAITS){if(!trait.imagePath||trait.isCustomUpload)continue;assert.equal(createHash('sha256').update(readCatalogImage(trait.imagePath)).digest('hex'),fingerprints[trait.imagePath],trait.id)}
});
test('owner-scoped stable identities reject uploaded/unknown/non-image choices',()=>{
 assert.notEqual(studioReferenceIdentity('owner','char_extreme').id,studioReferenceIdentity('other','char_extreme').id);
 assert.equal(studioReferenceIdentity('owner','char_extreme').id,studioReferenceIdentity('owner','char_extreme').id);
 for(const id of ['https://evil.test/a','../../secret','upload_123','hair_color_black','outfit_none'])assert.throws(()=>studioReferenceIdentity('owner',id));
});
test('real image encoding preserves dimensions within 1280 with no upscaling',async()=>{
 const image=await encodeStudioImage(source('char_extreme'));assert.equal(image.width,1254);assert.equal(image.height,1254);assert(image.buffer.length<source('char_extreme').length);
 await assert.rejects(encodeStudioImage(Buffer.from('not an image')));
});
test('bounded fetch retries transport/503 failures but not invalid content/404 and aborts stalled bodies',async()=>{
 let n=0;const fetcher=async(url)=>{assert.match(String(url),/^https:\/\/storage.googleapis.com\/ugcsaas-media\/catalog\/character-studio\/v1\/[a-f0-9]{64}\.png$/);if(++n===1)throw Error('network');return new Response('bytes',{headers:{'content-type':'image/png'}})};
 assert.equal((await fetchStudioImage('/explore/influencer-studio/characters/3.png',fetcher)).toString(),'bytes');assert.equal(n,2);
 n=0;await assert.rejects(fetchStudioImage('/explore/influencer-studio/characters/3.png',async()=>{n++;return new Response('',{status:404})}));assert.equal(n,1);
 n=0;await assert.rejects(fetchStudioImage('/explore/influencer-studio/characters/3.png',async()=>{n++;return new Response('<html>',{headers:{'content-type':'text/html'}})}));assert.equal(n,1);
 const signals=[];await assert.rejects(fetchStudioImage('/explore/influencer-studio/characters/3.png',async(url,{signal})=>{signals.push(signal);return new Response(new ReadableStream({start(){}}),{headers:{'content-type':'image/png'}})},5));assert.equal(signals.length,2);assert(signals.every(s=>s.aborted));
 await assert.rejects(studioDeadline(()=>new Promise(()=>{}),5));
});
test('retry and a new server instance reuse ready owned receipts without any refetch or upload',async()=>{
 const f=fixture(),ids=['char_extreme','bg_cozy_floral_bedroom','eye_vibrant_open'];
 const result=await f.prepare('owner',ids);assert.deepEqual(result.map(r=>r.traitId),ids);assert.equal(new Set(result.map(r=>r.assetId)).size,3);
 await createStudioPreparer(f.dep)('owner',ids);assert.deepEqual(f.calls,{fetch:3,upload:3,save:3});
 await f.prepare('other',ids);assert.equal(f.rows.size,6);
});
test('partial failure retains completed references and resumes only missing work',async()=>{
 const f=fixture(),base=f.dep.fetchImage;let fail=true;
 f.dep.fetchImage=async path=>{if(fail&&path.includes('natural-casual'))throw Error('network');return base(path)};
 const ids=['char_extreme','bg_cozy_floral_bedroom','eye_vibrant_open','build_natural'];
 await assert.rejects(f.prepare('owner',ids),/Natural \/ Casual.*loading catalog image/);assert.equal(f.rows.size,3);fail=false;
 const refs=await createStudioPreparer(f.dep)('owner',ids);assert.equal(refs.length,4);assert.equal(f.calls.upload,4);
});
test('concurrent same-owner requests and lost storage/database acknowledgements create one immutable result',async()=>{
 const f=fixture(),upload=f.dep.upload,save=f.dep.save;
 f.dep.upload=async input=>{await upload(input);throw Error('lost upload response')};
 f.dep.save=async input=>{await save(input);throw Error('lost db response')};
 const [a,b]=await Promise.all([f.prepare('owner',['char_extreme']),f.prepare('owner',['char_extreme'])]);assert.deepEqual(a,b);assert.equal(f.calls.upload,1);assert.equal(f.rows.size,1);
});
test('separate-instance racing uploads/row insert recover the same ready ID',async()=>{
 const f=fixture();const [a,b]=await Promise.all([createStudioPreparer(f.dep)('owner',['char_extreme']),createStudioPreparer(f.dep)('owner',['char_extreme'])]);assert.deepEqual(a,b);assert.equal(f.objects.size,1);assert.equal(f.rows.size,1);
});
test('wrong source bytes, corrupted receipt or conflicting stored object never become usable references',async()=>{
 const f=fixture();f.dep.fetchImage=async()=>Buffer.from('wrong version');await assert.rejects(f.prepare('owner',['char_extreme']),/catalog version/);assert.equal(f.calls.upload,0);
 const g=fixture();const identity=studioReferenceIdentity('owner','char_extreme');g.objects.set(identity.key,Buffer.from('wrong stored bytes'));await assert.rejects(g.prepare('owner',['char_extreme']),/saving reference image/);assert.equal(g.rows.size,0);
 const h=fixture();await h.prepare('owner',['char_extreme']);h.rows.get(identity.id).url='https://evil.test';await assert.rejects(h.prepare('owner',['char_extreme']),/checking saved reference/);
});
test('no more than three reference preparations run together and invalid batch does no work',async()=>{
 const f=fixture(),read=f.dep.fetchImage;let active=0,peak=0;
 f.dep.fetchImage=async path=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,10));return await read(path)}finally{active--}};
 await f.prepare('owner',['char_extreme','bg_cozy_floral_bedroom','eye_vibrant_open','build_natural','neck_standard']);assert.equal(peak,3);
 const g=fixture();await assert.rejects(g.prepare('owner',['char_extreme','unknown']));assert.equal(g.calls.fetch,0);
});
