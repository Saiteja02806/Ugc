import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.UGCPILOT_VERIFY_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: process.env.UGCPILOT_BROWSER_CHANNEL ?? "msedge" });
mkdirSync(".tmp/post-feed-verification", { recursive: true });
const sessionKey = "ugcpilot.try-demo.session.v1";

async function session(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey);
}
async function waitCounts(page, likes, skips) {
  await page.waitForFunction(({ key, likes, skips }) => {
    const value = JSON.parse(localStorage.getItem(key));
    return value?.postedCount === likes && value?.skippedCount === skips;
  }, { key: sessionKey, likes, skips });
}
async function waitForFeedHydration(page) {
  await page.waitForFunction(() => {
    const element = document.querySelector("[data-post-interaction-feed]");
    return element && Object.keys(element).some(key => key.startsWith("__reactProps$") &&
      typeof element[key]?.onKeyDown === "function");
  });
}
async function openDemo(context) {
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  await page.goto(`${origin}/try-ugcpilot`, { waitUntil: "load" });
  await page.locator('[data-post-interaction-feed][aria-busy="false"]').waitFor();
  await waitCounts(page, 0, 0);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  return page;
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  desktop.setDefaultNavigationTimeout(60_000);
  const page = await openDemo(desktop);
  const feed = page.locator("[data-post-interaction-feed]");
  await feed.click({ position: { x: 90, y: 210 } });
  await page.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
  await waitCounts(page, 0, 0);
  await feed.click({ position: { x: 90, y: 260 } });
  await page.waitForTimeout(350);
  assert.equal((await session(page)).postedCount, 0, "single tap must not like");
  await feed.dblclick({ position: { x: 100, y: 270 }, delay: 70 });
  await page.locator("[data-post-like-heart]").waitFor();
  // Repeat while feedback is locked; a screenshot can wait for fonts and
  // outlast the feedback, accidentally targeting the next post instead.
  await feed.dblclick({ position: { x: 100, y: 270 }, delay: 30 });
  await page.screenshot({ path: ".tmp/post-feed-verification/demo-heart.png" });
  await waitCounts(page, 1, 0);
  await page.waitForTimeout(400);
  assert.equal((await session(page)).postedCount, 1, "repeated double-tap must accept once");
  await page.getByRole("button", { name: "Turn on background audio" }).dblclick();
  await page.waitForTimeout(350);
  assert.equal((await session(page)).postedCount, 1, "audio control must not like");
  await feed.evaluate(element => element.scrollTo({ top: element.clientHeight, behavior: "instant" }));
  await page.waitForTimeout(500);
  assert.equal((await session(page)).skippedCount, 0, "programmatic scroll must not skip");
  await feed.hover();
  await page.mouse.wheel(0, 600);
  await waitCounts(page, 1, 1);
  await page.waitForTimeout(350);
  assert.equal((await session(page)).skippedCount, 1, "one scroll must skip one post");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitCounts(page, 1, 1);
  // Persisted counts exist before hydration; wait for session restoration to
  // enable the feed before starting another gesture on the reloaded page.
  await page.locator('[data-post-interaction-feed][aria-busy="false"]').waitFor();
  await page.screenshot({ path: ".tmp/post-feed-verification/demo-desktop.png" });
  console.log("PASS desktop: guide, single/double tap, heart, duplicate lock, audio controls, native/programmatic scroll, refresh");

  // A reset during heart feedback must not consume a post from the new deck.
  await feed.dblclick({ position: { x: 100, y: 270 }, delay: 30 });
  const pendingFeedbackDuration = await page.locator("[data-post-like-heart] svg").evaluate(element =>
    parseFloat(getComputedStyle(element).animationDuration) * 1000);
  await page.getByRole("button", { name: "Reset demo deck" }).click();
  await page.waitForTimeout(pendingFeedbackDuration + 150);
  await waitCounts(page, 0, 0);
  assert.equal((await session(page)).cards.length, 29);
  console.log("PASS reset cancels pending demo decisions");

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.setDefaultNavigationTimeout(60_000);
  const phone = await openDemo(mobile);
  const phoneFeed = phone.locator("[data-post-interaction-feed]");
  const box = await phoneFeed.boundingBox();
  await phone.touchscreen.tap(box.x + 100, box.y + 230);
  await phone.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
  await phone.touchscreen.tap(box.x + 100, box.y + 270);
  await phone.touchscreen.tap(box.x + 102, box.y + 272);
  await phone.locator("[data-post-like-heart]").waitFor();
  await waitCounts(phone, 1, 0);
  // Dispatch an actual touch scroll, so browser pointer cancellation is covered.
  const cdp = await mobile.newCDPSession(phone);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 150, y: box.y + box.height - 40 }] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 150, y: box.y + box.height - 40 - step * 65 }] });
    await phone.waitForTimeout(25);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitCounts(phone, 1, 1);
  assert.equal((await session(phone)).postedCount, 1, "touch scroll must not like");
  await phone.screenshot({ path: ".tmp/post-feed-verification/demo-mobile.png" });
  console.log("PASS mobile: true touch double-tap and vertical touch scroll");

  // The production Trending deck is mounted in a development-only fixture.
  const trending = await desktop.newPage();
  await trending.goto(`${origin}/e2e/trending-feed-preview`, { waitUntil: "domcontentloaded" });
  const trendingFeed = trending.locator("[data-post-interaction-feed]");
  await trendingFeed.waitFor();
  // Confirm hydration before scrolling the server-rendered preview.
  await waitForFeedHydration(trending);
  await trending.getByRole("button", { name: "Play Reaction audio" }).click();
  await trending.getByRole("button", { name: "Mute Reaction audio" }).click();
  const actions = trending.getByRole("group", { name: "Creative decisions", exact: true });
  assert.equal(await actions.locator(".lucide-heart").count(), 1);
  assert.equal(await actions.locator(".lucide-arrow-down").count(), 1);
  const actionBox = await actions.boundingBox();
  assert.ok(actionBox.y >= 0 && actionBox.y + actionBox.height <= 768, "Trending controls must fit a compact laptop");
  await trending.screenshot({ path: ".tmp/post-feed-verification/trending-desktop.png" });
  await trendingFeed.hover(); await trending.mouse.wheel(0, 650);
  await trending.getByText("Development preview · 1 reviewed", { exact: true }).waitFor();
  assert.equal(await trending.getByRole("dialog").count(), 0, "scroll skip must not open scheduling");
  await trendingFeed.dblclick({ position: { x: 230, y: 280 }, delay: 50 });
  await trending.locator("[data-post-like-heart]").waitFor();
  await trending.getByText("Development preview · 2 reviewed", { exact: true }).waitFor();
  await trending.getByRole("dialog").waitFor();
  assert.equal(await trending.getByRole("dialog").count(), 1);
  console.log("PASS actual Trending deck: compact layout, scroll skip, double-tap opens one scheduler");
  await trending.getByRole("button", { name: "Close", exact: true }).click();
  await trending.getByRole("dialog").waitFor({ state: "detached" });
  await trendingFeed.dblclick({ position: { x: 230, y: 280 }, delay: 50 });
  await trending.getByText("Development preview · 3 reviewed", { exact: true }).waitFor();
  await trending.getByRole("dialog").waitFor();
  await trending.getByRole("button", { name: "Close", exact: true }).click();
  await trending.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(await trendingFeed.count(), 0, "last post must finish without an extra feed slot");
  console.log("PASS final Trending post and scheduling cancellation");

  const finalPost = await desktop.newPage();
  await finalPost.goto(`${origin}/e2e/trending-feed-preview`, { waitUntil: "domcontentloaded" });
  // Wait for a stateful interaction, since the server-rendered feed can be
  // visible before React has attached its keyboard and scroll handlers.
  await waitForFeedHydration(finalPost);
  await finalPost.getByRole("button", { name: "Play Reaction audio" }).click();
  await finalPost.getByRole("button", { name: "Mute Reaction audio" }).click();
  for (let reviewed = 1; reviewed <= 3; reviewed++) {
    await finalPost.locator("[data-post-interaction-feed]").focus();
    await finalPost.keyboard.press("ArrowDown");
    await finalPost.getByText(`Development preview · ${reviewed} reviewed`, { exact: true }).waitFor();
  }
  assert.equal(await finalPost.locator("[data-post-interaction-feed]").count(), 0);
  assert.equal(await finalPost.getByRole("dialog").count(), 0);
  console.log("PASS keyboard and final-post skip");

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const reducedPage = await openDemo(reduced);
  const reducedFeed = reducedPage.locator("[data-post-interaction-feed]");
  await reducedFeed.click({ position: { x: 100, y: 200 } });
  await reducedPage.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
  await reducedFeed.dblclick({ position: { x: 100, y: 270 }, delay: 50 });
  const heart = reducedPage.locator("[data-post-like-heart] svg");
  await heart.waitFor();
  assert.equal(await heart.evaluate(element => getComputedStyle(element).animationName), "none");
  await waitCounts(reducedPage, 1, 0);
  console.log("PASS reduced-motion heart feedback");
  await reduced.close();

  const mobileTrending = await mobile.newPage();
  await mobileTrending.goto(`${origin}/e2e/trending-feed-preview`, { waitUntil: "domcontentloaded" });
  const mobileActions = await mobileTrending.getByRole("group", { name: "Creative decisions", exact: true }).boundingBox();
  assert.ok(mobileActions.y >= 0 && mobileActions.y + mobileActions.height <= 844);
  await mobileTrending.screenshot({ path: ".tmp/post-feed-verification/trending-mobile.png" });
  console.log("PASS Trending mobile layout");

  for (const viewport of [{ width: 320, height: 568 }, { width: 1024, height: 600 }]) {
    const compactContext = await browser.newContext({ viewport });
    compactContext.setDefaultNavigationTimeout(60_000);
    const compactPage = await compactContext.newPage();
    await compactPage.goto(`${origin}/e2e/trending-feed-preview`, { waitUntil: "domcontentloaded" });
    const compactFeed = compactPage.locator("[data-post-interaction-feed]");
    await compactFeed.waitFor();
    const feedBox = await compactFeed.boundingBox();
    const cardBox = await compactFeed.locator("[data-post-feed-item] article").first().boundingBox();
    const controlsBox = await compactPage.getByRole("group", { name: "Creative decisions", exact: true }).boundingBox();
    assert.ok(cardBox.y >= feedBox.y - 1 && cardBox.y + cardBox.height <= feedBox.y + feedBox.height + 1,
      `the complete Trending card must fit at ${viewport.width}×${viewport.height}`);
    assert.ok(controlsBox.y + controlsBox.height <= viewport.height + 1);
    await compactContext.close();
  }
  console.log("PASS short Trending viewports: complete media and reachable decisions");

  // Retired UI and API routes must stay unavailable without affecting the feed.
  for (const path of ["/create-content", "/e2e/create-content-preview", "/api/create-content/cards", "/api/create-content/cards/retired-asset", "/api/create-content/generate", "/api/create-content/renders"]) {
    const response = await desktop.request.get(`${origin}${path}`);
    assert.equal(response.status(), 404, path);
    if (path.startsWith("/api/")) {
      const postResponse = await desktop.request.post(`${origin}${path}`, { data: {} });
      assert.equal(postResponse.status(), 404, `POST ${path}`);
    }
  }
  console.log("PASS Create Content retirement: old page, preview, and APIs return 404");
  await desktop.close(); await mobile.close();
} finally {
  await browser.close();
}
