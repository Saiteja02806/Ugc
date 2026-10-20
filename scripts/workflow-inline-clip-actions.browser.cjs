/* eslint-disable @typescript-eslint/no-require-imports -- Real workflow local preview check. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const base = process.env.EXPLORE_PREVIEW_BASE_URL || "http://localhost:4334";
const out = path.resolve(__dirname, "../.tmp/inline-clip-browser");
fs.mkdirSync(out, { recursive: true });
const fixture = `${base}/e2e/explore-format-preview?format=hook&sources=1&step=demo&videoSource=upload`;
async function main() {
  console.log("Warming workflow preview…");
  const warm = await fetch(fixture, { signal: AbortSignal.timeout(90_000) }); assert.equal(warm.status, 200); await warm.text();
  console.log("Preview ready; opening browser…");
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1560, height: 1000 } }); page.setDefaultTimeout(15_000);
    const errors = [], writes = []; page.on("pageerror", e => errors.push(e.message));
    await page.route("**/api/**", async route => { if (route.request().method() !== "GET") { writes.push(route.request().url()); await route.abort(); } else await route.continue(); });
    const upload = { name: "inline-preview.mp4", mimeType: "video/mp4", buffer: fs.readFileSync(path.join(__dirname, "../public/explore/covers/hook-video-v1.mp4")) };
    const stage = page.getByRole("region", { name: "Clip preview and editing controls", exact: true });
    const opening = () => stage.getByRole("group", { name: "Add hook video", exact: true });
    const demo = () => stage.getByRole("group", { name: "Add demo video", exact: true });
    const dialog = () => page.getByRole("dialog", { name: "Choose from Creative Assets", exact: true });
    const openSource = async (label, hover = false) => {
      const trigger = stage.getByRole("group", { name: `Add ${label}`, exact: true }).getByRole("button", { name: `Choose ${label} source`, exact: true });
      if (hover) await trigger.hover(); else await trigger.click();
      await page.getByRole("button", { name: `Upload ${label}`, exact: true }).waitFor();
    };
    await page.goto(fixture, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await opening().getByRole("button", { name: "Choose hook video source", exact: true }).waitFor();
    await demo().getByRole("button", { name: "Choose demo video source", exact: true }).waitFor();
    assert.equal(await stage.getByRole("button", { name: "Go to Create", exact: true }).count(), 0);
    await page.screenshot({ path: path.join(out, "empty-desktop.png"), fullPage: true });
    await openSource("hook video", true); await page.screenshot({ path: path.join(out, "menu-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Choose hook video from Creative Assets", exact: true }).click();
    await dialog().getByRole("button", { name: /Existing video preview/ }).waitFor(); await page.keyboard.press("Escape");
    assert.equal(await opening().count(), 1); assert.equal(await demo().count(), 1); assert.equal(await page.getByRole("tab", { name: "Demo", exact: true }).getAttribute("aria-selected"), "true");
    await openSource("demo video"); await page.getByRole("button", { name: "Choose demo video from Creative Assets", exact: true }).click();
    await dialog().getByRole("button", { name: /Saved creator clip/ }).click();
    await stage.getByRole("button", { name: "Edit demo video", exact: true }).waitFor();
    assert.equal(await opening().count(), 1); assert.equal(await page.getByRole("tab", { name: "Demo", exact: true }).getAttribute("aria-selected"), "true");
    await page.waitForFunction(() => [...document.querySelectorAll("[aria-label='Clip preview and editing controls'] video")].some(video => video.readyState >= 1));
    await page.screenshot({ path: path.join(out, "demo-selected-desktop.png"), fullPage: true });
    await openSource("hook video"); const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Upload hook video", exact: true }).click(); await (await chooser).setFiles(upload);
    await stage.getByRole("button", { name: "Edit hook video", exact: true }).waitFor();
    await stage.getByRole("button", { name: "Edit demo video", exact: true }).waitFor();
    assert.equal(await page.getByRole("tab", { name: "Demo", exact: true }).getAttribute("aria-selected"), "true");
    await page.screenshot({ path: path.join(out, "both-selected-desktop.png"), fullPage: true });
    // A fresh account fixture checks the other direct entry point independently.
    console.log("Opening upload and Demo asset selection passed; checking Demo upload…");
    await page.evaluate(() => localStorage.clear()); await page.goto(fixture, { waitUntil: "domcontentloaded" });
    await openSource("demo video"); const demoChooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Upload demo video", exact: true }).click(); await (await demoChooser).setFiles(upload);
    await stage.getByRole("button", { name: "Edit demo video", exact: true }).waitFor();
    await openSource("hook video"); await page.getByRole("button", { name: "Choose hook video from Creative Assets", exact: true }).click();
    await dialog().getByRole("button", { name: /Existing video preview/ }).click();
    await stage.getByRole("button", { name: "Edit hook video", exact: true }).waitFor();
    assert.equal(await stage.getByRole("button", { name: "Edit demo video", exact: true }).count(), 1);
    console.log("Desktop source choices passed; checking mobile tap menu…");
    await page.evaluate(() => localStorage.clear()); await page.setViewportSize({ width: 390, height: 844 }); await page.goto(fixture, { waitUntil: "domcontentloaded" });
    await page.locator("[data-format='hook'][data-stage='demo']").waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector("nav[aria-label='Workspace panels'] button");
      return button && Object.keys(button).some(key => key.startsWith("__reactProps$"));
    });
    await page.getByRole("navigation", { name: "Workspace panels", exact: true }).getByRole("button", { name: "Preview", exact: true }).click();
    await page.locator("[data-format='hook'][data-pane='preview']").waitFor();
    await opening().getByRole("button", { name: "Choose hook video source", exact: true }).waitFor();
    await demo().getByRole("button", { name: "Choose demo video source", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, "empty-mobile.png"), fullPage: true });
    await openSource("demo video"); await page.screenshot({ path: path.join(out, "menu-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Choose demo video from Creative Assets", exact: true }).click();
    await dialog().getByRole("button", { name: /Existing video preview/ }).waitFor(); await page.keyboard.press("Escape");
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    const report = { singleButton: true, hoverMenu: true, tapMenu: true, openingUpload: true, openingAssets: true, demoUpload: true, demoAssets: true, chooserCancelPreservesDraft: true, preservesDemoTab: true, mobileOverflow: false, pageErrors: errors, writes };
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }); fs.writeFileSync(path.join(out, "failure.txt"), await page.locator("body").innerText()); }
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
