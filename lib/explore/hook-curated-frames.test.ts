import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import catalog from "../../worker/src/lib/hook-curated-frames.json" with { type: "json" };
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { getHookReferenceGalleryItems, getHookReferenceReleaseItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { createHookSourceFrameService, HookSourceFrameError } from "./hook-source-frame.ts";
import { approveHookKeyframeImage, createHookKeyframeDraft, updateHookKeyframeDraft, hookKeyframeInputKey, serializeHookKeyframeDraft, readHookKeyframeDraft, recordHookKeyframeImage, type HookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { hookKeyframeGenerationInputKey, parseHookKeyframeGenerationReceipt } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
const ownerId="curated-test",draftId="00000000-0000-4000-8000-000000000001",photo="00000000-0000-4000-8000-000000000002";
test("twenty-one exact selections include the first gallery Hook; Hook 88 stays original and hidden references stay archival",()=>{
  assert.equal(catalog.frames.length,21);assert.equal(new Set(catalog.frames.map(r=>r.referenceId)).size,21);assert.ok(!catalog.frames.some(r=>r.number===88));
  const active=getHookReferenceGalleryItems(),all=getHookReferenceReleaseItems();assert.equal(active.length,106);
  for(const id of ["explore-paired-hook-917cba028b9bc9cfda3e9f9b","explore-paired-hook-e5870158a2ad1494edc92741","explore-paired-hook-6365d336034633aa5070eb48"]){assert.ok(all.some(r=>r.id===id));assert.ok(!active.some(r=>r.id===id));}
  assert.ok(active.some(r=>r.title==="Hook 88"));
});
test("the first gallery Hook adds one clearer binding without changing the original twenty approved selections", async () => {
  const original = JSON.parse(await readFile("docs/approved-hook-frame-selections-2026-10-24.json", "utf8"));
  const approvals = original.items;
  assert.ok(Array.isArray(approvals));
  assert.equal(approvals.length, 20);
  for (const approved of approvals) {
    const current = catalog.frames.find(row => row.referenceId === approved.referenceId)!;
    assert.ok(current);
    assert.equal(current.number, approved.number);
    assert.equal(current.sourceSha256, approved.sourceSha256);
    assert.equal(current.index, approved.frameIndex);
    assert.equal(current.timeSeconds, approved.elapsedTimeSeconds);
    assert.equal(current.presentationTimeSeconds, approved.presentationTimeSeconds);
    assert.equal(current.sha256, approved.frameSha256);
    assert.equal(current.publicPath, `/explore/curated-hook-frames/v1/${approved.frameSha256}.png`);
  }
  const first = getHookReferenceGalleryItems().find(row => row.id === "explore-paired-hook-fc44f6214b6e17413600ec13")!;
  assert.ok(first);
  const replacement = getCuratedHookFrame(first.id, first.videoSha256);
  assert.equal(replacement?.number, 100); assert.equal(replacement?.index, 70);
  assert.equal(replacement?.timeSeconds, 2.333333); assert.equal(replacement?.presentationTimeSeconds, 2.399349);
  assert.equal(replacement?.sha256, "df452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c");
});
test("historical curated PNGs, browser drafts, worker receipts and motion previews bind the same selected frame",async()=>{
  // Historical selections remain recoverable after gallery retirement.
  const sources=getHookReferenceReleaseItems();
  const service=createHookSourceFrameService({items:()=>sources,download:async()=>assert.fail("curated images must not decode/download frame zero")});
  for(const selected of catalog.frames){
    const frame=await service(selected.referenceId);assert.equal(frame.frameIndex,selected.index);assert.equal(frame.frameTimeSeconds,selected.timeSeconds);assert.equal(createHash("sha256").update(frame.png).digest("hex"),selected.sha256);
    const bytes=await readFile(`public${selected.publicPath}`);assert.deepEqual(bytes,frame.png);
    const scope={ownerId,draftId,referenceId:selected.referenceId,sourceSha256:selected.sourceSha256};
    const sourceFrame={index:frame.frameIndex,timeSeconds:frame.frameTimeSeconds,width:frame.width,height:frame.height,sha256:frame.frameSha256};
    const historical={...createHookKeyframeDraft(scope),version:3 as const};
    const draft=updateHookKeyframeDraft(historical,{sourceFrame,imageAssetIds:[photo]});assert.equal(draft.version,3);assert.equal(readHookKeyframeDraft(serializeHookKeyframeDraft(draft),scope)?.sourceFrame?.index,selected.index);
    const preview=getHookKeyframePromptPreview(draft);assert.ok(preview.animationPrompt);assert.equal(preview.animationError,null);assert.equal(preview.requiresDecision,false);assert.doesNotMatch(preview.imagePrompt!,/VERIFIED OPENING SCENE/);
    const partial={version:3 as const,imageModel:draft.imageModel,...scope,sourceFrame,personImageAssetIds:[photo],instructions:""};
    assert.equal(hookKeyframeGenerationInputKey(partial),hookKeyframeInputKey(draft));
    const receipt={...partial,purpose:"hook_starting_frame" as const,promptVersion:4 as const,inputKey:hookKeyframeInputKey(draft),promptSha256:createHash("sha256").update(preview.imagePrompt!).digest("hex")};assert.ok(parseHookKeyframeGenerationReceipt(receipt));
    const historicalApproved=approveHookKeyframeImage(recordHookKeyframeImage(draft,{assetId:"00000000-0000-4000-8000-000000000003",inputKey:receipt.inputKey,promptVersion:4}));
    const reopened=readHookKeyframeDraft(serializeHookKeyframeDraft(historicalApproved),scope)!;
    assert.equal(reopened.version,3);assert.deepEqual(reopened.sourceFrame,sourceFrame);assert.deepEqual(reopened.approval,historicalApproved.approval);
    assert.deepEqual(updateHookKeyframeDraft(reopened,{generateAudio:true}).approval,historicalApproved.approval);
    for(const patch of [{index:selected.index+1},{timeSeconds:0},{sha256:"a".repeat(64)},{width:1}]){const changed={...sourceFrame,...patch};assert.equal(parseHookKeyframeGenerationReceipt({...receipt,sourceFrame:changed,inputKey:hookKeyframeGenerationInputKey({...partial,sourceFrame:changed})}),null);assert.throws(()=>updateHookKeyframeDraft(draft,{sourceFrame:changed}));}
    assert.equal(getCuratedHookFrame(selected.referenceId,"a".repeat(64)),undefined);
    const legacyFrame={...sourceFrame,index:0,timeSeconds:0};const legacyPartial={...partial,version:2 as const,sourceFrame:legacyFrame};const legacy={...receipt,...legacyPartial,inputKey:hookKeyframeGenerationInputKey(legacyPartial)};assert.ok(parseHookKeyframeGenerationReceipt(legacy));assert.equal(parseHookKeyframeGenerationReceipt({...receipt,version:2}),null);
  }
});
test("Hook 100 keeps old approved opening receipts recoverable while new preparations use t=0", () => {
  const selected = catalog.frames.find(row => row.number === 100)!;
  const scope = { ownerId, draftId, referenceId: selected.referenceId, sourceSha256: selected.sourceSha256 };
  const opening = { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "9eb3c117dbf181a870d89fb3c4b3f4495e10cfe435aa035140e079d4e1218f26" };
  const legacy: HookKeyframeDraft = { ...createHookKeyframeDraft(scope), version: 2, sourceFrame: opening, imageAssetIds: [photo] };
  const approved = approveHookKeyframeImage(recordHookKeyframeImage(legacy, {
    assetId: "00000000-0000-4000-8000-000000000003", inputKey: hookKeyframeInputKey(legacy), promptVersion: 4,
  }));
  const saved = serializeHookKeyframeDraft(approved);
  const restored = readHookKeyframeDraft(saved, scope)!;
  assert.equal(restored.version, 2); assert.equal(restored.sourceFrame?.index, 0);
  assert.deepEqual(updateHookKeyframeDraft(restored, { generateAudio: true }).approval, approved.approval);
  const originalReceipt = { version: 2 as const, imageModel: legacy.imageModel, ...scope, purpose: "hook_starting_frame" as const,
    sourceFrame: opening, personImageAssetIds: [photo], instructions: "", promptVersion: 4 as const, inputKey: hookKeyframeInputKey(legacy), promptSha256: "b".repeat(64) };
  assert.ok(parseHookKeyframeGenerationReceipt(originalReceipt));
  const sourceFrame = { index: selected.index, timeSeconds: selected.timeSeconds, width: selected.width, height: selected.height, sha256: selected.sha256 };
  assert.throws(() => updateHookKeyframeDraft(restored, { sourceFrame }), /could not be verified/);
  const next = updateHookKeyframeDraft(createHookKeyframeDraft(scope), { sourceFrame: opening, imageAssetIds: [photo] });
  assert.equal(next.version, 4); assert.equal(next.sourceFrame?.index, 0);
  assert.throws(() => updateHookKeyframeDraft(next, { sourceFrame }), /could not be verified/);
  assert.equal(next.generatedImage, null); assert.equal(next.approval, null);
  assert.notEqual(hookKeyframeInputKey(next), originalReceipt.inputKey);
  assert.equal(serializeHookKeyframeDraft(restored), saved, "Updating preparation never rewrites its frozen legacy approval");
  assert.ok(parseHookKeyframeGenerationReceipt(originalReceipt), "Previously accepted request still uses its original input and frame");
  const nextPrompt = getHookKeyframePromptPreview(next);
  assert.match(nextPrompt.directions, /PHASE \[0/);
  assert.match(nextPrompt.directions, /ENDING STATE:/);
  assert.ok(getHookKeyframePromptPreview(restored).animationPrompt, "Legacy frame-zero motion remains available through history");
});
test("hidden sources and changed approved source versions fail without decoding an opening fallback", async () => {
  const sources = getHookReferenceGalleryItems();
  const service = createHookSourceFrameService({ items: () => sources, download: async () => assert.fail("No download for rejected selection") });
  await assert.rejects(service("explore-paired-hook-917cba028b9bc9cfda3e9f9b"), error => error instanceof HookSourceFrameError && error.status === 404);
  const selected = catalog.frames[0];
  const changed = createHookSourceFrameService({ items: () => sources.map(row => row.id === selected.referenceId ? { ...row, videoSha256: "a".repeat(64), videoStorageKey: `explore/paired-references/v1/${"a".repeat(64)}.mp4` } : row), download: async () => assert.fail("No frame-zero fallback") });
  await assert.rejects(changed(selected.referenceId), error => error instanceof HookSourceFrameError && error.status === 409);
});
