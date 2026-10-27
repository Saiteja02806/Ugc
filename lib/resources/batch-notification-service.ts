import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { createBatchNotificationHandler } from "./batch-notification-api.ts";

export const batchNotificationPOST = createBatchNotificationHandler(async (email, request) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Notification storage unavailable");
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  });
  // Reuse the existing durable rate limiter with separate resource-only keys.
  const candidate = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ip = isIP(candidate) ? candidate : "unknown";
  const hash = (value: string) => createHmac("sha256", process.env.EMAIL_RATE_LIMIT_SECRET?.trim() || key).update(`hook-batch-2-v1:${value}`).digest("hex");
  const { data, error } = await client.rpc("consume_auth_email_limits", { p_buckets: [
    { key: hash(`email:${email}`), window_seconds: 3600, max_requests: 5, cooldown_seconds: 0 },
    { key: hash(`ip:${ip}`), window_seconds: 3600, max_requests: 20, cooldown_seconds: 0 },
    { key: hash("global"), window_seconds: 3600, max_requests: 200, cooldown_seconds: 0 },
  ] });
  if (error || typeof data?.allowed !== "boolean") throw new Error("Notification rate limiter unavailable");
  if (!data.allowed) return "limited";
  const { error: saveError } = await client.from("resource_batch_notifications").upsert({
    batch: "hook-videos-2", email, consent_version: "batch-2-only-v1",
  }, { onConflict: "batch,email", ignoreDuplicates: true });
  if (saveError) throw new Error("Notification storage unavailable");
  return "saved";
});
