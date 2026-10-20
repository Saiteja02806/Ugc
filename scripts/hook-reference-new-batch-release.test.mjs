import assert from "node:assert/strict";
import { test } from "node:test";
import batch from "../worker/src/lib/explore-hook-reference-new-batch-release.json" with { type: "json" };
import first from "../worker/src/lib/explore-hook-reference-release.json" with { type: "json" };
import second from "../worker/src/lib/explore-hook-reference-addition-release.json" with { type: "json" };
import textCatalog from "../lib/explore/reference-text-catalog.json" with { type: "json" };
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";

test("new batch binds 22 distinct complete sources to supplied audio and canonical post links", () => {
  const ready = validateHookAdditionRelease(batch, textCatalog);
  assert.equal(ready.eligible.length, 22);
  assert.deepEqual(ready.excluded, []);
  assert.equal(batch.items.filter(item => item.sourcePlatform === "instagram").length, 5);
  assert.equal(batch.items.filter(item => item.sourcePlatform === "tiktok").length, 17);
  assert.ok(batch.items.every(item => item.sourceUrl && item.durationSeconds <= 15));
  assert.ok(batch.items.every(item => ![...first.items, ...second.items].some(old => old.id === item.id || old.videoSha256 === item.videoSha256)));
  assert.ok(batch.items.some(item => item.sourceFolder === "New folder (2)"));
  assert.equal(batch.items.some(item => item.sourceFolder === "New folder (23)"), false);
  const texts = textCatalog.items.filter(text => batch.items.some(item => item.id === text.referenceId));
  assert.equal(texts.filter(text => text.status === "ready").length, 20);
  assert.equal(texts.filter(text => text.status === "no_text" && text.blocks.length === 0).length, 2);
});

test("readiness permits reviewed logo-only sources but rejects unreviewed or contradictory text states", () => {
  const noText = batch.items.find(item => item.sourceFolder === "New folder (18)");
  for (const change of [{ status: "needs_review" }, { blocks: [{ text: "invented caption", startMs: 0, endMs: 1000 }] }]) {
    const catalog = structuredClone(textCatalog);
    Object.assign(catalog.items.find(item => item.referenceId === noText.id), change);
    assert.throws(() => validateHookAdditionRelease(batch, catalog), /reviewed|No-text/);
  }
});
