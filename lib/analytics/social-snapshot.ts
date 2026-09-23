import "server-only";

import { enqueueAnalyticsSyncJob } from "@/lib/analytics/jobs";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { listBackgroundJobsForUser } from "@/lib/jobs/background-jobs";
import { listSocialConnections } from "@/lib/social/oauth";
import { selectSocialSnapshot } from "@/lib/analytics/social-snapshot-policy";

// Reuse durable, owner-scoped completed job outputs. No provider request is
// needed to display the last result, even after a browser reload.
export async function readOrRefreshSocialAnalytics(params: {
  userId: string;
  operation: "tiktok_videos" | "youtube_channel";
  force: boolean;
}) {
  const scope = { userId: params.userId, jobType: "analytics_sync" as const,
    projectId: `${params.operation}:current` };
  const [completed, active, connections] = await Promise.all([
    listBackgroundJobsForUser({ ...scope, completedOnly: true, limit: 5 }),
    listBackgroundJobsForUser({ ...scope, activeOnly: true, limit: 1 }),
    listSocialConnections(params.userId),
  ]);
  const platform = params.operation === "youtube_channel" ? "youtube" : "tiktok";
  const current = connections.filter((connection) => connection.platform === platform);
  const snapshot = selectSocialSnapshot(completed, current);
  if (current.length === 0) return { ok: true as const, data: { accounts: [] } };
  const ttl = params.force ? 30_000 : 5 * 60_000;
  if (snapshot && Date.now() - snapshot.savedAt < ttl) {
    return { ok: true as const, data: snapshot.data };
  }
  try {
    // Active work is shared across tabs/refreshes. A new refresh is scoped to
    // the last snapshot and connection generation, not a random browser ID.
    const connectionGeneration = Math.max(...current.map((c) => Date.parse(c.connectedAt)));
    const currentJob = active.find((job) => Date.parse(job.createdAt) >= connectionGeneration);
    const job = currentJob ?? await enqueueAnalyticsSyncJob({
      ...params,
      idempotencyKey: `${snapshot?.savedAt ?? "initial"}:${current.map((c) => `${c.id}:${c.connectedAt}`).sort().join("|")}:${Math.floor(Date.now() / 30_000)}`,
    });
    return { ok: true as const, ...(snapshot ? { data: snapshot.data } : {}),
      job: getPublicBackgroundJob(job), jobId: job.id, refreshing: job.status !== "completed" };
  } catch (error) {
    if (!snapshot) throw error;
    return { ok: true as const, data: snapshot.data,
      warning: "Saved analytics are shown. The refresh could not start; please try again shortly." };
  }
}
