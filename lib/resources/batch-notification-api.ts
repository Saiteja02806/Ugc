type Save = (email: string, request: Request) => Promise<"saved" | "limited">;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: object, status = 200) => Response.json(body, { status, headers });

export function createBatchNotificationHandler(save: Save) {
  return async function POST(request: Request) {
    if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Please use the form on UGC Pilot." }, 403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json" || Number(request.headers.get("content-length") ?? 0) > 2048) return reply({ error: "Invalid request." }, 400);
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: "Invalid request." }, 400);
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 2048) { await reader.cancel(); return reply({ error: "Invalid request." }, 400); }
          chunks.push(next.value);
        }
      } finally { reader.releaseLock(); }
      let input: unknown;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reply({ error: "Invalid request." }, 400); }
      if (!input || typeof input !== "object") return reply({ error: "Invalid request." }, 400);
      const { email, consent, website } = input as Record<string, unknown>;
      if (typeof website === "string" && website.length) return reply({ saved: true }); // Honeypot: no storage or delivery.
      const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
      const [local, domain] = normalized.split("@");
      if (consent !== true || normalized.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(normalized) || local.length > 64 || local.startsWith(".") || local.endsWith(".") || normalized.includes("..") || domain.split(".").some(label => label.length > 63)) return reply({ error: "Enter a valid email and agree to the Batch 2 notification." }, 400);
      const result = await save(normalized, request);
      if (result === "limited") return reply({ error: "Too many requests. Please try again later." }, 429);
      return reply({ saved: true }); // Same response for an existing request; no address enumeration.
    } catch { return reply({ error: "Notifications are temporarily unavailable. Your email was not confirmed; please try again later." }, 503); }
  };
}
