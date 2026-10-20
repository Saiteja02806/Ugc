import { getMcpIssuer, getMcpResource } from "@/lib/mcp/config";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

export function GET() {
  return Response.json({
    resource: getMcpResource(),
    authorization_servers: [getMcpIssuer()],
    scopes_supported: MCP_SCOPES,
    bearer_methods_supported: ["header"],
  }, { headers: { "Cache-Control": "no-store" } });
}
