import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

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
assert(!live || process.argv[baseFlag + 1], "Supply the live base URL after --base-url");
const base = live ? new URL(process.argv[baseFlag + 1]).origin : "http://127.0.0.1:8192";
const output = path.join(root, `.tmp/marketing-layout-browser${live ? "-live" : ""}`);
await mkdir(output, { recursive: true });
const server = live ? null : spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "8192"], {
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
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, `Development server did not become ready: ${serverLog}`);
  browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  for (const width of [360, 390, 768, 1050, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/mcp", "/mcp/claude", "/mcp/codex"]) {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(response.status(), 200, `${route} at ${width}px`);
      await page.locator("h1").waitFor();
      const navigation = page.locator("header");
      assert.equal(await navigation.getByRole("link", { name: "MCP", exact: true }).count(), 0);
      if (route === "/") {
        const badge = page.getByRole("link", { name: "Made for social Instagram TikTok YouTube" });
        await badge.waitFor();
        assert.equal(await badge.getAttribute("href"), "#workflow");
        assert.equal(await badge.locator("svg").count(), 3);
        assert.equal(await page.getByRole("link", { name: "Connect Claude or Codex", exact: true }).count(), 0);
        assert.equal(await page.getByRole("link", { name: "See how it works", exact: true }).getAttribute("href"), "#workflow");
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
    console.log(`Verified all four public pages at ${width}px in both themes`);
  }

  await page.goto(`${base}/mcp`);
  await page.getByRole("button", { name: "Copy Server URL", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /^Copied$/ }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "https://mcp.getugcpilot.com/mcp");
  await page.getByRole("button", { name: "Copy First prompt", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.");
  await page.getByRole("link", { name: "Copy the setup", exact: true }).click();
  await page.waitForURL(url => url.hash === "#setup");
  assert.equal(new URL(page.url()).hash, "#setup");
  assert.deepEqual(pageErrors, [], "Browser runtime errors");
  await writeFile(path.join(output, "receipt.json"), JSON.stringify({ base, checks, clipboard: "passed", setupLink: "passed", pageErrors }, null, 2));
  console.log(JSON.stringify({ base, layouts: checks.length, clipboard: "passed", setupLink: "passed", pageErrors: pageErrors.length, output, acceptance: live ? "live public pages" : "local only" }));
} finally {
  await browser?.close();
  server?.kill();
}
