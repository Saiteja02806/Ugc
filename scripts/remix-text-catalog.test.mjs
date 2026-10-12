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

test("every saved original resolves the exact current reference, slide and content fingerprint", () => {
  const refs = getRecreateReferences(), inventory = sourceInventory(), catalog = JSON.parse(readFileSync(new URL("../lib/explore/reference-text-catalog.json",import.meta.url),"utf8"));
  const canonical = new Map(refs.flatMap(ref=>ref.format==='slideshow'?ref.slides.map(s=>[referenceTextKey(ref.id,s.id),new URL(s.url).pathname]):[[referenceTextKey(ref.id,null),new URL(ref.videoUrl).pathname]]));
  assert.equal(inventory.length,refs.length);
  for(const ref of inventory)for(const unit of ref.units)assert.equal(canonical.get(referenceTextKey(ref.referenceId,unit.slideId)),`/${unit.key}`);
  const seen = new Set();
  for(const raw of catalog.items){const item=ReferenceTextSchema.parse(raw),key=referenceTextKey(item.referenceId,item.slideId);assert.equal(seen.has(key),false);seen.add(key);assert.match(canonical.get(key),new RegExp(`${item.sourceSha256}\\.`));assert.deepEqual(getReferenceText(item.referenceId,item.slideId),item);}
  const slideshow=refs.find(r=>r.format==='slideshow');
  assert.throws(()=>getReferenceText(slideshow.id,'foreign-slide'));
  assert.throws(()=>getReferenceText(slideshow.id,null));
  assert.throws(()=>getReferenceText('unknown-reference',null));
});
