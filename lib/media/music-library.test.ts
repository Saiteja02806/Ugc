import assert from "node:assert/strict";
import test from "node:test";
import type { MediaAsset } from "./types.ts";
import { isLibraryMusic } from "./music-library.ts";

const track = { collection: "audio", sourceType: "upload", status: "ready", mimeType: "audio/mpeg", url: "https://owned.test/music.mp3", durationSeconds: 600 } as MediaAsset;
test("music selection accepts a ready owned-upload recording up to ten minutes", () => {
  assert.equal(isLibraryMusic(track), true);
  for (const patch of [{ collection: "video" }, { sourceType: "generated_video" }, { status: "uploading" },
    { mimeType: "text/html" }, { url: "http://untrusted.test" }, { durationSeconds: 601 }, { durationSeconds: 0 }, { durationSeconds: null }]) {
    assert.equal(isLibraryMusic({ ...track, ...patch } as MediaAsset), false);
  }
});
