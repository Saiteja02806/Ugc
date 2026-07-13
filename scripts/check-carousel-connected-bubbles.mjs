import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(
  workspaceRoot,
  ".tmp",
  "carousel-connected-bubbles",
  "v9-smoothed-patterns",
);

const {
  CAROUSEL_RENDERER_VERSION,
  buildConnectedBubblePath,
  inspectCarouselSlideLayout,
  renderCarouselSlide,
  smoothConnectedBubbleWidths,
} = await import("../lib/carousel/render-slide.ts");

if (
  CAROUSEL_RENDERER_VERSION !==
  "social-bubble-renderer-v9-smoothed-connected-path"
) {
  throw new Error(`Unexpected renderer version: ${CAROUSEL_RENDERER_VERSION}`);
}

await mkdir(outputDir, { recursive: true });
checkPathGeometry();

const cases = [
  {
    id: "01-one-short-line",
    slide: createHeadlineSlide("One clear next step"),
  },
  {
    id: "02-equal-two-lines",
    slide: createStackedSlide(["Balanced output now", "Balanced output now"]),
  },
  {
    id: "03-short-long",
    slide: createStackedSlide(["Short", "Longer connected background line"]),
  },
  {
    id: "04-long-short",
    slide: createStackedSlide(["Longer connected background line", "Short"]),
  },
  {
    id: "05-medium-wide-narrow",
    slide: createStackedSlide([
      "Medium line here",
      "A deliberately much wider middle line",
      "Tiny",
    ]),
  },
  {
    id: "06-wide-narrow-wide",
    slide: createStackedSlide([
      "A deliberately wide opening line",
      "Tiny",
      "Another deliberately wide closing line",
    ]),
  },
  {
    id: "07-four-alternating-lines",
    slide: createStackedSlide([
      "Wide opening line for contrast",
      "Small",
      "Wide middle line for contrast",
      "Tiny",
    ]),
  },
  {
    id: "08-wide-characters-and-punctuation",
    slide: createStackedSlide([
      "WWW MMM @ 100%",
      "Metrics: 1, 2, 3!",
      "Contain #2026? Yes.",
    ]),
  },
  {
    id: "09-maximum-width-copy",
    slideForFormat: (format) =>
      createStackedSlide([
        format === "1:1"
          ? "Wide metrics keep every visible character safely inside"
          : "Wide metrics keep visible characters safely inside",
      ]),
  },
  {
    id: "10-minimum-font-size-copy",
    slideForFormat: (format) =>
      createStackedSlide([
        format === "1:1"
          ? "WWW MMM @2026: 100% contained 111i today now."
          : "WWW MMM @2026: 100% contained iiiii today now.",
      ]),
  },
];

const formats = ["1:1", "4:5"];
const results = [];

for (const format of formats) {
  const outputs = [];
  const background = await createBackground(format);

  for (const item of cases) {
    const slide = item.slideForFormat?.(format) ?? item.slide;
    const diagnostics = await inspectCarouselSlideLayout({ format, slide });

    assertLayout(item.id, diagnostics);

    if (item.id === "09-maximum-width-copy") {
      const widest = Math.max(
        ...diagnostics.lines.map((line) => line.rectangleWidth),
      );

      if (widest < diagnostics.maxBubbleWidth - 42) {
        throw new Error(
          `${item.id} did not exercise the maximum-width boundary in ${format}.`,
        );
      }
    }

    if (item.id === "10-minimum-font-size-copy") {
      const expectedFontSize = format === "1:1" ? 32 : 34;
      const actualFontSize = Math.min(
        ...diagnostics.lines.map((line) => line.fontSize),
      );

      if (actualFontSize !== expectedFontSize) {
        throw new Error(
          `${item.id} expected ${expectedFontSize}px but rendered at ${actualFontSize}px in ${format} with widths ${diagnostics.lines.map((line) => line.rectangleWidth).join(", ")}.`,
        );
      }
    }

    const rendered = await renderCarouselSlide({
      assetUrl: `data:image/jpeg;base64,${background.toString("base64")}`,
      format,
      slide,
      textStyle: "highlight",
    });
    await assertSingleWhiteBubbleComponent(rendered, item.id, format);
    const outputPath = path.join(
      outputDir,
      `${format.replace(":", "x")}-${item.id}.webp`,
    );

    await writeFile(outputPath, rendered);
    outputs.push(outputPath);
    results.push({
      case: item.id,
      escapedTextPixels: diagnostics.escapedTextPixels,
      fontSizes: diagnostics.lines.map((line) => line.fontSize),
      format,
      lineWidths: diagnostics.lines.map((line) => line.rectangleWidth),
      maxBubbleWidth: diagnostics.maxBubbleWidth,
      repaired: diagnostics.repaired,
    });
  }

  await writeContactSheet(
    outputs,
    path.join(outputDir, `${format.replace(":", "x")}-contact-sheet.png`),
    format,
  );
}

