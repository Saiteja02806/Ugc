import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  clampNormalizedTextPosition,
  createHookEditContent,
  createWallTextEditContent,
} from "./creative-edit-contract.ts";
import {
  chooseLibraryAsset,
  selectEntireLibrary,
  selectExactVideo,
  updateSourceChoiceForPreview,
} from "./creative-edit-source-selection.ts";
import {
  createHookTextLayout,
  getDefaultHookTextPosition,
  HOOK_TEXT_MAXIMUM_CHARACTERS,
  HOOK_TEXT_LAYOUT_VERSION,
} from "./hook-text-layout.ts";
import { validateWallTextContent } from "./wall-text-text-logic.ts";
import type { TrendingWallTextContent } from "./wall-text-types.ts";
import { getWallTextEditorTypography } from "./wall-text-visual-style.ts";
import {
  resolveTrendingTextColor,
  TRENDING_TEXT_COLOR_OPTIONS,
} from "./text-color.ts";

const currentContent: TrendingWallTextContent = {
  fullText: "Old lead. Old close.",
  kind: "wall_text",
  layoutVersion: "wall-text-overlay-v4",
  pattern: "problem_change_result",
  renderFontSize: 52,
  segments: [
    { lines: ["Old lead."], role: "lead" },
    { lines: ["Old close."], role: "closing" },
  ],
};

test("clamps dragged text anchors to the renderer safe range", () => {
  assert.deepEqual(clampNormalizedTextPosition({ x: -4, y: 2 }), {
    x: 0.1,
    y: 0.9,
  });
});

test("keeps the editor and worker on one safe color palette", () => {
  const workerContract = readFileSync(
    new URL(
      "../../worker/src/lib/edit-overlay-render-spec.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal(resolveTrendingTextColor(undefined), "#ffffff");
  assert.equal(resolveTrendingTextColor("url(evil)"), "#ffffff");
  assert.equal(TRENDING_TEXT_COLOR_OPTIONS.length, 6);
  for (const option of TRENDING_TEXT_COLOR_OPTIONS) {
    assert.equal(workerContract.includes(option.value), true);
  }
});

test("wall edits remain a renderable two-to-three segment payload", () => {
  const content = createWallTextEditContent(
    "This used to take all afternoon. Now one clear workflow keeps every handoff moving. The team gets its focus back.",
    currentContent,
  );

  assert.equal(content.fullText.includes("afternoon"), true);
  assert.equal(content.segments.length >= 2 && content.segments.length <= 3, true);
  assert.equal(
    content.segments.every(
      (segment) => segment.lines.length >= 1 && segment.lines.length <= 4,
    ),
    true,
  );
  assert.equal(content.segments[0]?.role, "lead");
  assert.equal(content.segments.at(-1)?.role, "closing");
  assert.equal("renderFontSize" in content, false);
  const lineCount = content.segments.reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );
  assert.equal(lineCount >= 5 && lineCount <= 8, true);
  assert.equal(
    content.segments.every((segment) =>
      segment.lines.every((line) => {
        const wordCount = line.split(/\s+/u).filter(Boolean).length;
        return wordCount >= 2 && wordCount <= 6;
      }),
    ),
    true,
  );
  assert.doesNotThrow(() => validateWallTextContent(content, 6));
  assert.throws(
    () => validateWallTextContent(content, 4),
    /16–16 words for a 4\.0-second clip/,
  );
});

test("Wall typing keeps Avenir at 50px when measured metadata is invalidated", () => {
  const saved: TrendingWallTextContent = {
    ...currentContent,
    layoutVersion: "wall-text-overlay-v9",
    renderFontSize: 50,
    finalLayout: {
      version: "wall-text-final-layout-v5",
      fontFamily: "Avenir Next",
      fontWeight: 600,
      fontSizePx: 50,
      lineHeightPx: 55,
      blocks: [{ role: "text", lines: ["Old lead.", "Old close."] }],
      textBox: { x: 150 / 1080, y: 660 / 1920, width: 780 / 1080, height: 480 / 1920 },
    },
  };
  const expected = getWallTextEditorTypography(saved);
  assert.match(expected.fontFamily, /Avenir Next/);
  assert.equal(expected.fontWeight, 600);
  assert.equal(expected.fontSize, 50);
  assert.equal(expected.outlineWidth, 2);

  for (const initial of [saved, currentContent]) {
    let draft = initial;
    for (const text of [
      "Between classes, meetings, and errands, integrating your schedule with calendars so tasks appear alongside appointments helps reduce the mental load of planning.",
      "Partial text",
      "",
      "A much longer pasted paragraph. ".repeat(8),
    ]) {
      draft = createWallTextEditContent(text, draft);
      assert.equal(draft.finalLayout, undefined);
      assert.equal(draft.renderFontSize, undefined);
      assert.deepEqual(getWallTextEditorTypography(draft), expected);
    }
  }

  // Opening a previously measured legacy layout still shows its saved style.
  const historical: TrendingWallTextContent = {
    ...saved,
    layoutVersion: "wall-text-overlay-v8",
    renderFontSize: 44,
    finalLayout: {
      ...saved.finalLayout!,
      fontFamily: "Arial",
      fontWeight: 400,
      fontSizePx: 44,
      lineHeightPx: 48.4,
      version: "wall-text-final-layout-v4",
    },
  };
  const historicalTypography = getWallTextEditorTypography(historical);
  assert.equal(historicalTypography.fontSize, 44);
  assert.equal(historicalTypography.outlineWidth, 4);
  assert.match(historicalTypography.fontFamily, /Arial/);
});

test("compact Wall edit patterns use the five-line minimum", () => {
  const content = createWallTextEditContent(
    "Reviewing weekly progress shows where effort actually went. The next choice feels less like a guess.",
    {
      ...currentContent,
      pattern: "action_benefit",
    },
  );
  const lineCount = content.segments.reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );

  assert.equal(lineCount, 5);
  assert.doesNotThrow(() => validateWallTextContent(content, 6));
});

