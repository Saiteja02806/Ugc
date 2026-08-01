"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { PublicBackgroundJob } from "./background-job-contract";

type JobResponse = { job: PublicBackgroundJob; ok: true };
type JobsResponse = { jobs: PublicBackgroundJob[]; ok: true };

const terminalStatuses = new Set(["cancelled", "completed", "failed"]);
const JOB_URL_CHANGE_EVENT = "ugc-background-job-url-change";

export function useActiveBackgroundJobs() {
  const { loading, user } = useAuth();

  return useQuery({
    enabled: !loading && Boolean(user),
    queryFn: () => fetchJobs("/api/jobs?status=active&limit=100"),
    queryKey: ["background-jobs", user?.uid, "active"],
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? 5_000 : 30_000,
  });
}

export function useBackgroundJob(jobId: string | null) {
  const { loading, user } = useAuth();

  return useQuery({
    enabled: !loading && Boolean(user && jobId),
    queryFn: () => fetchJob(`/api/jobs/${encodeURIComponent(jobId || "")}`),
    queryKey: ["background-jobs", user?.uid, jobId],
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      return status && terminalStatuses.has(status) ? false : 5_000;
    },
  });
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
    },
  });
}

export function persistJobIdInUrl(jobId: string | null) {
  const url = new URL(window.location.href);

  if (jobId) {
    url.searchParams.set("job", jobId);
  } else {
    url.searchParams.delete("job");
  }

  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(JOB_URL_CHANGE_EVENT));
}

export function getPersistedJobIdFromUrl() {
  return new URL(window.location.href).searchParams.get("job")?.trim() || null;
}

export function usePersistedJobIdFromUrl() {
  return useSyncExternalStore(
    subscribeToJobUrl,
    getPersistedJobIdFromUrl,
    () => null,
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

async function fetchJobs(url: string) {
  const response = await authenticatedFetch(url);
  const data = (await response.json()) as
    | JobsResponse
    | { error?: string; ok?: false };

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiError(data, "Could not load background jobs."));
  }

  return data.jobs;
}

async function fetchJob(url: string, init?: RequestInit) {
  const response = await authenticatedFetch(url, init);
  const data = (await response.json()) as
    | JobResponse
    | { error?: string; ok?: false };

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiError(data, "Could not update the background job."));
  }

  return data.job;
}

async function authenticatedFetch(url: string, init?: RequestInit) {
  const token = await getCurrentUserIdToken();

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
