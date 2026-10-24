import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock, test } from "node:test";
import { getCreatorSlideshowAccounts, getCreatorSlideshowReference, readCreatorSlide } from "./creator-slideshows.ts";
import { creatorSlideUrl, resolveCreatorSlideDelivery, verifyCreatorSlideDelivery } from "../../worker/src/lib/creator-slide-delivery.ts";
import { ReferenceTextSchema } from "./reference-text.ts";
import { resolveRemixSource } from "./remix-source.ts";

const allowed = {uid:"pilot-owner",email:"vtu19403@veltech.edu.in",emailVerified:true};
const requiresPrivateFixture = { skip: getCreatorSlideshowAccounts(allowed).length === 0 && "Private slideshow fixtures or package key are unavailable in this public clone." };
let actor=allowed;
const rows=new Map();let writes=0;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
class FirebaseAuthRequestError extends Error { status=401; }
mock.module(new URL("../firebase/server-auth.ts",import.meta.url),{namedExports:{FirebaseAuthRequestError,requireFirebaseUser:async()=>actor}});
mock.module(new URL("../ai-studio/server-access.ts",import.meta.url),{namedExports:{requireAIStudioProUser:async()=>actor}});
mock.module(new URL("./recreate-catalog.ts",import.meta.url),{namedExports:{getRecreateReferences:()=>[],getRecreateReference:()=>undefined}});
mock.module(new URL("../storage/storage.ts",import.meta.url),{namedExports:{isTrustedStorageUrl:url=>url.startsWith("https://owned.test/"),buildPublicStorageUrl:()=>assert.fail("No public copy"),headStorageObject:async()=>assert.fail("No public storage read")}});
mock.module(new URL("../media/media-storage.ts",import.meta.url),{namedExports:{
  getMediaAssetForOwnerByStorageKey:async({userId,storageKey})=>[...rows.values()].find(row=>row.user_id===userId&&row.storage_key===storageKey)??null,
  getMediaAssetForOwner:async({userId,assetId})=>rows.get(assetId)?.user_id===userId?rows.get(assetId):null,
  upsertReadyMediaAsset:async input=>{writes++;const row={id:uuid(writes),user_id:input.userId,status:"ready",deleted_at:null,collection:input.collection,source_type:input.sourceType,project_id:input.projectId,source_record_id:input.sourceRecordId,storage_key:input.storageKey,url:input.url,mime_type:input.mimeType,width:input.width,height:input.height,file_size_bytes:input.fileSizeBytes,metadata:input.metadata};rows.set(row.id,row);return row;},
  serializeMediaAsset:row=>({id:row.id,url:resolveCreatorSlideDelivery(row.url),metadata:row.metadata}),
}});
mock.module(new URL("../media/media-delivery.ts",import.meta.url),{namedExports:{isPrivateUserMedia:()=>false}});
mock.module(new URL("../media/private-media-storage.ts",import.meta.url),{namedExports:{assertPrivateMediaIdentity:()=>assert.fail("Wrong private storage"),privateMediaObject:()=>assert.fail("Wrong private storage")}});
mock.method(globalThis,"fetch",async()=>assert.fail("No network or paid provider calls"));
const {GET:catalogue}=await import("../../app/api/explore/creator-accounts/route.ts");
const {GET:media}=await import("../../app/api/explore/creator-slide-media/[referenceId]/[slideId]/route.ts");
const {GET:provider}=await import("../../app/api/explore/creator-slide-provider/[...path]/route.ts");
const {GET:canvas}=await import("../../app/api/explore/slideshows/image/route.ts");
const {importSlideshowReferenceForOwner}=await import("./slideshow-reference-import.ts");
const {getReferenceText}=await import("./reference-text-store.ts");
const {prepareSlideshowSaveForOwner}=await import("./slideshow-api.ts");

test("ten slideshow sets retain all 39 immutable slides, caption identities, private previews, imports and canvas editing",requiresPrivateFixture,async()=>{
  process.env.CREATOR_REFERENCE_SIGNING_SECRET="private-slideshow-test-key-at-least-32-characters";
  const accounts=getCreatorSlideshowAccounts(allowed);assert.equal(accounts.length,1);assert.equal(accounts[0].items.length,10);
  assert.equal(getCreatorSlideshowAccounts({...allowed,email:"other@example.com"}).length,0);
  const response=await catalogue(new Request("https://www.getugcpilot.com/api/explore/creator-accounts?format=slideshow"));assert.equal((await response.json()).accounts[0].items.length,10);
  let total=0;
  for(const entry of accounts[0].items){
    const reference=getCreatorSlideshowReference(entry.id,allowed);
    const imported=await importSlideshowReferenceForOwner(allowed.uid,{referenceId:entry.id,slideIds:[...entry.slides].reverse().map(slide=>slide.id)},allowed);
    assert.equal(imported.length,entry.slides.length);
    for(const [index,slide] of entry.slides.entries()){
      const object=await readCreatorSlide(entry.id,slide.id);assert.ok(object.bytes.length);assert.equal(createHash("sha256").update(object.bytes).digest("hex"),object.slide.sha256);
      const params={params:Promise.resolve({referenceId:entry.id,slideId:slide.id})};
      assert.equal((await media(new Request("https://www.getugcpilot.com"+slide.url),params)).status,200);
      const canonical=reference.slides[index].url,signed=resolveCreatorSlideDelivery(canonical);
      assert.equal(resolveRemixSource({format:"slideshow",referenceId:null,sourceUrl:canonical},[entry],"slideshow").slideId,slide.id);
      assert.ok(verifyCreatorSlideDelivery(signed));assert.equal((await provider(new Request(signed))).status,200);assert.equal((await provider(new Request(canonical))).status,404);
      assert.equal((await canvas(new Request(`https://www.getugcpilot.com/api/explore/slideshows/image?mediaAssetId=${imported[index].id}`))).status,200);
      const text=ReferenceTextSchema.parse(getReferenceText(entry.id,slide.id,"slideshow",allowed));assert.equal(text.sourceSha256,object.slide.sha256);assert.ok(text.blocks[0].text);
      assert.equal(imported[index].metadata.exploreOriginalReference.slideNumber,index+1);
      assert.equal(new URL(rows.get(imported[index].id).url).search,"");
      total++;
    }
    const before=writes;await importSlideshowReferenceForOwner(allowed.uid,{referenceId:entry.id,slideIds:entry.slides.map(s=>s.id)},allowed);assert.equal(writes,before);
  }
  assert.equal(total,39);
});

