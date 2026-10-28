import assert from "node:assert/strict";
import test from "node:test";
import { fitInitialHookText, HOOK_INITIAL_TEXT_LAYOUT_VERSION } from "./hook-initial-text-layout.ts";
import { DEFAULT_FORMAT_TEXT_STYLE, formatTextLayout, type ExploreFormatText } from "./explore-format-edit.ts";

const initial = (value: string): ExploreFormatText => ({ value, width: .84, y: .18, fontSize: 48, ...DEFAULT_FORMAT_TEXT_STYLE, startMs: 0, endMs: 3000 });

test("new Hook caption uses broad safe width and grows actual ink without adding lines or changing copy", () => {
  assert.equal(HOOK_INITIAL_TEXT_LAYOUT_VERSION, 1);
  for (const value of ["You're telling me this is\nwhat the cool girls use for\ntheir Pinterest??", "Wait… this was possible the whole time??", "I used to spend hours\ntrying to make product videos\nNow I can create them in one place\nand finally have something ready to post."]) {
    const old = initial(value), before = formatTextLayout(old, 1080, 1920);
    const fitted = fitInitialHookText(old, 1080, 1920), after = formatTextLayout(fitted, 1080, 1920);
    assert.equal(fitted.width, .94);
    assert.ok(fitted.fontSize > 48 && fitted.fontSize <= 84);
    assert.ok(after.textWidth > before.textWidth);
    assert.equal(after.lines.length, before.lines.length);
    assert.ok(after.textWidth + after.outlineWidth <= 1080 * .94);
    assert.equal(after.fits, true);
    assert.deepEqual({ ...fitted, width: old.width, fontSize: old.fontSize }, old);
    assert.equal(old.fontSize, 48);
  }
});

test("short captions remain one line, explicit paragraphs and emoji text stay exact", () => {
  for (const value of ["Wait… this was possible the whole time??", "Wow!", "Hiring creators ❌\nMaking videos ✅", "One\n\nTwo"]) {
    const fitted = fitInitialHookText(initial(value), 1080, 1920);
    assert.equal(fitted.value, value);
    assert.equal(formatTextLayout(fitted, 1080, 1920).lines.length, value.split("\n").length);
  }
});

test("portrait and landscape layouts stay within safe bounds; overfull text fails without truncation", () => {
  for (const [width, height] of [[1080, 1920], [1920, 1080], [360, 640]]) {
    const old = initial("A readable longer caption about making product videos. ".repeat(5));
    const next = fitInitialHookText(old, width, height), layout = formatTextLayout(next, width, height);
    assert.equal(next.value, old.value);
    assert.ok(next.fontSize >= 24 && next.fontSize <= 84);
    assert.ok(layout.fits && next.y * height + layout.lines.length * layout.lineHeight <= height * .72);
    assert.ok(layout.textWidth + layout.outlineWidth <= width * .94);
  }
  assert.throws(() => fitInitialHookText(initial("word\n".repeat(100)), 1080, 608), /fit/);
  for (const [width, height] of [[0,1920], [1080,0], [NaN,1920], [1080,Infinity]]) assert.throws(() => fitInitialHookText(initial("Hook"), width, height), /dimensions/);
});
