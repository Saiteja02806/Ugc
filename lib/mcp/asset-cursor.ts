import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const cursorPayload = z.object({
  v: z.literal(1),
  user_id: z.string().min(1),
  collection: z.string().nullable(),
  source_type: z.string().nullable(),
  query: z.string().nullable(),
  updated_at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
}).strict();

export type AssetCursorPayload = z.infer<typeof cursorPayload>;

function cursorKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("MCP cursor signing is not configured.");
  return key;
}

export function encodeAssetCursor(payload: AssetCursorPayload) {
  const body = Buffer.from(JSON.stringify(cursorPayload.parse(payload))).toString("base64url");
  const signature = createHmac("sha256", cursorKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function decodeAssetCursor(cursor: string): AssetCursorPayload | null {
  const [body, signature, extra] = cursor.split(".");
  if (!body || !signature || extra || body.length > 1800 || !/^[A-Za-z0-9_-]+$/.test(body)) return null;
  const expected = createHmac("sha256", cursorKey()).update(body).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    return cursorPayload.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}
