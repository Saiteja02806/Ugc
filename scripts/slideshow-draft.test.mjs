import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SLIDESHOW_SLIDES, moveSlideshowSlide, readSlideshowDraft, readSlideshowSaveRequest, readSlideshowOutput, sameSlideshowChoices } from "../lib/explore/slideshow-draft.ts";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const slides = [1,2].map(n => ({referenceSlideId:id(n + 10),mediaAssetId:id(n)}));
const saved = {version:2,owner:"owner-a",requestKey:id(20),referenceId:null,slides};
const output = {id:id(30),kind:"library_item",url:"https://owned.test/1",title:"My slideshow",slides:["https://owned.test/1","https://owned.test/2"]};

test("draft restoration binds asset identities and ordered choices to the exact owner without trusting stored URLs", () => {
  const raw = JSON.stringify({version:2,owner:"owner-a",slides:slides.map(slide => ({...slide,url:"https://attacker.test/image"}))});
  assert.deepEqual(readSlideshowDraft(raw,"owner-a"),{version:2,owner:"owner-a",slides});
  assert.equal(readSlideshowDraft(raw,"owner-b"),null);
  for (const value of [null,{},[],{version:2,owner:"owner-a",slides:[{...slides[0],mediaAssetId:null}]},{version:2,owner:"owner-a",slides:[slides[0],slides[0]]},{version:2,owner:"owner-a",slides:Array.from({length:MAX_SLIDESHOW_SLIDES+1},(_,n) => ({referenceSlideId:id(50+n),mediaAssetId:id(n+1)}))}]) assert.equal(readSlideshowDraft(JSON.stringify(value),"owner-a"),null);
  assert.equal(readSlideshowDraft("invalid-json","owner-a"),null);
});
test("save receipts preserve interrupted identity and exact sequence; new requests cannot restore catalogue originals", () => {
  assert.deepEqual(readSlideshowSaveRequest(JSON.stringify(saved),"owner-a"),saved);
  assert.equal(readSlideshowSaveRequest(JSON.stringify(saved),"owner-b"),null);
  assert.equal(readSlideshowSaveRequest(JSON.stringify({...saved,slides:[slides[0]]}),"owner-a"),null);
  assert.equal(readSlideshowSaveRequest(JSON.stringify({...saved,slides:[{...slides[0],mediaAssetId:null},slides[1]]}),"owner-a"),null);
  const legacy = {...saved,version:1,referenceId:"catalogue",slides:[{referenceSlideId:"original-1",mediaAssetId:null},{referenceSlideId:"original-2",mediaAssetId:id(2)}]};
  assert.deepEqual(readSlideshowSaveRequest(JSON.stringify(legacy),"owner-a"),legacy);
  assert.equal(readSlideshowSaveRequest(JSON.stringify({...saved,output:{...output,slides:[output.url]}}),"owner-a"),null);
});
test("output checks reject incomplete or mismatched sequences before enabling schedule", () => {
  assert.deepEqual(readSlideshowOutput(output,2),output);
  for (const value of [{...output,url:"https://different.test"},{...output,slides:[output.url]},{...output,slides:[output.url,"javascript:alert(1)"]},{...output,id:"not-a-library-id"},{...output,kind:"media_asset"}]) assert.equal(readSlideshowOutput(value,2),null);
});
test("reordering keeps identities immutable and changes the scheduling sequence", () => {
  const moved = moveSlideshowSlide(slides,1,0);
  assert.deepEqual(moved,[slides[1],slides[0]]); assert.deepEqual(slides,[{referenceSlideId:id(11),mediaAssetId:id(1)},{referenceSlideId:id(12),mediaAssetId:id(2)}]);
  assert.equal(sameSlideshowChoices(slides,moved),false); assert.equal(sameSlideshowChoices(slides,[...slides]),true);
  assert.deepEqual(moveSlideshowSlide(slides,-1,0),slides); assert.deepEqual(moveSlideshowSlide(slides,0,2),slides);
});
