import { createHmac } from "node:crypto";

import { validRedirectUri } from "@/lib/mcp/client-validation";
import { newOAuthSecret } from "@/lib/mcp/clients";
import { getMcpIssuer } from "@/lib/mcp/config";
import { isJsonObject, oauthError, readLimitedBody } from "@/lib/mcp/http";
import { clientLogRef } from "@/lib/mcp/logging";
import { getMcpStore } from "@/lib/mcp/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return oauthError("invalid_client_metadata");
  }
  try {
    const input: unknown = JSON.parse(await readLimitedBody(request));
    if (!isJsonObject(input) || typeof input.client_name !== "string" ||
        !input.client_name.trim() || input.client_name.length > 100 ||
        !Array.isArray(input.redirect_uris) ||
        input.redirect_uris.length < 1 || input.redirect_uris.length > 10 ||
        !input.redirect_uris.every((uri) => typeof uri === "string" && validRedirectUri(uri)) ||
        (input.token_endpoint_auth_method !== undefined && input.token_endpoint_auth_method !== "none") ||
        (input.grant_types !== undefined && (!Array.isArray(input.grant_types) ||
          input.grant_types.some((grant) => !["authorization_code", "refresh_token"].includes(grant)))) ||
        (input.response_types !== undefined && (!Array.isArray(input.response_types) ||
          input.response_types.some((response) => response !== "code")))) {
      return oauthError("invalid_client_metadata");
    }

    const ip = (process.env.NODE_ENV === "production"
      ? request.headers.get("x-vercel-forwarded-for")
      : request.headers.get("x-forwarded-for"))?.split(",")[0]?.trim() || "unknown";
    const store = getMcpStore();
    const rateKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!rateKey) throw new Error("MCP OAuth storage is not configured.");
    const ipHash = createHmac("sha256", rateKey).update(ip).digest("hex");
    const clientId = `mcp_${newOAuthSecret()}`;
    const { data: registered, error } = await store.rpc("mcp_register_client", {
      new_client_id: clientId,
      new_client_name: input.client_name.trim(),
      new_redirect_uris: input.redirect_uris,
      ip_hash: ipHash,
    });
    if (error) throw error;
    if (!registered) return oauthError("rate_limited", 429);
    console.info(JSON.stringify({ event: "mcp.oauth.client_registered", client_ref: clientLogRef(clientId) }));
    return Response.json({
      client_id: clientId,
      client_name: input.client_name.trim(),
      redirect_uris: input.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
      issuer: getMcpIssuer(),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "request_too_large") return oauthError("invalid_client_metadata", 413);
    if (error instanceof SyntaxError) return oauthError("invalid_client_metadata");
    console.error(JSON.stringify({ event: "mcp.oauth.registration_error", name: error instanceof Error ? error.name : "UnknownError" }));
    return oauthError("server_error", 503);
  }
}
