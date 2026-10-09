import assert from "node:assert/strict";
import test from "node:test";
import { canReuseUnchangedHookSource } from "../lib/explore/unchanged-hook-source.ts";
import { prepareFormatEditForExport } from "../lib/explore/format-edit-draft.ts";

const source = { id: "owned-video", status: "ready", collection: "video", mimeType: "video/mp4", url: "https://media.example/video.mp4", durationSeconds: 22.5 };
const edit = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 22500, originalVolume: 1, musicVolume: .2, text: null };

test("the full unedited ready MP4 can be reused, including an empty default text box", () => {
  assert.equal(canReuseUnchangedHookSource(source, edit, null), true);
  const blank = { value: "", width: .8, y: .2, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 22500 };
  assert.equal(canReuseUnchangedHookSource(source, prepareFormatEditForExport({ ...edit, textOverlays: [blank] }), null), true);
});

test("real edits, wall text, added audio, unknown duration and other containers require rendering", () => {
  for (const change of [{ trimStartMs: 1 }, { trimEndMs: 22499 }, { originalVolume: .9 }, { format: "wall_text" },
    { text: { value: "A real caption", width: .8, y: .2, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 22500 } }]) {
    assert.equal(canReuseUnchangedHookSource(source, { ...edit, ...change }, null), false);
  }
  for (const change of [{ durationSeconds: null }, { durationSeconds: NaN }, { status: "processing" }, { mimeType: "video/webm" }, { mimeType: "video/quicktime" }, { collection: "image" }, { url: "" }]) {
    assert.equal(canReuseUnchangedHookSource({ ...source, ...change }, edit, null), false);
  }
  assert.equal(canReuseUnchangedHookSource(source, edit, "owned-audio"), false);
  assert.equal(canReuseUnchangedHookSource(null, edit, null), false);
});
