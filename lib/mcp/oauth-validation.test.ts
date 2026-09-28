import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { validRedirectUri } from "./client-validation.ts";
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
