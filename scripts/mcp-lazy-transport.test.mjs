import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { readLimitedBody, requestWithBody } from "../lib/mcp/http.ts";
import { includesToolsListRequest, withToolSecuritySchemes } from "../lib/mcp/tool-auth-metadata.ts";
import { MCP_MAX_REQUEST_BYTES } from "../lib/mcp/transport-limits.ts";

const source = ts.transpileModule(readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function fixture() {
  const reads = [], loaded = [], calls = [];
  const state = { revoked: false, importFails: false };
  const imports = {
    "node:crypto": { randomUUID },
    "@/lib/mcp/auth": { async authenticateMcpRequest(request) {
      reads.push(request.method);
      if (!request.headers.has("authorization") || state.revoked) return Response.json({ error: "invalid_token" }, { status: 401 });
      const owner = request.headers.get("authorization");
      return { principal: { clientId: "local-client", firebaseUid: owner }, authInfo: { extra: { firebaseUid: owner } } };
    } },
    "@/lib/mcp/config": { getMcpResource: () => "https://mcp.example.test/mcp" },
    "@/lib/mcp/http": { readLimitedBody, requestWithBody },
    "@/lib/mcp/logging": { clientLogRef: () => "local-client" },
    "@/lib/mcp/transport-limits": { MCP_MAX_REQUEST_BYTES },
    "@/lib/mcp/tool-auth-metadata": { includesToolsListRequest, withToolSecuritySchemes },
  };
  const exported = {};
  vm.runInNewContext(source, { exports: exported, process: { env: { NODE_ENV: "production" } }, URL, Response, Date, Error, console: { info() {}, error() {} },
    require(name) {
      if (name === "@/lib/mcp/server") {
        loaded.push(name);
        if (state.importFails) throw new Error("Temporary import failure");
        return { mcpHandler: { async fetch(request, { authInfo }) {
          const body = request.method === "POST" ? await request.json().catch(() => null) : null;
          calls.push({ method: request.method, owner: authInfo.extra.firebaseUid, body });
          return Response.json({ jsonrpc: "2.0", id: body?.id ?? null, result: body?.method === "tools/list"
            ? { tools: [{ name: "get_profile", _meta: { securitySchemes: [{ type: "oauth2", scopes: ["account:read"] }] } }] }
            : { owner: authInfo.extra.firebaseUid } });
        } } };
      }
      assert.ok(name in imports, name); return imports[name];
    },
  });
  return { ...exported, state, reads, loaded, calls };
}
function request(method = "POST", { auth = "alice", origin, url = "https://mcp.example.test/mcp", body, headers = {} } = {}) {
  return new Request(url, { method, headers: { ...(auth ? { authorization: auth } : {}), ...(origin ? { origin } : {}), ...headers,
    ...(method === "POST" ? { "content-type": "application/json" } : {}) },
    ...(method === "POST" ? { body: body ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) } : {}) });
}
function assertFinished(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
}

test("route import and unauthenticated GET/POST/DELETE never initialize transport", async () => {
  const h = fixture(); assert.equal(h.loaded.length, 0);
  for (const method of ["GET", "POST", "DELETE"]) assertFinished(await h[method](request(method, { auth: null })), 401);
  assert.equal(h.reads.length, 3); assert.equal(h.loaded.length, 0); assert.equal(h.calls.length, 0);
});

test("invalid origin/host and bounded-body rejection skip SDK initialization", async () => {
  const h = fixture();
  assertFinished(await h.POST(request("POST", { origin: "https://evil.example.test" })), 403);
  assertFinished(await h.POST(request("POST", { url: "https://other.example.test/mcp" })), 421);
  assert.equal(h.reads.length, 0);
  assertFinished(await h.POST(request("POST", { body: "a".repeat(MCP_MAX_REQUEST_BYTES + 1) })), 413);
  assertFinished(await h.POST(request("POST", { headers: { "content-length": String(MCP_MAX_REQUEST_BYTES + 1) } })), 413);
  assert.equal(h.loaded.length, 0); assert.equal(h.reads.length, 2);
});

test("authorized calls preserve per-request auth for all methods and revocation", async () => {
  const h = fixture();
  for (const method of ["GET", "POST", "DELETE"]) assertFinished(await h[method](request(method)), 200);
  h.state.revoked = true;
  assertFinished(await h.POST(request()), 401);
  assert.equal(h.reads.length, 4); assert.equal(h.loaded.length, 3); assert.equal(h.calls.length, 3);
});

test("concurrent authorized requests retain independent principals and catalogue mirroring", async () => {
  const h = fixture();
  const responses = await Promise.all(["alice", "bob", "charlie"].map(auth => h.POST(request("POST", { auth }))));
  assert.deepEqual(h.calls.map(call => call.owner).sort(), ["alice", "bob", "charlie"]);
  for (const response of responses) {
    assertFinished(response, 200);
    const tool = (await response.json()).result.tools[0];
    assert.deepEqual(tool.securitySchemes, tool._meta.securitySchemes);
  }
});

test("transport import failure stays a bounded503; a later request can retry import", async () => {
  const h = fixture(); h.state.importFails = true;
  assertFinished(await h.POST(request()), 503);
  h.state.importFails = false;
  assertFinished(await h.POST(request()), 200);
  assert.equal(h.loaded.length, 2); assert.equal(h.reads.length, 2);
});
