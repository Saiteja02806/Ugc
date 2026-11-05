import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import loaderModule from "next/dist/compiled/@next/font/dist/local/loader.js";
const loader = loaderModule.default ?? loaderModule;
const source = fs.readFileSync("app/layout.tsx", "utf8");
const tree = ts.createSourceFile("layout.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const configs = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree) === "localFont") {
    const text = node.initializer.arguments[0].getText(tree);
    configs[node.name.text] = Function(`return (${text})`)();
  }
  ts.forEachChild(node, visit);
}
visit(tree);
async function load(config, name) {
  const emitted = [];
  const output = await loader({ functionName: "", variableName: name, data: [config],
    emitFontFile(bytes, ext, preload, fallback) { emitted.push({ bytes: bytes.length, preload, fallback }); return `/fonts/${name}.${ext}`; },
    resolve: async file => path.resolve("app", file), loaderContext: { fs },
  });
  return { output, emitted };
}
test("normal face is preloaded; italic is on demand in the exact same CSS family", async () => {
  const normal = await load(configs.geistSans, "geistSans");
  const italic = await load(configs.geistSansItalic, "geistSansItalic");
  assert.deepEqual(normal.emitted.map(e => e.preload), [true]);
  assert.deepEqual(italic.emitted.map(e => e.preload), [false]);
  for (const { output } of [normal, italic]) {
    assert.match(output.css, /font-family: geistSans;/);
    assert.match(output.css, /font-weight: 100 900;/);
    assert.match(output.css, /font-display: swap;/);
  }
  assert.match(normal.output.css, /font-style: normal;/);
  assert.match(italic.output.css, /font-style: italic;/);
  assert.equal(italic.output.adjustFontFallback, undefined, "italic registration cannot replace regular fallback metrics");
  assert.ok(source.includes("${geistSansItalic.variable}"));
});
test("normal fallback metrics and original font bytes remain unchanged", async () => {
  const historical = { ...configs.geistSans, src: [...configs.geistSans.src, { path: configs.geistSansItalic.src, style: "italic", weight: "100 900" }] };
  const before = await load(historical, "geistSans");
  const after = await load(configs.geistSans, "geistSans");
  assert.deepEqual(after.output.adjustFontFallback, before.output.adjustFontFallback);
  assert.ok(before.emitted.some(file => file.bytes === after.emitted[0].bytes));
  assert.equal(configs.geistSansItalic.src, "../node_modules/geist/dist/fonts/geist-sans/Geist-Italic[wght].woff2");
  assert.equal(configs.geistMono.preload, false);
  assert.equal(configs.geistEditOverlay.preload, false);
});

test("brand serif is demand-loaded with identical face, bytes and fallback metrics", async () => {
  const before = await load({ ...configs.brandSerif, preload: true }, "brandSerif");
  const after = await load(configs.brandSerif, "brandSerif");
  assert.deepEqual(before.emitted.map(file => file.preload), [true]);
  assert.deepEqual(after.emitted.map(file => file.preload), [false]);
  assert.equal(after.emitted[0].bytes, before.emitted[0].bytes);
  assert.equal(after.output.css, before.output.css);
  assert.deepEqual(after.output.adjustFontFallback, before.output.adjustFontFallback);
  assert.ok(source.includes("${brandSerif.variable}"));
});
