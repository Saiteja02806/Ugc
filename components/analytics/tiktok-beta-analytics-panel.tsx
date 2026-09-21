"use client";

import { Eye, Heart, LoaderCircle, MessageCircle, RefreshCw, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type TikTokVideo = {
  commentCount: number | null;
  createdAt: string | null;
  id: string;
  likeCount: number | null;
  shareCount: number | null;
  shareUrl: string | null;
  title: string | null;
  viewCount: number | null;
};

type TikTokAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  status: "error" | "permission_missing" | "ready" | "unavailable";
  videos: TikTokVideo[];
};

export function TikTokBetaAnalyticsPanel() {
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in before viewing TikTok analytics.");
      const output = await runAnalyticsBackgroundSync({
        idempotencyKey: crypto.randomUUID(),
        token,
        url: "/api/analytics/tiktok/videos",
      });
      setAccounts(getAccounts(output));
      setHasRefreshed(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "TikTok analytics could not load right now.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">TikTok beta</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-foreground">Per-video analytics</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Views, likes, comments, and shares for up to 20 public videos. This uses the connected account&apos;s <code>video.list</code> permission only.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
          Refresh TikTok analytics
        </Button>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-control border border-error/25 bg-error/10 px-3 py-2 text-sm font-semibold text-error">{error}</p> : null}
      {!hasRefreshed && !error ? <p className="mt-4 text-sm font-medium text-muted">Connect TikTok in Settings, then refresh to load the account&apos;s public-video metrics.</p> : null}
      {hasRefreshed && accounts.length === 0 ? <p className="mt-4 text-sm font-medium text-muted">No TikTok account data is available yet.</p> : null}
      <div className="mt-5 grid gap-4">
        {accounts.map((account) => <div key={account.connectionId} className="overflow-hidden rounded-control border border-border bg-card-muted/45">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><p className="text-sm font-bold text-foreground">{account.accountUsername || account.accountName || "TikTok account"}</p><p className="mt-0.5 text-xs font-medium text-muted">{account.lastSyncedAt ? `Updated ${formatDate(account.lastSyncedAt)}` : "Not refreshed yet"}</p></div><span className={account.status === "ready" ? "text-xs font-bold text-success" : "text-xs font-bold text-error"}>{account.status === "ready" ? "Ready" : "Action needed"}</span></div>
          {account.message ? <p className="px-4 py-3 text-sm font-medium text-muted">{account.message}</p> : null}
          {account.videos.length > 0 ? <div className="divide-y divide-border">{account.videos.map((video) => <TikTokVideoRow key={video.id} video={video} />)}</div> : null}
        </div>)}
      </div>
    </section>
  );
}

function TikTokVideoRow({ video }: { video: TikTokVideo }) {
  const content = <><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{video.title || "TikTok video"}</p><p className="mt-1 text-xs font-medium text-muted">{video.createdAt ? formatDate(video.createdAt) : "Publication date unavailable"}</p></div><Metric icon={Eye} label="Views" value={video.viewCount} /><Metric icon={Heart} label="Likes" value={video.likeCount} /><Metric icon={MessageCircle} label="Comments" value={video.commentCount} /><Metric icon={Share2} label="Shares" value={video.shareCount} /></>;
  return video.shareUrl ? <a href={video.shareUrl} target="_blank" rel="noreferrer" className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition hover:bg-card">{content}</a> : <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">{content}</div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number | null }) {
  return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><Icon className="size-3.5" aria-hidden="true" />{value?.toLocaleString() ?? "—"}<span className="sr-only"> {label}</span></span>;
}

function getAccounts(value: unknown): TikTokAccount[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { accounts?: unknown }).accounts)) return [];
  return (value as { accounts: TikTokAccount[] }).accounts;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
