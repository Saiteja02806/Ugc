import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";

import { AuthEmailError, type AuthEmailKind } from "./email-policy";

export async function consumeAuthEmailLimit(
  request: Request,
  kind: AuthEmailKind,
  subject: string,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new AuthEmailError("Email delivery is temporarily unavailable.");
  const secret = process.env.EMAIL_RATE_LIMIT_SECRET?.trim() || key;
  const ipHeader = request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") || "";
  const candidateIp = ipHeader.split(",")[0].trim();
  const ip = isIP(candidateIp) ? candidateIp : "unknown";
  const hash = (value: string) => createHmac("sha256", secret)
    .update(`ugc-auth-email-v1:${value}`).digest("hex");
  const buckets = [
    { key: hash(`${kind}:subject:${subject}`), window_seconds: 3600,
      max_requests: kind === "verification" ? 5 : 3, cooldown_seconds: 60 },
    { key: hash(`${kind}:ip:${ip}`), window_seconds: 3600,
      max_requests: kind === "verification" ? 20 : 10, cooldown_seconds: 0 },
    { key: hash("all:global"), window_seconds: 3600, max_requests: 200, cooldown_seconds: 0 },
  ];
  const store = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  });
  const { data, error } = await store.rpc("consume_auth_email_limits", { p_buckets: buckets });
  if (error || !data || typeof data.allowed !== "boolean") {
    // Fail closed across instances when shared storage is unavailable.
    throw new AuthEmailError("Email delivery is temporarily unavailable. Please try again later.");
  }
  if (!data.allowed) {
    const retryAfter = Math.max(1, Math.ceil(Number(data.retry_after) || 60));
    throw new AuthEmailError("Too many email requests. Please wait before trying again.", 429, retryAfter);
  }
}
