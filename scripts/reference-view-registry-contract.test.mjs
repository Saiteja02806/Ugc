import assert from "node:assert/strict";
import test from "node:test";
import hookRegistry from "../lib/explore/hook-reference-views.json" with { type: "json" };
import slideshowRegistry from "../lib/explore/slideshow-reference-views.json" with { type: "json" };
import { getAllHookReferenceViews, getHookReferenceViews } from "../lib/explore/hook-reference-views.ts";
import { getAllSlideshowReferenceViews, getSlideshowReferenceViews } from "../lib/explore/slideshow-reference-views.ts";

for (const [name, registry, all, lookup] of [
  ["Hook", hookRegistry, getAllHookReferenceViews, getHookReferenceViews],
  ["Slideshow", slideshowRegistry, getAllSlideshowReferenceViews, getSlideshowReferenceViews],
]) {
  test(`${name}: full record export preserves exact registry data without fabricated metadata`, () => {
    const records = all();
    assert.deepEqual(records, registry.items);
    assert.equal(new Set(records.map(record => record.id)).size, records.length);
    assert.equal(records.length, registry.verifiedCount);
    for (const record of records) {
      for (const key of ["id", "title", "formattedViews", "status"]) assert.equal(typeof record[key], "string", `${record.id}: ${key}`);
      assert.ok(Number.isSafeInteger(record.viewCount) && record.viewCount > 0);
      assert.equal(typeof record.sourceUrl, "string");
      assert.ok(["https:", "http:"].includes(new URL(record.sourceUrl).protocol));
      if (name === "Hook") assert.ok(["instagram", "tiktok"].includes(record.platform));
      if (name === "Slideshow") {
        if (record.category !== undefined) assert.equal(typeof record.category, "string");
        if (record.slidesCount !== undefined) assert.ok(Number.isInteger(record.slidesCount) && record.slidesCount > 0);
      }
    }
  });

  test(`${name}: full records and badge lookup agree; absent references remain absent`, () => {
    for (const record of all()) {
      const badge = lookup(record.id);
      assert.ok(badge, `${record.id} missing from lookup`);
      assert.equal(badge.viewCount, record.viewCount);
      assert.equal(badge.formattedViews, record.formattedViews);
      assert.equal(badge.sourceUrl, record.sourceUrl);
      assert.equal(badge.verifiedLive, true);
    }
    assert.equal(lookup("missing-reference-regression-fixture"), undefined);
  });
}
