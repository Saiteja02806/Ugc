import assert from "node:assert/strict";
import test from "node:test";
import { prepareFormatEditForExport, readFormatEditDraft } from "../lib/explore/format-edit-draft.ts";
import { MAX_FORMAT_TEXT_OVERLAYS, parseExploreFormatEdit } from "../worker/src/lib/explore-format-edit.ts";

const text = (value, patch = {}) => ({ value, width: .8, y: .12, fontSize: 48, color: "#ffffff", startMs: 200, endMs: 1600, ...patch });
const edit = patch => ({ version: 1, format: "hook", trimStartMs: 500, trimEndMs: 3500, originalVolume: 1, musicVolume: .2, text: null, ...patch });

test("blank UI overlays do not enter exports and leave the legacy no-text shape", () => {
  const draft = edit({ textOverlays: [text(""), text(" \t\r\n ")] });
  const exported = prepareFormatEditForExport(draft);
  assert.deepEqual(exported, edit());
  assert.equal(Object.hasOwn(exported, "textOverlays"), false);
  assert.equal(draft.textOverlays.length, 2);
  assert.equal(draft.textOverlays[1].value, " \t\r\n ");
  assert.deepEqual(parseExploreFormatEdit(exported), exported);
});

test("mixed exports preserve nonblank text, order, styles and timing without mutating drafts", () => {
  const first = text(" First message "), second = text("Second\n\nmessage", { startMs: 1700, endMs: 2800, color: "#ff0000" });
  const draft = edit({ textOverlays: [text(""), first, text("\n"), second] });
  const exported = prepareFormatEditForExport(draft);
  assert.deepEqual(exported.textOverlays, [first, second]);
  assert.equal(exported.textOverlays[0], first);
  assert.equal(draft.textOverlays.length, 4);
  assert.deepEqual(parseExploreFormatEdit(exported), exported);
});

test("legacy edits, nonblank sequences and existing empty arrays keep their exact export identity", () => {
  for (const draft of [edit(), edit({ text: text("Legacy text") }), edit({ textOverlays: [] }), edit({ textOverlays: [text("Ready")] })]) {
    assert.equal(prepareFormatEditForExport(draft), draft);
    assert.deepEqual(readFormatEditDraft(draft), parseExploreFormatEdit(draft));
  }
});

test("blank local drafts reload their original string, style and timing, while export parsing stays strict", () => {
  const draft = edit({ textOverlays: [text(" \t\r\n ", { width: .94, y: .3, fontSize: 64, color: "#67e8f9", startMs: 1200, endMs: 2900 }), text("Second message")] });
  const restored = readFormatEditDraft(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(restored, draft);
  assert.throws(() => parseExploreFormatEdit(draft));
  assert.deepEqual(parseExploreFormatEdit(prepareFormatEditForExport(restored)), edit({ textOverlays: [draft.textOverlays[1]] }));
});

test("blank values cannot bypass timing, style, shape, count or format validation", () => {
  const base = edit({ textOverlays: [text("")] });
  for (const badText of [
    text("", { startMs: -1 }), text("", { endMs: 3001 }), text("", { startMs: 1000, endMs: 1000 }), text("", { endMs: 1000.5 }),
    text("", { fontSize: 23 }), text("", { width: .95 }), text("", { y: .91 }), text("", { color: "red" }), text("", { unknown: true }),
    null, [], { value: "" }, text("", { width: Number.NaN }), text("", { fontSize: Infinity }),
  ]) assert.throws(() => readFormatEditDraft({ ...base, textOverlays: [badText] }));
  for (const patch of [
    { format: "slideshow" }, { version: 2 }, { trimEndMs: 600 }, { originalVolume: 2 }, { unknown: true },
    { textOverlays: {} }, { textOverlays: Array.from({ length: MAX_FORMAT_TEXT_OVERLAYS + 1 }, () => text("")) },
    { text: text("Legacy"), textOverlays: [text("")] }, { text: text(""), textOverlays: undefined },
  ]) assert.throws(() => readFormatEditDraft({ ...base, ...patch }));
  for (const value of [null, undefined, [], "invalid"]) assert.throws(() => readFormatEditDraft(value));
});

test("local blank placeholders do not conceal overlong strings or disallowed control characters", () => {
  for (const value of [" ".repeat(601), "\u000b", "\u000c", "\u0000", " \n\u001f", "text\u0008", "A".repeat(601)]) {
    assert.throws(() => readFormatEditDraft(edit({ textOverlays: [text(value)] })));
  }
  const longestBlank = edit({ textOverlays: [text(" ".repeat(600))] });
  assert.equal(readFormatEditDraft(longestBlank).textOverlays[0].value.length, 600);
});
