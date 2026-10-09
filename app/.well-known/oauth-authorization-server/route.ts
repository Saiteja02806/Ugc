import { getMcpIssuer } from "@/lib/mcp/config";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

export function GET() {
  const issuer = getMcpIssuer();
  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    scopes_supported: MCP_SCOPES,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
