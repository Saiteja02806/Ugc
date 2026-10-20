import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.UGCPILOT_VERIFY_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: process.env.UGCPILOT_BROWSER_CHANNEL ?? "msedge" });
const sessionKey = "ugcpilot.try-demo.session.v1";

async function open(screen, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/${screen === "demo" ? "try-ugcpilot" : "e2e/trending-feed-preview"}`, { waitUntil: "load" });
  const feed = page.locator('[data-post-interaction-feed][aria-busy="false"]');
  await feed.waitFor();
  if (screen === "demo") {
    await page.waitForFunction(key => Boolean(localStorage.getItem(key)), sessionKey);
    await feed.click({ position: { x: 100, y: 200 } });
    await page.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
  } else {
    await page.getByRole("button", { name: "Play Reaction audio" }).click();
    await page.getByRole("button", { name: "Mute Reaction audio" }).click();
  }
  const media = feed.locator("[data-post-feed-item] [data-post-like-target]").first();
  return { context, page, feed, media, errors };
}

async function counts(page, screen, reviewed, likes = 0) {
  if (screen === "demo") {
    await page.waitForFunction(({ key, reviewed, likes }) => {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved?.skippedCount === reviewed - likes && saved?.postedCount === likes;
    }, { key: sessionKey, reviewed, likes });
  } else {
    await page.getByText(`Development preview · ${reviewed} reviewed`, { exact: true }).waitFor();
    if (likes) await page.getByRole("dialog").waitFor();
    assert.equal(await page.getByRole("dialog").count(), likes);
  }
}

async function recordMotion(feed) {
  return feed.evaluate(element => {
    const firstId = element.querySelector("[data-post-feed-active]").dataset.postFeedItem;
    window.__postScrollMotion = { frames: [], resets: [], recording: true };
    const originalScrollTo = element.scrollTo.bind(element);
    element.scrollTo = (options, ...rest) => {
      if (options.top === 0 && element.scrollTop >= element.clientHeight * .8 &&
          element.querySelector("[data-post-feed-active]")?.dataset.postFeedItem === firstId) {
        window.__postScrollMotion.resets.push({ busy: element.getAttribute("aria-busy"), top: element.scrollTop });
      }
      return originalScrollTo(options, ...rest);
    };
    const sample = time => {
      if (!window.__postScrollMotion.recording) return;
      const first = element.querySelector("[data-post-feed-active]");
      window.__postScrollMotion.frames.push({ time, top: element.scrollTop,
        id: first?.dataset.postFeedItem, settling: element.dataset.postSettling === "true",
        firstY: first?.getBoundingClientRect().y, nextY: first?.nextElementSibling?.getBoundingClientRect().y });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return firstId;
  });
}

async function stopRecording(page) {
  return page.evaluate(() => {
    window.__postScrollMotion.recording = false;
    return window.__postScrollMotion;
  });
}

async function movePost({ page, feed, media }, fraction, pause = 0) {
  const box = await media.boundingBox();
  const height = await feed.evaluate(element => element.clientHeight);
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 25;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - height * fraction, { steps: 3 });
  if (pause) await page.waitForTimeout(pause);
  await page.mouse.up();
}

try {
  for (const screen of ["demo", "trending"]) {
    const current = await open(screen);
    const { page, feed, media, context, errors } = current;

    // An earlier fast movement expires if the user holds before releasing.
    await recordMotion(feed);
    await movePost(current, .18, 160);
    await page.waitForFunction(() => {
      const feed = document.querySelector("[data-post-interaction-feed]");
      return feed.scrollTop < 1 && !feed.dataset.postSettling;
    });
    await counts(page, screen, 0);
    const returning = (await stopRecording(page)).frames.filter(frame => frame.settling);
    assert.ok(returning.filter(frame => frame.top > 1).length >= 2, "short drags must glide back rather than jump");
    for (let index = 1; index < returning.length; index++) {
      assert.ok(returning[index].top <= returning[index - 1].top + 1,
        `return must settle without a bounce: ${JSON.stringify(returning.map(frame => Math.round(frame.top)))}`);
    }

    // Cancelling during the release animation must preserve the active post.
    await movePost(current, .18);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(360);
    await counts(page, screen, 0);
    assert.equal(await feed.getAttribute("data-post-settling"), null);
    assert.ok(await feed.evaluate(element => element.scrollTop < 1));

    // A quick short flick advances; record real frames through the parent hand-off.
    const oldId = await recordMotion(feed);
    await movePost(current, .18);
    await counts(page, screen, 1);
    await page.waitForTimeout(80);
    const motion = await stopRecording(page);
    const forward = motion.frames.filter(frame => frame.id === oldId && frame.settling);
    assert.ok(forward.length >= 2, "flick release must show intermediate frames");
    for (let index = 1; index < forward.length; index++) {
      assert.ok(forward[index].top >= forward[index - 1].top - 1, "forward motion must not reverse or bounce");
    }
    assert.deepEqual(motion.resets, [], "the old post must not flash back during the skip hand-off");
    const arrived = motion.frames.find(frame => frame.id !== oldId);
    assert.ok(arrived, "the next post must become active");
    assert.ok(Math.abs(forward.at(-1).nextY - arrived.firstY) < 3, "the arriving post must remain in place when it becomes active");
    assert.equal(await page.locator("[data-post-like-heart]").count(), 0);

    await media.dblclick({ delay: 60 });
    await page.locator("[data-post-like-heart]").waitFor();
    await counts(page, screen, 2, 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${screen}: paused flick returns smoothly, Escape cancels settling, short flick glides into one post without flashing, later heart/like works`);
    await context.close();

    const phone = await open(screen, { isMobile: true, hasTouch: true });
    const touch = await phone.context.newCDPSession(phone.page);
    const box = await phone.feed.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 20;
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - box.height * .95 * step / 8 }] });
      await phone.page.waitForTimeout(20);
    }
    await phone.page.waitForTimeout(250);
    await counts(phone.page, screen, 0);
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await counts(phone.page, screen, 1);
    assert.deepEqual(phone.errors, []);
    console.log(`PASS ${screen}: native touch movement holds the post until release and settles into one skip`);
    await phone.context.close();

    const reduced = await open(screen, { reducedMotion: "reduce" });
    await recordMotion(reduced.feed);
    await movePost(reduced, .18);
    await counts(reduced.page, screen, 1);
    const reducedFrames = (await stopRecording(reduced.page)).frames;
    assert.equal(reducedFrames.some(frame => frame.settling), false, "reduced motion must skip release tweening");
    assert.deepEqual(reduced.errors, []);
    console.log(`PASS ${screen}: reduced motion advances without release animation`);
    await reduced.context.close();
  }
} finally {
  await browser.close();
}
