import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GalleryVerticalEnd } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

const readSource = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Explore renders the selected stacked gallery artwork with a transparent background", async () => {
  const svg = readSource("../public/icons/sidebar/explore.svg");
  const reference = renderToStaticMarkup(
    createElement(GalleryVerticalEnd, { size: 24, strokeWidth: 1.7 }),
  );
  const rasterize = (source) => sharp(Buffer.from(source)).resize(20, 20).ensureAlpha().raw().toBuffer();
  const [actualPixels, expectedPixels] = await Promise.all([rasterize(svg), rasterize(reference)]);
  assert.deepEqual(actualPixels, expectedPixels);
  const alpha = [...actualPixels].filter((_, index) => index % 4 === 3);
  assert.equal(alpha[0], 0, "the artwork must not have an opaque background");
  assert.ok(alpha.some((value) => value > 0), "the gallery outline must remain visible");
});

test("Explore uses its own asset without changing its navigation target", () => {
  const sidebar = readSource("../components/layout/app-sidebar.tsx");
  const icons = readSource("../components/icons/sidebar-icon.tsx");
  assert.match(sidebar, /key: "explore",\s+label: "Explore",\s+href: "\/explore",\s+icon: "explore"/);
  assert.match(icons, /explore: "\/icons\/sidebar\/explore\.svg"/);
  assert.match(icons, /viral: "\/icons\/sidebar\/viral\.svg"/);
});

test("Explore inherits navigation colors through the shared sidebar mask", () => {
  const icons = readSource("../components/icons/sidebar-icon.tsx");
  assert.doesNotMatch(icons, /backgroundImage:/);
  assert.match(icons, /aria-hidden="true"/);
  assert.match(icons, /size-5 shrink-0 bg-current/);
  assert.match(icons, /WebkitMaskImage:/);
  assert.match(icons, /maskImage:/);
});

test("production navigation keeps Explore and hides Audio in active and collapsed states", () => {
  const source = readSource("../components/layout/app-sidebar.tsx");
  const tree = ts.createSourceFile("sidebar.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = tree.statements.filter((node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "SidebarNavigation" ||
    ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
      ["primaryNavigationItems", "libraryNavigationItems"].includes(declaration.name.getText(tree))),
  );
  assert.equal(declarations.length, 3, "execute the real navigation and its two item lists");
  const compiled = ts.transpileModule(declarations.map((node) => node.getText(tree)).join("\n"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const SidebarLink = ({ item, active, collapsed }) => createElement("a", {
    href: item.href, "aria-current": active ? "page" : undefined,
    "data-collapsed": String(collapsed), "data-icon": item.icon,
  }, item.label);
  const originalEnvironment = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const Navigation = new Function("require", "exports", "SidebarLink", "cn", `${compiled}\nreturn SidebarNavigation;`)(
      (id) => { assert.equal(id, "react/jsx-runtime"); return jsxRuntime; },
      {},
      SidebarLink, (...values) => values.filter(Boolean).join(" "),
    );
    for (const collapsed of [false, true]) {
      for (const activeKey of ["explore", "audio-generation"]) {
        const html = renderToStaticMarkup(createElement(Navigation, { collapsed, activeKey }));
        assert.match(html, /href="\/explore"/);
        assert.doesNotMatch(html, /href="\/audio-generation"/);
        if (activeKey === "explore") assert.match(html, new RegExp(`href="/${activeKey}" aria-current="page" data-collapsed="${collapsed}"`));
        assert.doesNotMatch(html, /href="\/create-content"/);
      }
    }
    assert.match(readSource("../components/icons/sidebar-icon.tsx"), /audio: "\/icons\/sidebar\/audio\.svg"/);
    assert.match(readSource("../public/icons/sidebar/audio.svg"), /<svg[\s\S]*<path/);
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
});
