// Offline raster QA of both production renderers. No provider, DB or storage calls.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { renderCarouselSlideWithDiagnostics } from "../worker/dist/lib/carousel-render-slide.js";
import { renderCarouselStructure2SlideFromBuffer } from "../worker/dist/lib/carousel-structure-2-render-slide.js";

const output = path.resolve(".tmp/carousel-inter-typography");
await mkdir(output, { recursive: true });
const cases = [
  { name: "hook", slideNumber: 1, headline: "5 ways i stopped drowning in my endless to-do list", body: null, weight: 500 },
  { name: "heading-and-thoughts", slideNumber: 2, headline: "1. i stopped writing everything down", body: "honestly my list was just\nmaking me more anxious\n\nnow i only track what i can do\ntoday", weight: 400 },
  { name: "short-statement", slideNumber: 3, headline: null, body: "i started tracking\n\nwhat i already had", weight: 500 },
];
const tiles = [];
const reports = [];
for (const format of ["1:1", "4:5"]) {
  const height = format === "1:1" ? 1080 : 1350;
  for (const structure of ["structure_1", "structure_2"]) {
    for (const example of cases) {
      // Bright backdrop deliberately exercises outline contrast as well as type hierarchy.
      const assetBuffer = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}">
        <defs><linearGradient id="bg" x2="0.7" y2="1"><stop stop-color="#e4e0d4"/><stop offset="0.55" stop-color="#99aba3"/><stop offset="1" stop-color="#445d54"/></linearGradient></defs>
        <rect width="1080" height="${height}" fill="url(#bg)"/>
        <rect x="30" y="${height - 280}" width="400" height="240" rx="32" fill="#536859" opacity="0.2"/>
      </svg>`)).png().toBuffer();
      const slide = {
        body: example.body, ctaText: null, headline: example.headline,
        imageDirection: "offline typography fixture", layoutPreset: "middle-statement", listItems: [],
        slideNumber: example.slideNumber, slideType: example.slideNumber === 1 ? "hook" : "problem",
        subtext: example.body, textMode: example.body && example.headline ? "headline_body" : "single_statement", textPosition: "center",
      };
      const result = structure === "structure_1"
        ? await renderCarouselSlideWithDiagnostics({ assetUrl: `data:image/png;base64,${assetBuffer.toString("base64")}`, format, slide, textStyle: "plain" })
        : await renderCarouselStructure2SlideFromBuffer({ assetBuffer, format, spec: {
            assetId: "offline-fixture", assetUrl: "https://example.invalid/not-fetched", ctaText: null,
            headline: example.slideNumber === 1 ? null : example.headline, layoutVariant: "story_overlay_only",
            productVisualEligibility: "forbidden", slideNumber: example.slideNumber, storyFormatId: "wrong_belief",
            storyRole: example.slideNumber === 1 ? "recognition" : "failure_scene", storyText: example.body ?? example.headline,
            textPosition: "center", textTreatment: "overlay", visualContext: "offline fixture", visualRole: example.slideNumber === 1 ? "hook" : "human",
          } });
      const diagnostics = result.diagnostics;
      assert.equal(diagnostics.bodyFontWeight ?? diagnostics.storyFontWeight, example.weight);
      assert.equal(diagnostics.bodyFontSize ?? diagnostics.storyFontSize, example.slideNumber === 1 ? 72 : 48);
      assert.equal(diagnostics.whiteBackgroundGroupCount, example.slideNumber === 2 ? 1 : 0);
      const metadata = await sharp(result.buffer).metadata();
      assert.equal(metadata.width, 1080);
      assert.equal(metadata.height, height);
      const name = `${structure}-${format.replace(":", "x")}-${example.name}`;
      await writeFile(path.join(output, `${name}.webp`), result.buffer);
      reports.push({ name, ...diagnostics });
      const thumbnail = await sharp(result.buffer).resize(320, 400, { fit: "contain", background: "#202725" }).png().toBuffer();
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="42"><rect width="320" height="42" fill="#202725"/><text x="12" y="27" font-family="Inter" font-size="15" fill="white">${structure} · ${format} · ${example.name}</text></svg>`);
      tiles.push({ input: await sharp({ create: { width: 320, height: 442, channels: 3, background: "#202725" } }).composite([{ input: thumbnail, top: 0, left: 0 }, { input: label, top: 400, left: 0 }]).png().toBuffer(), top: Math.floor(tiles.length / 3) * 442, left: (tiles.length % 3) * 320 });
    }
  }
}
await sharp({ create: { width: 960, height: 1768, channels: 3, background: "#202725" } }).composite(tiles).png().toFile(path.join(output, "contact-sheet.png"));
await writeFile(path.join(output, "diagnostics.json"), JSON.stringify(reports, null, 2));
console.log(`PASS: ${reports.length} raster outputs; contact sheet: ${path.join(output, "contact-sheet.png")}`);
