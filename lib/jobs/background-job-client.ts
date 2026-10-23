"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState, useSyncExternalStore } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { backgroundJobStaleTime, readCoveredBackgroundJob } from "./background-job-polling-policy";
import type { CanonicalBackgroundJobType, PublicBackgroundJob } from "./background-job-contract";

type JobResponse = { job: PublicBackgroundJob; ok: true };
type JobsResponse = { jobs: PublicBackgroundJob[]; ok: true };

const terminalStatuses = new Set(["cancelled", "completed", "failed"]);
const JOB_URL_CHANGE_EVENT = "ugc-background-job-url-change";

export function useActiveBackgroundJobs({ enabled = true, exploreFormat }: {
  enabled?: boolean;
  exploreFormat?: PublicBackgroundJob["exploreFormat"];
} = {}) {
  const { loading, user } = useAuth();

  return useQuery({
    enabled: enabled && !loading && Boolean(user),
    queryFn: ({ signal }) => fetchJobs(`/api/jobs?status=active&limit=100${exploreFormat ? `&exploreFormat=${exploreFormat}` : ""}`, user?.uid, signal),
    queryKey: ["background-jobs", user?.uid, "active", ...(exploreFormat ? [exploreFormat] : [])],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? 5_000 : 30_000,
  });
}

/** Discover account-owned workflow tasks even when this browser has no saved ID. */
export function useRecoverableWorkflowJobs(
  knownJobIds: readonly string[],
  {
    enabled,
    exploreFormat,
    jobType,
  }: {
    enabled: boolean;
    exploreFormat: PublicBackgroundJob["exploreFormat"];
    jobType: CanonicalBackgroundJobType;
  },
) {
  const { loading, user } = useAuth();
  const recoveryEnabled = enabled && Boolean(exploreFormat) && !loading && Boolean(user);
  const accountJobs = useActiveBackgroundJobs({ enabled: recoveryEnabled, exploreFormat });
  const ownerKey = `${user?.uid ?? "signed-out"}:${exploreFormat ?? ""}:${jobType}`;
  const [recovered, setRecovered] = useState<{
    ownerKey: string;
    ids: string[];
    source: PublicBackgroundJob[] | undefined;
  }>({ ownerKey: "", ids: [], source: undefined });
  const matchingJobs = recoveryEnabled
    ? (accountJobs.data ?? []).filter(job => job.jobType === jobType && job.exploreFormat === exploreFormat)
    : [];

  // Retain discovered IDs when they leave the active list, so their final
  // status and output are still retrieved by the individual job queries.
  // Adjust only when the account/scope or query snapshot changes.
  if (recoveryEnabled && (recovered.ownerKey !== ownerKey || recovered.source !== accountJobs.data)) {
    setRecovered({
      ownerKey,
      source: accountJobs.data,
      ids: Array.from(new Set([
        ...(recovered.ownerKey === ownerKey ? recovered.ids : []),
        ...matchingJobs.map(job => job.id),
      ])),
    });
  }

  const ids = Array.from(new Set([
    ...knownJobIds,
    // Keep the same observers/cache when a mounted panel becomes inactive.
    // Only reads stop; discovered IDs must still recover on reactivation.
    ...(recovered.ownerKey === ownerKey ? recovered.ids : []),
    ...matchingJobs.map(job => job.id),
  ]));
  return {
    // Standalone AI Studio has no Explore format but still reads known IDs.
    queries: useBackgroundJobs(ids, { enabled, reuseActiveList: true }),
    recovering: recoveryEnabled && (accountJobs.isPending || (accountJobs.isFetching && !accountJobs.isFetchedAfterMount)),
    recoveryError: recoveryEnabled && accountJobs.isError ? "Could not check ongoing generations. Refresh to try again." : null,
  };
}

/** Read browser hints independently of media-history requests. */
export function useStoredBackgroundJobIds(storageKey: string | null) {
  const getSnapshot = useCallback(() => {
    try {
      return storageKey ? window.localStorage.getItem(storageKey) : null;
    } catch {
      return null;
    }
  }, [storageKey]);
  const getServerSnapshot = useCallback(() => null, []);
  const rawValue = useSyncExternalStore(subscribeToJobStorage, getSnapshot, getServerSnapshot);
  if (!rawValue) return [];
  try {
    const parsed: unknown = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [rawValue];
  }
}

function subscribeToJobStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  // Accepted submissions save browser metadata before updating the job URL.
  window.addEventListener(JOB_URL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(JOB_URL_CHANGE_EVENT, onStoreChange);
  };
}

export function useBackgroundJob(jobId: string | null) {
  const { loading, user } = useAuth();

  return useQuery({
    enabled: !loading && Boolean(user && jobId),
    queryFn: ({ signal }) => fetchJob(`/api/jobs/${encodeURIComponent(jobId || "")}`, { signal }, user?.uid),
    queryKey: ["background-jobs", user?.uid, jobId],
    staleTime: backgroundJobStaleTime,
    refetchOnWindowFocus: query => !terminalStatuses.has(query.state.data?.status ?? ""),
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      return status && terminalStatuses.has(status) ? false : 5_000;
    },
  });
}

