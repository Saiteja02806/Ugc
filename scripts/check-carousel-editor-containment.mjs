// Isolated browser QA of the real component. No app routes, auth, DB or uploads.
// Use installed Playwright, or set CAROUSEL_BROWSER_DEPENDENCIES to a bundled
// node_modules directory. Only generated test artifacts are written to .tmp.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const browserRequire = process.env.CAROUSEL_BROWSER_DEPENDENCIES
  ? createRequire(path.resolve(process.env.CAROUSEL_BROWSER_DEPENDENCIES, "../package.json"))
  : require;
const { chromium } = browserRequire("playwright");
const output = path.resolve(".tmp/carousel-editor-containment");
mkdirSync(output, { recursive: true });
const entry = path.join(output, "entry.cjs");
writeFileSync(entry, `
const React = require("react");
const { createRoot } = require("react-dom/client");
const { CarouselDraggableOverlay } = require("../../components/trending/carousel-draggable-overlay.tsx");
const h = React.createElement;
const root = createRoot(document.getElementById("root"));
let fixtureId = 0;
function Fixture(options) {
  const [position, setPosition] = React.useState(options.position || { x: 0.5, y: 0.5 });
  const [width, setWidth] = React.useState(options.width);
  const [copy, setCopy] = React.useState(options.kind === "hook" ? "five shifts that made learning feel easier" : "i used to wait until i felt ready\\n\\nnow i show up for ten minutes every morning");
  const [writes, setWrites] = React.useState(0);
  const [enabled, setEnabled] = React.useState(options.enabled !== false);
  window.fixture = { setWidth, setCopy };
  return h(React.Fragment, null,
    h("div", { id: "frame", "data-format": options.format, "data-structure": options.structure, style: { width, aspectRatio: options.format === "1:1" ? "1" : "4/5" } },
      h(CarouselDraggableOverlay, {
        ariaLabel: "Move carousel text", format: options.format, structureId: options.structure,
        bounds: options.structure === "structure_2" ? { minX: 0.5, maxX: 0.5, minY: 0.12, maxY: 0.88 } : undefined,
        enabled, position, onPositionChange: (next) => { setPosition(next); setWrites(n => n + 1); setEnabled(true); }
      }, enabled ? options.kind === "hook" ? h("div", { className: "cover" }, h("p", { className: "hook" }, copy)) : h("div", { className: "group" },
        options.kind === "body" ? null : h("p", { className: "heading" }, h("span", null, "i stopped waiting for motivation")),
        ...copy.split(/\\n\\s*\\n/).map((text, index) => h("p", { className: "body", key: index }, text)),
        h("p", { className: "body" }, "try one small step today")
      ) : h("span", { style: { display: "block", width: "82cqw", height: "28cqw", opacity: 0 } }, "saved render hit target"))
    ),
    h("output", { id: "state", "data-writes": writes, "data-x": position.x, "data-y": position.y }, JSON.stringify(position))
  );
}
window.renderFixture = options => root.render(h(Fixture, { ...options, key: ++fixtureId }));
window.renderFixture({ width: 340, format: "4:5", structure: "structure_1" });
`);

