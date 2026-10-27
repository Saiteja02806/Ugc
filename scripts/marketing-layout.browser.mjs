import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { verifyLandingGallery } from "./landing-gallery.browser-checks.mjs";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
}

const root = process.cwd();
const baseFlag = process.argv.indexOf("--base-url");
const live = baseFlag >= 0;
const homeOnly = process.argv.includes("--home-only");
assert(!live || process.argv[baseFlag + 1], "Supply the live base URL after --base-url");
const base = live ? new URL(process.argv[baseFlag + 1]).origin : "http://127.0.0.1:8192";
const hosted = live && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname);
const output = path.join(root, `.tmp/marketing-layout-browser${homeOnly ? "-home" : ""}${live ? hosted ? "-live" : "-production" : ""}`);
await mkdir(output, { recursive: true });
const server = live ? null : spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "8192"], {
  cwd: root,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
for (const stream of server ? [server.stdout, server.stderr] : []) {
  stream.on("data", chunk => { serverLog = (serverLog + chunk).slice(-16000); });
}
let browser;
const checks = [];
try {
  let ready = live;
  for (let attempt = 0; !ready && attempt < 90; attempt++) {
    if (server.exitCode !== null) throw Error(`Development server exited: ${serverLog}`);
    if (/Ready in/i.test(serverLog)) { ready = true; break; }
    try {
      // A cold Turbopack compilation on Windows/OneDrive can take longer than
      // the previous two-second probe and aborting it repeatedly prevents the
      // first route from ever finishing.
      const response = await fetch(base, { signal: AbortSignal.timeout(30000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, `Development server did not become ready: ${serverLog}`);
  browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(240000);
  const pageErrors = [];
  const imageWarnings = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (/Image with src.*has.*fill.*invalid.*position/.test(message.text())) imageWarnings.push(message.text()); });

  for (const width of [360, 390, 768, 1050, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of homeOnly ? ["/"] : ["/", "/mcp", "/mcp/claude", "/mcp/codex"]) {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(response.status(), 200, `${route} at ${width}px`);
      await page.locator("h1").waitFor();
      const navigation = page.locator("header");
      assert.equal(await navigation.getByRole("link", { name: "MCP", exact: true }).count(), 0);
      if (route === "/") {
        const badge = page.locator('a[href="#workflow"]').filter({ hasText: "Post right away" });
        await badge.waitFor();
        assert.equal(await badge.getAttribute("href"), "#workflow");
        assert.equal(await badge.locator("svg").count(), 3);
        assert.equal(await page.getByRole("link", { name: "Connect Claude or Codex", exact: true }).count(), 0);
        assert.equal(await page.getByRole("link", { name: "See how it works", exact: true }).getAttribute("href"), "#workflow");
        const gallery = await page.locator("[data-hero-gallery]").evaluate(element => {
          const cards = Array.from(element.querySelectorAll("[data-hero-gallery-card]"));
          return {
            count: cards.length,
            sourceIds: cards.map(card => card.getAttribute("data-source-id")),
            cards: cards.map(card => {
              const rect = card.getBoundingClientRect();
              return { width: Math.round(rect.width), height: Math.round(rect.height), center: Math.round(rect.top + rect.height / 2) };
            }),
            stageWidth: element.clientWidth,
          };
        });
        assert.equal(gallery.count, 11, "Homepage hero must rotate eleven curated Explore pieces");
        assert(await page.locator("[data-active-slide] img").evaluateAll(images => images.every(image => getComputedStyle(image.parentElement).position === "relative")),
          "Every slideshow fill image must have a positioned direct parent");
        assert.deepEqual(gallery.sourceIds, [
          "explore-paired-hook-3cddc94937cdb32947f9e0c2",
          "explore-wall-text-05",
          "explore-slideshow-fitness-1e937e8be4486b45",
          "explore-paired-hook-2a74d53ba481fd0f99b84179",
          "explore-slideshow-fitness-6762e151a53d2f5c",
          "explore-wall-text-61",
          "explore-paired-hook-44d165d51084f977f5146f69",
          "talking-room-explainer-full",
          "explore-paired-hook-4585ee949081c4e5cd835cd3",
          "talking-room-explainer-full:demo-0-19",
          "explore-paired-wall_text-d3259c1239762b2daa319893",
        ]);
        if (width === 1440) {
          assert(Math.max(...gallery.cards.map(card => card.center)) - Math.min(...gallery.cards.map(card => card.center)) <= 1,
            "Desktop cards must share one vertical center");
        } else if (width <= 1050) {
          assert(gallery.stageWidth <= width, "Animated gallery stays within the viewport");
        }
        if (width === 1440 || width === 390) {
          await page.waitForFunction(() => {
            const primary = document.querySelector('[data-focal="true"] video');
            const passive = [...document.querySelectorAll("[data-landing-preview] video")].filter(video => video !== primary);
            return (!primary || !primary.paused && primary.readyState >= 2) && passive.every(video => !video.hasAttribute("src"));
          });
        }
      }
      for (const theme of ["dark", "light"]) {
        await page.evaluate(value => {
          document.documentElement.classList.toggle("dark", value === "dark");
          document.documentElement.dataset.theme = value;
        }, theme);
        const layout = await page.evaluate(() => {
          const heading = document.querySelector("h1").getBoundingClientRect();
          const blocks = Array.from(document.querySelectorAll("main pre"));
          return {
            viewport: document.documentElement.clientWidth,
            documentWidth: document.documentElement.scrollWidth,
            headingWidth: heading.width,
            clippedCodeBlocks: blocks.filter(block => {
              const rect = block.getBoundingClientRect();
              return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
            }).map(block => block.getAttribute("aria-label")),
          };
        });
        assert(layout.documentWidth <= layout.viewport + 1, `${route} ${width}px ${theme}: page overflow`);
        assert.deepEqual(layout.clippedCodeBlocks, [], `${route} ${width}px ${theme}: code block extends beyond viewport`);
        if (route === "/mcp" && width === 1050) {
          assert(layout.headingWidth >= 700, "Tablet heading must use its readable width without being squeezed by the setup card");
        }
        checks.push({ route, width, theme, ...layout });
      }
      if ([390, 1050, 1440].includes(width) && ["/", "/mcp"].includes(route)) {
        await page.evaluate(() => document.documentElement.classList.add("dark"));
        await page.screenshot({ path: path.join(output, `${route === "/" ? "home" : "mcp"}-${width}.png`) });
      }
    }
    console.log(`Verified ${homeOnly ? "landing page" : "all four public pages"} at ${width}px in both themes`);
  }

  // The viewport sweep above captures the real page. The dedicated fixture
  // records animation separately, without unrelated lazy editor-font loading.
  const motion = await verifyLandingGallery(page, browser, base, output, { captureMedia: false });
  if (!homeOnly) {
  await page.goto(`${base}/mcp`);
  await page.getByRole("button", { name: "Copy Server URL", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /^Copied$/ }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "https://mcp.getugcpilot.com/mcp");
  await page.getByRole("button", { name: "Copy First prompt", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.");
  await page.getByRole("link", { name: "Copy the setup", exact: true }).click();
  await page.waitForURL(url => url.hash === "#setup");
  assert.equal(new URL(page.url()).hash, "#setup");
  }
  assert.deepEqual(pageErrors, [], "Browser runtime errors");
  assert.deepEqual(imageWarnings, [], "No Next.js fill-parent image warnings");
  await writeFile(path.join(output, "receipt.json"), JSON.stringify({ base, checks, motion, clipboard: homeOnly ? "not tested" : "passed", setupLink: homeOnly ? "not tested" : "passed", pageErrors, imageWarnings }, null, 2));
  console.log(JSON.stringify({ base, layouts: checks.length, clipboard: homeOnly ? "not tested" : "passed", setupLink: homeOnly ? "not tested" : "passed", pageErrors: pageErrors.length, output, acceptance: hosted ? "live public pages" : "local only" }));
} finally {
  await browser?.close();
  server?.kill();
}
