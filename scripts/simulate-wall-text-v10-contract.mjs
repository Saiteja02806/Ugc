import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(rootDirectory, ".tmp", "wall-text-v10-simulation");
const loaderUrl = pathToFileURL(
  path.join(rootDirectory, "scripts", "next-server-only-test-loader.mjs"),
).href;

// The samples deliberately cover each automatic word-count band. Their
// expected row count is a preference, not per-card metadata: measured fit can
// still choose the nearest viable count for unusually long words.
const samples = [
  {
    expectedLines: 5,
    name: "24-words-5-lines",
    text: "Your day feels lighter when tasks stop competing for attention and start showing you one clear next step at the moment you need it.",
  },
  {
    expectedLines: 6,
    name: "28-words-6-lines",
    text: "One small delay can change the shape of a day. When your plan stays clear, it is easier to see what matters and act before stress grows again.",
  },
  {
    expectedLines: 7,
    name: "32-words-7-lines",
    text: "Small tasks can steal a calm day when they stay hidden. Seeing them beside your plans makes the next choice clear before everything starts to feel rushed and hard to manage again.",
  },
  {
    expectedLines: 8,
    name: "36-words-8-lines",
    text: "Your plan should help when the day changes, not make you rebuild it. Keep tasks and time together so each small choice stays clear, calm, and easy to act on when things move around again today.",
  },
  {
    expectedLines: 8,
    name: "40-words-8-lines",
    text: "Life feels less loud when you can see what matters next. A clear plan keeps your tasks near your time, so changes do not turn into a long list of things to fix before the whole day feels lost again.",
  },
];

const generated = generateSemanticLayouts(samples);
const { buildWallTextOverlaySvg } = await import(
  pathToFileURL(
    path.join(rootDirectory, "worker", "dist", "lib", "wall-text-render-spec.js"),
  ).href
);
const { assertWallTextOverlayPixelsInsideTextBox } = await import(
  pathToFileURL(
    path.join(rootDirectory, "worker", "dist", "lib", "render-engine.js"),
  ).href
);

mkdirSync(outputDirectory, { recursive: true });

const report = [];
for (const sample of samples) {
  const result = generated[sample.name];
  assert.ok(result, `Simulation did not return ${sample.name}.`);

  const { content, render } = result;
  const lines = content.finalLayout.blocks.flatMap((block) => block.lines);
  const wordCount = countWords(content.fullText);
  assert.equal(wordCount, Number(sample.name.slice(0, 2)));
  assert.equal(lines.length, sample.expectedLines);
  assert.equal(lines.join(" "), content.fullText);
  assert.ok(lines.every((line) => countWords(line) >= 2));
  assert.equal(content.finalLayout.fontFamily, "Arial");
  assert.equal(content.finalLayout.fontWeight, 700);
  assert.equal(content.finalLayout.fontSizePx, 50);

  const svg = buildWallTextOverlaySvg({
    content,
    placement: content.layout?.placement ?? "middle",
    textBox: content.finalLayout.textBox,
  });
  const raster = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const textBox = {
    height: Math.round(content.finalLayout.textBox.height * 1920),
    left: Math.round(content.finalLayout.textBox.x * 1080),
    top: Math.round(content.finalLayout.textBox.y * 1920),
    width: Math.round(content.finalLayout.textBox.width * 1080),
  };
  const bounds = assertWallTextOverlayPixelsInsideTextBox({
    channels: raster.info.channels,
    height: raster.info.height,
    pixels: raster.data,
    textBox,
    width: raster.info.width,
  });
  const innerLeft = textBox.left + 15;
  const innerRight = textBox.left + textBox.width - 15 - 1;
  const leftPadding = bounds.left - innerLeft;
  const rightPadding = innerRight - bounds.right;
  assert.ok(leftPadding > 0, `${sample.name} reaches the protected left fence.`);
  assert.ok(rightPadding > 0, `${sample.name} reaches the protected right fence.`);
  assert.ok(render.maximumLineWidth + 8 < 750);

  const imagePath = path.join(outputDirectory, `${sample.name}.png`);
  await sharp({
    create: {
      background: { alpha: 1, b: 38, g: 29, r: 24 },
      channels: 4,
      height: 1920,
      width: 1080,
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(imagePath);

  report.push({
    font: {
      family: content.finalLayout.fontFamily,
      sizePx: content.finalLayout.fontSizePx,
      weight: content.finalLayout.fontWeight,
    },
    imagePath,
    leftPadding,
    lineCount: lines.length,
    lineWidths: render.lineWidths,
    maximumLineWidth: render.maximumLineWidth,
    name: sample.name,
    rightPadding,
    textBox,
    wordCount,
  });
}

const reportPath = path.join(outputDirectory, "report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report, reportPath }, null, 2));

function generateSemanticLayouts(inputSamples) {
  const script = `
    const [engine, feed, logic, validation] = await Promise.all([
      import(${JSON.stringify(pathToFileURL(path.join(rootDirectory, "lib", "trending", "wall-layout-engine.ts")).href)}),
      import(${JSON.stringify(pathToFileURL(path.join(rootDirectory, "lib", "trending", "wall-text-feed-logic.ts")).href)}),
      import(${JSON.stringify(pathToFileURL(path.join(rootDirectory, "lib", "trending", "wall-text-text-logic.ts")).href)}),
      import(${JSON.stringify(pathToFileURL(path.join(rootDirectory, "lib", "trending", "wall-text-render-validation.ts")).href)}),
    ]);
    const output = {};
    for (const sample of ${JSON.stringify(inputSamples)}) {
      try {
        const layout = feed.createWallTextLayout();
        const result = await engine.createAuthoritativeWallTextContent({
          content: { kind: "text", text: sample.text },
          formatId: "freeform",
          layout,
        });
        logic.validateWallTextContent(result.content, 6);
        logic.validateWallTextContent(result.content, 60);
        output[sample.name] = {
          content: { ...result.content, layout: result.layout },
          render: await validation.validateWallTextRenderFit(result.content),
        };
      } catch (error) {
        throw new Error(sample.name + ": " + (error instanceof Error ? error.message : String(error)));
      }
    }
    process.stdout.write(JSON.stringify(output));
  `;
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--import",
        loaderUrl,
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        script,
      ],
      { cwd: rootDirectory, encoding: "utf8", stdio: "pipe" },
    ),
  );
}

function countWords(value) {
  return value.split(/\s+/u).filter(Boolean).length;
}
