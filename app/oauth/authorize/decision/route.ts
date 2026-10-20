import { validateAuthorizationRequest } from "@/lib/mcp/authorization";
import { hashOAuthSecret } from "@/lib/mcp/auth";
import { newOAuthSecret } from "@/lib/mcp/clients";
import { getMcpIssuer } from "@/lib/mcp/config";
import { isJsonObject, oauthError, readLimitedBody } from "@/lib/mcp/http";
import { clientLogRef } from "@/lib/mcp/logging";
import { getMcpStore } from "@/lib/mcp/store";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return oauthError("invalid_request");
  }
  try {
    const input: unknown = JSON.parse(await readLimitedBody(request, 8192));
    if (!isJsonObject(input) || typeof input.authorizationParams !== "string" ||
        input.authorizationParams.length > 4096 || typeof input.approve !== "boolean") {
      return oauthError("invalid_request");
    }
    const authorization = await validateAuthorizationRequest(new URLSearchParams(input.authorizationParams));
    if (!authorization) return oauthError("invalid_request");
    const user = await requireFirebaseUser(request);
    const redirect = new URL(authorization.redirectUri);
    redirect.searchParams.set("state", authorization.state);
    redirect.searchParams.set("iss", getMcpIssuer());

    if (!input.approve) {
      redirect.searchParams.set("error", "access_denied");
      return Response.json({ redirect_url: redirect.href }, { headers: { "Cache-Control": "no-store" } });
    }

    const code = newOAuthSecret();
    const store = getMcpStore();
    const { error } = await store.from("mcp_oauth_authorization_codes").insert({
      code_hash: hashOAuthSecret(code),
      client_id: authorization.client.clientId,
      firebase_uid: user.uid,
      redirect_uri: authorization.redirectUri,
      resource: authorization.resource,
      scopes: authorization.scopes,
      code_challenge: authorization.codeChallenge,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (error) throw error;
    const { error: consentError } = await store.from("mcp_oauth_consents").upsert({
      firebase_uid: user.uid,
      client_id: authorization.client.clientId,
      scopes: authorization.scopes,
      granted_at: new Date().toISOString(),
    });
    if (consentError) throw consentError;
    redirect.searchParams.set("code", code);
    console.info(JSON.stringify({ event: "mcp.oauth.consent_granted", client_ref: clientLogRef(authorization.client.clientId) }));
    return Response.json({ redirect_url: redirect.href }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return oauthError("access_denied", error.status);
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "request_too_large")) return oauthError("invalid_request");
    console.error(JSON.stringify({ event: "mcp.oauth.authorization_error", name: error instanceof Error ? error.name : "UnknownError" }));
    return oauthError("server_error", 503);
  }
}
