import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://local-mcp-token-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-secret";

const calls = [];
globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.hostname, "local-mcp-token-test.supabase.co");
  calls.push(url.pathname);
  return Response.json({ message: "private database failure", code: "XX000" }, { status: 500 });
};

const { POST } = await import("../app/oauth/token/route.ts");
for (const grant of [
  { grant_type: "authorization_code", code: "local-code", redirect_uri: "http://127.0.0.1:47831/callback", code_verifier: "a".repeat(43) },
  { grant_type: "refresh_token", refresh_token: "local-refresh" },
]) {
  const response = await POST(new Request("https://mcp.getugcpilot.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: "local-client", resource: "https://mcp.getugcpilot.com/mcp", ...grant }),
  }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "server_error" });
}
assert.deepEqual(calls, ["/rest/v1/rpc/mcp_exchange_authorization_code", "/rest/v1/rpc/mcp_rotate_refresh_token"]);
console.log("MCP token endpoint: asynchronous code and refresh failures return safe, uncached 503 responses.");