console.log(
  JSON.stringify(
    {
      contactSheets: formats.map((format) =>
        path.join(
          outputDir,
          `${format.replace(":", "x")}-contact-sheet.png`,
        ),
      ),
      outputDir,
      rendererVersion: CAROUSEL_RENDERER_VERSION,
      results,
    },
    null,
    2,
  ),
);

function checkPathGeometry() {
  const oneLine = buildConnectedBubblePath({
    centerX: 540,
    groupHeight: 60,
    groupY: 300,
    lineCenterOffset: 30,
    lineStep: 50,
    outerRadius: 16,
    stepRadius: 12,
    widths: [300],
  });
  const snappedWidths = smoothConnectedBubbleWidths({
    maxSideInset: 24,
    requiredWidths: [302, 318],
  });
  const snapped = buildConnectedBubblePath({
    centerX: 540,
    groupHeight: 110,
    groupY: 300,
    lineCenterOffset: 30,
    lineStep: 50,
    outerRadius: 16,
    stepRadius: 12,
    widths: snappedWidths,
  });
  const controlledWidths = smoothConnectedBubbleWidths({
    maxSideInset: 24,
    requiredWidths: [700, 570],
  });
  const controlled = buildConnectedBubblePath({
    centerX: 540,
    groupHeight: 110,
    groupY: 300,
    lineCenterOffset: 30,
    lineStep: 50,
    outerRadius: 16,
    stepRadius: 12,
    widths: controlledWidths,
  });
  const bidirectionalWidths = smoothConnectedBubbleWidths({
    maxSideInset: 22,
    requiredWidths: [700, 570, 690],
  });

  if (!oneLine.pathData.startsWith("M ") || !oneLine.pathData.endsWith(" Z")) {
    throw new Error("One-line bubble did not produce one closed SVG path.");
  }

  if (snapped.widths[0] !== 318 || snapped.widths[1] !== 318) {
    throw new Error("Adjacent side-width differences below 10px were not snapped.");
  }

  if (controlled.widths[0] !== 700 || controlled.widths[1] !== 652) {
    throw new Error("The connected-bubble side inset was not limited to 24px.");
  }

  if (bidirectionalWidths.join(",") !== "700,656,690") {
    throw new Error(
      `Bidirectional smoothing produced unexpected widths: ${bidirectionalWidths.join(",")}.`,
    );
  }
}

function assertLayout(id, diagnostics) {
  if (diagnostics.bubbleShapeStrategy !== "connected-step-path") {
    throw new Error(`${id} did not use the connected path strategy.`);
  }

  if (
    !diagnostics.textPixelContainmentPassed ||
    diagnostics.escapedTextPixels !== 0
  ) {
    throw new Error(`${id} failed text-pixel containment.`);
  }

  for (const line of diagnostics.lines) {
    if (line.rectangleWidth < line.requiredWidth) {
      throw new Error(`${id} rendered a bubble band narrower than its text.`);
    }

    if (line.visualWidth !== line.rectangleWidth) {
      throw new Error(`${id} did not build the path from visualWidth.`);
    }

    if (line.rectangleWidth > diagnostics.maxBubbleWidth) {
      throw new Error(`${id} crossed the maximum bubble width.`);
    }

    if (line.cornerSafety < line.radius + 6) {
      throw new Error(`${id} did not preserve radius-aware corner safety.`);
    }
  }
}

