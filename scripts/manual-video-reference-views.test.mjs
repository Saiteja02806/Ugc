import assert from "node:assert/strict";
import test from "node:test";
import imported from "../lib/explore/video-reference-views.json" with { type: "json" };
import { PUBLIC_REFERENCE_LIMIT } from "../lib/explore/public-reference-preview.ts";
import legacy from "../lib/explore/hook-reference-views.json" with { type: "json" };
import { getVideoReferenceViews } from "../lib/explore/hook-reference-views.ts";
import { getRecreateReferences } from "../lib/explore/recreate-catalog.ts";
import { getTalkingHeadReferences } from "../lib/explore/talking-head-reference-catalog.ts";
import { visibleTalkingHeadReferences } from "../lib/explore/talking-head-reference.ts";
import { canonicalHookSource } from "../worker/src/lib/explore-instagram-source.ts";
import { filterReferenceViews, sortReferenceViews, videoReferencePreview } from "../lib/explore/video-reference-feed.ts";
import { GET } from "../app/api/explore/public-reference-preview/route.ts";

const hooks = getRecreateReferences().filter(item => item.format === "hook" && !item.archived);
const talking = visibleTalkingHeadReferences(getTalkingHeadReferences());

test("manual workbook counts retain raw source, approximation and reporting provenance without invented live verification/date", () => {
  assert.equal(imported.sourceWorkbookSha256, "0de136ac379b904e38e83e681c7f89629072dc9355a448833e405a78bdb52f44");
  assert.equal(imported.items.length, 62);
  assert.equal(new Set(imported.items.map(item => item.sourceUrl)).size, 62);
  for (const item of imported.items) {
    assert.equal(item.verificationMethod, "user-provided-workbook");
    assert.notEqual(item.verifiedLive, true);
    assert.equal(item.retrievedAt, undefined, "no checked dates were supplied");
    assert.ok(Number.isSafeInteger(item.viewCount) && item.viewCount >= 0);
    const raw = String(item.rawValue).replace(/'$/, "");
    const match = raw.match(/^(\d+(?:\.\d+)?)([km])?$/i);
    assert.ok(match, raw);
    const multiplier = match[2]?.toLowerCase() === "m" ? 1e6 : match[2] ? 1000 : 1;
    const [whole, fraction = ""] = match[1].split(".");
    const numerator = BigInt(whole + fraction) * BigInt(multiplier);
    const denominator = 10n ** BigInt(fraction.length);
    assert.equal(numerator % denominator, 0n);
    assert.equal(item.viewCount, Number(numerator / denominator));
    assert.equal(item.approximate, Boolean(match[2]));
  }
  for (const [id, value] of [["talking-kamile-mirror-discovery", 400], ["talking-kamile-lowlight-what", 64], ["talking-room-explainer-full", 223000], ["explore-paired-hook-bee95bd7a34b5d2a72775282", 15200000]]) {
    assert.equal(imported.items.find(item => item.referenceIds.includes(id)).viewCount, value);
  }
});

test("all imported counts reach the exact real catalog source and reference, including both workflows", () => {
  let hookCount = 0, talkingCount = 0;
  for (const item of imported.items) {
    for (const id of item.referenceIds) {
      const reference = [...hooks, ...getTalkingHeadReferences()].find(candidate => candidate.id === id);
      assert.ok(reference, id);
      assert.equal(canonicalHookSource(reference.sourceUrl ?? reference.instagramUrl).url, item.sourceUrl);
      assert.equal(reference.viewCount, item.viewCount);
      assert.equal(reference.viewsSource, "user-reported");
      assert.equal(reference.viewsApproximate, item.approximate);
      assert.equal(reference.viewsRetrievedAt, undefined);
      assert.equal(getVideoReferenceViews(item.sourceUrl).viewCount, item.viewCount);
      if (hooks.includes(reference)) hookCount++; else talkingCount++;
    }
  }
  assert.equal(hookCount, 42); assert.equal(talkingCount, 20);
  assert.equal(getVideoReferenceViews("https://www.tiktok.com/@wrong/video/1"), undefined);
});

test("previous verified snapshots remain untouched and no-count/no-link references remain unavailable", () => {
  for (const item of Object.values(legacy.viewsByReferenceId)) {
    if (!item.verifiedLive || !canonicalHookSource(item.sourceUrl)) continue;
    assert.ok(!imported.items.some(row => row.sourceUrl === canonicalHookSource(item.sourceUrl).url));
    const current = getVideoReferenceViews(item.sourceUrl);
    assert.equal(current.viewCount, item.viewCount);
    assert.equal(current.retrievedAt, legacy.updatedAt);
  }
  assert.equal(filterReferenceViews(hooks, "available").length, 111);
  assert.equal(filterReferenceViews(talking, "available").length, 19);
  assert.equal(filterReferenceViews([...hooks, ...talking], "unavailable").length, 23);
  for (const id of ["explore-paired-hook-aa0caa002b6a92ad9226b26c", "talking-car-story-full", "talking-mug-story", "talking-websites-explainer", "explore-paired-hook-4aa27111a23b04a6dd27717b"]) {
    assert.equal([...hooks, ...talking].find(item => item.id === id)?.viewCount, undefined);
  }
});

test("updated numeric counts drive descending/ascending, unavailable filter and fixed ten membership", () => {
  for (const collection of [hooks, talking]) {
    const descending = sortReferenceViews(filterReferenceViews(collection, "available"));
    assert.ok(descending.every((item, index) => index === 0 || descending[index - 1].viewCount >= item.viewCount));
    const ascending = sortReferenceViews(descending, "lowest");
    assert.ok(ascending.every((item, index) => index === 0 || ascending[index - 1].viewCount <= item.viewCount));
    const preview = videoReferencePreview(collection, false);
    assert.equal(preview.length, 10);
    assert.deepEqual(preview.map(item => item.id), descending.slice(0, 10).map(item => item.id));
    assert.equal(filterReferenceViews(preview, "unavailable").length, 0);
  }
  assert.equal(sortReferenceViews(talking)[0].id, "talking-discovery-hook-v2");
  assert.equal(sortReferenceViews(talking, "lowest")[0].id, "talking-kamile-lowlight-what");
});

test("guest response contains the same exact top ten counts and manual provenance without workbook/private details", async () => {
  for (const [workflow, collection] of [["hook", hooks], ["talking_head", talking]]) {
    const body = await GET(new Request(`https://app.test/api/explore/public-reference-preview?workflow=${workflow}`)).json();
    const expected = sortReferenceViews(collection).slice(0, PUBLIC_REFERENCE_LIMIT);
    assert.deepEqual(body.items.map(item => item.id), expected.map(item => item.id));
    for (const [index, item] of body.items.entries()) {
      assert.equal(item.viewCount, expected[index].viewCount);
      assert.equal(item.viewsSource, expected[index].viewsSource);
      assert.equal(item.viewsApproximate, expected[index].viewsApproximate);
      for (const key of ["rawValue", "sourceWorkbookSha256", "workbookRow", "generationPrompt", "sourceSha256"]) assert.equal(key in item, false);
    }
  }
});
