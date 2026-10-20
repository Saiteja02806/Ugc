import assert from "node:assert/strict";
import test from "node:test";
import { createWallScheduleComposition } from "./wall-pending-composition.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const editing = { version: 1, format: "wall_text", trimStartMs: 1000, trimEndMs: 7000, originalVolume: .5, musicVolume: .3,
  text: { value: "My wall text", width: .8, y: .2, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 6000 } };
function fixture(overrides = {}) {
  let current = null;
  const input = { ownerId: "owner-a", sourceAssetId: id(1), title: "Wall post", pendingSource: false,
    clip: { sourceId: id(1), editing, busy: false, error: null, backgroundAssetId: id(2), backgroundPlayback: "repeat" }, ...overrides,
    currentSignature: () => current };
  const result = createWallScheduleComposition(input);
  current = result.signature;
  return { input, result, setCurrent: value => { current = value; } };
}

test("Wall background schedule captures trim, text, original sound and chosen repeating audio without an extra join", async () => {
  const { result } = fixture();
  const draft = await result.resolve();
  assert.deepEqual(draft.editing, editing);
  assert.equal(draft.sourceAssetId, id(1)); assert.equal(draft.backgroundAssetId, id(2));
  assert.equal(draft.backgroundPlayback, "repeat"); assert.equal(draft.composition, undefined);
  assert.equal(draft.demoAssetId, null); assert.equal(draft.demoAudioAssetId, null); assert.equal(draft.subtitles, null);
});

test("removing background audio removes its ID and repeat mode from the captured draft", async () => {
  const { result } = fixture({ clip: { sourceId: id(1), editing, busy: false, error: null, backgroundAssetId: null, backgroundPlayback: "repeat" } });
  assert.equal((await result.resolve()).backgroundAssetId, null);
  assert.equal(result.draft.backgroundPlayback, "once");
});

test("source, edit, audio, account changes and unmount invalidate an earlier confirmation", async () => {
  const f = fixture();
  const variants = [
    { ownerId: "owner-b" }, { sourceAssetId: id(3) },
    { clip: { ...f.input.clip, editing: { ...editing, originalVolume: .2 } } },
    { clip: { ...f.input.clip, backgroundAssetId: id(4) } },
    { clip: { ...f.input.clip, backgroundPlayback: "once" } },
  ];
  for (const patch of variants) {
    f.setCurrent(createWallScheduleComposition({ ...f.input, ...patch }).signature);
    await assert.rejects(f.result.resolve(), /changed/);
  }
  f.setCurrent(null); await assert.rejects(f.result.resolve(), /changed/);
});

test("loading, save/export busy, selection errors and uncertain edit errors block acceptance", async () => {
  for (const overrides of [{ pendingSource: true }, { selectionError: "Upload failed" },
    { clip: { sourceId: id(1), editing, busy: true, error: null } },
    { clip: { sourceId: id(1), editing, busy: false, error: "Earlier export needs recovery" } }, { clip: null }]) {
    const { result } = fixture(overrides);
    assert.equal(result.draft, null); assert.ok(result.error);
    await assert.rejects(result.resolve());
  }
});

test("local URLs, stale source snapshots and other workflow edits cannot become publishing sources", async () => {
  for (const overrides of [{ ownerId: null }, { sourceAssetId: "blob:local" },
    { sourceAssetId: id(3) }, { clip: { sourceId: id(1), editing: { ...editing, format: "hook" }, busy: false, error: null } }]) {
    const { result } = fixture(overrides); assert.equal(result.draft, null);
    await assert.rejects(result.resolve());
  }
});

test("the saved snapshot stays exact after mutable editor input changes", async () => {
  const changed = { ...editing, text: { ...editing.text } };
  const { result } = fixture({ clip: { sourceId: id(1), editing: changed, busy: false, error: null } });
  changed.text.value = "Later edit";
  assert.equal((await result.resolve()).editing.text.value, "My wall text");
});
