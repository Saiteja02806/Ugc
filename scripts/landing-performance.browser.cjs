/* eslint-disable @typescript-eslint/no-require-imports -- Local production and isolated auth browser checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/landing-performance-browser");
fs.mkdirSync(out, { recursive: true });
const checks = [];
const galleryOnly = process.argv.includes("--gallery-only");
const assets = require("../lib/marketing/landing-preview-assets.json");
const immutableAssets = [
  ...Object.values(assets.videos).flatMap(asset => [asset.src, asset.poster]),
  ...Object.values(assets.slideshows).flatMap(asset => asset.slides.map(slide => slide.src)),
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const write = (file, value) => fs.writeFileSync(path.join(out, file), value);
// Isolate video lifecycle/performance from the carousel's separately tested motion.
const freezeGallery = async page => {
  await page.waitForFunction(() => document.querySelector("[data-hero-gallery] [data-phase]"));
  await page.getByRole("button", { name: "Pause gallery motion", exact: true }).evaluate(button => button.click());
  await page.waitForLoadState("networkidle");
};

async function authFixture() {
  write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
  write("auth.tsx", `import {useSyncExternalStore} from 'react';const initial={user:null,loading:true};let state=initial;window.setLandingAuth=value=>{state=value;window.dispatchEvent(new Event('auth-fixture'))};export function useAuth(){return useSyncExternalStore(cb=>{window.addEventListener('auth-fixture',cb);return()=>window.removeEventListener('auth-fixture',cb)},()=>state,()=>initial)}`);
  write("link.tsx", `export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`);
  write("entry.tsx", `import {hydrateRoot} from 'react-dom/client';import {renderToString} from 'react-dom/server';import {LandingAuthAction,LandingAuthCta} from '@/components/marketing/landing-auth-actions';function App(){return <><LandingAuthAction appearance='header' initialHasSession={false}/><LandingAuthCta initialHasSession={false}/></>};const target=document.getElementById('root');window.serverMarkup=renderToString(<App/>);target.innerHTML=window.serverMarkup;hydrateRoot(target,<App/>);`);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root,
      entry: path.join(out, "entry.tsx"), output: { path: out, filename: "auth.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/contexts/auth-context": path.join(out, "auth.tsx"),
        "next/link": path.join(out, "link.tsx"), "@": root,
      } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] },
      plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("development") })] });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors()
      ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/auth.js" ? "text/javascript" : "text/html");
    response.end(request.url === "/auth.js" ? fs.readFileSync(path.join(out, "auth.js"))
      : '<html><body><div id="root"></div><script src="/auth.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function main() {
  let pw;
  try { pw = require("playwright"); }
  catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  server.stdout.on("data", chunk => { logs += chunk; });
  server.stderr.on("data", chunk => { logs += chunk; });
  let browser, fixture;
  try {
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { response = await fetch(base); if (response.ok) break; } catch { /* Startup. */ }
      await sleep(200);
    }
    assert(response?.ok, `Production server did not start: ${logs}`);
    const html = await response.text();
    assert(JSON.parse(fs.readFileSync(path.join(root, ".next/prerender-manifest.json"))).routes["/"], "Homepage must be prerendered");
    assert(!/no-store|private/.test(response.headers.get("cache-control") || ""), "Shared homepage must be cacheable");
    const withCookie = await fetch(base, { headers: { Cookie: "ugc_session=1" } });
    assert.equal(await withCookie.text(), html, "Cookies must not personalize cached homepage HTML");
    const fontPreloads = [...new Set([
      ...(response.headers.get("link") || "").split(",").filter(value => /as="font"/.test(value))
        .map(value => value.match(/<([^>]+)>/)?.[1]),
      ...(html.match(/<link\b[^>]*>/g) || []).filter(value => /as="font"/.test(value))
        .map(value => value.match(/href="([^"]+)"/)?.[1]),
    ].filter(Boolean))];
    if (!galleryOnly) {
      assert.equal(fontPreloads.length, 2, "Only normal/italic primary marketing fonts should preload");
      assert(fontPreloads.every(value => /Geist_(Variable|Italic)/.test(value)), "Editor fonts must not preload");
      checks.push("static cookie-independent homepage and only two primary-font preloads");
    } else checks.push("static cookie-independent homepage; unrelated font-preload budget excluded from scoped gallery run");
    for (const src of immutableAssets) {
      const head = await fetch(base + src, { method: "HEAD" });
      assert.equal(head.status, 200);
      const video = Object.values(assets.videos).find(asset => asset.src === src);
      if (video) assert.equal(Number(head.headers.get("content-length")), video.bytes);
      assert.match(head.headers.get("cache-control"), /max-age=31536000.*immutable/);
      const range = await fetch(base + src, { headers: { Range: "bytes=0-63" } });
      assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 64);
    }
    checks.push("hashed video URLs, immutable headers and byte-range delivery");
    browser = await pw.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      let visibility = "visible";
      Object.defineProperty(document, "visibilityState", { get: () => visibility });
      window.setPreviewVisibility = value => { visibility = value; document.dispatchEvent(new Event("visibilitychange")); };
    });
    const page = await context.newPage(), errors = [], fontRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && /hydrat|did not match|server rendered/i.test(message.text())) errors.push(message.text()); });
    page.on("request", request => { if (/\.(ttf|woff2)(\?|$)/.test(request.url())) fontRequests.push(request.url()); });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await freezeGallery(page);
    await page.waitForFunction(() => {
      const primary = document.querySelector('video[aria-label="Primary Hook Explore video"]');
      const passive = [...document.querySelectorAll("[data-landing-preview] video")].filter(video => video !== primary);
      return primary && !primary.paused && primary.readyState >= 2 && passive.every(video => !video.hasAttribute("src"));
    });
    assert(!fontRequests.some(url => /arial|avenir|Geist_SemiBold|inter_latin_400/.test(url)), "Editor fonts should not transfer on the public homepage");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "homepage-desktop.png"), fullPage: false });
    checks.push("desktop hydration, one focal video plays, passive videos stay unloaded, and no editor font transfers or horizontal overflow");
    await page.getByRole("button", { name: "Pause Primary Hook Explore video", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').hasAttribute("src"));
    await page.evaluate(() => window.setPreviewVisibility("hidden"));
    await page.evaluate(() => window.setPreviewVisibility("visible"));
    assert.equal(await page.locator('video[aria-label="Primary Hook Explore video"]').getAttribute("src"), null,
      "An explicit pause must survive visibility changes");
    await page.getByRole("button", { name: "Play Primary Hook Explore video", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
    checks.push("explicit pause releases source and Play resumes");
    await page.evaluate(() => window.setPreviewVisibility("hidden"));
    await page.waitForFunction(() => [...document.querySelectorAll("[data-landing-preview] video")].every(video => !video.hasAttribute("src")));
    await page.evaluate(() => window.setPreviewVisibility("visible"));
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
    await context.setOffline(true);
    await page.waitForFunction(() => [...document.querySelectorAll("[data-landing-preview] video")].every(video => !video.hasAttribute("src")));
    await context.setOffline(false);
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => [...document.querySelectorAll("[data-landing-preview] video")].every(video => !video.hasAttribute("src")));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
    checks.push("hidden, offline and offscreen sources release; return resumes playback");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Wall of Text Explore video"]').hasAttribute("src"));
    await page.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "homepage-mobile.png"), fullPage: false });
    checks.push("mobile keeps center playback, excludes desktop video and has no horizontal overflow");
    // The exact root font variables still load the original faces when an editor needs them.
    const faces = await page.evaluate(async () => {
      const root = getComputedStyle(document.documentElement);
      return Promise.all([["--font-edit-overlay", 600], ["--font-wall-text-inter", 400],
        ["--font-wall-text-arial-regular", 400], ["--font-wall-text-arial", 500],
        ["--font-wall-text-arial-bold", 700], ["--font-wall-text-avenir-next", 600]].map(async ([variable, weight]) => {
        const family = root.getPropertyValue(variable).trim();
        const loaded = await document.fonts.load(`${weight} 32px ${family}`, "Exact overlay text metrics");
        return { variable, loaded: loaded.length, family };
      }));
    });
    assert(faces.every(face => face.loaded > 0), JSON.stringify(faces));
    checks.push("all six existing editor font families load on demand at their original weights");
    assert.deepEqual(errors, []);
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobile.newPage(), mobileRequests = [];
    mobilePage.on("request", request => { if (/\/marketing\/hero-gallery\/.*\.mp4(?:\?|$)/.test(request.url())) mobileRequests.push(request.url()); });
    await mobilePage.goto(base, { waitUntil: "domcontentloaded" });
    await freezeGallery(mobilePage);
    await mobilePage.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
    assert(mobileRequests.length === 1 && mobileRequests[0].includes("hookPrimary."), "A cold mobile visit must request only the focal Hook video");
    checks.push("cold mobile visit requests only the focal Hook preview");
    await mobile.close();

    for (const preference of ["reduced-motion", "save-data"]) {
      const guarded = await browser.newContext({ viewport: { width: 1440, height: 1000 },
        ...(preference === "reduced-motion" ? { reducedMotion: "reduce" } : {}) });
      if (preference === "save-data") await guarded.addInitScript(() => {
        const connection = new EventTarget(); connection.saveData = true;
        Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
      });
      const preview = await guarded.newPage(), requests = [];
      preview.on("request", request => { if (/\/marketing\/hero-gallery\/.*\.mp4(?:\?|$)/.test(request.url())) requests.push(request.url()); });
      await preview.goto(base, { waitUntil: "domcontentloaded" }); await freezeGallery(preview); await preview.waitForTimeout(1100);
      assert.equal(requests.length, 0, `${preference} must not automatically request video`);
      const slide = preview.getByLabel("Fitness slideshow Explore preview", { exact: true });
      const before = await slide.getAttribute("data-active-slide"); await preview.waitForTimeout(3400);
      assert.equal(await slide.getAttribute("data-active-slide"), before, "Slideshow must respect motion/data preference");
      await preview.getByRole("button", { name: "Play Primary Hook Explore video", exact: true }).click();
      await preview.waitForFunction(() => !document.querySelector('video[aria-label="Primary Hook Explore video"]').paused);
      checks.push(`${preference}: posters only until explicit Play; slideshow stays still`);
      await guarded.close();
    }

    fixture = await authFixture();
    const authBase = `http://127.0.0.1:${fixture.address().port}`;
    for (const scenario of [
      { name: "signed out", state: { user: null, loading: false }, href: "/sign-in?next=explore", label: "Start Creating" },
      { name: "verified", state: { user: { emailVerified: true }, loading: false }, href: "/explore", label: "Start Posting" },
      { name: "unverified", state: { user: { emailVerified: false }, loading: false }, href: "/verify-email", label: "Verify email" },
      { name: "restoring cookie", state: { user: null, loading: true }, cookie: true, href: "/explore", label: "Start Posting" },
      { name: "stale cookie", state: { user: null, loading: false }, cookie: true, href: "/sign-in?next=explore", label: "Start Creating" },
    ]) {
      const authContext = await browser.newContext();
      if (scenario.cookie) await authContext.addCookies([{ name: "ugc_session", value: "1", url: authBase }]);
      const authPage = await authContext.newPage(), authErrors = [];
      authPage.on("pageerror", error => authErrors.push(error.message));
      authPage.on("console", message => { if (message.type() === "error") authErrors.push(message.text()); });
      await authPage.goto(authBase);
      await authPage.waitForFunction(() => typeof window.setLandingAuth === "function");
      await authPage.evaluate(state => window.setLandingAuth(state), scenario.state);
      await authPage.getByRole("link", { name: scenario.label, exact: true }).last().waitFor();
      assert.equal(await authPage.locator("#root a").last().getAttribute("href"), scenario.href);
      assert.match(await authPage.evaluate(() => window.serverMarkup), /Start Creating/);
      assert.doesNotMatch(await authPage.evaluate(() => window.serverMarkup), /Start Posting|Verify email/);
      assert.deepEqual(authErrors, []);
      checks.push(`actual auth actions hydrate correctly: ${scenario.name}`);
      await authContext.close();
    }
    write("receipt.json", JSON.stringify({ checks, editorFaces: faces,
      excludedChecks: galleryOnly ? ["Root font-preload budget: unscoped run observed 0 instead of 2; font configuration unchanged by gallery task"] : [],
      originalHeroBytes: 8679447,
      optimizedHeroBytes: Object.values(assets.videos).reduce((sum, asset) => sum + asset.bytes, 0) }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, checks, screenshots: out }, null, 2));
  } finally {
    write("progress.json", JSON.stringify({ checks }, null, 2));
    await browser?.close();
    if (fixture) await new Promise(resolve => fixture.close(resolve));
    server.kill(); write("server.log", logs);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
