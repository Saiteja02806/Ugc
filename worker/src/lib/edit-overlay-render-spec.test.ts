import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEditOverlayTextLayout,
  buildResolvedEditOverlayTextLayout,
  type EditOverlayRatio,
  type EditOverlayStyle,
} from "./edit-overlay-render-spec.js";

const REPORTED_SENTENCE =
  "After seeing this onboarding, i got to know how much time i wasted";

test("keeps the reported overlay wrapping stable across ratios and styles", () => {
  const cases: Array<{
    expected: ReturnType<typeof toGolden>;
    ratio: EditOverlayRatio;
    style: EditOverlayStyle;
  }> = [
    {
      ratio: "9:16",
      style: "clean",
      expected: {
        bounds: {
          containerHeight: 252,
          containerWidth: 824,
          containerX: 128,
          contentMaxWidth: 907,
          maxContainerHeight: 653,
          maxContainerWidth: 907,
          textHeight: 252,
          textWidth: 824,
        },
        estimatedLineWidths: [551, 824, 792],
        fontSize: 68,
        lineHeight: 92,
        lines: [
          "After seeing this",
          "onboarding, i got to know",
          "how much time i wasted",
        ],
        lineSpacing: 24,
        padding: 0,
      },
    },
    {
      ratio: "4:5",
      style: "minimal",
      expected: {
        bounds: {
          containerHeight: 274,
          containerWidth: 814,
          containerX: 133,
          contentMaxWidth: 869,
          maxContainerHeight: 459,
          maxContainerWidth: 907,
          textHeight: 236,
          textWidth: 776,
        },
        estimatedLineWidths: [519, 776, 745],
        fontSize: 64,
        lineHeight: 86,
        lines: [
          "After seeing this",
          "onboarding, i got to know",
          "how much time i wasted",
        ],
        lineSpacing: 22,
        padding: 19,
      },
    },
    {
      ratio: "16:9",
      style: "clean",
      expected: {
        bounds: {
          containerHeight: 160,
          containerWidth: 1548,
          containerX: 186,
          contentMaxWidth: 1613,
          maxContainerHeight: 454,
          maxContainerWidth: 1613,
          textHeight: 160,
          textWidth: 1548,
        },
        estimatedLineWidths: [1548, 638],
        fontSize: 68,
        lineHeight: 92,
        lines: [
          "After seeing this onboarding, i got to know how",
          "much time i wasted",
        ],
        lineSpacing: 24,
        padding: 0,
      },
    },
  ];

  for (const scenario of cases) {
    const layout = buildEditOverlayTextLayout(
      REPORTED_SENTENCE,
      scenario.style,
      scenario.ratio,
    );

    assert.deepEqual(
      toGolden(layout),
      scenario.expected,
      `${scenario.style} ${scenario.ratio}`,
    );
  }
});

test("reserves background padding inside the 84 percent width", () => {
  const ratios: EditOverlayRatio[] = ["9:16", "1:1", "4:5", "16:9"];
  const styles: EditOverlayStyle[] = ["clean", "minimal", "bubble", "hook"];

  for (const ratio of ratios) {
    for (const style of styles) {
      const layout = buildEditOverlayTextLayout(
        REPORTED_SENTENCE,
        style,
        ratio,
      );

      assert.ok(
        layout.bounds.containerWidth <= layout.bounds.maxContainerWidth,
      );
      assert.equal(
        layout.bounds.contentMaxWidth,
        layout.bounds.maxContainerWidth - layout.padding * 2,
      );
      assert.ok(
        layout.estimatedLineWidths.every(
          (width) => width <= layout.bounds.contentMaxWidth,
        ),
      );
      assert.equal(layout.lineHeight, layout.fontSize + layout.lineSpacing);
    }
  }
});

test("renders Hook copy as restrained text without a background plate", () => {
  const layout = buildEditOverlayTextLayout(
    "Tired of slow meal logging?",
    "hook",
    "9:16",
  );

  assert.equal(layout.backgroundColor, undefined);
  assert.equal(layout.backgroundOpacity, null);
  assert.equal(layout.fontSize, 52);
  assert.equal(layout.fontWeight, 600);
  assert.equal(layout.padding, 0);
  assert.equal(layout.lineHeight, 64);
  assert.equal(layout.isTruncated, false);
});

test("preserves three intentional Hook lines with an emoji", () => {
  const layout = buildEditOverlayTextLayout(
    "Meal logging\ninterrupts the day\nagain 😩",
    "hook",
    "9:16",
  );

  assert.deepEqual(layout.lines, [
    "Meal logging",
    "interrupts the day",
    "again 😩",
  ]);
  assert.equal(layout.fontSize, 52);
  assert.equal(layout.isTruncated, false);
});

test("keeps fixed Hook type and exposes semantic-line overflow", () => {
  const layout = buildEditOverlayTextLayout(
    "Quitting stems from slow meal logging\nFaster entry makes consistency possible",
    "hook",
    "9:16",
  );

  assert.equal(layout.fontSize, 52);
  assert.ok(layout.lines.length > 2);
  assert.equal(layout.isTruncated, false);
});

