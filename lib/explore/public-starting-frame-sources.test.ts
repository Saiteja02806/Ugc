import assert from "node:assert/strict";
import test from "node:test";
import { getPublicStartingFrameSources } from "./public-starting-frame-sources.ts";
import { getHookReferenceGalleryItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { hasCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";

test("preparation covers every public Hook including curated later-frame references and excludes private sources", () => {
  const hooks = getPublicStartingFrameSources("hook");
  const active = getHookReferenceGalleryItems();
  assert(active.some(item => hasCuratedHookFrame(item.id)), "Regression fixture must include later-curated references");
  assert.deepEqual(hooks.map(item => [item.id, item.videoSha256]).sort(), active.map(item => [item.id, item.videoSha256]).sort());
  const all = getPublicStartingFrameSources();
  assert.equal(new Set(all.map(item => item.id)).size, all.length);
  assert(all.every(item => !item.id.startsWith("creator-account-")));
  for (const workflow of ["wall_text", "talking_head"] as const) assert(getPublicStartingFrameSources(workflow).length > 0);
});
