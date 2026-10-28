import assert from "node:assert/strict";
import { mock, test } from "node:test";
import release from "../../worker/src/lib/explore-hook-wall-reclassification-release.json" with { type: "json" };
let selected = null;
mock.module(new URL("./recreate-catalog.ts", import.meta.url), { namedExports: {
  getRecreateReference: id => selected?.id === id ? selected : undefined,
} });
const { getReferenceText } = await import("./reference-text-store.ts");

test("actual source-text resolver enforces Hook identity, trimmed hash and opening-only copy", () => {
  for (const item of release.items) {
    selected = { id: item.id, format: "hook", videoUrl: `https://example.test/${item.videoStorageKey}` };
    const text = getReferenceText(item.id, null, "hook");
    assert.equal(text.sourceSha256, item.videoSha256);
    assert.equal(text.blocks.length, 1);
    assert.equal(text.blocks[0].endMs, Math.round(item.durationSeconds * 1000));
    assert.throws(() => getReferenceText(item.id, null, "wall_text"), /workflow/);
    selected = { ...selected, videoUrl: `https://example.test/${"f".repeat(64)}.mp4` };
    assert.throws(() => getReferenceText(item.id, null, "hook"), /re-extracted/);
  }
  selected = null;
  assert.throws(() => getReferenceText(release.items[0].id, null, "hook"), /available catalogue/);
});
