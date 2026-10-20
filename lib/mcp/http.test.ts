import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { readLimitedBody, requestWithBody } from "./http.ts";

const { Request: FrameworkRequest } = createRequire(import.meta.url)(
  "next/dist/compiled/@edge-runtime/primitives/fetch.js",
);

test("rebuilds a consumed framework request without assuming a native Request brand", async () => {
  const abort = new AbortController();
  const request: Request = new FrameworkRequest("https://mcp.getugcpilot.com/mcp", {
    method: "POST", signal: abort.signal,
    headers: { "content-type": "application/json", authorization: "Bearer fixture", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(request instanceof Request, false);
  const body = await readLimitedBody(request, 64 * 1024);
  assert.throws(() => new Request(request, { body }), TypeError);
  const rebuilt = requestWithBody(request, body);
  assert.equal(rebuilt.url, request.url);
  assert.equal(rebuilt.method, "POST");
  assert.equal(rebuilt.headers.get("authorization"), "Bearer fixture");
  assert.equal(rebuilt.headers.get("mcp-protocol-version"), "2025-06-18");
  assert.equal((await rebuilt.json()).method, "tools/list");
  abort.abort();
  assert.equal(rebuilt.signal.aborted, true);
});

test("rejects an oversized framework request before transport reconstruction", async () => {
  const request: Request = new FrameworkRequest("https://mcp.getugcpilot.com/mcp", {
    method: "POST", body: "x".repeat(65537),
  });
  await assert.rejects(readLimitedBody(request, 64 * 1024), /request_too_large/);
});
