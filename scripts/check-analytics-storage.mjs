import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function assertAnalyticsProject(url, expectedProject) {
  if (!expectedProject || new URL(url).hostname !== `${expectedProject}.supabase.co`) {
    throw new Error("Analytics storage check requires the explicitly expected Supabase project.");
  }
}

/** Readiness check: never queues work or changes existing account snapshots. */
export async function checkAnalyticsStorage(client) {
  const read = await client.from("analytics_account_snapshots").select("user_id", { head: true, count: "exact" });
  if (read.error && !read.error.code) throw new Error("Analytics storage readiness could not be checked. Verify network access and server credentials.");
  if (read.error) throw new Error(`Analytics snapshot table is unavailable (${read.error.code ?? "unknown"}). Apply the analytics_account_snapshots migration before releasing analytics.`);
  // No matching owner/connection returns false before any INSERT. An empty
  // account also fails validation before writing if that sentinel ever exists.
  const writeFunction = await client.rpc("save_analytics_account_snapshot", {
    p_user_id: "__ugc_analytics_readiness_no_owner__",
    p_connection_id: "00000000-0000-0000-0000-000000000000",
    p_operation: "youtube_channel", p_range_days: 0,
    p_authorization_revision: "2000-01-01T00:00:00Z",
    p_account: {}, p_attempted_at: "2000-01-01T00:00:00Z",
  });
  if (writeFunction.error || writeFunction.data !== false) throw new Error(`Analytics snapshot write function is unavailable (${writeFunction.error?.code ?? "unexpected result"}). Verify the migration and service-role permissions.`);
  return { ready: true, snapshotRows: read.count, accountDataChanged: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Configure server-only Supabase credentials before checking analytics storage.");
    assertAnalyticsProject(url, process.argv[2]);
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20_000) }) } });
    console.log(JSON.stringify(await checkAnalyticsStorage(client), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
