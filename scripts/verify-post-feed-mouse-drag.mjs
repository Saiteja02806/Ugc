import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.UGCPILOT_VERIFY_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: process.env.UGCPILOT_BROWSER_CHANNEL ?? "msedge" });
mkdirSync(".tmp/post-feed-verification", { recursive: true });

try {
  for (const screen of ["demo", "trending"]) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/${screen === "demo" ? "try-ugcpilot" : "e2e/trending-feed-preview"}`, { waitUntil: "load" });
    const feed = page.locator("[data-post-interaction-feed]");
    const media = feed.locator("[data-post-feed-item] [data-post-like-target]").first();
    await feed.waitFor();
    if (screen === "demo") {
      await page.waitForFunction(() => Boolean(localStorage.getItem("ugcpilot.try-demo.session.v1")));
      await media.click({ position: { x: 100, y: 210 } });
      await page.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
    } else {
      await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
      await page.getByRole("button", { name: "Play Reaction audio" }).click();
      await page.getByRole("button", { name: "Mute Reaction audio" }).click();
    }
    const feedBox = await feed.boundingBox();
    const height = feedBox.height;
    const audio = page.getByRole("button", { name: screen === "demo" ? /background audio/ : /Reaction audio/ });
    await media.hover();
    assert.equal(await media.evaluate(element => getComputedStyle(element).cursor), "grab");
    const hoverBox = await media.boundingBox();
    assert.equal(await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).cursor,
      { x: hoverBox.x + hoverBox.width / 2, y: hoverBox.y + hoverBox.height / 2 }), "grab");
    await audio.hover();
    assert.equal(await audio.evaluate(element => getComputedStyle(element).cursor), "pointer");

    async function assertReviewed(expected, likes = 0) {
      if (screen === "demo") {
        const counts = await page.evaluate(() => JSON.parse(localStorage.getItem("ugcpilot.try-demo.session.v1")));
        assert.equal(counts.skippedCount, expected - likes);
        assert.equal(counts.postedCount, likes);
      } else {
        assert.equal(await page.getByText(`Development preview · ${expected} reviewed`, { exact: true }).count(), 1);
        assert.equal(await page.getByRole("dialog").count(), likes);
      }
      assert.equal(await page.locator("[data-post-like-heart]").count(), 0);
    }
    async function startDrag(fraction, steps = 10) {
      const box = await media.boundingBox();
      const start = { x: box.x + box.width / 2, y: box.y + box.height - 25 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      assert.equal(await media.evaluate(element => getComputedStyle(element).cursor), "grabbing");
      await page.mouse.move(start.x, start.y - height * fraction, { steps });
      return start;
    }
    async function assertRestored() {
      await page.waitForFunction(() => document.querySelector("[data-post-interaction-feed]").scrollTop < 1);
      await page.waitForTimeout(220);
      assert.equal(await feed.getAttribute("data-post-mouse-down"), null);
      assert.equal(await feed.getAttribute("data-post-dragging"), null);
      assert.equal(await media.evaluate(element => getComputedStyle(element).cursor), "grab");
      await assertReviewed(0);
    }

    // A short drag moves the media but returns without deciding a post.
    await startDrag(.08);
    assert.ok(await feed.evaluate(element => element.scrollTop > 10));
    await page.mouse.up();
    await assertRestored();

    // Reversing down restores the same post, including after a paused drag.
    const reverse = await startDrag(.60);
    await page.waitForTimeout(350);
    await assertReviewed(0);
    await page.mouse.move(reverse.x, reverse.y + 20, { steps: 10 });
    await page.mouse.up();
    await assertRestored();

    // Horizontal movement and a release outside cannot leave a stuck hand.
    const horizontal = await media.boundingBox();
    await page.mouse.move(horizontal.x + horizontal.width / 2, horizontal.y + horizontal.height / 2);
    await page.mouse.down();
    await page.mouse.move(feedBox.x + feedBox.width + 70, horizontal.y + horizontal.height / 2, { steps: 10 });
    await page.mouse.up();
    await assertRestored();

    for (const cancellation of ["escape", "blur", "capture"]) {
      await feed.evaluate(element => element.addEventListener("gotpointercapture", event => {
        window.__postFeedAuditPointerId = event.pointerId;
      }, { once: true }));
      const start = await startDrag(.60);
      if (cancellation === "escape") await page.keyboard.press("Escape");
      else if (cancellation === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      else {
        await feed.evaluate(element => element.releasePointerCapture(window.__postFeedAuditPointerId));
        await page.mouse.move(start.x + 2, start.y - height * .60);
      }
      await page.mouse.up();
      await assertRestored();
    }

    // Native draggable images use the same shared handlers as Carousel media.
    await media.evaluate(element => {
      const image = document.createElement("img");
      image.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="white"/></svg>');
      image.draggable = true;
      image.dataset.postDragAuditImage = "true";
      image.style.cssText = "position:absolute;left:20px;top:40px;width:80px;height:80px;z-index:40";
      image.addEventListener("dragstart", event => { window.__postFeedNativeImageDrag = !event.defaultPrevented; });
      element.append(image);
    });
    const image = media.locator("[data-post-drag-audit-image]");
    const imageBox = await image.boundingBox();
    await page.mouse.move(imageBox.x + 40, imageBox.y + 40);
    await page.mouse.down();
    await page.mouse.move(imageBox.x + 40, imageBox.y + 40 - height * .20, { steps: 10 });
    assert.equal(await feed.getAttribute("data-post-dragging"), "true");
    assert.ok(await feed.evaluate(element => element.scrollTop > 30));
    assert.notEqual(await page.evaluate(() => window.__postFeedNativeImageDrag), true);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await image.evaluate(element => element.remove());
    await assertRestored();

    // Controls retain their clicks and never start a post drag.
    const sound = await audio.boundingBox();
    await page.mouse.move(sound.x + sound.width / 2, sound.y + sound.height / 2);
    await page.mouse.down();
    await page.mouse.move(sound.x + sound.width / 2, sound.y - 100, { steps: 10 });
    await page.mouse.up();
    await assertRestored();
    await audio.click();
    await page.getByRole("button", { name: screen === "demo" ? "Mute background audio" : "Mute Reaction audio" }).waitFor();
    await audio.click();
    await assertReviewed(0);

    // A full drag follows the cursor and waits for release, even at the next post.
    const full = await startDrag(.90);
    assert.ok(await feed.evaluate(element => element.scrollTop >= element.clientHeight * .85));
    await page.waitForTimeout(350);
    await assertReviewed(0);
    await feed.screenshot({ path: `.tmp/post-feed-verification/${screen}-mouse-drag.png` });
    await page.mouse.move(feedBox.x + feedBox.width + 70, full.y - height * .90);
    await page.mouse.up();
    if (screen === "demo") {
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("ugcpilot.try-demo.session.v1")).skippedCount === 1);
    } else await page.getByText("Development preview · 1 reviewed", { exact: true }).waitFor();
    await page.waitForTimeout(350);
    await assertReviewed(1);
    assert.equal(await feed.getAttribute("data-post-dragging"), null);

    // A later double-tap still likes the new active post exactly once.
    await media.dblclick({ delay: 60 });
    await page.locator("[data-post-like-heart]").waitFor();
    if (screen === "demo") {
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("ugcpilot.try-demo.session.v1")).postedCount === 1);
    } else {
      await page.getByText("Development preview · 2 reviewed", { exact: true }).waitFor();
      await page.getByRole("dialog").waitFor();
    }
    await assertReviewed(2, 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${screen}: grab/grabbing, short/reversed/horizontal drags, outside release, cancellation, native images, controls, one skip on release, later double-tap`);
    await context.close();
  }
} finally {
  await browser.close();
}
