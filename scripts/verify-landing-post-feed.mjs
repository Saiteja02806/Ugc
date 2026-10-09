import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.UGCPILOT_VERIFY_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: process.env.UGCPILOT_BROWSER_CHANNEL ?? "msedge" });
mkdirSync(".tmp/post-feed-verification", { recursive: true });

async function open(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().startsWith(`${origin}/api/`) && request.method() !== "GET") writes.push(request.url());
  });
  await page.goto(`${origin}/#interactive-feed`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const section = page.locator("#interactive-feed");
  const feed = section.locator("[data-post-interaction-feed]");
  await feed.waitFor();
  const frame = await feed.boundingBox();
  assert.ok(Math.abs(frame.height - frame.width * 16 / 9) < 2, "the preview must retain a 9:16 frame");
  await section.scrollIntoViewIfNeeded();
  await section.getByRole("button", { name: "Skip preview post" }).click();
  await active(feed, "item-wot");
  assert.equal(await section.getByText(/Swipe|REJECTED|POSTED/).count(), 0);
  assert.equal(await section.getByRole("heading", { name: "Double-tap to approve your daily content." }).count(), 1);
  assert.equal(await section.getByRole("button", { name: "Skip preview post" }).locator(".lucide-arrow-down").count(), 1);
  assert.equal(await section.getByRole("button", { name: "Like preview post" }).locator(".lucide-heart").count(), 1);
  return { context, page, section, feed, errors, writes };
}

async function active(feed, id) {
  await feed.locator(`[data-post-feed-item="${id}"]`).first().waitFor();
  await feed.page().waitForFunction(({ id }) => {
    const feed = document.querySelector("#interactive-feed [data-post-interaction-feed]");
    return feed.querySelector("[data-post-feed-active]")?.dataset.postFeedItem === id &&
      Math.abs(feed.scrollTop - (feed.dataset.postHasPrevious ? feed.clientHeight : 0)) < 1;
  }, { id });
}

try {
  const desktop = await open({ viewport: { width: 1366, height: 900 } });
  const { page, section, feed } = desktop;
  const media = feed.locator("[data-post-feed-item] [data-post-like-target]").first();
  await media.hover();
  assert.equal(await media.evaluate(element => getComputedStyle(element).cursor), "grab");
  await media.click({ position: { x: 100, y: 250 } });
  await page.waitForTimeout(350);
  await active(feed, "item-wot");
  await media.dblclick({ position: { x: 100, y: 250 }, delay: 60 });
  await section.locator("[data-post-like-heart]").waitFor();
  assert.equal(await section.getByRole("button", { name: "Skip preview post" }).isDisabled(), true);
  await media.dblclick({ position: { x: 100, y: 250 }, delay: 30 });
  await section.screenshot({ path: ".tmp/post-feed-verification/landing-heart-desktop.png" });
  await active(feed, "item-slideshow");
  await page.waitForTimeout(350);
  await active(feed, "item-slideshow");

  const strip = media.locator("[data-landing-slide-strip]");
  assert.equal(await strip.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41), 0);
  await section.getByRole("button", { name: "Next slide" }).click();
  await page.waitForFunction(() => {
    const strip = document.querySelector("#interactive-feed [data-post-feed-active] [data-landing-slide-strip]");
    return new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41 < -200;
  });
  await section.getByRole("button", { name: "Previous slide" }).click();
  await page.waitForFunction(() => {
    const strip = document.querySelector("#interactive-feed [data-post-feed-active] [data-landing-slide-strip]");
    return Math.abs(new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41) < 1;
  });
  assert.equal(await section.locator("[data-post-like-heart]").count(), 0);
  await active(feed, "item-slideshow");

  await media.hover();
  await page.mouse.wheel(0, 650);
  await active(feed, "item-hook");
  await page.waitForFunction(() => {
    const videos = [...document.querySelectorAll("#interactive-feed video")];
    const activeVideo = document.querySelector("#interactive-feed [data-post-feed-active] video");
    return activeVideo?.paused === false && videos.filter(video => video !== activeVideo).every(video => video.paused);
  });
  const box = await media.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 10 });
  await page.waitForTimeout(220);
  assert.equal(await feed.locator("[data-post-feed-item]").first().getAttribute("data-post-feed-item"), "item-hook");
  await page.mouse.up();
  await active(feed, "item-wot");
  await feed.focus();
  await page.keyboard.press("ArrowDown");
  await active(feed, "item-slideshow");
  await section.getByRole("button", { name: "Like preview post" }).click();
  await section.locator("[data-post-like-heart]").waitFor();
  await active(feed, "item-hook");
  await section.screenshot({ path: ".tmp/post-feed-verification/landing-feed-desktop.png" });
  assert.deepEqual(desktop.errors, []);
  assert.deepEqual(desktop.writes, []);
  console.log("PASS landing desktop: new copy/icons, single/double tap, heart lock, slideshow controls, wheel/drag/keyboard, three-format looping, only active video plays, no API writes");
  await desktop.context.close();

  const mobile = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.feed.scrollIntoViewIfNeeded();
  const mobileBox = await mobile.feed.boundingBox();
  await mobile.page.touchscreen.tap(mobileBox.x + 100, mobileBox.y + 250);
  await mobile.page.touchscreen.tap(mobileBox.x + 102, mobileBox.y + 252);
  await mobile.section.locator("[data-post-like-heart]").waitFor();
  await active(mobile.feed, "item-slideshow");
  await mobile.feed.scrollIntoViewIfNeeded();
  const scrollBox = await mobile.feed.boundingBox();
  const touch = await mobile.context.newCDPSession(mobile.page);
  const y = scrollBox.y + scrollBox.height - 25;
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: scrollBox.x + 135, y }] });
  for (let step = 1; step <= 8; step++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: scrollBox.x + 135, y: y - scrollBox.height * .95 * step / 8 }] });
    await mobile.page.waitForTimeout(25);
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await active(mobile.feed, "item-hook");
  assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "homepage must fit mobile width");
  await mobile.section.screenshot({ path: ".tmp/post-feed-verification/landing-feed-mobile.png" });
  assert.deepEqual(mobile.errors, []);
  assert.deepEqual(mobile.writes, []);
  console.log("PASS landing mobile: real touch double-tap and native scroll, loop, responsive width, no API writes");
  await mobile.context.close();

  const reduced = await open({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await reduced.section.getByRole("button", { name: "Like preview post" }).click();
  const heart = reduced.section.locator("[data-post-like-heart] svg");
  await heart.waitFor();
  assert.equal(await heart.evaluate(element => getComputedStyle(element).animationName), "none");
  await active(reduced.feed, "item-slideshow");
  assert.deepEqual(reduced.errors, []);
  console.log("PASS landing reduced motion: still heart and one advance");
  await reduced.context.close();
} finally {
  await browser.close();
}
