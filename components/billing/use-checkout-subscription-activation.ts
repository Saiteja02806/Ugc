"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  getBillingSubscriptionQueryKey,
  type BillingSubscription,
} from "@/components/billing/use-billing-subscription";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type CheckoutActivationResponse = {
  status: "active" | "pending" | "unavailable";
  subscription: BillingSubscription;
};

export function useCheckoutSubscriptionActivation(options?: {
  activationPolling?: boolean;
}) {
  const { loading, user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: !loading && Boolean(user),
    gcTime: 60_000,
    queryFn: confirmCheckoutActivation,
    queryKey: ["billing-checkout-activation", user?.uid ?? "signed-out"],
    refetchInterval: (currentQuery) =>
      options?.activationPolling &&
      currentQuery.state.data?.status === "pending"
        ? 2_000
        : false,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
  });

  useEffect(() => {
    const subscription = query.data?.subscription;

    if (!user || !subscription) {
      return;
    }

    const currentUser = user;
    const currentSubscription = subscription;
    let cancelled = false;
    const subscriptionQueryKey = getBillingSubscriptionQueryKey(currentUser.uid);

    async function syncSubscriptionCache() {
      // The regular subscription request starts at the same time as this
      // reconciliation request. Cancel it before publishing the verified
      // result so a slower stale response cannot overwrite Premium locally.
      if (currentSubscription.isActive) {
        await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });
      }

      if (cancelled) {
        return;
      }

      queryClient.setQueryData(subscriptionQueryKey, currentSubscription);

      if (currentSubscription.isActive) {
        void queryClient.invalidateQueries({
          queryKey: ["ai-studio-access", currentUser.uid],
        });
      }
    }

    void syncSubscriptionCache();

    return () => {
      cancelled = true;
    };
  }, [query.data?.subscription, queryClient, user]);

  return query;
}

async function confirmCheckoutActivation(): Promise<CheckoutActivationResponse> {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in to confirm your subscription.");
  }

  const response = await fetch("/api/billing/checkout/activate", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; status?: string; subscription?: BillingSubscription }
    | null;

  if (
    !response.ok ||
    !data?.subscription ||
    (data.status !== "active" &&
      data.status !== "pending" &&
      data.status !== "unavailable")
  ) {
    throw new Error(data?.error || "Could not confirm your subscription.");
  }

  return {
    status: data.status,
    subscription: data.subscription,
  };
}
