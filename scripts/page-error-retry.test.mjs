import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("the page error Try again action calls the retry prop supplied by installed Next", () => {
  const runtime = readFileSync(new URL("../node_modules/next/dist/client/components/error-boundary.js", import.meta.url), "utf8");
  assert.match(runtime, /retry: this\.retry/);
  const code = ts.transpileModule(readFileSync(new URL("../app/error.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exported = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, { exports: exported, require(name) {
    if (name === "react") return { useEffect() {} };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "next/link") return { default: "Link" };
    if (name === "@/components/ui/button") return { Button: "Button" };
    if (name === "@/components/brand/product-logo") return { ProductLogoMark: "Logo" };
    if (name === "lucide-react") return { AlertTriangle: "AlertTriangle", RotateCcw: "RotateCcw" };
    throw Error(`Unexpected import ${name}`);
  } });
  const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
  let retries = 0;
  const tree = exported.default({ error: new Error("Opening failed"), retry: () => { retries++; } });
  const action = nodes(tree).find(node => node.type === "Button");
  assert.ok(action);
  action.props.onClick();
  assert.equal(retries, 1);
  assert.equal(nodes(tree).find(node => node.type === "Link").props.href, "/dashboard");
});
