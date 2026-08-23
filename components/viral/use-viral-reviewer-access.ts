"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ViralReviewerAccessState } from "@/lib/viral/reviewer-access";

type AccessResponse = {
  hasAccess?: unknown;
  ok?: unknown;
};

const VIRAL_REVIEWER_ACCESS_STALE_TIME_MS = 30 * 60 * 1_000;
const VIRAL_REVIEWER_ACCESS_GC_TIME_MS = 60 * 60 * 1_000;

export function useViralReviewerAccess({
  authorizedByParent = false,
}: {
  authorizedByParent?: boolean;
} = {}) {
  return useViralReviewerAccessQuery({ authorizedByParent }).accessState;
}

export function useViralReviewerAccessQuery({
  authorizedByParent = false,
}: {
  authorizedByParent?: boolean;
} = {}) {
  const { loading, user } = useAuth();
  const accessQuery = useQuery({
    enabled: !authorizedByParent && !loading && Boolean(user),
    gcTime: VIRAL_REVIEWER_ACCESS_GC_TIME_MS,
    queryFn: ({ signal }) => fetchViralReviewerAccess(signal),
    queryKey: ["viral-reviewer-access", user?.uid ?? "signed-out"],
    refetchOnWindowFocus: false,
    staleTime: VIRAL_REVIEWER_ACCESS_STALE_TIME_MS,
  });
  let accessState: ViralReviewerAccessState;

  if (authorizedByParent) {
    accessState = "reviewer";
  } else if (loading) {
    accessState = "checking";
  } else if (!user) {
    accessState = "locked";
  } else if (accessQuery.isPending) {
    accessState = "checking";
  } else if (accessQuery.isError) {
    accessState = "error";
  } else {
    accessState = accessQuery.data;
  }

  return {
    accessState,
    retryAccessCheck: accessQuery.refetch,
  };
}

async function fetchViralReviewerAccess(
  signal?: AbortSignal,
): Promise<Exclude<ViralReviewerAccessState, "checking" | "error">> {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Could not verify your sign-in session.");
  }

  const response = await fetch("/api/admin/viral/access", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = (await response.json().catch(() => null)) as
    | AccessResponse
    | null;

  if (response.status === 503) {
    return "unavailable";
  }

  if (response.status === 403) {
    return "locked";
  }

  if (!response.ok || data?.ok !== true) {
    throw new Error("Could not verify Explore access.");
  }

  return data.hasAccess === true ? "reviewer" : "locked";
}
