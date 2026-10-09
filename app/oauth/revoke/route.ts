import { hashOAuthSecret } from "@/lib/mcp/auth";
import { oauthError, readLimitedBody } from "@/lib/mcp/http";
import { clientLogRef } from "@/lib/mcp/logging";
import { getMcpStore } from "@/lib/mcp/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return oauthError("invalid_request");
  }
  try {
    const form = new URLSearchParams(await readLimitedBody(request, 8192));
    const token = form.get("token");
    const clientId = form.get("client_id");
    if (!token || !clientId || form.getAll("token").length !== 1 ||
        form.getAll("client_id").length !== 1) return oauthError("invalid_request");
    const store = getMcpStore();
    const { data, error } = await store.from("mcp_oauth_tokens")
      .select("family_id,client_id")
      .eq("token_hash", hashOAuthSecret(token))
      .maybeSingle();
    if (error) throw error;
    if (data?.client_id === clientId) {
      const { error: revokeError } = await store.from("mcp_oauth_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("family_id", data.family_id)
        .is("revoked_at", null);
      if (revokeError) throw revokeError;
      console.info(JSON.stringify({ event: "mcp.oauth.family_revoked", client_ref: clientLogRef(clientId) }));
    }
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "request_too_large") return oauthError("invalid_request", 413);
    console.error(JSON.stringify({ event: "mcp.oauth.revocation_error", name: error instanceof Error ? error.name : "UnknownError" }));
    return oauthError("server_error", 503);
  }
}
