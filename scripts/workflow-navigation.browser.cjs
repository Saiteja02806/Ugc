/* eslint-disable @typescript-eslint/no-require-imports -- Local real-Next navigation verification. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const base = process.env.WORKFLOW_NAVIGATION_BASE_URL || "http://localhost:4332";
const workflows = [
  ["Hook video", "/explore/hook-video"], ["Wall of text", "/explore/wall-of-text"],
  ["Slideshows", "/explore/slideshows"], ["Talking Head + Demo", "/explore/create-hook"],
  ["Build AI influencer", "/explore/build-character"],
];
const out = path.resolve(__dirname, "../.tmp/workflow-navigation-browser");
fs.mkdirSync(out, { recursive: true });
const explorer = `${base}/explore?preview=1`;
async function main() {
  // Compile the development routes before timing client navigation. This is a
  // local layout/navigation sanity check, not production authenticated acceptance.
  for (const route of ["/explore", ...workflows.map(([, route]) => route)]) {
    console.log(`Warming ${route}`);
    const response = await fetch(`${base}${route}?preview=1`, { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200); await response.text();
  }
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1342, height: 897 } });
    const page = await context.newPage();
    const errors = [], writes = [], transitions = [];
    page.setDefaultTimeout(30_000);
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", route => {
      if (route.request().method() !== "GET") { writes.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const coverRequests = [];
    page.on("request", request => { if (/\/explore\/(covers|characters)\/.*\.mp4/.test(request.url())) coverRequests.push(request.url()); });
    await page.goto(explorer, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Explore", exact: true }).waitFor();
    await page.mouse.move(0, 0);
    assert.equal(await page.locator("[data-workflow-cover] video[src], [data-character-cover] video[src]").count(), 0);
    assert.equal(coverRequests.length, 0, "opening Explore must not start decorative cover downloads");
    for (let pass = 0; pass < 2; pass++) for (const [title, route] of workflows) {
      const link = page.getByRole("link").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
      const start = Date.now();
      await link.click();
      await page.waitForURL(url => url.pathname === route);
      await page.getByRole("heading", { name: title, exact: true, level: 1 }).waitFor();
      assert.equal(new URL(page.url()).pathname, route);
      transitions.push({ pass, title, route, clickToHeadingMs: Date.now() - start });
      await page.getByRole("link", { name: "Back to Explore", exact: true }).click();
      await page.getByRole("heading", { name: "Explore", exact: true }).waitFor();
      await page.mouse.move(0, 0);
    }
    // On a fresh browser page the first Hook navigation is delayed deliberately.
    // A second click must win without the older route arriving afterwards.
    const racing = await context.newPage();
    const raceErrors = []; racing.on("pageerror", error => raceErrors.push(error.message));
    let delayed;
    const started = new Promise(resolve => { delayed = resolve; });
    await racing.route("**/explore/hook-video?**", async route => {
      if (new URL(route.request().url()).searchParams.has("_rsc")) {
        delayed(); await new Promise(resolve => setTimeout(resolve, 700));
      }
      try { await route.continue(); } catch { /* The newer route intentionally cancels this request. */ }
    });
    await racing.goto(explorer, { waitUntil: "domcontentloaded" });
    await racing.getByRole("heading", { name: "Explore", exact: true }).waitFor();
    await racing.getByRole("link").filter({ has: racing.getByRole("heading", { name: "Hook video", exact: true }) }).click();
    await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error("Hook navigation did not request RSC")), 5000))]);
    await racing.getByRole("link").filter({ has: racing.getByRole("heading", { name: "Wall of text", exact: true }) }).click();
    await racing.waitForURL(url => url.pathname === "/explore/wall-of-text");
    await racing.getByRole("heading", { name: "Wall of text", exact: true, level: 1 }).waitFor();
    await new Promise(resolve => setTimeout(resolve, 900));
    assert.equal(new URL(racing.url()).pathname, "/explore/wall-of-text");
    assert.deepEqual(raceErrors, []);
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ base, scope: "Precompiled local development preview; authenticated production timing not measured", transitions, rapidSwitch: "passed", coverRequestsBeforeNavigation: 0, pageErrors: errors, writes }, null, 2));
    await racing.screenshot({ path: path.join(out, "rapid-switch.png") });
    console.log(JSON.stringify(transitions));
    console.log("PASS: all five workflows open and return twice; fast second navigation wins; no cover downloads on entry, page errors or writes.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
