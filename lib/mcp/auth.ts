import "server-only";

import { createHash } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";

import { getMcpResource, getProtectedResourceMetadataUrl } from "./config";
import { getMcpStore } from "./store";

export type McpPrincipal = {
  firebaseUid: string;
  clientId: string;
  scopes: string[];
};

export function hashOAuthSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function getBearerSecret(request: Request) {
  const header = request.headers.get("authorization");
  const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(header || "");
  return match?.[1] ?? null;
}

export async function authenticateMcpRequest(request: Request): Promise<
  { principal: McpPrincipal; authInfo: AuthInfo } | Response
> {
  const token = getBearerSecret(request);
  if (!token) return unauthorized();

  const { data, error } = await getMcpStore()
    .from("mcp_oauth_tokens")
    .select("client_id,firebase_uid,resource,scopes,expires_at,revoked_at,token_type")
    .eq("token_hash", hashOAuthSecret(token))
    .eq("token_type", "access")
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ event: "mcp.auth.store_error", code: error.code }));
    return Response.json({ error: "server_error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!data || data.revoked_at || data.resource !== getMcpResource() ||
      Date.parse(data.expires_at) <= Date.now()) return unauthorized();

  const principal: McpPrincipal = {
    firebaseUid: data.firebase_uid,
    clientId: data.client_id,
    scopes: data.scopes,
  };
  return {
    principal,
    authInfo: {
      token,
      clientId: principal.clientId,
      scopes: principal.scopes,
      expiresAt: Math.floor(Date.parse(data.expires_at) / 1000),
      resource: new URL(data.resource),
      resourceMetadataUrl: getProtectedResourceMetadataUrl(),
      extra: { firebaseUid: principal.firebaseUid },
    },
  };
}

function unauthorized() {
  return Response.json(
    { error: "invalid_token" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": `Bearer resource_metadata="${getProtectedResourceMetadataUrl()}", scope="account:read"`,
      },
    },
  );
}
