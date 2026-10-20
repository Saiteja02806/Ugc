import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.UGCPILOT_VERIFY_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: process.env.UGCPILOT_BROWSER_CHANNEL ?? "msedge" });
mkdirSync(".tmp/post-feed-verification", { recursive: true });

async function verify(name, options) {
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.url().startsWith(`${origin}/api/`) && request.method() !== "GET") writes.push(request.url());
    });
    await page.goto(`${origin}/#content-showcase`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const section = page.locator("#content-showcase");
    const preview = section.locator("[data-landing-slideshow]");
    await preview.waitFor();
    await section.scrollIntoViewIfNeeded();
    assert.equal(await section.getByRole("heading", { name: "Create a repeatable content format." }).count(), 1);
    assert.equal(await section.locator("button, video, [data-post-interaction-feed]").count(), 0);
    assert.equal(await section.getByText(/Double.tap|Interactive|like|skip/i).count(), 0);
    assert.equal(await preview.locator("img").count(), 6);
    const box = await preview.boundingBox();
    assert.ok(Math.abs(box.height - box.width * 16 / 9) < 2, "slideshow must retain a 9:16 frame");
    const strip = section.locator("[data-landing-slide-strip]");
    await preview.dblclick();
    assert.equal(await section.locator("[data-post-like-heart], [data-post-review-status]").count(), 0, "double tap must not approve content or create review state");
    const before = await strip.getAttribute("style");
    if (options.reducedMotion === "reduce") {
      await page.waitForTimeout(3300);
      assert.equal(await strip.getAttribute("style"), before, "reduced motion keeps a static slideshow");
    } else {
      await page.waitForFunction(previous => document.querySelector("#content-showcase [data-landing-slide-strip]")?.getAttribute("style") !== previous, before, { timeout: 4000 });
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page must fit viewport width");
    await section.screenshot({ path: `.tmp/post-feed-verification/landing-content-${name}.png` });
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(`PASS ${name}: passive slideshow, no videos or approval controls, responsive frame, no API writes`);
  } finally {
    await context.close();
  }
}

try {
  await verify("desktop", { viewport: { width: 1366, height: 900 } });
  await verify("mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await verify("reduced-motion", { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
} finally {
  await browser.close();
}
