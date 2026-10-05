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
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/${screen === "demo" ? "try-ugcpilot" : "e2e/trending-feed-preview"}`, { waitUntil: "load" });
    const feed = page.locator("[data-post-interaction-feed]");
    await feed.waitFor();
    if (screen === "demo") {
      await page.waitForFunction(() => Boolean(localStorage.getItem("ugcpilot.try-demo.session.v1")));
      await feed.click({ position: { x: 100, y: 210 } });
      await page.locator("[data-trending-swipe-guide]").waitFor({ state: "detached" });
    } else {
      await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
      await page.getByRole("button", { name: "Play Reaction audio" }).click();
      await page.getByRole("button", { name: "Mute Reaction audio" }).click();
    }
    // Hydrate and load media before freezing time; the decision timer is
    // created by the next double-tap and is therefore fully controlled.
    const now = await page.evaluate(() => Date.now());
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now + 50);
    const media = feed.locator("[data-post-feed-item] [data-post-like-target]").first();
    const mediaBox = await media.boundingBox();
    await media.dblclick({ position: { x: mediaBox.width / 2, y: mediaBox.height / 2 }, delay: 50 });
    const heart = page.locator("[data-post-like-heart] svg");
    await heart.waitFor();
    const duration = await heart.evaluate(element => {
      const animation = element.getAnimations()[0];
      if (!animation) throw new Error("Like feedback has no animation");
      animation.pause();
      return animation.effect.getComputedTiming().duration;
    });
    assert.ok(duration >= 650 && duration <= 800, "feedback must be readable without delaying review for a full second");
    assert.equal(await heart.evaluate(element => getComputedStyle(element).fill), "rgb(255, 255, 255)");
    assert.equal(await heart.getAttribute("stroke-width"), "0");

    async function frame(fraction) {
      return heart.evaluate((element, { duration, fraction }) => {
        element.getAnimations()[0].currentTime = duration * fraction;
        const style = getComputedStyle(element);
        const matrix = new DOMMatrixReadOnly(style.transform);
        return { opacity: Number(style.opacity), scale: Math.hypot(matrix.a, matrix.b) };
      }, { duration, fraction });
    }
    assert.ok((await frame(.12)).opacity > .9, "the heart must appear promptly after a double-tap");
    const peak = await frame(.18);
    assert.ok(peak.scale > 1.1 && peak.scale < 1.25, "the pop should have a restrained spring overshoot");
    await feed.screenshot({ path: `.tmp/post-feed-verification/${screen}-heart-pop.png` });
    const hold = await frame(.60);
    assert.equal(hold.opacity, 1);
    assert.ok(Math.abs(hold.scale - 1) < .01, "the heart must settle before fading");
    const heartBox = await heart.boundingBox();
    assert.ok(Math.abs((heartBox.y + heartBox.height / 2) - (mediaBox.y + mediaBox.height / 2)) < 2, "feedback must be centered on the actual media");
    await feed.screenshot({ path: `.tmp/post-feed-verification/${screen}-heart-hold.png` });
    assert.ok((await frame(.94)).opacity < .5, "feedback must fade smoothly at the end");
    assert.equal((await frame(1)).opacity, 0);

    await page.clock.runFor(duration - 1);
    assert.equal(await heart.count(), 1, "the liked post must remain mounted through its feedback");
    if (screen === "demo") {
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("ugcpilot.try-demo.session.v1")).postedCount), 0);
    } else {
      assert.equal(await page.getByText("Development preview · 0 reviewed", { exact: true }).count(), 1);
      assert.equal(await page.getByRole("dialog").count(), 0);
    }
    await page.clock.runFor(101);
    // React commits and session persistence use browser tasks as well as timers.
    await page.clock.resume();
    await heart.waitFor({ state: "detached" });
    if (screen === "demo") {
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("ugcpilot.try-demo.session.v1")).postedCount === 1);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("ugcpilot.try-demo.session.v1")).postedCount), 1);
    } else {
      await page.getByText("Development preview · 1 reviewed", { exact: true }).waitFor();
      await page.getByRole("dialog").waitFor();
      assert.equal(await page.getByRole("dialog").count(), 1);
    }
    assert.equal(await heart.count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${screen}: prompt pop, spring/hold/fade, media centering, ${duration}ms feedback, one decision after feedback`);
    await context.close();
  }
} finally {
  await browser.close();
}
