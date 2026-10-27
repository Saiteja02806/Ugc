import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { getWorkspaceRouteConfig } from "../lib/navigation/workspace-route.ts";

const source = readFileSync(new URL("../components/layout/workspace-route-boundary.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
let pathname, auth;
const element = (type, props) => ({ type, props });
const exports = {};
vm.runInNewContext(compiled, { exports, require(name) {
  if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
  if (name === "next/navigation") return { usePathname: () => pathname };
  if (name === "@/contexts/auth-context") return { useAuth: () => auth };
  if (name === "@/lib/navigation/workspace-route") return { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute: () => false };
  return { AuthGuard: "guard", AppShell: "shell", HookVideoBundle: "bundle" };
} });

test("only the exact signed-out Hook route gets the public offer", () => {
  auth = { user: null, loading: false };
  for (pathname of ["/explore/hook-video", "/explore/hook-video/"]) assert.equal(exports.WorkspaceRouteBoundary({ children: "workflow" }).type, "bundle");
  for (pathname of ["/explore", "/explore/hook-video/other", "/explore/wall-of-text", "/explore/slideshows", "/scheduling"]) {
    const tree = exports.WorkspaceRouteBoundary({ children: "workflow" }); assert.equal(tree.type, "guard"); assert.equal(tree.props.requireAuthentication, true);
  }
});
test("signed-in Hook users retain the same guarded workspace; public bundle stays unguarded", () => {
  pathname = "/explore/hook-video"; auth = { user: { uid: "owner" }, loading: false };
  let tree = exports.WorkspaceRouteBoundary({ children: "workflow" });
  assert.equal(tree.type, "guard"); assert.equal(tree.props.requireBusinessProfile, true);
  assert.equal(tree.props.children.type, "shell"); assert.equal(tree.props.children.props.children, "workflow");
  pathname = "/hook-video-bundle"; assert.equal(exports.WorkspaceRouteBoundary({ children: "public-bundle" }), "public-bundle");
  pathname = "/explore/hook-video"; auth = { user: null, loading: true };
  tree = exports.WorkspaceRouteBoundary({ children: "workflow" }); assert.equal(tree.type, "guard");
});
