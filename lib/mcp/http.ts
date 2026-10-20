export async function readLimitedBody(request: Request, maxBytes = 16384) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("request_too_large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function requestWithBody(request: Request, body: string) {
  // Next.js can provide a Request from a different fetch implementation.
  // Construct from its URL rather than relying on the constructor's brand check.
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    body,
  });
}

export function oauthError(error: string, status = 400) {
  return Response.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store", "Pragma": "no-cache" },
  });
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
