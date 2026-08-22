"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type AccessResponse = {
  isPro?: unknown;
  message?: unknown;
  ok?: unknown;
};

const AI_STUDIO_ACCESS_STALE_TIME_MS = 5 * 60 * 1_000;
const AI_STUDIO_ACCESS_GC_TIME_MS = 30 * 60 * 1_000;

export function useAIStudioAccess() {
  const { loading, user } = useAuth();
  const accessQuery = useQuery({
    enabled: !loading && Boolean(user),
    gcTime: AI_STUDIO_ACCESS_GC_TIME_MS,
    queryFn: ({ signal }) => fetchAIStudioAccess(signal),
    queryKey: ["ai-studio-access", user?.uid ?? "signed-out"],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: AI_STUDIO_ACCESS_STALE_TIME_MS,
  });

  if (loading) {
    return "checking";
  }

  if (!user) {
    return "locked";
  }

  if (accessQuery.isPending) {
    return "checking";
  }

  if (accessQuery.isError) {
    return "error";
  }

  return accessQuery.data;
}

async function fetchAIStudioAccess(
  signal?: AbortSignal,
): Promise<Exclude<AIStudioAccessState, "checking" | "error">> {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Could not verify your sign-in session.");
  }

  const response = await fetch("/api/ai-studio/access", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
  const data = (await response.json().catch(() => null)) as
    | AccessResponse
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error("Could not verify AI Studio access.");
  }

  return data.isPro === true ? "pro" : "locked";
}
