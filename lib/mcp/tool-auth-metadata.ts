function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mirrorToolSecuritySchemes(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    for (const item of payload) mirrorToolSecuritySchemes(item);
    return payload;
  }
  if (!isRecord(payload) || !isRecord(payload.result) || !Array.isArray(payload.result.tools)) {
    return payload;
  }

  for (const tool of payload.result.tools) {
    if (!isRecord(tool) || tool.securitySchemes !== undefined || !isRecord(tool._meta)) continue;
    const schemes = tool._meta.securitySchemes;
    if (!Array.isArray(schemes)) continue;
    tool.securitySchemes = schemes;
  }

  return payload;
}

export function includesToolsListRequest(payload: unknown): boolean {
  if (Array.isArray(payload)) return payload.some((item) => includesToolsListRequest(item));
  return isRecord(payload) && payload.method === "tools/list";
}

function responseWithText(response: Response, text: string): Response {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function withToolSecuritySchemes(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    const transformed = text.split(/\r?\n/).map((line) => {
      if (!line.startsWith("data: ")) return line;
      try {
        return `data: ${JSON.stringify(mirrorToolSecuritySchemes(JSON.parse(line.slice(6))))}`;
      } catch {
        return line;
      }
    }).join(newline);
    return responseWithText(response, transformed);
  }
  if (!contentType.includes("application/json")) return response;

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return responseWithText(response, text);
  }
  return responseWithText(response, JSON.stringify(mirrorToolSecuritySchemes(payload)));
}
