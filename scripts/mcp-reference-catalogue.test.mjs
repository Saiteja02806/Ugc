import assert from "node:assert/strict";
import test from "node:test";
process.env.GCP_STORAGE_BUCKET="reference-catalogue-offline-fixture";
process.env.GCP_STORAGE_PUBLIC_BASE_URL="https://catalogue.example.test";
const { getRecreateReferences }=await import("../lib/explore/recreate-catalog.ts");
const { listExploreReferences,getExploreReference }=await import("../lib/explore/reference-access.ts");
test("actual published catalogue pages are complete and preserve application media/paired audio",()=>{
  const expected=getRecreateReferences(),seen=[];let cursor;
  do{const page=listExploreReferences({limit:7,...(cursor?{cursor}:{})});seen.push(...page.items);assert.equal(page.total,expected.length);cursor=page.next_cursor;}while(cursor);
  assert.deepEqual(seen,expected);assert.equal(new Set(seen.map(r=>r.id)).size,seen.length);assert.ok(seen.some(r=>r.pairedAudio));
  for(const kind of ["hook","wall_text","slideshow"]){const page=listExploreReferences({format:kind,limit:50});assert.ok(page.items.length);assert.ok(page.items.every(r=>r.format===kind));}
});
test("actual text retrieval is bound to catalogue source and selected slide",()=>{
  const refs=getRecreateReferences();let ready=0;
  for(const reference of refs){
    if(reference.format==="slideshow")assert.equal(getExploreReference(reference.id,null).text_status,"slide_required");
    for(const slideId of reference.format==="slideshow"?reference.slides.map(s=>s.id):[null]){
      const result=getExploreReference(reference.id,slideId);assert.equal(result.reference.id,reference.id);
      if(result.source){assert.equal(result.source.referenceId,reference.id);assert.equal(result.source.slideId,slideId);assert.equal(result.source.format,reference.format);
        const url=slideId?reference.slides.find(s=>s.id===slideId).url:reference.videoUrl;assert.ok(new URL(url).pathname.includes(result.source.sourceSha256));if(result.source.status==="ready")ready++;}
    }
  }
  assert.ok(ready>0,"Existing reviewed text must remain available without OCR/provider calls");
});
