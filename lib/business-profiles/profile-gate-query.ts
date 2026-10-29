"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { ReadDeadlineError, withReadDeadline } from "@/lib/http/read-deadline";

export const BUSINESS_PROFILE_GATE_STALE_TIME_MS = 30 * 60 * 1_000;
export const BUSINESS_PROFILE_GATE_GC_TIME_MS = 60 * 60 * 1_000;

export type BusinessProfileGateResult = {
  onboardingComplete: boolean;
};

export class BusinessProfileGateError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "BusinessProfileGateError";
  }
}

export function canRetainBusinessProfileGate(data: BusinessProfileGateResult | undefined, error: unknown) {
  return data?.onboardingComplete === true && (
    error instanceof ReadDeadlineError ||
    (error instanceof BusinessProfileGateError && (error.status === 429 || error.status >= 500))
  );
}

export function getBusinessProfileGateQueryKey(userId: string) {
  return ["business-profile-gate", userId] as const;
}

export async function fetchBusinessProfileGate(
  ownerId: string,
  signal?: AbortSignal,
): Promise<BusinessProfileGateResult> {
  return withReadDeadline(async bounded => {
  const token = await getCurrentUserIdToken(ownerId);
  bounded.throwIfAborted();

  if (!token) {
    throw new Error("Could not verify your sign-in session.");
  }

  const response = await fetch("/api/business-profile", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal: bounded,
  }).catch(error => {
    bounded.throwIfAborted();
    if (error instanceof TypeError) throw new BusinessProfileGateError("Check your connection, then try again.", 503);
    throw error;
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    ok?: boolean;
    profile?: { onboardingComplete?: boolean } | null;
  } | null;

  if (!response.ok || !data?.ok) {
    throw new BusinessProfileGateError(data?.message ?? "Could not verify your business profile.", response.ok ? 502 : response.status);
  }

  return {
    onboardingComplete: data.profile?.onboardingComplete === true,
  };
  }, signal);
}
