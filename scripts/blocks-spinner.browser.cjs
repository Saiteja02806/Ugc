/* eslint-disable @typescript-eslint/no-require-imports -- No-build browser regression of the real rendered SVG. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/spinner-stall-20261113");
const source = fs.readFileSync(path.join(root, "components/ui/blocks-spinner.tsx"), "utf8");
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exportsForTest,
  require: key => key === "@/lib/utils" ? { cn: (...parts) => parts.filter(Boolean).join(" ") } : require(key),
});
const { BlocksSpinner } = exportsForTest;
const render = (count, prefix, size = 24) => renderToStaticMarkup(
  React.createElement("div", null, ...Array.from({ length: count }, (_, key) =>
    React.createElement(BlocksSpinner, { key, size, className: "fixture-spinner" }))),
  { identifierPrefix: prefix },
);
const globalCss = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const cssStart = globalCss.indexOf("/* Blocks-shuffle loading indicator");
assert.ok(cssStart >= 0, "Use the actual reduced-motion styles");
const css = globalCss.slice(cssStart);

async function main() {
  fs.mkdirSync(out, { recursive: true });
  let playwright;
  try { playwright = require("playwright"); }
  catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
  const browser = await playwright.chromium.launch({ channel: process.env.SPINNER_BROWSER_CHANNEL || "msedge", headless: true });
  const checks = [];
  const samples = [];
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 280 }, reducedMotion: "no-preference" });
    await page.setContent(`<!doctype html><style>${css}
      body{background:#101014;color:white;font:16px system-ui;padding:24px}
      .row{display:flex;align-items:center;gap:18px;margin:20px 0}
      </style><div class="row"><div id="primary">${render(1, "primary", 48)}</div>Opening page…</div>
      <div id="many">${render(48, "many")}</div><div id="late"></div>`);
    const ids = await page.locator("animate").evaluateAll(nodes => nodes.map(n => n.id));
    assert.equal(new Set(ids).size, ids.length, "Instances and numeric steps must never collide");
    assert.ok(ids.every(id => /^[A-Za-z][A-Za-z0-9]*$/.test(id)), "All syncbase ids must be timing-parser safe");
    checks.push("49 simultaneous instances have unique safe animation ids");

    // Real browser time across more than two complete 2.4-second loops.
    for (let i = 0; i < 60; i++) {
      samples.push(await page.locator("#primary .blocks-spinner-motion rect").evaluateAll(nodes =>
        nodes.map(r => [r.x.animVal.value, r.y.animVal.value])));
      await page.waitForTimeout(100);
    }
    for (const start of [0, 24, 48]) {
      for (let block = 0; block < 3; block++) {
        assert.ok(new Set(samples.slice(start, start + 12).map(frame => JSON.stringify(frame[block]))).size > 1,
          `Block ${block} must keep moving in sample window ${start}`);
      }
    }
    checks.push("all three blocks keep moving across repeated real-time loops");

    const positions = () => page.locator("#late .blocks-spinner-motion rect").evaluateAll(nodes =>
      nodes.map(r => [r.x.animVal.value, r.y.animVal.value]));
    for (let mount = 0; mount < 2; mount++) {
      await page.locator("#late").evaluate((node, html) => { node.innerHTML = html; }, render(2, `late${mount}`));
      const states = [];
      for (let i = 0; i < 15; i++) { states.push(await positions()); await page.waitForTimeout(100); }
      for (let block = 0; block < 6; block++) {
        assert.ok(new Set(states.map(s => JSON.stringify(s[block]))).size > 1, `Late/remounted block ${block} moves`);
      }
      await page.locator("#late").evaluate(node => { node.innerHTML = ""; });
    }
    checks.push("late-mounted and removed/remounted concurrent spinners animate");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const visibility = () => page.locator("#primary svg").evaluate(svg => ({
      moving: getComputedStyle(svg.querySelector(".blocks-spinner-motion")).display,
      fallback: getComputedStyle(svg.querySelector(".blocks-spinner-static")).display,
      width: svg.getBoundingClientRect().width,
      hidden: svg.getAttribute("aria-hidden"),
    }));
    assert.deepEqual(await visibility(), { moving: "none", fallback: "inline", width: 48, hidden: "true" });
    await page.screenshot({ path: path.join(out, "reduced-motion.png") });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    assert.equal((await visibility()).fallback, "none");
    checks.push("reduced-motion fallback and SVG sizing/accessibility preserved");

    // Capture real-time frames: syncbase event chains are not reliably seekable.
    for (let index = 0; index < 4; index++) {
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(out, `phase-${index}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 500 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, "mobile.png") });
    checks.push("desktop and mobile layout fixtures preserve spinner geometry without overflow");
    fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify({ checks, samples, scope: "Actual component SSR SVG and unchanged global CSS, isolated Edge browser; no app build/hydration/hosted navigation" }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
