"use client";

import { useEffect, useState } from "react";

import { PricingCard } from "@/components/pricing/pricing-card";
import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import {
  pricingPlans,
  type BillingInterval,
  parseBillingInterval,
} from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

type PricingCatalogProps = {
  initialBillingInterval: BillingInterval;
};

export function PricingCatalog({
  initialBillingInterval,
}: PricingCatalogProps) {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>(initialBillingInterval);
  const subscriptionQuery = useBillingSubscription();

  useEffect(() => {
    function syncBillingInterval() {
      const searchParams = new URLSearchParams(window.location.search);
      setBillingInterval(parseBillingInterval(searchParams.get("billing")));
    }

    window.addEventListener("popstate", syncBillingInterval);
    return () => window.removeEventListener("popstate", syncBillingInterval);
  }, []);

  function updateBillingInterval(nextInterval: BillingInterval) {
    const url = new URL(window.location.href);

    if (nextInterval === "yearly") {
      url.searchParams.set("billing", "yearly");
    } else {
      url.searchParams.delete("billing");
    }

    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setBillingInterval(nextInterval);
  }

  const isYearly = billingInterval === "yearly";

  return (
    <>
      {/* Segmented Billing Interval Switcher */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <div
          className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-xs"
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            aria-pressed={!isYearly}
            onClick={() => updateBillingInterval("monthly")}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
              !isYearly
                ? "bg-foreground text-background shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            aria-pressed={isYearly}
            onClick={() => updateBillingInterval("yearly")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
              isYearly
                ? "bg-foreground text-background shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            <span>Annual Billing</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                isYearly
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              Save 20%
            </span>
          </button>
        </div>
        <p className="text-center text-xs text-muted">
          All plans include full workflow access · Cancel or switch anytime
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div
        aria-label="Pricing plans"
        className="mx-auto mt-8 grid max-w-5xl items-stretch gap-5 lg:grid-cols-3"
      >
        {pricingPlans.map((plan) => (
          <PricingCard
            key={plan.slug}
            billingInterval={billingInterval}
            isSubscriptionLoading={subscriptionQuery.isPending}
            plan={plan}
            subscription={subscriptionQuery.data ?? null}
          />
        ))}
      </div>
    </>
  );
}
