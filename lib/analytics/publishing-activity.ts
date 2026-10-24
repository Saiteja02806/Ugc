import "server-only";
import { createClient } from "@supabase/supabase-js";
import { buildInstagramActivitySummary, type InstagramActivityTarget } from "./instagram-activity";
import { listSocialConnections } from "@/lib/social/oauth";

type Target = InstagramActivityTarget & { postId: string };
export async function readPublishingActivity(userId: string, dateKeys: string[], offsetMinutes: number, connectionId: string) {
  const connections = (await listSocialConnections(userId)).filter(c => c.platform === "instagram" && (connectionId === "all" || c.id === connectionId));
  const empty = () => buildInstagramActivitySummary({ accountNames: new Map(), dateKeys, schedules: [], visibleConnectionIds: new Set(), offsetMinutes });
  if (!connections.length) return empty();
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const start = new Date(Date.parse(`${dateKeys[0]}T00:00:00Z`) + offsetMinutes * 60_000).toISOString();
  const end = new Date(Date.parse(`${dateKeys.at(-1)}T23:59:59.999Z`) + offsetMinutes * 60_000).toISOString();
  const targets: Target[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db.from("scheduled_post_targets")
      .select("id,scheduled_post_id,social_connection_id,status,platform_post_url,published_at,scheduled_for,updated_at,platform")
      .eq("user_id", userId).eq("platform", "instagram").in("social_connection_id", connections.map(c => c.id))
      .or(`and(published_at.gte.${start},published_at.lte.${end}),and(scheduled_for.gte.${start},scheduled_for.lte.${end}),and(updated_at.gte.${start},updated_at.lte.${end})`)
      .order("id").range(page * 500, page * 500 + 499);
    if (error) throw new Error("Could not load publishing activity.");
    for (const row of data ?? []) targets.push({ id: row.id, postId: row.scheduled_post_id, socialConnectionId: row.social_connection_id, status: row.status,
      platformPostUrl: row.platform_post_url, publishedAt: row.published_at, scheduledFor: row.scheduled_for, updatedAt: row.updated_at, platform: row.platform });
    if ((data?.length ?? 0) < 500) break;
  }
  const schedules = targets.map(target => ({ id: target.postId, title: "Scheduled post", targets: [target] }));
  const summary = buildInstagramActivitySummary({ accountNames: new Map(connections.map(c => [c.id, c.platformAccountName ?? c.platformAccountUsername])), dateKeys,
    schedules, visibleConnectionIds: new Set(connections.map(c => c.id)), offsetMinutes });
  const ids = [...new Set(summary.activityRows.map(row => row.id.split(":")[0]))];
  if (ids.length) {
    const { data, error } = await db.from("scheduled_posts").select("id,title").eq("user_id", userId).in("id", ids);
    if (error) throw new Error("Could not load publishing activity titles.");
    const titles = new Map((data ?? []).map(row => [row.id, row.title]));
    for (const row of summary.activityRows) row.title = titles.get(row.id.split(":")[0])?.trim() || "Scheduled post";
  }
  return summary;
}
