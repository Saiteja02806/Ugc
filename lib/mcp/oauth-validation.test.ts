import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  classifyRedirectDestination,
  redirectUriMatches,
  supportsPublicClientTokenExchange,
  validRedirectUri,
} from "./client-validation.ts";
import { matchesPkce, pkceChallenge } from "./pkce.ts";
import { parseMcpScopes } from "./scopes.ts";

test("redirect URIs require HTTPS except local loopback clients", () => {
  assert.equal(validRedirectUri("https://chatgpt.com/connector/callback"), true);
  assert.equal(validRedirectUri("http://127.0.0.1:4100/callback"), true);
  assert.equal(validRedirectUri("http://localhost:4100/callback"), true);
  assert.equal(validRedirectUri("http://evil.example/callback"), false);
  assert.equal(validRedirectUri("https://user:pass@example.com/callback"), false);
  assert.equal(validRedirectUri("https://example.com/callback#fragment"), false);
});

test("hosted callbacks require an exact registered URI", () => {
  assert.equal(
    redirectUriMatches(
      "https://chatgpt.com/connector_platform_oauth_redirect",
      "https://chatgpt.com/connector_platform_oauth_redirect",
    ),
    true,
  );
  assert.equal(
    redirectUriMatches("https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback/"),
    false,
  );
  assert.equal(
    redirectUriMatches("https://example.com/callback", "https://example.com:444/callback"),
    false,
  );
});

test("portless loopback registrations accept only a changed ephemeral port", () => {
  assert.equal(
    redirectUriMatches("http://127.0.0.1/callback/abc", "http://127.0.0.1:61019/callback/abc"),
    true,
  );
  assert.equal(
    redirectUriMatches("http://localhost/callback?flow=abc", "http://localhost:3118/callback?flow=abc"),
    true,
  );
  assert.equal(
    redirectUriMatches("http://[::1]/callback", "http://[::1]:49152/callback"),
    true,
  );
  assert.equal(
    redirectUriMatches("http://127.0.0.1:4000/callback", "http://127.0.0.1:61019/callback"),
    false,
  );
  assert.equal(
    redirectUriMatches("http://127.0.0.1/callback", "http://localhost:61019/callback"),
    false,
  );
  assert.equal(
    redirectUriMatches("http://localhost/callback", "http://localhost:3118/different"),
    false,
  );
  assert.equal(
    redirectUriMatches("http://localhost/callback?flow=abc", "http://localhost:3118/callback?flow=def"),
    false,
  );
  assert.equal(
    redirectUriMatches("http://localhost/callback", "http://localhost.attacker.test:3118/callback"),
    false,
  );
  assert.equal(
    redirectUriMatches("http://localhost/callback", "https://localhost:3118/callback"),
    false,
  );
});

test("CIMD selects none from the supported method intersection", () => {
  assert.equal(supportsPublicClientTokenExchange({}), true);
  assert.equal(supportsPublicClientTokenExchange({ token_endpoint_auth_method: "none" }), true);
  assert.equal(supportsPublicClientTokenExchange({ token_endpoint_auth_method: "private_key_jwt" }), false);
  assert.equal(supportsPublicClientTokenExchange({
    token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
    token_endpoint_auth_method: "private_key_jwt",
  }), true);
  assert.equal(supportsPublicClientTokenExchange({
    token_endpoint_auth_methods_supported: ["private_key_jwt"],
    token_endpoint_auth_method: "none",
  }), false);
  assert.equal(supportsPublicClientTokenExchange({ token_endpoint_auth_methods_supported: "none" }), false);
  assert.equal(supportsPublicClientTokenExchange({ token_endpoint_auth_method: 0 }), false);
});

test("consent copy identifies only official callback shapes", () => {
  assert.equal(classifyRedirectDestination("https://chatgpt.com/connector_platform_oauth_redirect"), "chatgpt");
  assert.equal(classifyRedirectDestination("https://chatgpt.com/connector/oauth/callback-id"), "chatgpt");
  assert.equal(classifyRedirectDestination("https://chatgpt.com/unrelated"), "hosted");
  assert.equal(classifyRedirectDestination("https://claude.ai/api/mcp/auth_callback"), "claude");
  assert.equal(classifyRedirectDestination("https://claude.ai/other"), "hosted");
  assert.equal(classifyRedirectDestination("http://127.0.0.1:61019/callback/abc"), "loopback");
  assert.equal(classifyRedirectDestination("https://example.com/oauth/callback"), "hosted");
});

test("PKCE accepts the matching S256 verifier and rejects substitutions", () => {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(pkceChallenge(verifier), challenge);
  assert.equal(pkceChallenge("short"), null);
  assert.equal(matchesPkce(verifier, challenge), true);
  assert.equal(matchesPkce("b".repeat(43), challenge), false);
  assert.equal(matchesPkce("short", challenge), false);
});

test("only approved OAuth scopes can be granted", () => {
  assert.deepEqual(parseMcpScopes(null), ["account:read"]);
  assert.deepEqual(parseMcpScopes("account:read assets:read account:read"), ["account:read", "assets:read"]);
  assert.equal(parseMcpScopes("admin:write"), null);
});