test("other emails cannot import, render, read or remix private creator slides even with known identities",requiresPrivateFixture,async()=>{
  const entry=getCreatorSlideshowAccounts(allowed)[0].items[0],slide=entry.slides[0];actor={...allowed,email:"other@example.com"};
  const params={params:Promise.resolve({referenceId:entry.id,slideId:slide.id})};
  assert.equal((await media(new Request("https://www.getugcpilot.com"+slide.url),params)).status,404);
  await assert.rejects(importSlideshowReferenceForOwner(allowed.uid,{referenceId:entry.id,slideIds:[slide.id]},actor));
  assert.throws(()=>getReferenceText(entry.id,slide.id,"slideshow",actor));
  const imported=[...rows.values()][0];assert.equal((await canvas(new Request(`https://www.getugcpilot.com/api/explore/slideshows/image?mediaAssetId=${imported.id}`))).status,404);
  actor=allowed;
});

test("private reference saves preserve the normal owned rendered-image contract and reject unrendered provider links",requiresPrivateFixture,async()=>{
  process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED="true";const ref=getCreatorSlideshowAccounts(allowed)[0].items[0];
  const outputs=[0,1].map(index=>({id:uuid(100+index),user_id:allowed.uid,deleted_at:null,status:"ready",collection:"image",mime_type:"image/png",url:`https://owned.test/rendered-${index}.png`,storage_key:`owned/rendered-${index}.png`}));outputs.forEach(row=>rows.set(row.id,row));
  const body={version:2,requestKey:uuid(500),referenceId:ref.id,slides:outputs.map((row,index)=>({referenceSlideId:ref.slides[index].id,mediaAssetId:row.id}))};
  const prepared=await prepareSlideshowSaveForOwner(allowed.uid,body,allowed);assert.ok(!(prepared instanceof Response));assert.equal(prepared.p_metadata.referenceId,ref.id);assert.equal(prepared.p_slides.length,2);
  assert.ok(await prepareSlideshowSaveForOwner(allowed.uid,body,{...allowed,email:"other@example.com"}) instanceof Response);
  assert.ok(await prepareSlideshowSaveForOwner(allowed.uid,{...body,version:1,slides:ref.slides.slice(0,2).map(slide=>({referenceSlideId:slide.id,mediaAssetId:null}))},allowed) instanceof Response);
});

test("private provider read capability expires and cannot authorize a different slide, hash or host",async()=>{
  process.env.CREATOR_REFERENCE_SIGNING_SECRET="synthetic-slideshow-test-key-at-least-32-characters";
  const now=Date.now(),canonical=creatorSlideUrl("creator-slideshow-01",{id:"slide-1-"+"a".repeat(12),sha256:"a".repeat(64),extension:"png"});
  const signed=resolveCreatorSlideDelivery(canonical,now);
  assert.equal(verifyCreatorSlideDelivery(signed,now+600_000),null);
  const modified=new URL(signed);modified.pathname=modified.pathname.replace(/\/[a-f0-9]{64}\./,"/"+"f".repeat(64)+".");assert.equal(verifyCreatorSlideDelivery(modified.toString(),now),null);
  const foreign=new URL(signed);foreign.hostname="other.example";assert.equal(verifyCreatorSlideDelivery(foreign.toString(),now),null);
  assert.equal((await provider(new Request(modified))).status,404);
  assert.equal(resolveCreatorSlideDelivery("https://public.example/image.png"),"https://public.example/image.png");
});

test("private slideshow metadata remains hidden from unverified or different identities even without customer fixtures",async()=>{
  for(const denied of [null,{...allowed,emailVerified:false},{...allowed,email:"other@example.com"}]) {
    assert.deepEqual(getCreatorSlideshowAccounts(denied),[]);
    assert.equal(getCreatorSlideshowReference("creator-slideshow-01",denied),undefined);
  }
  actor={...allowed,email:"other@example.com"};
  const response=await catalogue(new Request("https://www.getugcpilot.com/api/explore/creator-accounts?format=slideshow"));
  assert.deepEqual((await response.json()).accounts,[]);
  assert.equal((await media(new Request("https://www.getugcpilot.com/api/explore/creator-slide-media/creator-slideshow-01/slide-1-aaaaaaaaaaaa"),{params:Promise.resolve({referenceId:"creator-slideshow-01",slideId:"slide-1-aaaaaaaaaaaa"})})).status,404);
  actor=allowed;
});
