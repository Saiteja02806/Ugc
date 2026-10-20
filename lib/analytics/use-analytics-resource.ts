"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { PublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { useAnalyticsDisplayTiming } from "./use-analytics-display-timing";

type Snapshot<T> = { data?: T; needsRefresh: boolean; refreshKey: string; warning?: string };
type Start<T> = { data?: T; job?: PublicBackgroundJob; jobId?: string; warning?: string };
const terminal = new Set(["cancelled", "completed", "failed"]);
const JOB_WAIT_MS = 15 * 60_000;
function subscribeVisibility(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
const isVisible = () => document.visibilityState !== "hidden";
function expired(job: PublicBackgroundJob | undefined) {
  return Boolean(job && !terminal.has(job.status) && Date.now() - Date.parse(job.createdAt) >= JOB_WAIT_MS);
}

export async function analyticsRequest<T>(url: string, owner: string, signal: AbortSignal, body?: object): Promise<T> {
  const token = await getCurrentUserIdToken(owner);
  signal.throwIfAborted();
  if (!token) throw new Error("Sign in before viewing analytics.");
  const response = await fetch(url, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error(result?.message ?? "Could not load analytics. Please try again.");
  return result as T;
}

/** Snapshot reads never wait for provider synchronization or dispatch. */
export function useAnalyticsResource<T>(params: {
  owner: string; platform: string; revision: string; url: string;
  days?: 7 | 30 | 90; enabled: boolean; refreshRequest: number; staleTime: number;
}) {
  const client = useQueryClient();
  const visible = useSyncExternalStore(subscribeVisibility, isVisible, () => true);
  const [consumerId] = useState(() => crypto.randomUUID());
  const { owner, platform, url, days, revision, refreshRequest } = params;
  const key = useMemo(() => ["account", owner, "analytics", platform, url, days ?? 0, revision], [owner, platform, url, days, revision]);
  const active = Boolean(owner && params.enabled);
  const scope = JSON.stringify(key);
  const [manual, setManual] = useState<{ request: number; scope: string | null }>({ request: refreshRequest, scope: null });
  const previousRequest = useRef(refreshRequest);
  // A counter is an event for the currently visible resource. Do not replay a
  // previous Refresh click after remounting or changing range/authorization.
  useEffect(() => {
    if (previousRequest.current === refreshRequest) return;
    previousRequest.current = refreshRequest;
    // Commit the request event before changing the external query observer.
    setManual({ request: refreshRequest, scope: active ? scope : null });
  }, [refreshRequest, active, scope]);
  const force = manual.request === refreshRequest && manual.scope === scope;
  const snapshot = useQuery({
    queryKey: key, enabled: active, staleTime: params.staleTime, gcTime: 30 * 60_000,
    retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => analyticsRequest<Snapshot<T>>(`${url}${days ? `?days=${days}` : ""}`, owner, signal),
  });
  const refreshKey = useMemo(() => [...key, "refresh", force ? `manual:${consumerId}:${refreshRequest}` : snapshot.data?.refreshKey ?? "initial"], [key, force, refreshRequest, consumerId, snapshot.data?.refreshKey]);
  const refresh = useQuery({
    queryKey: refreshKey,
    enabled: active && visible && Boolean(snapshot.data && (snapshot.data.needsRefresh || force)),
    staleTime: Infinity, gcTime: 30 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => analyticsRequest<Start<T>>(url, owner, signal, { ...(days ? { days } : {}), force }),
  });
  const jobId = refresh.data?.jobId;
  const initialJob = refresh.data?.job;
  const jobKey = useMemo(() => ["account", owner, "analytics-job", jobId], [owner, jobId]);
  const job = useQuery({
    queryKey: jobKey,
    enabled: active && visible && Boolean(jobId && initialJob && !terminal.has(initialJob.status) && !expired(initialJob)),
    initialData: initialJob, staleTime: 0, retry: false, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => (await analyticsRequest<{ job: PublicBackgroundJob }>(`/api/jobs/${encodeURIComponent(jobId!)}`, owner, signal)).job,
    refetchInterval: (query) => {
      if (query.state.data && (terminal.has(query.state.data.status) || expired(query.state.data))) return false;
      return query.state.status === "error" ? Math.min(30_000, 2_000 * 2 ** Math.min(query.state.fetchFailureCount, 4)) : 2_000;
    },
  });
  const currentJob = job.data ?? initialJob;
  const jobStatus = currentJob?.status;
  // A completed job has already persisted its account snapshots. Reading the
  // authoritative snapshot avoids replaying an old completed job over newer data.
  useEffect(() => {
    if (jobStatus === "completed") void client.invalidateQueries({ queryKey: key, exact: true });
  }, [client, key, jobId, jobStatus]);
  useEffect(() => {
    if (active) return;
    void client.cancelQueries({ queryKey: key, exact: true });
    void client.cancelQueries({ queryKey: refreshKey, exact: true });
    void client.cancelQueries({ queryKey: jobKey, exact: true });
  }, [active, client, key, refreshKey, jobKey]);
  useEffect(() => {
    if (!visible) {
      void client.cancelQueries({ queryKey: refreshKey, exact: true });
      void client.cancelQueries({ queryKey: jobKey, exact: true });
    }
  }, [visible, client, refreshKey, jobKey]);
  const failed = currentJob && ["failed", "cancelled"].includes(currentJob.status);
  const timedOut = expired(currentJob);
  const waiting = Boolean(currentJob && !terminal.has(currentJob.status) && !job.isError && !timedOut);
  const output = snapshot.data?.data ?? refresh.data?.data;
  const accounts = (output as { accounts?: { status?: string }[] } | undefined)?.accounts;
  useAnalyticsDisplayTiming("snapshot", JSON.stringify(key), active, Boolean(accounts?.some(account => account.status === "ready")));
  return {
    output,
    error: snapshot.error?.message ?? refresh.error?.message ?? job.error?.message ??
      (timedOut ? "Analytics is taking longer than expected. Saved data remains available while the sync continues." : null) ??
      (failed ? currentJob.error?.message ?? "Analytics refresh could not finish. Saved data is still shown." : null) ??
      refresh.data?.warning ?? snapshot.data?.warning ?? null,
    loading: active && output === undefined && (snapshot.isFetching || refresh.isFetching || waiting),
    refreshing: active && (snapshot.isFetching || refresh.isFetching || waiting),
    refetch: snapshot.refetch,
  };
}
