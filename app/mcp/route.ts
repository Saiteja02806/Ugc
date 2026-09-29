import { randomUUID } from "node:crypto";

import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { getMcpResource } from "@/lib/mcp/config";
import { clientLogRef } from "@/lib/mcp/logging";
import { mcpHandler } from "@/lib/mcp/server";
import {
  includesToolsListRequest,
  withToolSecuritySchemes,
} from "@/lib/mcp/tool-auth-metadata";

export const runtime = "nodejs";

async function handle(request: Request) {
  const requestId = randomUUID();
  const started = Date.now();
  const resourceOrigin = new URL(getMcpResource()).origin;
  if (process.env.NODE_ENV === "production" && new URL(request.url).origin !== resourceOrigin) {
    return Response.json({ error: "invalid_resource_host" }, { status: 421 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== resourceOrigin) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }

  try {
    const authentication = await authenticateMcpRequest(request);
    if (authentication instanceof Response) return authentication;
    const mirrorToolAuth = request.method === "POST" &&
      request.headers.get("content-type")?.includes("application/json") &&
      await request.clone().json().then(includesToolsListRequest).catch(() => false);
    const transportResponse = await mcpHandler.fetch(request, {
      authInfo: authentication.authInfo,
    });
    const response = mirrorToolAuth
      ? await withToolSecuritySchemes(transportResponse)
      : transportResponse;
    console.info(JSON.stringify({
      event: "mcp.request",
      request_id: requestId,
      method: request.method,
      status: response.status,
      duration_ms: Date.now() - started,
      client_ref: clientLogRef(authentication.principal.clientId),
    }));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "mcp.request.error",
      request_id: requestId,
      name: error instanceof Error ? error.name : "UnknownError",
    }));
    return Response.json({ error: "server_error", request_id: requestId }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
