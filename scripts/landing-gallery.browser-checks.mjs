import assert from "node:assert/strict";
import path from "node:path";

export async function verifyLandingGallery(page, browser, base, output, { captureMedia = true } = {}) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.mouse.move(0, 0);
  const stage = page.getByRole("region", { name: "Explore content examples" });
  const phase = () => stage.getAttribute("data-phase").then(Number);
  const start = await phase();
  assert.equal(start, 3, "Arrival uses the exact original Hook-centered composition");
  await page.waitForTimeout(700);
  assert.equal(await phase(), start, "Arrival remains still without hover");
  await stage.hover({ position: { x: 15, y: 15 } });
  const hovered = await phase();
  await page.waitForTimeout(1400);
  const travel = ((await phase()) - hovered + 11) % 11;
  assert(travel > 0.3 && travel < 0.65, `Gallery moves at the new three-second pace: ${travel} positions in1.4seconds`);
  await page.mouse.move(0, 0); await page.waitForTimeout(80);
  const held = await phase(); await page.waitForTimeout(400);
  assert.equal(await phase(), held, "Mouse leave stops travel at its current position");
  await stage.hover({ position: { x: 15, y: 15 } });
  await page.waitForTimeout(400);
  assert(await phase() > held + 0.08, "Re-enter resumes from the stopped position");
  await page.getByRole("button", { name: "Pause gallery motion", exact: true }).click();
  await page.mouse.move(0, 0);
  const paused = await phase(); await page.waitForTimeout(300);
  assert(Math.abs(await phase() - paused) < 0.01, "Explicit pause is stable");
  const seen = [];
  for (let index = 0; index < 11; index++) {
    await page.getByRole("button", { name: "Next content example", exact: true }).click();
    await page.waitForTimeout(100);
    const focal = page.locator('[data-hero-gallery-card][data-focal="true"]');
    const sourceId = await focal.getAttribute("data-source-id");
    seen.push(sourceId);
    const capture = {
      "talking-room-explainer-full": "talking-head",
      "talking-room-explainer-full:demo-0-19": "demo",
      "explore-paired-hook-4585ee949081c4e5cd835cd3": "extra-hook",
      "explore-paired-wall_text-d3259c1239762b2daa319893": "extra-wall",
    }[sourceId];
    if (capture && captureMedia) await page.screenshot({ path: path.join(output, `gallery-${capture}.png`) });
    assert(Math.abs((await focal.boundingBox()).width - 270) < 1, "Every reference grows to the same focal width");
    await page.waitForFunction(() => [...document.querySelectorAll('[data-hero-gallery-card]:not([data-focal="true"]) video')].every(video => !video.hasAttribute("src")));
  }
  assert.equal(new Set(seen).size, 11, "All eleven references reach the center without duplication");
  assert(seen.includes("talking-room-explainer-full") && seen.includes("talking-room-explainer-full:demo-0-19"));
  await page.getByRole("button", { name: "Next content example", exact: true }).focus();
  const beforeKey = await phase(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(100);
  assert.notEqual(await phase(), beforeKey, "Keyboard navigation advances the centered item");
  // Return to the approved initial composition for comparable screenshots.
  for (let index = 0; index < 11 && Math.round(await phase()) !== 3; index++) {
    await page.getByRole("button", { name: "Next content example", exact: true }).click(); await page.waitForTimeout(60);
  }
  await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement?.blur());
  if (captureMedia) await page.screenshot({ path: path.join(output, "gallery-desktop-still.png") });
  await page.getByRole("button", { name: "Resume gallery motion", exact: true }).click();
  await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement?.blur());
  const idleResumed = await phase(); await page.waitForTimeout(250);
  assert.equal(await phase(), idleResumed, "Resume does not start travel outside hover");
  await stage.hover({ position: { x: 15, y: 15 } });
  await page.waitForTimeout(1300);
  if (captureMedia) await page.screenshot({ path: path.join(output, "gallery-desktop-moving.png") });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.waitForTimeout(200);
  if (captureMedia) await page.screenshot({ path: path.join(output, "gallery-mobile-moving.png") });
  const beforeSwipe = await phase();
  await stage.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 280, clientY: 750 });
  await stage.dispatchEvent("pointerup", { pointerType: "touch", clientX: 100, clientY: 750 });
  await page.waitForTimeout(100);
  assert(await phase() !== beforeSwipe, "Touch swipe advances content");
  await page.mouse.move(0, 0); await page.waitForTimeout(80);
  const afterTouch = await phase(); await page.waitForTimeout(250);
  assert.equal(await phase(), afterTouch, "Touch browsing leaves the track still");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No mobile page overflow");
  for (const preference of ["reduced-motion", "save-data"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, ...(preference === "reduced-motion" ? { reducedMotion: "reduce" } : {}) });
    if (preference === "save-data") await context.addInitScript(() => {
      const connection = new EventTarget(); connection.saveData = true;
      Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
    });
    const guarded = await context.newPage();
    await guarded.goto(base, { waitUntil: "networkidle" });
    const gallery = guarded.getByRole("region", { name: "Explore content examples" });
    assert.equal(await gallery.getAttribute("data-phase"), "3.0000", "Opening track uses the requested Hook-centered arrangement");
    assert.equal(await guarded.locator('[data-focal="true"]').getAttribute("data-source-id"), "explore-paired-hook-2a74d53ba481fd0f99b84179");
    await gallery.hover({ position: { x: 15, y: 15 } });
    const before = await gallery.getAttribute("data-phase"); await guarded.waitForTimeout(400);
    assert.equal(await gallery.getAttribute("data-phase"), before, `${preference} keeps the track still`);
    assert.equal(await guarded.locator("[data-hero-gallery-card] video[src]").count(), 0, `${preference} avoids automatic media requests`);
    await guarded.getByRole("button", { name: "Next content example", exact: true }).click();
    await guarded.waitForTimeout(100);
    assert.notEqual(await gallery.getAttribute("data-phase"), before, `${preference} retains manual browsing`);
    if (preference === "reduced-motion") {
      await guarded.setViewportSize({ width: 1440, height: 1100 });
      await guarded.getByRole("button", { name: "Previous content example", exact: true }).click(); await guarded.waitForTimeout(70);
      const slide = guarded.getByLabel("Fitness slideshow Explore preview", { exact: true });
      const nextSlide = guarded.getByRole("button", { name: "Next slide in Fitness slideshow Explore preview", exact: true });
      assert(await nextSlide.isVisible(), "Slideshow chevrons are visible before hover, even on a non-focal card");
      assert.equal(await nextSlide.evaluate(button => getComputedStyle(button.parentElement).opacity), "1", "Slideshow arrows are not transparent before hover");
      const stablePhase = await gallery.getAttribute("data-phase");
      const previousSlide = Number(await slide.getAttribute("data-active-slide"));
      await nextSlide.click();
      assert.equal(Number(await slide.getAttribute("data-active-slide")), (previousSlide + 1) % 6);
      assert.equal(await gallery.getAttribute("data-phase"), stablePhase, "Slideshow click does not move the gallery");
      await nextSlide.press("ArrowLeft");
      assert.equal(Number(await slide.getAttribute("data-active-slide")), previousSlide);
      assert.equal(await gallery.getAttribute("data-phase"), stablePhase, "Slideshow keys do not bubble into track navigation");
      if (captureMedia) await guarded.screenshot({ path: path.join(output, "gallery-visible-slideshow-chevrons.png") });
    }
    await context.close();
  }
  const recovery = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  const recovering = await recovery.newPage();
  await recovering.route("**/marketing/hero-gallery/hookPrimary.*.mp4", route => route.abort());
  await recovering.goto(base, { waitUntil: "networkidle" });
  await recovering.getByRole("button", { name: "Pause gallery motion", exact: true }).evaluate(button => button.click());
  await recovering.getByRole("button", { name: "Play Primary Hook Explore video", exact: true }).click();
  await recovering.waitForTimeout(900);
  assert(await recovering.locator('[data-focal="true"] video').getAttribute("poster"), "Failed video keeps its poster");
  await recovering.getByRole("button", { name: "Next content example", exact: true }).click();
  await recovering.waitForTimeout(100);
  assert.equal(await recovering.locator('[data-focal="true"]').getAttribute("data-source-id"), "explore-slideshow-fitness-6762e151a53d2f5c", "Media failure does not block browsing");
  await recovery.setOffline(true);
  await recovering.mouse.move(0, 0); await recovering.evaluate(() => document.activeElement?.blur());
  await recovering.waitForTimeout(100);
  assert.equal(await recovering.locator("[data-hero-gallery-card] video[src]").count(), 0, "Offline releases video sources");
  await recovery.setOffline(false);
  await recovering.reload({ waitUntil: "networkidle" });
  assert.equal(await recovering.locator('[data-focal="true"]').getAttribute("data-source-id"), "explore-paired-hook-2a74d53ba481fd0f99b84179", "Reload restores the initial focal source");
  await recovery.close();
  if (captureMedia) {
  const recording = await browser.newContext({ viewport: { width: 1440, height: 1100 },
    recordVideo: { dir: path.join(output, "recordings"), size: { width: 1440, height: 1100 } } });
  const demo = await recording.newPage();
  await demo.goto(base, { waitUntil: "networkidle" });
  await demo.waitForTimeout(1500);
  await demo.getByRole("region", { name: "Explore content examples" }).hover({ position: { x: 15, y: 15 } });
  await demo.waitForTimeout(7500);
  await demo.mouse.move(0, 0);
  await demo.waitForTimeout(1500);
  await recording.close();
  await demo.video().saveAs(path.join(output, "landing-gallery-motion.webm"));
  }
  return { hoverOnlyMotion: "passed", idleLeaveAndReentry: "passed", explicitPause: "passed", centeredSources: seen,
    openingArrangementAndFasterPace: "passed", visibleSlideshowChevrons: "passed", keyboardAndTouch: "passed", reducedMotionAndSaveData: "passed", mediaErrorOfflineReload: "passed", acceptance: "local browser" };
}
