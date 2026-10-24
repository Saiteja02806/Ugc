import assert from "node:assert/strict";
import test from "node:test";
import { fullDurationSingleHookText } from "./hook-text-timing.ts";
import { readFormatEditDraft } from "./format-edit-draft.ts";
import { formatTextOverlays, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

const text = { value: "Hook copy", width: .8, x: .6, y: .18, fontSize: 48, color: "#ffffff", startMs: 500, endMs: 1500 };
const edit: ExploreFormatEdit = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3000, originalVolume: .7, musicVolume: .2, text };

test("single Hook text covers trim after save/reopen, including legacy and blank draft shapes", () => {
  for (const value of [edit, { ...edit, text: null, textOverlays: [text] }, { ...edit, text: null, textOverlays: [{ ...text, value: "" }] }]) {
    const next = fullDurationSingleHookText(readFormatEditDraft(JSON.parse(JSON.stringify(value))));
    assert.deepEqual(formatTextOverlays(next), [{ ...formatTextOverlays(value)[0], startMs: 0, endMs: 3000 }]);
    assert.equal(fullDurationSingleHookText(next), next);
    assert.equal(Object.hasOwn(next, "textOverlays"), Object.hasOwn(value, "textOverlays"));
    assert.equal(next.originalVolume, value.originalVolume);
    assert.deepEqual(readFormatEditDraft(JSON.parse(JSON.stringify(next))), next);
  }
});

test("no text, multi-block Hook sequences, and other format timing stay unchanged", () => {
  for (const value of [{ ...edit, text: null }, { ...edit, text: null, textOverlays: [] },
    { ...edit, text: null, textOverlays: [text, { ...text, value: "Second", startMs: 2000, endMs: 3000 }] },
    { ...edit, format: "wall_text" as const }]) assert.equal(fullDurationSingleHookText(value), value);
});
