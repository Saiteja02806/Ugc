import "server-only";

import { resolveMcpClient, type McpOAuthClient } from "./clients";
import { getMcpResource } from "./config";
import { parseMcpScopes } from "./scopes";

export type ValidAuthorizationRequest = {
  client: McpOAuthClient;
  redirectUri: string;
  resource: string;
  scopes: string[];
  codeChallenge: string;
  state: string;
};

export async function validateAuthorizationRequest(params: URLSearchParams): Promise<ValidAuthorizationRequest | null> {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const resource = params.get("resource");
  const state = params.get("state");
  const codeChallenge = params.get("code_challenge");
  if (!clientId || !redirectUri || !state || state.length > 512 ||
      !codeChallenge || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) ||
      params.get("code_challenge_method") !== "S256" ||
      params.get("response_type") !== "code" ||
      resource !== getMcpResource()) return null;
  const scopes = parseMcpScopes(params.get("scope"));
  if (!scopes) return null;
  const client = await resolveMcpClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) return null;
  return { client, redirectUri, resource, scopes, codeChallenge, state };
}
