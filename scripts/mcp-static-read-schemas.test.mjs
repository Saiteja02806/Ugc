import assert from "node:assert/strict";
import test from "node:test";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerReadMcpTools, registeredReadMcpTools } from "../lib/mcp/read-tools.ts";

test("static read contracts reuse schemas while handlers remain request-local", () => {
  const collect = () => {
    const tools = new Map();
    registerReadMcpTools({ registerTool(name, config, handler) { tools.set(name, { config, handler }); } });
    return tools;
  };
  const first = collect(), second = collect();
  assert.deepEqual([...first.keys()], [...registeredReadMcpTools]);
  for (const name of registeredReadMcpTools) {
    assert.equal(first.get(name).config.inputSchema, second.get(name).config.inputSchema, name);
    assert.equal(first.get(name).config.outputSchema, second.get(name).config.outputSchema, name);
    assert.notEqual(first.get(name).handler, second.get(name).handler, name);
  }
});

test("fresh SDK servers preserve validation, scope enforcement and concurrent owner isolation", async () => {
  let servers = 0;
  const handler = createMcpHandler(() => {
    servers++;
    const server = new McpServer({ name: "static-read-schema-test", version: "1" });
    registerReadMcpTools(server); return server;
  }, { legacy: "stateless" });
  let requestId = 0;
  const call = async (owner, scopes, method = "tools/call", params = { name: "get_profile", arguments: {} }) => {
    const response = await handler.fetch(new Request("https://mcp.example.test/mcp", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json,text/event-stream", "MCP-Protocol-Version": "2025-11-25" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    }), { authInfo: { token: "local-token", clientId: "local-client", scopes, extra: { firebaseUid: owner } } });
    const text = await response.text();
    const line = text.split(/\r?\n/).find(line => line.startsWith("data: "));
    return { status: response.status, body: JSON.parse(line ? line.slice(6) : text) };
  };
  try {
    const profiles = await Promise.all(["alice", "bob", "charlie"].map(owner => call(owner, ["account:read"])));
    assert.deepEqual(profiles.map(result => result.body.result.structuredContent.id), ["alice", "bob", "charlie"]);
    assert.equal((await call("alice", [])).status, 403);
    const invalid = await call("alice", ["account:read"], "tools/call", { name: "get_profile", arguments: { owner: "bob" } });
    assert.equal(invalid.body.result.isError, true);
    const catalogue = await call("alice", ["account:read"], "tools/list", {});
    assert.deepEqual(catalogue.body.result.tools.map(tool => tool.name), [...registeredReadMcpTools]);
    assert.equal(servers, 6);
  } finally { await handler.close(); }
});
