import { randomUUID } from "node:crypto";

import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { getMcpResource } from "@/lib/mcp/config";
import { readLimitedBody, requestWithBody } from "@/lib/mcp/http";
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
  let clientRef: string | undefined;
  const finish = (response: Response) => {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-Id", requestId);
    console.info(JSON.stringify({
      event: "mcp.request",
      request_id: requestId,
      method: request.method,
      status: response.status,
      duration_ms: Date.now() - started,
      client_ref: clientRef,
    }));
    return response;
  };
  const resourceOrigin = new URL(getMcpResource()).origin;
  if (process.env.NODE_ENV === "production" && new URL(request.url).origin !== resourceOrigin) {
    return finish(Response.json({ error: "invalid_resource_host" }, { status: 421 }));
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== resourceOrigin) {
    return finish(Response.json({ error: "invalid_origin" }, { status: 403 }));
  }

  try {
    const authentication = await authenticateMcpRequest(request);
    if (authentication instanceof Response) return finish(authentication);
    clientRef = clientLogRef(authentication.principal.clientId);
    let mirrorToolAuth = false;

    if (request.method === "POST") {
      // Tools receive metadata and asset IDs; media bytes use signed uploads.
      // Bound the actual stream even when Content-Length is absent or false.
      const body = await readLimitedBody(request, 64 * 1024);
      if (request.headers.get("content-type")?.includes("application/json")) {
        try {
          mirrorToolAuth = includesToolsListRequest(JSON.parse(body));
        } catch {
          // Let the transport return its normal JSON-RPC parse error.
        }
      }
      request = requestWithBody(request, body);
    }
    const transportResponse = await mcpHandler.fetch(request, {
      authInfo: authentication.authInfo,
    });
    const response = mirrorToolAuth
      ? await withToolSecuritySchemes(transportResponse)
      : transportResponse;
    return finish(response);

  } catch (error) {
    if (error instanceof Error && error.message === "request_too_large") {
      return finish(Response.json({ error: "request_too_large" }, {
        status: 413,
        headers: { "Cache-Control": "no-store" },
      }));
    }
    console.error(JSON.stringify({
      event: "mcp.request.error",
      request_id: requestId,
      name: error instanceof Error ? error.name : "UnknownError",
    }));
    return finish(Response.json({ error: "server_error", request_id: requestId }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    }));
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
