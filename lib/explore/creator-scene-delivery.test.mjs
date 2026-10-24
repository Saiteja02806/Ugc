import assert from "node:assert/strict";
import { test } from "node:test";
import { creatorSceneCanonicalUrl, resolveCreatorSceneDelivery, verifyCreatorSceneDelivery } from "../../worker/src/lib/creator-scene-delivery.ts";
import { getCreatorAccountSource } from "./creator-accounts.ts";
import { GET } from "../../app/api/explore/creator-scene/[...path]/route.ts";

test("provider access expires, binds one exact still, and cannot expose original videos or other references", async () => {
  process.env.CREATOR_REFERENCE_SIGNING_SECRET = "a-private-fixture-secret-with-32-characters";
  const source = {id:"creator-account-1-01",sourceSha256:"a".repeat(64),posterSha256:"b".repeat(64)};
  const receipt = { referenceId: source.id, sourceSha256: source.sourceSha256, sourceFrame: { sha256: source.posterSha256 } };
  const canonical = creatorSceneCanonicalUrl(receipt), now = Date.now();
  const signed = resolveCreatorSceneDelivery(canonical, receipt, now);
  assert.equal(verifyCreatorSceneDelivery(new URL(canonical), now), null);
  assert.equal(verifyCreatorSceneDelivery(new URL(signed), now).referenceId, source.id);
  assert.equal(verifyCreatorSceneDelivery(new URL(signed), now + 600_000), null);
  for (const change of [url => url.pathname = url.pathname.replace("1-01", "2-01"), url => url.pathname = url.pathname.replace(".png", ".mp4"), url => url.searchParams.set("expires", String(Math.floor(now / 1000) + 3600)), url => url.searchParams.set("signature", "a".repeat(64))]) {
    const modified = new URL(signed); change(modified); assert.equal(verifyCreatorSceneDelivery(modified, now), null);
  }
  assert.throws(() => resolveCreatorSceneDelivery(canonical.replace("https://", "https://evil.example/"), receipt));
  assert.equal(resolveCreatorSceneDelivery("https://public.example/frame.png", { ...receipt, referenceId: "normal-hook" }), "https://public.example/frame.png");
  assert.equal((await GET(new Request(canonical))).status, 404);
  const mismatch = { ...receipt, sourceFrame: { sha256: "a".repeat(64) } };
  assert.equal((await GET(new Request(resolveCreatorSceneDelivery(creatorSceneCanonicalUrl(mismatch), mismatch)))).status, 404);
  delete process.env.CREATOR_REFERENCE_SIGNING_SECRET;
});

test("actual private source bytes require the matching signed capability", {skip:!getCreatorAccountSource("creator-account-1-01")&&"Private creator fixture or package key is unavailable in this public clone."},async()=>{
  process.env.CREATOR_REFERENCE_SIGNING_SECRET="a-private-fixture-secret-with-32-characters";
  const source=getCreatorAccountSource("creator-account-1-01"),receipt={referenceId:source.id,sourceSha256:source.sourceSha256,sourceFrame:{sha256:source.posterSha256}};
  const canonical=creatorSceneCanonicalUrl(receipt),response=await GET(new Request(resolveCreatorSceneDelivery(canonical,receipt)));
  assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/png");assert.equal(response.headers.get("cache-control"),"private, no-store");
  delete process.env.CREATOR_REFERENCE_SIGNING_SECRET;
});
