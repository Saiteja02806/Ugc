import "server-only";
import { createClient } from "@supabase/supabase-js";
import { validateTimeZone } from "./schedule-time";

export async function initializeAccountTimeZone(userId: string, timezone: string) {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Account time zone storage is not configured.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("initialize_user_timezone", {
    p_user_id: userId,
    p_timezone: validateTimeZone(timezone),
  });
  if (error || typeof data !== "string") throw new Error("Could not save your account time zone.");
  return validateTimeZone(data);
}
