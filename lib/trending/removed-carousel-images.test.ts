import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { usesRemovedCarouselImage } from "./removed-carousel-images.ts";
import { isRecoverableTrendingReview } from "./reviewed-feed-candidate.ts";
const policy=JSON.parse(fs.readFileSync(new URL("./removed-carousel-images.json",import.meta.url),"utf8"));
function candidate(url="/safe.webp") {
 const slide={headline:"Keep this copy",renderedUrl:url,slideNumber:1,status:"ready"};
 const carousel={carouselId:"carousel",status:"completed",slideCount:1,slides:[slide]};
 return {format:"carousel",item:{id:"post",assignmentId:"assignment",creativeId:"creative",feedItemId:"feed",readiness:"preview_ready",format:"carousel",creative:carousel},carousel,slides:[slide]};
}
test("all deleted image objects and source IDs are rejected from nested cached snapshots",()=>{
 for(const key of policy.storageKeys) {
  const url="https://storage.googleapis.com/ugcsaas-media/"+key;
  assert.equal(usesRemovedCarouselImage({preview:{url}}),true);
  assert.equal(isRecoverableTrendingReview(candidate(url)),false);
 }
 for(const id of policy.assetIds) assert.equal(usesRemovedCarouselImage({content:{slides:[{backgroundAssetId:id}]}}),true);
});
test("unrelated slideshow history survives, and removed edit snapshots cannot revive it",()=>{
 const safe=candidate(); assert.equal(isRecoverableTrendingReview(safe),true);
 const edit={assignmentId:"assignment",creativeId:"creative",format:"carousel",content:{format:"carousel",version:"trending-creative-edit-v1",slides:[{backgroundAssetId:policy.assetIds[0]}]}};
 assert.equal(isRecoverableTrendingReview({...safe,reviewedEdit:edit}),false);
 assert.equal(usesRemovedCarouselImage({backgroundAssetId:"unrelated",renderedUrl:"/safe.webp"}),false);
});
