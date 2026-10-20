import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { proxy } = await import("../../proxy.ts");

test("production permits Explore while preserving the separate MCP deployment boundary", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    for (const path of ["/explore", "/explore/", "/explore?preview=1", "/explore/build-character?preview=1", "/explore/anything"]) {
      assert.equal(proxy({ nextUrl: new URL(path, "https://getugcpilot.com") }).status, 200);
    }
    assert.equal(proxy({ nextUrl: new URL("https://mcp.getugcpilot.com/explore") }).status, 404);
    assert.equal(proxy({ nextUrl: new URL("https://getugcpilot.com/ai-studio") }).status, 200);
    assert.equal(proxy({ nextUrl: new URL("https://getugcpilot.com/explore-other") }).status, 200);
  } finally { process.env.NODE_ENV = previous; }
});

test("development character preview remains available", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try { assert.equal(proxy({ nextUrl: new URL("http://localhost:3000/explore/build-character?preview=1") }).status, 200); }
  finally { process.env.NODE_ENV = previous; }
});

test("production navigation includes Explore and Audio", () => {
  const source = readFileSync(new URL("../../components/layout/app-sidebar.tsx", import.meta.url), "utf8");
  assert.ok(source.includes(`href: "/explore"`));
  assert.ok(source.includes(`href: "/audio-generation"`));
  assert.ok(!source.includes("isCreateContentScreenEnabled"));
});
