"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";

export const BUSINESS_PROFILE_GATE_STALE_TIME_MS = 30 * 60 * 1_000;
export const BUSINESS_PROFILE_GATE_GC_TIME_MS = 60 * 60 * 1_000;

export type BusinessProfileGateResult = {
  onboardingComplete: boolean;
};

export function getBusinessProfileGateQueryKey(userId: string) {
  return ["business-profile-gate", userId] as const;
}

export async function fetchBusinessProfileGate(
  signal?: AbortSignal,
): Promise<BusinessProfileGateResult> {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Could not verify your sign-in session.");
  }

  const response = await fetch("/api/business-profile", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    ok?: boolean;
    profile?: { onboardingComplete?: boolean } | null;
  } | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message ?? "Could not verify your business profile.");
  }

  return {
    onboardingComplete: data.profile?.onboardingComplete === true,
  };
}
