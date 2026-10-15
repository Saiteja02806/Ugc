import assert from "node:assert/strict";
import { test } from "node:test";
import additions from "../worker/src/lib/explore-hook-reference-addition-release.json" with { type: "json" };
import textCatalog from "../lib/explore/reference-text-catalog.json" with { type: "json" };
import { canonicalHookSource } from "../worker/src/lib/explore-instagram-source.ts";
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";

test("the optional-source Hook addition has complete reviewed media and preserves source-link availability", () => {
  const ready = validateHookAdditionRelease(additions, textCatalog);
  const linked = additions.items.filter(item => item.sourceUrl);
  const unlinked = additions.items.filter(item => !item.sourceUrl);

  assert.equal(additions.items.length, 31);
  assert.equal(ready.eligible.length, 31);
  assert.equal(ready.assets.length, 124);
  assert.deepEqual(ready.excluded, []);
  assert.equal(linked.length, 17);
  assert.equal(linked.filter(item => item.sourcePlatform === "instagram").length, 1);
  assert.equal(linked.filter(item => item.sourcePlatform === "tiktok").length, 16);
  assert.equal(unlinked.length, 14);

  for (const item of additions.items) {
    assert.ok(item.durationSeconds > 0 && item.durationSeconds <= 15);
    assert.ok(item.audioDurationSeconds > 0);
    assert.match(item.previewStorageKey, new RegExp(`${item.previewSha256}\\.mp4$`));
    assert.match(item.audioStorageKey, new RegExp(`${item.audioSha256}\\.mp3$`));
    assert.equal(textCatalog.items.find(text => text.referenceId === item.id && text.slideId === null)?.status, "ready");
    assert.deepEqual(canonicalHookSource(item.sourceUrl), item.sourceUrl ? { platform: item.sourcePlatform, url: item.sourceUrl } : null);
  }
});