export function useBackgroundJobs(jobIds: readonly string[], { enabled = true, reuseActiveList = false }: { enabled?: boolean; reuseActiveList?: boolean } = {}) {
  const { loading, user } = useAuth();
  const queryClient = useQueryClient();

  const queries = useQueries({
    queries: jobIds.map((jobId) => ({
      enabled: enabled && !loading && Boolean(user && jobId),
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        if (reuseActiveList) {
          const current = queryClient.getQueryState<PublicBackgroundJob>(["background-jobs", user?.uid, jobId]);
          const covered = readCoveredBackgroundJob(queryClient, { ownerId: user?.uid, jobId, currentJob: current?.data, invalidated: current?.isInvalidated });
          if (covered) return Promise.resolve(covered);
        }
        return fetchJob(`/api/jobs/${encodeURIComponent(jobId)}`, { signal }, user?.uid);
      },
      queryKey: ["background-jobs", user?.uid, jobId],
      staleTime: backgroundJobStaleTime,
      refetchOnWindowFocus: (query: { state: { data?: PublicBackgroundJob } }) => !terminalStatuses.has(query.state.data?.status ?? ""),
      refetchInterval: (query: {
        state: { data?: PublicBackgroundJob };
      }) => {
        const status = query.state.data?.status;

        if (status && terminalStatuses.has(status)) {
          if (reuseActiveList) {
            // Another tab may retry the same ID after this observer stopped.
            // Use a fresh list only as a reason to recheck; the query function
            // still verifies ordering/conflicts before reusing that receipt.
            const listed = readCoveredBackgroundJob(queryClient, { ownerId: user?.uid, jobId });
            const currentTime = Date.parse(query.state.data!.updatedAt);
            if (listed && !terminalStatuses.has(listed.status) &&
                (!Number.isFinite(currentTime) || Date.parse(listed.updatedAt) >= currentTime)) return 5_000;
          }
          return false;
        }
        return 5_000;
      },
    })),
  });
  if (!reuseActiveList) return queries;
  return queries.map((query, index) => ({ ...query,
    // An explicit Check status must reach the server even if automatic polling
    // can reuse a recent list receipt. Direct consumers retain their old behavior.
    refetch: async (options?: Parameters<typeof query.refetch>[0]) => {
      await queryClient.invalidateQueries({ queryKey: ["background-jobs", user?.uid, jobIds[index]], exact: true, refetchType: "none" });
      return query.refetch(options);
    },
  }));
}

export function useCancelBackgroundJob() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) =>
      fetchJob(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: "POST",
      }),
    onSuccess: (job) => {
      queryClient.setQueryData(
        ["background-jobs", user?.uid, job.id],
        job,
      );
      void queryClient.invalidateQueries({
        queryKey: ["background-jobs", user?.uid, "active"],
      });
    },
  });
}

export function useRetryBackgroundJob() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) =>
      fetchJob(`/api/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
      }),
    onSuccess: (job) => {
      queryClient.setQueryData(
        ["background-jobs", user?.uid, job.id],
        job,
      );
      void queryClient.invalidateQueries({
        queryKey: ["background-jobs", user?.uid, "active"],
      });
      if (user) {
        void queryClient.invalidateQueries({
          queryKey: ["billing-subscription", user.uid],
        });
      }
    },
  });
}

export function persistJobIdInUrl(
  jobId: string | null,
  parameterName = "job",
) {
  const url = new URL(window.location.href);

  if (jobId) {
    url.searchParams.set(parameterName, jobId);
  } else {
    url.searchParams.delete(parameterName);
  }

  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(JOB_URL_CHANGE_EVENT));
}

export function getPersistedJobIdFromUrl(parameterName = "job") {
  return (
    new URL(window.location.href).searchParams.get(parameterName)?.trim() || null
  );
}

export function usePersistedJobIdFromUrl(parameterName = "job") {
  const getSnapshot = useCallback(
    () => getPersistedJobIdFromUrl(parameterName),
    [parameterName],
  );
  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(
    subscribeToJobUrl,
    getSnapshot,
    getServerSnapshot,
  );
}

function subscribeToJobUrl(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(JOB_URL_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(JOB_URL_CHANGE_EVENT, onStoreChange);
  };
}

async function fetchJobs(url: string, ownerId?: string, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const response = await authenticatedFetch(url, { signal: bounded }, ownerId);
    const data = (await response.json()) as
      | JobsResponse
      | { error?: string; ok?: false };

    if (!response.ok || data.ok !== true) {
      throw new Error(getApiError(data, "Could not load background jobs."));
    }

    return data.jobs;
  }, signal);
}

async function fetchJob(url: string, init?: RequestInit, ownerId?: string) {
  const read = async (signal?: AbortSignal) => {
    const response = await authenticatedFetch(url, { ...init, signal }, ownerId);
    const data = (await response.json()) as
      | JobResponse
      | { error?: string; ok?: false };

    if (!response.ok || data.ok !== true) {
      throw new Error(getApiError(data, "Could not update the background job."));
    }

    return data.job;
  };
  // Cancellation/retry remain deliberate mutations, never automatic read retries.
  return init?.method === "POST" ? read(init.signal ?? undefined) : withReadDeadline(read, init?.signal ?? undefined);
}

async function authenticatedFetch(url: string, init?: RequestInit, ownerId?: string) {
  const token = await getCurrentUserIdToken(ownerId);
  init?.signal?.throwIfAborted();

  if (!token) {
    throw new Error("Sign in to view background jobs.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers,
  });
}

function getApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}
