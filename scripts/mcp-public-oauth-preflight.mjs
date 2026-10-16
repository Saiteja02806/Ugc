import assert from "node:assert/strict";

// This emulates the safe, unauthenticated portion of a newly installed MCP
// client. It never creates a client, follows a sign-in redirect, sends a
// bearer token, or invokes a tool that can read or change customer content.
const origin = safeOrigin(process.env.UGC_PILOT_MCP_ORIGIN?.trim() || "https://mcp.getugcpilot.com");
const endpoint = `${origin}/mcp`;

function safeOrigin(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", "MCP origin must use HTTPS");
  assert(!url.username && !url.password && !url.search && !url.hash, "MCP origin must not contain credentials, query, or fragment");
  return url.origin;
}

async function request(path) {
  const response = await fetch(`${origin}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
  });
  return response;
}

async function json(path, expectedStatus = 200) {
  const response = await request(path);
  assert.equal(response.status, expectedStatus, `${path} returned HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/i, `${path} is not JSON`);
  return response.json();
}

const resource = await json("/.well-known/oauth-protected-resource/mcp");
assert.equal(resource.resource, endpoint, "Protected-resource metadata names a different MCP endpoint");
assert.deepEqual(resource.authorization_servers, [origin], "Protected-resource metadata names a different issuer");
assert(resource.scopes_supported?.includes("account:read"), "The initial read scope is not advertised");
assert(resource.scopes_supported?.includes("creative:write"), "The finishing scope is not advertised");

const issuer = await json("/.well-known/oauth-authorization-server");
assert.equal(issuer.issuer, origin, "Issuer metadata does not match the protected resource");
assert.equal(issuer.authorization_endpoint, `${origin}/oauth/authorize`);
assert.equal(issuer.token_endpoint, `${origin}/oauth/token`);
assert.equal(issuer.registration_endpoint, `${origin}/oauth/register`);
assert(issuer.code_challenge_methods_supported?.includes("S256"), "OAuth metadata does not advertise PKCE S256");
assert.equal(issuer.authorization_response_iss_parameter_supported, true, "OAuth metadata does not enable issuer-bound redirects");
assert.equal(issuer.client_id_metadata_document_supported, true, "OAuth metadata does not support CIMD");

const health = await json("/mcp/health");
assert.equal(health.status, "ready", "MCP health is not ready");

const challenge = await request("/mcp");
assert.equal(challenge.status, 401, "An anonymous MCP request must require OAuth");
const wwwAuthenticate = challenge.headers.get("www-authenticate") ?? "";
assert(wwwAuthenticate.includes(`resource_metadata=\"${origin}/.well-known/oauth-protected-resource\"`), "The OAuth challenge does not point back to protected-resource metadata");
assert(wwwAuthenticate.includes('scope="account:read"'), "The OAuth challenge does not request the initial read scope");

console.log(JSON.stringify({
  status: "passed",
  endpoint,
  checks: [
    "health",
    "protected-resource metadata",
    "authorization-server metadata",
    "PKCE S256",
    "issuer-bound redirect support",
    "CIMD support",
    "anonymous OAuth challenge",
  ],
  limitation: "This validates discovery and the sign-in handoff only. A person must complete sign-in and consent in a real Codex/Claude client to validate the return redirect and authenticated tools.",
}, null, 2));
