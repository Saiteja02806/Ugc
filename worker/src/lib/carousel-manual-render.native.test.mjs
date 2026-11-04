import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The application dependency remains usable even when the worker's optional
// native dependency cannot load. No worker build or real upload is involved.
const appRequire = createRequire(new URL("../../../package.json", import.meta.url));
const sharp = appRequire("sharp");
let workerCalls = 0;
mock.module("sharp", { defaultExport: () => {
  workerCalls++;
  throw Error("worker Sharp unavailable");
} });
const { renderCarouselManualSlide } = await import("./carousel-manual-render.ts");
const { defaultCarouselManualTextStyle } = await import("./carousel-manual-text.ts");

test("injected application Sharp renders real pixels without loading worker Sharp", async () => {
  const background = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#12ab34" } }).png().toBuffer();
  const { buffer } = await renderCarouselManualSlide({
    assetUrl: `data:image/png;base64,${background.toString("base64")}`,
    slide: { headline: "Native rendering", subtext: "", ctaText: "", slideNumber: 1,
      renderFormat: "4:5", textPosition: { x: 0.5, y: 0.5 }, textStyle: defaultCarouselManualTextStyle() },
  }, { imageProcessor: sharp, fontDirectory: fileURLToPath(new URL("../assets/fonts", import.meta.url)) });
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1080); assert.equal(info.height, 1350);
  [18, 171, 52].forEach((expected, index) => assert.ok(Math.abs(data[index] - expected) < 12));
  assert.equal(workerCalls, 0);
});