test("uses saved Hook lines and font size without recalculating", () => {
  const layout = buildResolvedEditOverlayTextLayout({
    fontSize: 44,
    layoutVersion: "hook-overlay-layout-v1",
    lines: [
      "Quitting stems from slow meal logging",
      "Faster entry makes consistency possible",
    ],
    ratio: "9:16",
    style: "hook",
    textColor: "#f472b6",
  });

  assert.equal(layout.fontSize, 44);
  assert.deepEqual(layout.lines, [
    "Quitting stems from slow meal logging",
    "Faster entry makes consistency possible",
  ]);
  assert.equal(layout.isTruncated, false);
  assert.equal(layout.textColor, "#f472b6");
});

test("accepts a saved three-line Hook layout", () => {
  const layout = buildResolvedEditOverlayTextLayout({
    fontSize: 52,
    lines: ["Meal logging", "interrupts the day", "again 😩"],
    ratio: "9:16",
    style: "hook",
  });

  assert.deepEqual(layout.lines, [
    "Meal logging",
    "interrupts the day",
    "again 😩",
  ]);
  assert.equal(layout.isTruncated, false);
});

test("rejects a saved Hook layout that would wrap differently", () => {
  assert.throws(
    () =>
      buildResolvedEditOverlayTextLayout({
        fontSize: 52,
        lines: [
          "This deliberately oversized saved Hook line cannot fit the renderer width",
        ],
        ratio: "9:16",
        style: "hook",
      }),
    /do not fit the saved font size/,
  );
});

test("preserves manual lines and deterministically splits long words", () => {
  const layout = buildEditOverlayTextLayout(
    "First manual line\nSupercalifragilisticexpialidociousSupercalifragilisticexpialidocious",
    "bubble",
    "1:1",
  );

  assert.deepEqual(toGolden(layout), {
    bounds: {
      containerHeight: 357,
      containerWidth: 905,
      containerX: 88,
      contentMaxWidth: 853,
      maxContainerHeight: 367,
      maxContainerWidth: 907,
      textHeight: 303,
      textWidth: 851,
    },
    estimatedLineWidths: [488, 851, 851, 242],
    fontSize: 60,
    lineHeight: 81,
    lines: [
      "First manual line",
      "Supercalifragilisticexpialidoc",
      "iousSupercalifragilisticexpial",
      "idocious",
    ],
    lineSpacing: 21,
    padding: 27,
  });

  assert.deepEqual(
    buildEditOverlayTextLayout("Line one\n\nLine three", "clean", "9:16")
      .lines,
    ["Line one", "", "Line three"],
  );
});

test("adapts font size to keep dense text inside the height budget", () => {
  const layout = buildEditOverlayTextLayout(
    "ABCDEFGHIJ".repeat(10),
    "minimal",
    "1:1",
  );

  assert.equal(layout.fontSize, 52);
  assert.equal(layout.lineSpacing, 18);
  assert.equal(layout.bounds.containerHeight, 294);
  assert.ok(layout.bounds.containerHeight <= layout.bounds.maxContainerHeight);
  assert.deepEqual(layout.lines, [
    "ABCDEFGHIJABCDEFGHIJABCDE",
    "FGHIJABCDEFGHIJABCDEFGHIJA",
    "BCDEFGHIJABCDEFGHIJABCDEF",
    "GHIJABCDEFGHIJABCDEFGHIJ",
  ]);
});

test("truncates pathological manual line counts inside the frame", () => {
  const layout = buildEditOverlayTextLayout(
    Array.from({ length: 20 }, (_, index) => `L${index + 1}`).join("\n"),
    "bubble",
    "1:1",
  );

  assert.equal(layout.isTruncated, true);
  assert.ok(layout.lines.at(-1)?.endsWith("…"));
  assert.ok(layout.bounds.containerHeight <= layout.bounds.maxContainerHeight);
});

test("keeps full-width scripts inside the horizontal safe area", () => {
  const layout = buildEditOverlayTextLayout(
    "视觉叙事让每一帧都更清晰".repeat(4),
    "clean",
    "9:16",
  );

  assert.ok(
    layout.estimatedLineWidths.every(
      (width) => width <= layout.bounds.contentMaxWidth,
    ),
  );
  assert.ok(layout.lines.length > 1);
});

function toGolden(layout: ReturnType<typeof buildEditOverlayTextLayout>) {
  return {
    bounds: {
      containerHeight: layout.bounds.containerHeight,
      containerWidth: layout.bounds.containerWidth,
      containerX: layout.bounds.containerX,
      contentMaxWidth: layout.bounds.contentMaxWidth,
      maxContainerHeight: layout.bounds.maxContainerHeight,
      maxContainerWidth: layout.bounds.maxContainerWidth,
      textHeight: layout.bounds.textHeight,
      textWidth: layout.bounds.textWidth,
    },
    estimatedLineWidths: layout.estimatedLineWidths,
    fontSize: layout.fontSize,
    lineHeight: layout.lineHeight,
    lines: layout.lines,
    lineSpacing: layout.lineSpacing,
    padding: layout.padding,
  };
}
