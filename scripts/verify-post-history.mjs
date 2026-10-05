import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.UGCPILOT_VERIFY_ORIGIN ?? "http://127.0.0.1:3000";
const sessionKey = "ugcpilot.try-demo.session.v1";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
mkdirSync(".tmp/post-feed-verification", { recursive: true });

async function open(screen, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...options });
  const page = await context.newPage();
  const errors = [], writes = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().startsWith(`${origin}/api/`) && request.method() !== "GET") writes.push(request.url());
  });
  await page.goto(`${origin}/${screen === "demo" ? "try-ugcpilot" : screen === "trending" ? "e2e/trending-feed-preview" : "#interactive-feed"}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const section = screen === "landing" ? page.locator("#interactive-feed") : page.locator("main");
  const feed = section.locator("[data-post-interaction-feed]");
  await feed.waitFor();
  await page.waitForFunction(() => {
    const feed = document.querySelector("[data-post-interaction-feed]");
    return feed && Object.keys(feed).some(key => key.startsWith("__reactProps$") &&
      typeof feed[key]?.onKeyDown === "function");
  });
  if (screen === "demo") {
    await page.locator('[data-post-interaction-feed][aria-busy="false"]').waitFor();
    await feed.click({ position: { x: 100, y: 200 } });
    await page.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
  } else if (screen === "trending") {
    // The server-rendered feed can be visible before keyboard handlers attach.
    await section.getByRole("button", { name: "Play Reaction audio" }).click();
    await section.getByRole("button", { name: "Mute Reaction audio" }).click();
  }
  await feed.scrollIntoViewIfNeeded();
  return { context, page, section, feed, errors, writes, screen };
}

async function snapshot(feed) {
  return feed.locator("[data-post-feed-active]").evaluate(element => ({
    id: element.dataset.postFeedItem,
    text: element.innerText,
    video: element.querySelector("video")?.getAttribute("src") ?? null,
    poster: element.querySelector("video")?.getAttribute("poster") ?? null,
  }));
}

async function settled(feed) {
  await feed.page().waitForFunction(() => {
    const feed = document.querySelector("[data-post-interaction-feed]");
    return feed && feed.getAttribute("aria-busy") === "false" && !feed.dataset.postSettling &&
      Math.abs(feed.scrollTop - (feed.dataset.postHasPrevious ? feed.clientHeight : 0)) < 1;
  });
}

async function counts(current, reviewed, likes = 0) {
  if (current.screen === "demo") {
    await current.page.waitForFunction(({ key, reviewed, likes }) => {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved?.swipedCount === reviewed && saved?.postedCount === likes && saved?.skippedCount === reviewed - likes;
    }, { key: sessionKey, reviewed, likes });
  } else if (current.screen === "trending") {
    await current.page.getByText(`Development preview · ${reviewed} reviewed`, { exact: true }).waitFor();
  }
}

async function key(current, name) {
  await current.feed.focus();
  await current.page.keyboard.press(name);
  await settled(current.feed);
}

async function samePost(current, expected, decision = "skipped") {
  await current.section.locator("[data-post-review-status]").filter({ hasText: `Previously ${decision}` }).waitFor();
  await settled(current.feed);
  const actual = await snapshot(current.feed);
  assert.deepEqual({ ...actual, id: expected.id }, expected, "return must show the exact copy, video, and poster");
  if (current.screen !== "landing") assert.equal(actual.id, expected.id);
  assert.equal(await current.feed.evaluate(element => [...element.querySelectorAll("video")]
    .filter(video => !video.closest("[data-post-feed-active]"))
    .every(video => video.paused)), true, "history and upcoming videos must stay paused");
}

try {
  for (const screen of ["demo", "trending", "landing"]) {
    const current = await open(screen);
    const { page, section, feed } = current;
    const first = await snapshot(feed);
    await key(current, "ArrowDown");
    await counts(current, 1);
    const second = await snapshot(feed);
    assert.notEqual(second.id, first.id, "forward browsing must reach a different post");
    if (screen === "trending") {
      // The real parent retains history while Hook composition replaces its deck.
      await section.getByRole("button", { name: "Reopen review deck" }).click();
      await settled(feed);
      assert.equal((await snapshot(feed)).id, second.id);
    }
    await feed.hover();
    await page.mouse.wheel(0, -650);
    await samePost(current, first);
    await page.setViewportSize({ width: 1280, height: 768 });
    await settled(feed);
    await samePost(current, first);
    await counts(current, 1);
    const like = screen === "demo" ? section.getByRole("button", { name: "Like this demo post" })
      : screen === "landing" ? section.getByRole("button", { name: "Like preview post" })
      : section.getByRole("button", { name: "Like and schedule this post" });
    assert.equal(await like.isDisabled(), true, "reviewed post must not create a second decision");
    await feed.locator("[data-post-feed-active] [data-post-like-target]").dblclick({ delay: 50 });
    await page.waitForTimeout(800);
    assert.equal(await section.locator("[data-post-like-heart]").count(), 0);
    await counts(current, 1);
    await key(current, "ArrowDown");
    assert.deepEqual(await snapshot(feed), second);
    await counts(current, 1);
    await key(current, "ArrowDown");
    await counts(current, 2);
    const third = await snapshot(feed);

    // The old post follows a held mouse drag, then decelerates on release.
    const box = await feed.boundingBox();
    const mediaBox = await feed.locator("[data-post-feed-active] [data-post-like-target]").boundingBox();
    const startY = Math.max(box.y + 20, mediaBox.y + 35);
    await page.mouse.move(box.x + box.width / 2, startY);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, startY + box.height * .6, { steps: 8 });
    await page.waitForTimeout(200);
    assert.equal(await feed.getAttribute("data-post-dragging"), "true");
    assert.equal((await snapshot(feed)).id, third.id, "holding a drag must not change the active post");
    await feed.evaluate(element => {
      window.__historyFrames = [];
      window.__historyRecording = true;
      const record = () => {
        if (!window.__historyRecording) return;
        const active = element.querySelector("[data-post-feed-active]");
        window.__historyFrames.push({ top: element.scrollTop, settling: Boolean(element.dataset.postSettling),
          id: active?.dataset.postFeedItem, activeY: active?.getBoundingClientRect().y,
          previousY: element.querySelector("[data-post-history-item]")?.getBoundingClientRect().y });
        requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.mouse.up();
    await samePost(current, second);
    const recording = await page.evaluate(() => { window.__historyRecording = false; return window.__historyFrames; });
    const frames = recording.filter(frame => frame.settling && frame.id === third.id);
    assert.ok(frames.length >= 2, "backward release must show intermediate animation frames");
    for (let index = 1; index < frames.length; index++) assert.ok(frames[index].top <= frames[index - 1].top + 1, `backward release must not bounce: ${JSON.stringify(frames)}`);
    const arrived = recording.find(frame => frame.id !== third.id);
    assert.ok(arrived, "the previous post must become active");
    assert.ok(Math.abs(frames.at(-1).previousY - arrived.activeY) < 3, "the previous post must stay in place through the history hand-off");
    await key(current, "ArrowUp");
    await samePost(current, first);
    await key(current, "ArrowUp");
    await samePost(current, first);
    await key(current, "ArrowDown");
    await samePost(current, second);
    await key(current, "ArrowDown");
    assert.deepEqual(await snapshot(feed), third);
    await counts(current, 2);
    await feed.locator("[data-post-feed-active] [data-post-like-target]").dblclick({ delay: 50 });
    await section.locator("[data-post-like-heart]").waitFor();
    await counts(current, 3, 1);
    if (screen === "trending") {
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await section.getByRole("button", { name: "View previous posts" }).click();
      await samePost(current, third, "liked");
      await section.getByRole("button", { name: "Play Reaction audio" }).click();
      await section.getByRole("button", { name: "Mute Reaction audio" }).click();
      await feed.locator("[data-post-feed-active] [data-post-like-target]").dblclick({ delay: 50 });
      await page.waitForTimeout(800);
      assert.equal(await page.getByRole("dialog").count(), 0);
      await counts(current, 3, 1);
      await feed.focus(); await page.keyboard.press("ArrowDown");
      await section.getByRole("button", { name: "View previous posts" }).waitFor();
    } else {
      await settled(feed);
      await key(current, "ArrowUp");
      await samePost(current, third, "liked");
      await counts(current, 3, 1);
      if (screen === "demo") {
        await section.getByRole("button", { name: "Turn on background audio" }).click();
        await section.getByRole("button", { name: "Mute background audio" }).click();
        await section.getByRole("button", { name: "Reset demo deck" }).click();
        await settled(feed);
        assert.equal(await feed.getAttribute("data-post-has-previous"), null);
        await counts(current, 0);
      } else {
        await section.getByRole("button", { name: "Next slide" }).click();
        await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector("[data-post-feed-active] [data-landing-slide-strip]")).transform).m41 < -200);
        await samePost(current, third, "liked");
      }
    }
    await section.screenshot({ path: `.tmp/post-feed-verification/${screen}-history-desktop.png` });
    assert.deepEqual(current.errors, []);
    assert.deepEqual(current.writes, []);
    console.log(`PASS ${screen}: wheel back, held drag and smooth backward release, oldest boundary, forward return, unchanged counts, read-only likes, fresh heart, media controls${screen === "trending" ? ", final-post return and no duplicate scheduler" : ""}`);
    await current.context.close();
  }

  const finalDemo = await open("demo");
  await finalDemo.page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.cards = saved.cards.slice(0, 1);
    saved.generatedCount = 1;
    localStorage.setItem(key, JSON.stringify(saved));
  }, sessionKey);
  await finalDemo.page.reload({ waitUntil: "domcontentloaded" });
  await finalDemo.page.locator('[data-post-interaction-feed][aria-busy="false"]').waitFor();
  const finalPost = await snapshot(finalDemo.feed);
  await finalDemo.feed.focus(); await finalDemo.page.keyboard.press("ArrowDown");
  await finalDemo.section.getByRole("heading", { name: "Deck reviewed" }).waitFor();
  await counts(finalDemo, 1);
  await finalDemo.section.getByRole("button", { name: "View previous posts" }).click();
  await samePost(finalDemo, finalPost);
  await finalDemo.section.getByRole("button", { name: "Skip to the next demo post" }).click();
  await finalDemo.section.getByRole("heading", { name: "Deck reviewed" }).waitFor();
  await counts(finalDemo, 1);
  assert.deepEqual(finalDemo.errors, []);
  console.log("PASS final demo post: return from the empty state, browse it, and leave without another skip");
  await finalDemo.context.close();

  const refilling = await open("demo");
  let pendingRefill;
  await refilling.page.route(`${origin}/api/try-ugcpilot/next`, route => { pendingRefill = route; });
  await refilling.page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.cards = saved.cards.slice(0, 1);
    saved.businessContext = { brand: "History fixture", url: "https://example.com", title: "History fixture",
      description: "Verification only", markdown: "Verification only" };
    localStorage.setItem(key, JSON.stringify(saved));
  }, sessionKey);
  await refilling.page.reload({ waitUntil: "domcontentloaded" });
  await refilling.page.locator('[data-post-interaction-feed][aria-busy="false"]').waitFor();
  const loadingPost = await snapshot(refilling.feed);
  await refilling.section.getByRole("button", { name: "Skip to the next demo post" }).click();
  await refilling.section.getByRole("heading", { name: "Loading more content" }).waitFor();
  await refilling.section.getByRole("button", { name: "View previous posts" }).click();
  await samePost(refilling, loadingPost);
  // Session persistence deliberately waits until the refill finishes. Check the
  // live counter while the request is held, then its saved counter afterwards.
  await refilling.section.getByText("Liked 0 / Skipped 1 / Generating 10", { exact: true }).waitFor();
  assert.ok(pendingRefill, "the refill must be pending during backward browsing");
  await pendingRefill.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Verification-only refill failure" } }) });
  await samePost(refilling, loadingPost);
  await counts(refilling, 1);
  assert.deepEqual(refilling.errors, []);
  assert.deepEqual(refilling.writes, [`${origin}/api/try-ugcpilot/next`]);
  console.log("PASS demo while refilling: return to the same post during a held request, with no repeated review or generation");
  await refilling.context.close();

  for (const screen of ["demo", "trending", "landing"]) {
    const current = await open(screen, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const first = await snapshot(current.feed);
    await key(current, "ArrowDown");
    const box = await current.feed.boundingBox();
    const touch = await current.context.newCDPSession(current.page);
    const x = box.x + box.width / 2, y = box.y + 30;
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + box.height * .85 * step / 8 }] });
      await current.page.waitForTimeout(25);
    }
    await current.page.waitForTimeout(200);
    assert.equal(await current.section.locator("[data-post-review-status]").filter({ hasText: "Previously" }).count(), 0, "held touch must not retire a post");
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await samePost(current, first);
    await counts(current, 1);
    await current.section.screenshot({ path: `.tmp/post-feed-verification/${screen}-history-mobile.png` });
    assert.deepEqual(current.errors, []);
    console.log(`PASS ${screen}: native downward touch returns the same post only after release`);
    await current.context.close();
  }

  const reduced = await open("demo", { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const first = await snapshot(reduced.feed);
  await key(reduced, "ArrowDown");
  await key(reduced, "ArrowUp");
  await samePost(reduced, first);
  assert.equal(await reduced.feed.getAttribute("data-post-settling"), null);
  await counts(reduced, 1);
  assert.deepEqual(reduced.errors, []);
  console.log("PASS backward navigation with reduced motion");
  await reduced.context.close();
} finally {
  await browser.close();
}
