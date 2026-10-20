import "server-only";
import { listSocialConnections } from "@/lib/social/oauth";
import { getConnectionRevision, getConnectionsRevision } from "@/lib/social/connection-revision";
import { getInstagramAccountInsightsSnapshotForOwner, getInstagramContentSnapshotForOwner } from "./instagram-snapshots";
import { listBackgroundJobsForUser } from "@/lib/jobs/background-jobs";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { enqueueAnalyticsSyncJob } from "./jobs";
import { selectSocialSnapshot } from "./social-snapshot-policy";
import { readAccountSnapshots, snapshotRowAccount, type SnapshotOperation } from "./snapshot-store";
import { getUniqueInstagramConnections } from "./instagram-insights";
import { getInstagramAnalyticsRangeStart } from "./instagram-freshness";

export async function readAnalyticsSnapshot(params: { userId: string; operation: SnapshotOperation; days?: 7 | 30 | 90 }) {
  const platform = params.operation.startsWith("instagram") ? "instagram" : params.operation === "tiktok_videos" ? "tiktok" : "youtube";
  const storedConnections = await listSocialConnections(params.userId);
  const connections = platform === "instagram" ? getUniqueInstagramConnections(storedConnections) : storedConnections.filter(c => c.platform === platform);
  const rows = await readAccountSnapshots({ ...params, connections });
  const byConnection = new Map(rows.map(row => [row.social_connection_id, snapshotRowAccount(row)]));
  let legacyNeedsRefresh = false;
  // Legacy results are usable only until that connection first reauthorizes.
  const legacyConnections = connections.filter(c => !c.authorizationRevision && !byConnection.has(c.id));
  if (legacyConnections.length) {
    let legacy: { accounts: unknown[]; needsRefresh?: boolean };
    if (params.operation === "instagram_insights" || params.operation === "instagram_content") {
      legacy = await (params.operation === "instagram_insights" ? getInstagramAccountInsightsSnapshotForOwner : getInstagramContentSnapshotForOwner)({ userId: params.userId, days: params.days ?? 30 });
    } else {
      const jobs = await listBackgroundJobsForUser({ userId: params.userId, jobType: "analytics_sync", projectId: `${params.operation}:current`, completedOnly: true, limit: 100 });
      const selected = selectSocialSnapshot(jobs, legacyConnections);
      legacy = { accounts: selected?.data.accounts ?? [], needsRefresh: !selected || Date.now() - selected.savedAt > 5 * 60_000 };
    }
    legacyNeedsRefresh = legacy.needsRefresh ?? false;
    for (const value of legacy.accounts) {
      const account = value as { connectionId: string };
      if (legacyConnections.some(c => c.id === account.connectionId)) byConnection.set(account.connectionId, value as ReturnType<typeof snapshotRowAccount>);
    }
  }
  const ttl = params.operation.startsWith("instagram") ? 60 * 60_000 : 5 * 60_000;
  const needsRefresh = connections.length > 0 && (legacyNeedsRefresh || connections.some(c => {
    const row = rows.find(r => r.social_connection_id === c.id);
    if (!row) return !byConnection.has(c.id);
    // Failed attempts have a cooldown without marking old metrics fresh.
    return Date.now() - Date.parse(row.attempted_at) >= (row.refresh_status === "ready" ? ttl : 60_000);
  }));
  const accounts = [...byConnection.values()].map(account => {
    if (params.operation !== "instagram_content" || !Array.isArray(account.items)) return account;
    const since = getInstagramAnalyticsRangeStart(params.days ?? 30).getTime();
    return { ...account, items: account.items.filter(item => item && typeof item === "object" && "publishedAt" in item && Date.parse(String(item.publishedAt)) >= since) };
  });
  return {
    ok: true as const, data: { accounts, ...(params.days ? { days: params.days } : {}), operation: params.operation },
    ...(rows.some(row => row.refresh_status !== "ready" && row.last_success_at) ? { warning: "Some accounts could not refresh. Showing their last saved analytics." } : {}),
    needsRefresh,
    lastAttemptAt: rows.length ? Math.max(...rows.map(r => Date.parse(r.attempted_at))) : 0,
    refreshKey: `${getConnectionsRevision(connections)}:${rows.map(r => r.attempted_at).sort().join("|") || "legacy"}:${Math.floor(Date.now() / ttl)}`,
    connections,
  };
}

export async function refreshAnalyticsSnapshot(params: { userId: string; operation: SnapshotOperation; days?: 7 | 30 | 90; force: boolean }) {
  const snapshot = await readAnalyticsSnapshot(params);
  if (!snapshot.connections.length || (!params.force && !snapshot.needsRefresh) ||
    (params.force && Date.now() - snapshot.lastAttemptAt < 30_000)) return publicSnapshot(snapshot);
  const scope = `${params.operation}:${params.days ? `${params.days}d` : "current"}`;
  const revisions = Object.fromEntries(snapshot.connections.map(c => [c.id, getConnectionRevision(c)]));
  const refreshStarted = performance.now();
  try {
    const active = await listBackgroundJobsForUser({ userId: params.userId, jobType: "analytics_sync", projectId: scope, activeOnly: true, limit: 10 });
    const activeReadAt = performance.now();
    const job = active.find(job => {
      const input = job.input && typeof job.input === "object" && !Array.isArray(job.input) ? job.input : {};
      const expected = input.connectionRevisions;
      return expected && typeof expected === "object" && !Array.isArray(expected) &&
        Object.keys(revisions).length === Object.keys(expected).length &&
        Object.entries(revisions).every(([id, revision]) => expected[id] === revision);
    }) ?? await enqueueAnalyticsSyncJob({
      ...params, force: params.force || snapshot.connections.some(c => Boolean(c.authorizationRevision) && !snapshot.data.accounts.some(a => a.connectionId === c.id && a.status === "ready" && a.lastSyncedAt)),
      connectionRevisions: revisions,
      idempotencyKey: `${getConnectionsRevision(snapshot.connections)}:${Math.floor(Date.now() / 30_000)}`,
    });
    console.info("analytics_refresh_timing", { operation: params.operation, activeLookupMs: Math.round(activeReadAt-refreshStarted), dispatchMs: Math.round(performance.now()-activeReadAt) });
    return { ...publicSnapshot(snapshot), job: getPublicBackgroundJob(job), jobId: job.id, refreshing: job.status !== "completed" };
  } catch (error) {
    if (!snapshot.data.accounts.length) throw error;
    return { ...publicSnapshot(snapshot), warning: "Saved analytics are shown. The refresh could not start; please try again shortly." };
  }
}

export function publicSnapshot(snapshot: Awaited<ReturnType<typeof readAnalyticsSnapshot>>) {
  const { connections: _connections, lastAttemptAt: _lastAttemptAt, ...result } = snapshot;
  void _connections;
  void _lastAttemptAt;
  return result;
}
