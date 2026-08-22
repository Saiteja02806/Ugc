"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

export type BillingSubscription = {
  billingInterval: "monthly" | "yearly" | null;
  cancelAtPeriodEnd: boolean;
  connectedInstagramAccounts: number;
  creditsRemaining: number;
  creditsReserved: number;
  creditsUsed: number;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  dailyContentPieces: number | "Limited";
  displayName: "Free" | "Starter" | "Growth";
  instagramAccounts: number;
  isActive: boolean;
  planKey: "free" | "starter" | "growth";
  sharedMonthlyCredits: number;
  status:
    | "active"
    | "cancelled"
    | "expired"
    | "failed"
    | "free"
    | "on_hold"
    | "paused"
    | "pending";
  updatedAt: string | null;
  userId: string;
};

export function useBillingSubscription(options?: {
  activationPolling?: boolean;
}) {
  const { loading, user } = useAuth();

  return useQuery({
    enabled: !loading && Boolean(user),
    gcTime: 10 * 60 * 1_000,
    queryFn: fetchBillingSubscription,
    queryKey: ["billing-subscription", user?.uid ?? "signed-out"],
    refetchInterval: (query) =>
      options?.activationPolling && !query.state.data?.isActive ? 2_000 : false,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: options?.activationPolling ? 0 : 30_000,
  });
}

async function fetchBillingSubscription(): Promise<BillingSubscription> {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in to view billing details.");
  }

  const response = await fetch("/api/billing/subscription", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; subscription?: BillingSubscription }
    | null;

  if (!response.ok || !data?.subscription) {
    throw new Error(data?.error || "Could not load billing details.");
  }

  return data.subscription;
}