// Tiny test-only CommonJS packer: transpiles the component and packages the
// already-installed React runtime without adding a bundler dependency.
const modules = [];
const ids = new Map();
function pack(file) {
  if (ids.has(file)) return ids.get(file);
  const id = modules.length;
  ids.set(file, id);
  modules.push("");
  let source = readFileSync(file, "utf8");
  if (/\.tsx?$/u.test(file)) {
    source = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  }
  const from = createRequire(file);
  source = source.replace(/require\(["']([^"']+)["']\)/gu, (_, specifier) => {
    let resolved;
    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(file), specifier);
      resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find(candidate => {
        try { return !!readFileSync(candidate); } catch { return false; }
      });
    }
    return `load(${pack(resolved || from.resolve(specifier))})`;
  });
  modules[id] = `function(module,exports,load){${source}\n}`;
  return id;
}
const entryId = pack(entry);
const bundle = `const process={env:{NODE_ENV:"development"}};const modules=[${modules.join(",")}],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports,load);return module.exports;}load(${entryId});`;
const font = readFileSync("worker/src/assets/fonts/InterTight-VariableFont_wght.ttf");
const html = `<!doctype html><html><head><style>
@font-face{font-family:InterTight;src:url('/font.ttf');font-weight:100 900}
body{margin:40px;background:#202625;color:white;font-family:InterTight,Arial}
#frame{position:relative;overflow:hidden;container-type:inline-size;background:#435254;border:1px solid #777}
.absolute{position:absolute}.z-20{z-index:20}.group{width:82cqw;text-align:center}
.group p{margin:0 auto;max-width:78cqw;white-space:pre-line}
.heading{font-size:4.62963cqw;font-weight:600;line-height:1.04}
.heading span{box-decoration-break:clone;background:white;color:#111316;border-radius:1.8cqw;padding:.7cqw 2.2cqw}
.group .body{font-size:4.44444cqw;font-weight:600;line-height:1.16;margin-top:2.96296cqw;-webkit-text-stroke:.370cqw rgba(0,0,0,.72);paint-order:stroke fill}
.cover{width:78cqw;text-align:center}.hook{font-size:6.66667cqw;font-weight:700;line-height:.98;margin:0;white-space:pre-line}
[role=alert]{position:absolute;bottom:8px;background:white;color:black;font:12px Arial}
</style></head><body><div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script></body></html>`;
const browser = await chromium.launch({ channel: process.env.CAROUSEL_BROWSER_CHANNEL || "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
await page.route("http://carousel.test/**", route => route.fulfill({
  contentType: route.request().url().endsWith("font.ttf") ? "font/ttf" : "text/html",
  body: route.request().url().endsWith("font.ttf") ? font : html,
}));
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function contained(label) {
  await settle();
  const measured = await page.evaluate(() => {
    const frameElement = document.getElementById("frame");
    const frame = frameElement.getBoundingClientRect();
    const layer = document.querySelector('[aria-label="Move carousel text"]');
    const rects = Array.from(layer.querySelectorAll("p, span")).filter(element => !element.children.length).flatMap(element => Array.from(element.getClientRects()));
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const range = document.createRange(); range.selectNodeContents(node);
      rects.push(...range.getClientRects());
    }
    return {
      overflow: layer.dataset.carouselTextOverflow,
      width: frameElement.clientWidth,
      height: frameElement.clientHeight,
      square: frameElement.dataset.format === "1:1",
      structure2: frameElement.dataset.structure === "structure_2",
      left: Math.min(...rects.map(rect => rect.left)) - frame.left,
      right: frame.right - Math.max(...rects.map(rect => rect.right)),
      top: Math.min(...rects.map(rect => rect.top)) - frame.top,
      bottom: frame.bottom - Math.max(...rects.map(rect => rect.bottom)),
    };
  });
  assert.equal(measured.overflow, "false", `${label}: unexpected oversized flag`);
  const safeX = measured.width * (measured.structure2 ? 72 : measured.square ? 108 : 96) / 1080;
  const safeTop = measured.height * (measured.structure2 ? 84 : measured.square ? 112 : 136) / (measured.square ? 1080 : 1350);
  const safeBottom = measured.structure2 ? measured.height * 92 / (measured.square ? 1080 : 1350) : safeTop;
  for (const [edge, minimum] of [["left", safeX], ["right", safeX], ["top", safeTop], ["bottom", safeBottom]]) assert.ok(measured[edge] >= minimum - 0.5, `${label}: ${edge} crossed safe margin (${measured[edge]}px < ${minimum}px)`);
}
let checked = 0;
try {
  await page.goto("http://carousel.test/");
  await page.evaluate(() => document.fonts.ready);
  await contained("initial load");
  const layer = page.getByRole("button", { name: "Move carousel text" });
  for (const structure of ["structure_1", "structure_2"]) {
    for (const format of ["1:1", "4:5"]) {
      for (const width of [160, 300, 340]) {
        for (const kind of ["hook", "body", "heading"]) {
        await page.evaluate(options => window.renderFixture(options), { structure, format, width, kind });
        await contained(`${structure}/${format}/${width}`);
        for (const [x, y] of [[0, 0], [1200, 0], [1200, 950], [0, 950]]) {
          const rect = await layer.boundingBox();
          await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
          await page.mouse.down();
          await page.mouse.move(x, y, { steps: 3 });
          await page.mouse.up();
          await contained("pointer edge");
        }
        await layer.focus();
        for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
          for (let step = 0; step < 6; step++) await layer.press(`Shift+${key}`);
          await contained(`keyboard ${key}`);
        }
        await page.evaluate(() => window.fixture.setWidth(220));
        await contained("resize after drag");
        await page.evaluate(kind => window.fixture.setCopy(kind === "hook" ? "five small changes that made a difficult task feel easier every morning" : "i changed how i approached a difficult task each morning\n\nnow i start with a manageable step instead of rebuilding the entire plan"), kind);
        await contained("text growth at edge");
        if (structure === "structure_2") assert.equal(Number(await page.locator("#state").getAttribute("data-x")), 0.5);
        checked++;
        }
      }
    }
  }
  await page.screenshot({ path: path.join(output, "contained-preview.png") });
  await page.evaluate(() => window.fixture.setCopy("W".repeat(200)));
  await settle();
  assert.equal(await layer.getAttribute("data-carousel-text-overflow"), "true");
  assert.match(await page.getByRole("alert").innerText(), /Shorten the text/);
  const writes = await page.locator("#state").getAttribute("data-writes");
  await layer.press("ArrowLeft");
  assert.equal(await page.locator("#state").getAttribute("data-writes"), writes);
  await page.evaluate(() => window.renderFixture({ structure: "structure_1", format: "4:5", width: 300, enabled: false, position: { x: 0.1, y: 0.1 } }));
  await settle();
  await page.evaluate(() => window.fixture.setWidth(220));
  await settle();
  assert.equal(await page.locator("#state").getAttribute("data-writes"), "0");
  assert.equal(await page.locator("#state").getAttribute("data-x"), "0.1");
  assert.equal(await layer.getAttribute("data-carousel-text-overflow"), "false");
  assert.deepEqual(errors, []);
  console.log(`PASS: ${checked} browser scenarios; pointer edges, keyboard, resizing, text growth, oversized warning, immutable opening; no console errors.`);
} finally {
  await browser.close();
}
