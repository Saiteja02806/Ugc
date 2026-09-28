import { randomUUID } from "node:crypto";

import { hashOAuthSecret } from "@/lib/mcp/auth";
import { newOAuthSecret } from "@/lib/mcp/clients";
import { getMcpResource } from "@/lib/mcp/config";
import { oauthError, readLimitedBody } from "@/lib/mcp/http";
import { clientLogRef } from "@/lib/mcp/logging";
import { pkceChallenge } from "@/lib/mcp/pkce";
import { getMcpStore } from "@/lib/mcp/store";

export const runtime = "nodejs";

const ACCESS_TOKEN_SECONDS = 3600;

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ||
      request.headers.has("authorization")) return oauthError("invalid_request");
  try {
    const form = new URLSearchParams(await readLimitedBody(request, 8192));
    const clientId = single(form, "client_id");
    const resource = single(form, "resource");
    if (!clientId || resource !== getMcpResource()) return oauthError("invalid_request");
    const grantType = single(form, "grant_type");
    if (grantType === "authorization_code") return exchangeCode(form, clientId, resource);
    if (grantType === "refresh_token") return rotateRefreshToken(form, clientId, resource);
    return oauthError("unsupported_grant_type");
  } catch (error) {
    if (error instanceof Error && error.message === "request_too_large") return oauthError("invalid_request", 413);
    console.error(JSON.stringify({ event: "mcp.oauth.token_error", name: error instanceof Error ? error.name : "UnknownError" }));
    return oauthError("server_error", 503);
  }
}

async function exchangeCode(form: URLSearchParams, clientId: string, resource: string) {
  const code = single(form, "code");
  const redirectUri = single(form, "redirect_uri");
  const verifier = single(form, "code_verifier");
  const challenge = verifier ? pkceChallenge(verifier) : null;
  if (!code || !redirectUri || !challenge) {
    return oauthError("invalid_grant");
  }
  const accessToken = newOAuthSecret();
  const refreshToken = newOAuthSecret();
  const { data, error } = await getMcpStore().rpc("mcp_exchange_authorization_code", {
    authorization_code_hash: hashOAuthSecret(code),
    expected_client_id: clientId,
    expected_redirect_uri: redirectUri,
    expected_resource: resource,
    expected_code_challenge: challenge,
    new_access_hash: hashOAuthSecret(accessToken),
    new_refresh_hash: hashOAuthSecret(refreshToken),
    new_family_id: randomUUID(),
  });
  if (error) throw error;
  const exchanged = Array.isArray(data) ? data[0] : null;
  if (!exchanged) return oauthError("invalid_grant");
  console.info(JSON.stringify({ event: "mcp.oauth.token_issued", client_ref: clientLogRef(clientId) }));
  return tokenResponse(accessToken, refreshToken, exchanged.scopes);
}

async function rotateRefreshToken(form: URLSearchParams, clientId: string, resource: string) {
  const previous = single(form, "refresh_token");
  if (!previous) return oauthError("invalid_grant");
  const accessToken = newOAuthSecret();
  const refreshToken = newOAuthSecret();
  const { data, error } = await getMcpStore().rpc("mcp_rotate_refresh_token", {
    old_hash: hashOAuthSecret(previous),
    new_refresh_hash: hashOAuthSecret(refreshToken),
    new_access_hash: hashOAuthSecret(accessToken),
    expected_client_id: clientId,
    expected_resource: resource,
  });
  if (error) throw error;
  const rotated = Array.isArray(data) ? data[0] : null;
  if (!rotated) return oauthError("invalid_grant");
  console.info(JSON.stringify({ event: "mcp.oauth.token_refreshed", client_ref: clientLogRef(clientId) }));
  return tokenResponse(accessToken, refreshToken, rotated.scopes);
}

function single(form: URLSearchParams, key: string) {
  const values = form.getAll(key);
  return values.length === 1 ? values[0] : null;
}

function tokenResponse(accessToken: string, refreshToken: string, scopes: string[]) {
  return Response.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
