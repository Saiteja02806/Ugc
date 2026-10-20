import assert from "node:assert/strict";
import test from "node:test";

import {
  includesToolsListRequest,
  mirrorToolSecuritySchemes,
  withToolSecuritySchemes,
} from "./tool-auth-metadata.ts";

test("mirrors OAuth schemes to the top-level tool descriptor", () => {
  const schemes = [{ type: "oauth2", scopes: ["assets:read"] }];
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [{
        name: "list_assets",
        securitySchemes: undefined as typeof schemes | undefined,
        _meta: { securitySchemes: schemes },
      }],
    },
  };

  assert.equal(mirrorToolSecuritySchemes(payload), payload);
  assert.deepEqual(payload.result.tools[0].securitySchemes, schemes);
});

test("does not overwrite SDK-native schemes or change unrelated responses", () => {
  const native = [{ type: "oauth2", scopes: ["account:read"] }];
  const payload = {
    result: {
      tools: [{
        name: "get_profile",
        securitySchemes: native,
        _meta: { securitySchemes: [{ type: "oauth2", scopes: ["wrong"] }] },
      }],
    },
  };
  const unrelated = { jsonrpc: "2.0", id: 2, result: { content: [] } };

  mirrorToolSecuritySchemes(payload);
  assert.equal(payload.result.tools[0].securitySchemes, native);
  assert.equal(mirrorToolSecuritySchemes(unrelated), unrelated);
});

test("supports JSON-RPC batch responses", () => {
  const payload = [{
    result: {
      tools: [{
        name: "get_profile",
        _meta: { securitySchemes: [{ type: "oauth2", scopes: ["account:read"] }] },
        securitySchemes: undefined as { type: string; scopes: string[] }[] | undefined,
      }],
    },
  }];

  mirrorToolSecuritySchemes(payload);
  assert.deepEqual(payload[0].result.tools[0].securitySchemes, [
    { type: "oauth2", scopes: ["account:read"] },
  ]);
});

test("detects tools/list in single and batch requests", () => {
  assert.equal(includesToolsListRequest({ method: "tools/list" }), true);
  assert.equal(includesToolsListRequest([{ method: "ping" }, { method: "tools/list" }]), true);
  assert.equal(includesToolsListRequest({ method: "tools/call" }), false);
});

test("mirrors schemes inside an SSE tools/list response", async () => {
  const response = new Response(
    'event: message\ndata: {"result":{"tools":[{"name":"get_profile","_meta":{"securitySchemes":[{"type":"oauth2","scopes":["account:read"]}]}}]}}\n\n',
    { headers: { "content-type": "text/event-stream" } },
  );
  const transformed = await withToolSecuritySchemes(response);
  const text = await transformed.text();
  const data = JSON.parse(text.split("\n").find((line) => line.startsWith("data: "))!.slice(6));

  assert.deepEqual(data.result.tools[0].securitySchemes, [
    { type: "oauth2", scopes: ["account:read"] },
  ]);
});