async function assertSingleWhiteBubbleComponent(rendered, id, format) {
  const { data, info } = await sharp(rendered)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const white = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * info.channels;

    if (
      (data[offset] ?? 0) >= 238 &&
      (data[offset + 1] ?? 0) >= 238 &&
      (data[offset + 2] ?? 0) >= 238
    ) {
      white[pixelIndex] = 1;
    }
  }

  let bubbleComponents = 0;
  const componentSizes = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (!white[start] || visited[start]) {
      continue;
    }

    let head = 0;
    let tail = 0;
    let componentPixels = 0;

    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % info.width;
      const y = Math.floor(pixelIndex / info.width);
      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x + 1 < info.width ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - info.width : -1,
        y + 1 < info.height ? pixelIndex + info.width : -1,
      ];

      componentPixels += 1;

      for (const neighbor of neighbors) {
        if (neighbor >= 0 && white[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }

    // Enclosed counters inside dark glyphs form small white islands.
    if (componentPixels >= 2_000) {
      bubbleComponents += 1;
      componentSizes.push(componentPixels);
    }
  }

  if (bubbleComponents !== 1) {
    throw new Error(
      `${id} produced ${bubbleComponents} disconnected white bubble components in ${format}: ${componentSizes.join(", ")}.`,
    );
  }
}

function createHeadlineSlide(headline) {
  return {
    body: null,
    ctaText: null,
    headline,
    imageDirection: "Object-only test background with open central text space.",
    listItems: [],
    layoutPreset: "middle-statement",
    slideNumber: 1,
    slideType: "hook",
    subtext: null,
    textMode: "headline_body",
    textPosition: "center",
  };
}

function createStackedSlide(lines) {
  return {
    body: null,
    ctaText: null,
    headline: null,
    imageDirection: "Object-only test background with open central text space.",
    listItems: lines,
    layoutPreset: "interactive-list",
    slideNumber: 1,
    slideType: "problem",
    subtext: null,
    textMode: "checklist",
    textPosition: "center",
  };
}

async function createBackground(format) {
  const width = 1080;
  const height = format === "1:1" ? 1080 : 1350;
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#1b2528"/>
      <rect x="80" y="90" width="420" height="330" rx="28" fill="#33494a"/>
      <circle cx="890" cy="245" r="150" fill="#b77c4f" opacity="0.86"/>
      <rect x="120" y="${height - 360}" width="840" height="250" rx="34" fill="#101719"/>
      <rect x="710" y="${height - 300}" width="190" height="140" rx="22" fill="#6d8f88" opacity="0.72"/>
    </svg>
  `);

  return sharp(svg).jpeg({ quality: 92 }).toBuffer();
}

async function writeContactSheet(outputs, outputPath, format) {
  const tileWidth = 240;
  const tileHeight = format === "1:1" ? 240 : 300;
  const labelHeight = 46;
  const gap = 20;
  const columns = 5;
  const rows = Math.ceil(outputs.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * (tileHeight + labelHeight) + (rows + 1) * gap;
  const composites = [];

  for (const [index, output] of outputs.entries()) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = gap + column * (tileWidth + gap);
    const y = gap + row * (tileHeight + labelHeight + gap);
    const label = path
      .basename(output, ".webp")
      .replace(/^\d+x\d+-\d+-/, "");
    const image = await sharp(output)
      .resize(tileWidth, tileHeight, { fit: "contain" })
      .png()
      .toBuffer();
    const labelSvg = Buffer.from(`
      <svg width="${tileWidth}" height="${labelHeight}" viewBox="0 0 ${tileWidth} ${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="${Math.round(tileWidth / 2)}" y="27" text-anchor="middle" fill="#172226" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700">${label}</text>
      </svg>
    `);

    composites.push({ input: image, left: x, top: y });
    composites.push({ input: labelSvg, left: x, top: y + tileHeight });
  }

  await sharp({
    create: {
      background: "#f4f6f4",
      channels: 4,
      height,
      width,
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}