test("Hook edits recalculate their final lines, font, and safe position", () => {
  const current = {
    fontSize: 52,
    format: "hook_video" as const,
    hookText: "Old Hook copy",
    lines: ["Old Hook copy"],
    position: { x: 0.01, y: 0.01 },
    textColor: "#ffffff" as const,
    version: "trending-creative-edit-v1" as const,
  };
  const edited = createHookEditContent(
    "Your slow reporting workflow is costing the team every morning",
    current,
  );
  const layout = createHookTextLayout(edited.hookText, {
    fontSize: edited.fontSize,
    lines: edited.lines,
  });

  assert.equal(edited.lines.length, 2);
  assert.equal(edited.fontSize, 52);
  assert.equal(edited.fontSize, layout.fontSize);
  assert.equal(layout.version, HOOK_TEXT_LAYOUT_VERSION);
  assert.equal(edited.textColor, "#ffffff");
  assert.ok(edited.position.x >= layout.positionBounds.minX);
  assert.ok(edited.position.y >= layout.positionBounds.minY);
});

test("new Hook text starts in the upper safe band instead of over the face", () => {
  const layout = createHookTextLayout(
    "A clearer way to plan content",
  );
  const position = getDefaultHookTextPosition(layout.positionBounds);

  assert.equal(position.x, 0.5);
  assert.equal(position.y, layout.positionBounds.minY);
  assert.ok(position.y < 0.25);
});

test("Hook edits preserve three intentional lines and a trailing emoji", () => {
  const layout = createHookTextLayout(
    "Meal logging\nshouldn't interrupt\nyour whole day 😩",
  );

  assert.deepEqual(layout.lines, [
    "Meal logging",
    "shouldn't interrupt",
    "your whole day 😩",
  ]);
  assert.equal(layout.fontSize, 52);
  assert.equal(layout.wordCount, 8);
});

test("Hook editor changes preserve user-controlled line breaks", () => {
  const current = {
    fontSize: 52,
    format: "hook_video" as const,
    hookText: "Old Hook copy",
    lines: ["Old Hook copy"],
    position: { x: 0.5, y: 0.15 },
    textColor: "#ffffff" as const,
    version: "trending-creative-edit-v1" as const,
  };
  const hookText = "Meal logging\nshouldn't interrupt\nyour whole day";
  const edited = createHookEditContent(hookText, current);

  assert.equal(edited.hookText, hookText);
  assert.deepEqual(edited.lines, [
    "Meal logging",
    "shouldn't interrupt",
    "your whole day",
  ]);
});

test("Hook layouts fail closed when saved lines or font metadata change", () => {
  assert.throws(
    () =>
      createHookTextLayout("The original Hook copy", {
        fontSize: 60,
        lines: ["Different Hook copy"],
      }),
    /saved Hook lines do not match/,
  );
  assert.throws(
    () =>
      createHookTextLayout("The original Hook copy", {
        fontSize: 55,
        lines: ["The original Hook copy"],
      }),
    /fixed 52px font size/,
  );
});

test("invalid in-progress Hook edits are preserved instead of sliced", () => {
  const current = {
    fontSize: 52,
    format: "hook_video" as const,
    hookText: "Old Hook copy",
    lines: ["Old Hook copy"],
    position: { x: 0.5, y: 0.15 },
    textColor: "#ffffff" as const,
    version: "trending-creative-edit-v1" as const,
  };
  const edited = createHookEditContent("One\nTwo\nThree\nFour", current);

  assert.equal(edited.hookText, "One\nTwo\nThree\nFour");
  assert.deepEqual(edited.lines, ["One", "Two", "Three", "Four"]);
  assert.throws(
    () =>
      createHookTextLayout(edited.hookText, {
        fontSize: edited.fontSize,
        lines: edited.lines,
      }),
    /3 lines/,
  );
});

test("Hook save validation rejects word and character limit violations", () => {
  assert.throws(
    () => createHookTextLayout("one two three four five six seven eight nine ten eleven twelve thirteen"),
    /12 words/,
  );
  assert.throws(
    () =>
      createHookTextLayout(
        `This Hook is ${"far ".repeat(HOOK_TEXT_MAXIMUM_CHARACTERS)}`,
      ),
    /78 characters/,
  );
});

test("library and exact-video choices stay distinct while browsing", () => {
  const libraryChoice = selectEntireLibrary("library-1", "video-1");
  const nextLibraryChoice = updateSourceChoiceForPreview(
    libraryChoice,
    "library-1",
    "video-2",
  );
  const exactChoice = selectExactVideo("video-2");

  assert.deepEqual(nextLibraryChoice, {
    groupId: "library-1",
    resolvedAssetId: "video-2",
    selectionKind: "group",
  });
  assert.deepEqual(
    updateSourceChoiceForPreview(exactChoice, "library-1", "video-3"),
    exactChoice,
  );
  assert.deepEqual(
    updateSourceChoiceForPreview(exactChoice, null, "video-3"),
    selectExactVideo("video-3"),
  );
});

test("an entire library resolves to one stable export video", () => {
  const assets = [
    { id: "video-1" },
    { id: "video-2" },
    { id: "video-3" },
  ];
  const first = chooseLibraryAsset(assets, "creative-123");
  const second = chooseLibraryAsset(assets, "creative-123");

  assert.ok(first);
  assert.equal(second?.id, first.id);
  assert.equal(assets.some((asset) => asset.id === first.id), true);
  assert.equal(chooseLibraryAsset([], "creative-123"), null);
});
