import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { sourceInventory } from "./explore-reference-text-inventory.mjs";
import { ReferenceTextSchema, referenceTextKey } from "../lib/explore/reference-text.ts";

// Existing catalogues omit Node's JSON import attribute; keep app source unchanged.
registerHooks({load(url,context,nextLoad){if(url.startsWith('file:')&&/\/lib\/explore\/(?:imported-catalog|reference-text-catalog)\.json$/.test(url))return {format:'module',source:`export default ${readFileSync(new URL(url),'utf8')}`,shortCircuit:true};return nextLoad(url,context);}});
const { getRecreateReferences } = await import("../lib/explore/recreate-catalog.ts");
const { getReferenceText } = await import("../lib/explore/reference-text-store.ts");
process.env.GCP_STORAGE_BUCKET = "remix-test-bucket";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://media.fixture.test";

// Deliberately retired on 22 October; retain transcripts without reactivating cards.
const retiredWallSources = new Map([
  ["explore-wall-text-06", "e85c145d5316e4bdd4395900895e6f51c220b44accc84f3025149c554620856f"],
  ["explore-wall-text-21", "d3ed4f1f5e6c491f83ceab686444d67713e3fc9cfb3d90cabce0215ec0504434"],
  ["explore-wall-text-28", "46871589f47a434baedda1ae05aa6b1115f87eb6e3b381cccbfbf51e55ea70d1"],
  ["explore-wall-text-59", "99241cc10573b7b1b4defe485c3c9e042303e6f548781a29e7ebee1b9af3d052"],
  ["explore-wall-text-08", "686eed6e67b73c82c703bf2bab0add794268e2cdab075eedcca58cc2e2474ff2"],
  ["explore-wall-text-09", "b6159891652a6f4ea1a3e13d79f5736f24b20de30111c136733e47f22f5e61ab"],
]);

test("every saved original resolves the exact current reference, slide and content fingerprint", () => {
  // Saved caption records include archived sources used by historical drafts.
  const refs = getRecreateReferences(true), inventory = sourceInventory(), catalog = JSON.parse(readFileSync(new URL("../lib/explore/reference-text-catalog.json",import.meta.url),"utf8"));
  const canonical = new Map(refs.flatMap(ref=>ref.format==='slideshow'?ref.slides.map(s=>[referenceTextKey(ref.id,s.id),new URL(s.url).pathname]):[[referenceTextKey(ref.id,null),new URL(ref.videoUrl).pathname]]));
  assert.equal(inventory.length,refs.length);
  assert.deepEqual(inventory.map(ref => ref.referenceId).sort(), refs.map(ref => ref.id).sort(), "Inventory must cover the exact current and archived reference IDs, not just the count");
  for(const ref of inventory)for(const unit of ref.units)assert.equal(canonical.get(referenceTextKey(ref.referenceId,unit.slideId)),`/${unit.key}`);
  const seen = new Set();
  for(const raw of catalog.items){
    const item=ReferenceTextSchema.parse(raw),key=referenceTextKey(item.referenceId,item.slideId);
    assert.equal(seen.has(key),false);seen.add(key);
    if(retiredWallSources.has(item.referenceId)){
      assert.equal(item.slideId,null);
      assert.equal(item.format,"wall_text");
      assert.equal(item.sourceSha256,retiredWallSources.get(item.referenceId));
      assert.equal(canonical.has(key),false,"Retired Wall references must remain unavailable");
      assert.throws(()=>getReferenceText(item.referenceId,null),/available catalogue reference/);
      continue;
    }
    assert.match(canonical.get(key),new RegExp(`${item.sourceSha256}\\.`));
    assert.deepEqual(getReferenceText(item.referenceId,item.slideId),item);
  }
  for(const id of retiredWallSources.keys())assert.ok(seen.has(referenceTextKey(id,null)),"Keep historical transcripts");
  const slideshow=refs.find(r=>r.format==='slideshow');
  assert.throws(()=>getReferenceText(slideshow.id,'foreign-slide'));
  assert.throws(()=>getReferenceText(slideshow.id,null));
  assert.throws(()=>getReferenceText('unknown-reference',null));
});
