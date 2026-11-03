import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { getWorkspaceRouteConfig } from "../lib/navigation/workspace-route.ts";

const source = readFileSync(new URL("../components/layout/workspace-route-boundary.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
let pathname;
const element = (type, props) => ({ type, props });
const exports = {};
vm.runInNewContext(compiled, { exports, require(name) {
  if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
  if (name === "next/navigation") return { usePathname: () => pathname };
  if (name === "@/lib/navigation/workspace-route") return { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute: () => false };
  if (name === "@/components/auth/auth-guard") return { AuthGuard: "guard" };
  if (name === "@/components/layout/app-shell") return { AppShell: "shell" };
  throw new Error(`Unexpected route boundary dependency: ${name}`);
} });

test("Hook always delegates authentication to the normal guard, never the bundle", () => {
  for (pathname of ["/explore/hook-video", "/explore/hook-video/"]) {
    const tree = exports.WorkspaceRouteBoundary({ children: "workflow" });
    assert.equal(tree.type, "guard");
    assert.equal(tree.props.requireAuthentication, true);
    assert.equal(tree.props.requireBusinessProfile, true);
    assert.equal(tree.props.children.type, "shell");
    assert.equal(tree.props.children.props.children, "workflow");
  }
});

test("dedicated bundle stays public; Explore landing and sibling access stay unchanged", () => {
  pathname = "/hook-video-bundle";
  assert.equal(exports.WorkspaceRouteBoundary({ children: "public-bundle" }), "public-bundle");
  pathname = "/explore";
  assert.equal(exports.WorkspaceRouteBoundary({ children: "landing" }).props.requireAuthentication, false);
  for (pathname of ["/explore/hook-video/other", "/explore/wall-of-text", "/explore/slideshows", "/explore/create-hook", "/scheduling"]) {
    const tree = exports.WorkspaceRouteBoundary({ children: "workflow" });
    assert.equal(tree.type, "guard");
    assert.equal(tree.props.requireAuthentication, true);
    assert.equal(tree.props.requireBusinessProfile, true);
  }
});
