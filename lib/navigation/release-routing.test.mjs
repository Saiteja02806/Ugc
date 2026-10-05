import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });

// Next initializes this runtime global itself; reproduce it in the isolated test.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const { NextRequest } = await import("next/server");
const { proxy, config } = await import("../../proxy.ts");
const { getWorkspaceRouteConfig } = await import("./workspace-route.ts");
// The installed 16.3.7 helper still exposes its legacy Middleware name.
const { unstable_doesMiddlewareMatch: doesProxyMatch } = createRequire(import.meta.url)(
  "next/dist/experimental/testing/server/middleware-testing-utils.js",
);

function route(pathname, { hostname = "www.getugcpilot.com", environment = "production", mcpOnly = false } = {}) {
  const original = { node: process.env.NODE_ENV, mcp: process.env.MCP_ONLY_DEPLOYMENT };
  try {
    process.env.NODE_ENV = environment;
    process.env.MCP_ONLY_DEPLOYMENT = String(mcpOnly);
    return proxy(new NextRequest(`https://${hostname}${pathname}`));
  } finally {
    for (const [key, value] of [["NODE_ENV", original.node], ["MCP_ONLY_DEPLOYMENT", original.mcp]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Explore and Audio reach their authenticated pages in production, without being indexed", () => {
  for (const path of ["/explore", "/explore/create-hook", "/explore/creator-phone", "/audio-generation"]) {
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), true, path);
    const response = route(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("x-middleware-next"), "1", path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex", path);
    const access = getWorkspaceRouteConfig(path);
    assert.ok(access && access.access !== "none", path);
    assert.equal(access.access, path === "/audio-generation" ? "authentication" : "profile", path);
  }
});

test("main's MCP-only deployment boundary remains enforced at the actual proxy", () => {
  for (const path of ["/explore", "/audio-generation", "/api/jobs", "/", "/pricing"]) {
    assert.equal(route(path, { hostname: "mcp.getugcpilot.com" }).status, 404, path);
    assert.equal(route(path, { hostname: "preview.vercel.app", mcpOnly: true }).status, 404, path);
  }
  for (const path of ["/mcp", "/mcp/health", "/oauth/token", "/.well-known/oauth-authorization-server"]) {
    assert.equal(route(path).status, 404, path);
    assert.equal(route(path, { hostname: "mcp.getugcpilot.com" }).status, 200, path);
    assert.equal(route(path, { hostname: "localhost", environment: "development" }).status, 200, path);
  }
});

test("marketing stays indexable and authentication actions retain their privacy headers", () => {
  for (const path of ["/", "/pricing", "/guides"]) {
    assert.equal(route(path).headers.get("x-robots-tag"), null, path);
  }
  for (const path of ["/auth/action", "/auth/action/reset-password"]) {
    const headers = route(path).headers;
    assert.equal(headers.get("referrer-policy"), "no-referrer");
    assert.equal(headers.get("cache-control"), "no-store");
    assert.equal(headers.get("x-robots-tag"), "noindex");
  }
});

test("workspace matching retains existing guards and cannot match a similar public pathname", () => {
  assert.equal(getWorkspaceRouteConfig("/dashboard/billing").access, "authentication");
  for (const path of ["/dashboard", "/analytics", "/library", "/scheduling", "/settings", "/ai-studio"]) {
    assert.equal(getWorkspaceRouteConfig(path).access, "profile", path);
  }
  for (const path of ["/exploreish", "/audio-generationish", "/create-content"]) {
    assert.equal(getWorkspaceRouteConfig(path), null, path);
  }
});
