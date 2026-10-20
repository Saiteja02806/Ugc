import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getConnectionRevision } from "@/lib/social/connection-revision";
import type { SocialConnection } from "@/lib/social/types";
import type { Json } from "@/lib/jobs/background-jobs";

export type SnapshotOperation = "instagram_insights" | "instagram_content" | "tiktok_videos" | "youtube_channel";
export type SnapshotAccount = { connectionId: string; lastSyncedAt?: string | null; status: string; message?: string | null; [key: string]: unknown };
type Row = { social_connection_id: string; authorization_revision: string; snapshot_json: SnapshotAccount;
  last_success_at: string | null; attempted_at: string; refresh_status: string; refresh_message: string | null };
type SnapshotDatabase = { public: {
  Tables: { analytics_account_snapshots: { Row: Row & { user_id: string; operation: string; range_days: number }; Insert: never; Update: never; Relationships: [] } };
  Views: Record<string, never>;
  Functions: { save_analytics_account_snapshot: { Args: { p_user_id: string; p_connection_id: string; p_operation: string; p_range_days: number; p_authorization_revision: string; p_account: Json; p_attempted_at: string }; Returns: boolean } };
} };
let client: ReturnType<typeof createClient<SnapshotDatabase>> | undefined;
function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Analytics snapshot storage is not configured.");
  return client = createClient<SnapshotDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readAccountSnapshots(params: { userId: string; operation: SnapshotOperation; days?: number; connections: SocialConnection[] }) {
  if (!params.connections.length) return [] as Row[];
  const { data, error } = await db().from("analytics_account_snapshots").select("*")
    .eq("user_id", params.userId).eq("operation", params.operation).eq("range_days", params.days ?? 0)
    .in("social_connection_id", params.connections.map(c => c.id));
  if (error) throw new Error(`Could not read saved analytics: ${error.message}`);
  return (data as Row[]).filter(row => params.connections.some(c => c.id === row.social_connection_id && (
    c.authorizationRevision ? getConnectionRevision(c) === row.authorization_revision : Date.parse(c.connectedAt) === Date.parse(row.authorization_revision)
  )));
}

export function snapshotRowAccount(row: Row): SnapshotAccount {
  return row.refresh_status !== "ready" && row.last_success_at ? {
    ...row.snapshot_json, message: `${row.refresh_message ?? "Refresh could not finish."} Showing saved analytics.`,
  } : row.snapshot_json;
}

export async function saveAccountSnapshots(params: {
  userId: string; operation: SnapshotOperation; days?: number; accounts: unknown[];
  connectionRevisions: Record<string, string>; attemptedAt: string;
}) {
  for (const value of params.accounts) {
    const account = value as SnapshotAccount;
    const revision = params.connectionRevisions[account.connectionId];
    if (!revision) continue;
    const { error } = await db().rpc("save_analytics_account_snapshot", {
      p_user_id: params.userId, p_connection_id: account.connectionId, p_operation: params.operation,
      p_range_days: params.days ?? 0, p_authorization_revision: revision,
      p_account: account as unknown as Json, p_attempted_at: params.attemptedAt,
    });
    if (error) throw new Error(`Could not preserve analytics snapshot: ${error.message}`);
  }
}
