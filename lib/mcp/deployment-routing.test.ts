import assert from "node:assert/strict";
import test from "node:test";

import {
  isMcpDeploymentPath,
  isMcpExclusivePath,
  shouldBlockDeploymentRoute,
} from "./deployment-routing.ts";

test("recognizes only the MCP and OAuth routes that belong to the MCP service", () => {
  for (const pathname of [
    "/mcp",
    "/mcp/health",
    "/oauth",
    "/oauth/token",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    assert.equal(isMcpExclusivePath(pathname), true, pathname);
  }

  for (const pathname of [
    "/",
    "/api/jobs",
    "/mcpress",
    "/oauthish",
    "/.well-known/security.txt",
  ]) {
    assert.equal(isMcpExclusivePath(pathname), false, pathname);
  }
});

test("keeps the small set of support assets needed by the isolated MCP deployment", () => {
  for (const pathname of [
    "/_next/static/app.js",
    "/__/auth/handler",
    "/__/firebase/init.json",
    "/icons/google.svg",
    "/favicon.ico",
  ]) {
    assert.equal(isMcpDeploymentPath(pathname), true, pathname);
  }

  assert.equal(isMcpDeploymentPath("/api/jobs"), false);
  assert.equal(isMcpDeploymentPath("/.well-known/security.txt"), false);
});

test("isolates both deployment targets while preserving local MCP development", () => {
  assert.equal(shouldBlockDeploymentRoute({
    hostname: "mcp.getugcpilot.com",
    isMcpOnlyDeployment: false,
    isProduction: true,
    pathname: "/api/jobs",
  }), true);
  assert.equal(shouldBlockDeploymentRoute({
    hostname: "preview-123.vercel.app",
    isMcpOnlyDeployment: true,
    isProduction: true,
    pathname: "/mcp/health",
  }), false);
  assert.equal(shouldBlockDeploymentRoute({
    hostname: "www.getugcpilot.com",
    isMcpOnlyDeployment: false,
    isProduction: true,
    pathname: "/oauth/token",
  }), true);
  assert.equal(shouldBlockDeploymentRoute({
    hostname: "www.getugcpilot.com",
    isMcpOnlyDeployment: false,
    isProduction: true,
    pathname: "/.well-known/security.txt",
  }), false);
  assert.equal(shouldBlockDeploymentRoute({
    hostname: "localhost",
    isMcpOnlyDeployment: false,
    isProduction: false,
    pathname: "/oauth/token",
  }), false);
});
