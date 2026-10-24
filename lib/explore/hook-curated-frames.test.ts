import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import catalog from "../../worker/src/lib/hook-curated-frames.json" with { type: "json" };
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { getHookReferenceGalleryItems, getHookReferenceReleaseItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { createHookSourceFrameService, HookSourceFrameError } from "./hook-source-frame.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft, hookKeyframeInputKey, serializeHookKeyframeDraft, readHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { hookKeyframeGenerationInputKey, parseHookKeyframeGenerationReceipt } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
const ownerId="curated-test",draftId="00000000-0000-4000-8000-000000000001",photo="00000000-0000-4000-8000-000000000002";
test("twenty exact approvals exclude Hook 88; hidden references stay archival but not selectable",()=>{
  assert.equal(catalog.frames.length,20);assert.equal(new Set(catalog.frames.map(r=>r.referenceId)).size,20);assert.ok(!catalog.frames.some(r=>r.number===88));
  const active=getHookReferenceGalleryItems(),all=getHookReferenceReleaseItems();assert.equal(active.length,104);
  for(const id of ["explore-paired-hook-917cba028b9bc9cfda3e9f9b","explore-paired-hook-e5870158a2ad1494edc92741","explore-paired-hook-6365d336034633aa5070eb48"]){assert.ok(all.some(r=>r.id===id));assert.ok(!active.some(r=>r.id===id));}
  assert.ok(active.some(r=>r.title==="Hook 88"));
});
test("all curated PNGs, browser drafts, worker receipts and motion previews bind the same selected frame",async()=>{
  const sources=getHookReferenceGalleryItems();
  const service=createHookSourceFrameService({items:()=>sources,download:async()=>assert.fail("curated images must not decode/download frame zero")});
  for(const selected of catalog.frames){
    const frame=await service(selected.referenceId);assert.equal(frame.frameIndex,selected.index);assert.equal(frame.frameTimeSeconds,selected.timeSeconds);assert.equal(createHash("sha256").update(frame.png).digest("hex"),selected.sha256);
    const bytes=await readFile(`public${selected.publicPath}`);assert.deepEqual(bytes,frame.png);
    const scope={ownerId,draftId,referenceId:selected.referenceId,sourceSha256:selected.sourceSha256};
    const sourceFrame={index:frame.frameIndex,timeSeconds:frame.frameTimeSeconds,width:frame.width,height:frame.height,sha256:frame.frameSha256};
    const draft=updateHookKeyframeDraft(createHookKeyframeDraft(scope),{sourceFrame,imageAssetIds:[photo]});assert.equal(draft.version,3);assert.equal(readHookKeyframeDraft(serializeHookKeyframeDraft(draft),scope)?.sourceFrame?.index,selected.index);
    const preview=getHookKeyframePromptPreview(draft);assert.ok(preview.animationPrompt);assert.equal(preview.animationError,null);assert.equal(preview.requiresDecision,false);assert.doesNotMatch(preview.imagePrompt!,/VERIFIED OPENING SCENE/);
    const partial={version:3 as const,imageModel:draft.imageModel,...scope,sourceFrame,personImageAssetIds:[photo],instructions:""};
    assert.equal(hookKeyframeGenerationInputKey(partial),hookKeyframeInputKey(draft));
    const receipt={...partial,purpose:"hook_starting_frame" as const,promptVersion:4 as const,inputKey:hookKeyframeInputKey(draft),promptSha256:createHash("sha256").update(preview.imagePrompt!).digest("hex")};assert.ok(parseHookKeyframeGenerationReceipt(receipt));
    for(const patch of [{index:selected.index+1},{timeSeconds:0},{sha256:"a".repeat(64)},{width:1}]){const changed={...sourceFrame,...patch};assert.equal(parseHookKeyframeGenerationReceipt({...receipt,sourceFrame:changed,inputKey:hookKeyframeGenerationInputKey({...partial,sourceFrame:changed})}),null);assert.throws(()=>updateHookKeyframeDraft(draft,{sourceFrame:changed}));}
    assert.equal(getCuratedHookFrame(selected.referenceId,"a".repeat(64)),undefined);
    const legacyFrame={...sourceFrame,index:0,timeSeconds:0};const legacyPartial={...partial,version:2 as const,sourceFrame:legacyFrame};const legacy={...receipt,...legacyPartial,inputKey:hookKeyframeGenerationInputKey(legacyPartial)};assert.ok(parseHookKeyframeGenerationReceipt(legacy));assert.equal(parseHookKeyframeGenerationReceipt({...receipt,version:2}),null);
  }
});
test("hidden sources and changed approved source versions fail without decoding an opening fallback", async () => {
  const sources = getHookReferenceGalleryItems();
  const service = createHookSourceFrameService({ items: () => sources, download: async () => assert.fail("No download for rejected selection") });
  await assert.rejects(service("explore-paired-hook-917cba028b9bc9cfda3e9f9b"), error => error instanceof HookSourceFrameError && error.status === 404);
  const selected = catalog.frames[0];
  const changed = createHookSourceFrameService({ items: () => sources.map(row => row.id === selected.referenceId ? { ...row, videoSha256: "a".repeat(64), videoStorageKey: `explore/paired-references/v1/${"a".repeat(64)}.mp4` } : row), download: async () => assert.fail("No frame-zero fallback") });
  await assert.rejects(changed(selected.referenceId), error => error instanceof HookSourceFrameError && error.status === 409);
});
