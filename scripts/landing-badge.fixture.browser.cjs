/* eslint-disable @typescript-eslint/no-require-imports -- Isolated actual-component browser fixture. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/landing-badge-browser");

async function main() {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "baseline.tsx"), execFileSync("git", ["show", "HEAD:components/marketing/landing-platforms.tsx"], { cwd: root }));
  fs.writeFileSync(path.join(out, "loader.cjs"), `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
  fs.writeFileSync(path.join(out, "entry.tsx"), `import {createRoot} from 'react-dom/client';import {LandingPlatformBadge} from '@/components/marketing/landing-platforms';import {LandingPlatformBadge as Baseline} from './baseline';createRoot(document.getElementById('badge')).render(location.search.includes('before')?<Baseline/>:<LandingPlatformBadge showMcp={location.search.includes('mcp-preview')}/>);`);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root,
      entry: path.join(out, "entry.tsx"), output: { path: out, filename: "badge.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] },
      plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })] });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const sources = ["components/marketing/landing-platforms.tsx", "components/marketing/landing-rotating-badge.tsx", "components/marketing/landing-agent-mark.tsx", "scripts/landing-badge.fixture.browser.cjs", ".tmp/landing-badge-browser/baseline.tsx"]
    .map(file => `@source "${path.join(root, file).replaceAll("\\", "/")}";`).join("\n");
  const css = await require("postcss")([require("@tailwindcss/postcss")({ base: out })]).process(fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', `@import "tailwindcss" source(none);\n${sources}`), { from: path.join(root, "app/globals.css") });
  fs.writeFileSync(path.join(out, "style.css"), css.css);
  const html = `<!doctype html><html class="dark"><head><link rel="stylesheet" href="/style.css"><style>@font-face{font-family:Geist;src:url('/geist.woff2')}body{font-family:Geist,sans-serif;--font-geist-sans:Geist}</style></head><body><main class="instagram-theme min-h-screen bg-background px-4 pt-20 text-center text-foreground"><div id="badge"></div><h1 class="text-4xl font-semibold">Find viral content.<br>Recreate for yours</h1><div id="workflow" tabindex="-1">Workflow destination</div></main><script src="/badge.js"></script></body></html>`;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); return; }
    if (pathname === "/mcp") { response.setHeader("Content-Type", "text/html"); response.end("<h1>MCP navigation fixture</h1>"); return; }
    const file = pathname === "/geist.woff2" ? path.join(root, "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2") : path.join(pathname.startsWith("/marketing/") ? path.join(root, "public") : out, pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.statusCode = 404; response.end(); return; }
    response.setHeader("Content-Type", ({ ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png" })[path.extname(file)] || "application/octet-stream");
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  const checks = []; const errors = [];
  try {
    let pw; try { pw = require("playwright"); } catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
    browser = await pw.chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base); const defaultBadge = page.locator('[data-landing-rotating-badge]'); await defaultBadge.waitFor();
    assert.equal(await defaultBadge.getAttribute('data-landing-rotating-badge'),'social');
    await page.waitForTimeout(6400);
    assert.equal(await defaultBadge.getAttribute('data-landing-rotating-badge'),'social');
    assert(!/Claude|Codex|Grok|Coming soon/.test(await defaultBadge.innerText()));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 500 });
      await page.goto(base + "/?before"); await page.locator("#badge a").waitFor();
      await page.locator("#badge").screenshot({ path: path.join(out, `before-${width}.png`) });
      for (const theme of ["dark", "light"]) {
        await page.goto(base + '/?mcp-preview'); await page.locator('[data-landing-rotating-badge="agents"]').waitFor();
        await page.evaluate(theme => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
        const badge = page.locator('[data-landing-rotating-badge]');
        await page.mouse.move(0, 0); await page.evaluate(() => document.fonts.ready);
        const initial = await badge.boundingBox();
        assert.equal(await badge.getAttribute("href"), "/mcp");
        assert.match(await badge.innerText(), /Coming soon[\s\S]*Control from[\s\S]*Claude[\s\S]*Codex[\s\S]*Grok bot/);
        assert.equal(await badge.locator("svg, img").count(), 4);
        assert(await badge.locator('img[src="/marketing/grok-bot.png"]').evaluate(img => img.complete && img.naturalWidth === 240), "Supplied Grok bot icon loads");
        const status = await badge.getByText("Coming soon", { exact: true }).boundingBox();
        if (width >= 640) assert(Math.abs(status.x - initial.x - initial.width + 12) <= 2, "Status overlaps right edge slightly");
        else assert(Math.abs(status.x + status.width - initial.x - initial.width) <= 2, "Mobile status remains inside viewport at right edge");
        assert(status.y < initial.y && status.y + status.height > initial.y + 3, "Status slightly touches/overlaps main pill top edge");
        assert(status.width < 75 && status.height < 16, "Status is only slightly smaller");
        const clipLeft = Math.max(0, initial.x - 16);
        const clipRight = Math.min(width, Math.max(initial.x + initial.width, status.x + status.width) + 16);
        const region = { x: clipLeft, y: initial.y - 20, width: clipRight - clipLeft, height: initial.height + 40 };
        await page.screenshot({ path: path.join(out, `agents-${theme}-${width}.png`), clip: region });
        await page.waitForFunction(() => document.querySelector('[data-landing-rotating-badge]')?.dataset.landingRotatingBadge === "social", { timeout: 4500 });
        assert.match(await badge.innerText(), /Post right away[\s\S]*Instagram[\s\S]*TikTok[\s\S]*YouTube/);
        assert.equal(await badge.getAttribute("href"), "#workflow");
        assert.deepEqual(await badge.boundingBox(), initial, "Badge must not shift layout between states");
        assert(await badge.evaluate(el => el.scrollWidth <= el.clientWidth), "No badge clipping");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No page overflow");
        await page.locator("#badge").screenshot({ path: path.join(out, `social-${theme}-${width}.png`) });
        checks.push({ width, theme, stableGeometry: initial, states: "agents first; social after 3s", icons: 4 });
      }
    }
    await page.goto(base + '/?mcp-preview'); const badge = page.locator('[data-landing-rotating-badge]'); await badge.waitFor();
    await badge.hover(); await page.waitForTimeout(3300); assert.equal(await badge.getAttribute("href"), "/mcp");
    await page.mouse.move(0, 0); await page.waitForFunction(() => document.querySelector('[data-landing-rotating-badge]')?.dataset.landingRotatingBadge === "social");
    await badge.focus(); await page.waitForTimeout(3300); assert.equal(await badge.getAttribute("href"), "#workflow");
    await page.keyboard.press("Enter"); assert.equal(new URL(page.url()).hash, "#workflow");
    await page.goto(base + '/?mcp-preview'); await page.locator('[data-landing-rotating-badge="agents"]').click(); assert.equal(new URL(page.url()).pathname, "/mcp");
    await page.goto(base + '/?mcp-preview'); await page.waitForFunction(() => document.querySelector('[data-landing-rotating-badge]')?.dataset.landingRotatingBadge === "social");
    await page.waitForFunction(() => document.querySelector('[data-landing-rotating-badge]')?.dataset.landingRotatingBadge === "agents");
    assert.deepEqual(errors, []);
    const receipt = { checks, hoverPause: true, focusPause: true, keyboardSocialNavigation: true, mcpClickNavigation: true, repeatCycle: true, pageErrors: errors, boundary: "Actual badge and CSS; static shell and MCP navigation fixture, not Next.js or production acceptance" };
    fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
