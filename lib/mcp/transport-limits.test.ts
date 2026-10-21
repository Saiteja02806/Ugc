import assert from "node:assert/strict";
import test from "node:test";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MCP_MAX_REQUEST_BYTES, MCP_MAX_TOOL_INPUT_ELEMENTS } from "./transport-limits.ts";
import { MAX_DEMO_FRAMING_POINTS } from "../../worker/src/lib/explore-finishing-contract.ts";
import { MAX_FORMAT_TEXT_OVERLAYS } from "../../worker/src/lib/explore-format-edit.ts";

function fixture() {
  let calls = 0;
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "local-input-bound", version: "1" }, { maxToolInputElements: MCP_MAX_TOOL_INPUT_ELEMENTS });
    server.registerTool("inspect", { inputSchema: z.object({ values: z.array(z.unknown()) }) }, async () => {
      calls += 1; return { content: [{ type: "text", text: "accepted" }] };
    });
    return server;
  }, { legacy: "stateless", maxRequestBodySize: MCP_MAX_REQUEST_BYTES });
  const call = (values: unknown[]) => handler.fetch(new Request("https://local.example.test/mcp", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "inspect", arguments: { values } } }),
  }));
  return { handler, call, calls: () => calls };
}
async function rpcResult(response: Response) {
  const body = await response.text();
  return JSON.parse(body.startsWith("event:") ? body.split("\n").find(line => line.startsWith("data: "))!.slice(6) : body);
}

test("real MCP transport rejects excessive argument elements before invoking a tool even below the byte cap", async () => {
  const f = fixture();
  try {
    const response = await f.call(Array(MCP_MAX_TOOL_INPUT_ELEMENTS + 1).fill(0));
    assert.equal(response.status, 200);
    const result = await rpcResult(response);
    assert.equal(result.result.isError, true);
    assert.equal(f.calls(), 0);
  } finally { await f.handler.close(); }
});

test("real MCP transport accepts legitimate maximum framing and overlay-shaped input", async () => {
  const f = fixture();
  try {
    const track = () => ({ version: 1, width: 1, height: 1, points: Array.from({ length: MAX_DEMO_FRAMING_POINTS }, (_, i) => [i * 100, .5, .5]) });
    const values = [{ sourceFraming: track(), demoFraming: track(), textOverlays: Array.from({ length: MAX_FORMAT_TEXT_OVERLAYS }, () => ({ value: "Exact caption", width: .8, y: .1, fontSize: 30, color: "#ffffff", startMs: 0, endMs: 1000 })) }];
    const response = await f.call(values);
    assert.equal(response.status, 200); assert.notEqual((await rpcResult(response)).result.isError, true);
    assert.equal(f.calls(), 1);
  } finally { await f.handler.close(); }
});

test("real MCP transport enforces the same 64 KiB limit as the authenticated route", async () => {
  const f = fixture();
  try {
    const response = await f.call(["x".repeat(MCP_MAX_REQUEST_BYTES)]);
    assert.equal(response.status, 413); assert.equal(f.calls(), 0);
  } finally { await f.handler.close(); }
});
