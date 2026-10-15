import assert from "node:assert/strict";
import { mock, test } from "node:test";

const url = "https://trusted.test/registered.mp4";
mock.module(new URL("./recreate-catalog.ts", import.meta.url), { namedExports: {
  getRecreateReference: id => id === "hook-registered" ? { id, format: "hook", videoUrl: url } : undefined,
} });
const { resolveGalleryGenerationVideo } = await import("./generation-video-reference.ts");
function clip(seconds) {
  const bytes = Buffer.alloc(36);
  bytes.writeUInt32BE(36, 0); bytes.write("moov", 4);
  bytes.writeUInt32BE(28, 8); bytes.write("mvhd", 12);
  bytes.writeUInt32BE(1000, 28); bytes.writeUInt32BE(seconds * 1000, 32);
  return bytes;
}
test("gallery sources resolve only from the registered workflow and use the actual movie duration", async () => {
  let reads = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async requested => {
    reads++; assert.equal(requested, url);
    return new Response(clip(3.4), { headers: { "Content-Type": "video/mp4" } });
  };
  try {
    assert.deepEqual(await resolveGalleryGenerationVideo("hook-registered", "hook"), { url, durationSeconds: 3.4 });
    for (const [id, format] of [[url, "hook"], ["unknown", "hook"], ["hook-registered", "wall_text"]]) {
      await assert.rejects(resolveGalleryGenerationVideo(id, format), /published video/);
    }
    assert.equal(reads, 1);
    globalThis.fetch = async () => new Response(clip(10.1), { headers: { "Content-Type": "video/mp4" } });
    await assert.rejects(resolveGalleryGenerationVideo("hook-registered", "hook"), /trimmed clip up to 10 seconds/);
    assert.deepEqual(await resolveGalleryGenerationVideo("hook-registered", "hook", 15), { url, durationSeconds: 10.1 });
    globalThis.fetch = async () => new Response(clip(15.1), { headers: { "Content-Type": "video/mp4" } });
    await assert.rejects(resolveGalleryGenerationVideo("hook-registered", "hook", 15), /trimmed clip up to 15 seconds/);
  } finally { globalThis.fetch = originalFetch; }
});
