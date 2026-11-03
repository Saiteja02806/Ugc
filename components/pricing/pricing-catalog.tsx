"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { PricingCard } from "@/components/pricing/pricing-card";
import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import {
  displayedPricingPlans,
  type BillingInterval,
  type PlanAllowanceView,
  parseBillingInterval,
} from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";
import styles from "./pricing-catalog.module.css";

type PricingCatalogProps = {
  initialBillingInterval: BillingInterval;
};

export function PricingCatalog({
  initialBillingInterval,
}: PricingCatalogProps) {
  const searchParams = useSearchParams();
  const [allowanceView, setAllowanceView] = useState<PlanAllowanceView>("hooks");
  const billingInterval = searchParams
    ? parseBillingInterval(searchParams.get("billing"))
    : initialBillingInterval;
  const subscriptionQuery = useBillingSubscription({ freshOnMount: true, refreshOnFocus: true });

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
  }

  const isYearly = billingInterval === "yearly";
  const allowanceOptions: Array<{ label: string; value: PlanAllowanceView }> = [
    { label: "3-second hooks", value: "hooks" },
    { label: "6-second videos", value: "full" },
    { label: "Credits", value: "credits" },
  ];

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
            aria-label="Monthly Billing"
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
            aria-label="Annual Billing"
            onClick={() => updateBillingInterval("yearly")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
              isYearly
                ? "bg-foreground text-background shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            <span>Annual<span className="hidden sm:inline"> Billing</span></span>
          </button>
        </div>
        <div
          className="mt-3 inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-xs"
          role="group"
          aria-label="Show plans as"
        >
          {allowanceOptions.map((option) => {
            const selected = allowanceView === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAllowanceView(option.value)}
                className={cn(
                  styles.allowanceButton,
                  "rounded-full px-2.5 py-1 text-[11px] leading-4 font-medium transition-all duration-150 cursor-pointer",
                  selected
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {subscriptionQuery.isError ? (
        <div
          role="alert"
          className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>Your billing details couldn&apos;t be loaded. Try again to continue.</p>
          <button
            type="button"
            onClick={() => void subscriptionQuery.refetch()}
            disabled={subscriptionQuery.isFetching}
            className="rounded-lg border border-border px-3 py-1.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
          >
            {subscriptionQuery.isFetching ? "Retrying…" : "Retry billing details"}
          </button>
        </div>
      ) : null}

      {/* Pricing Cards Grid */}
      <div
        role="group"
        aria-label="Pricing plans"
        className="mx-auto mt-8 grid max-w-5xl items-stretch gap-5 lg:grid-cols-3"
      >
        {displayedPricingPlans.map((plan) => (
          <PricingCard
            key={plan.slug}
            allowanceView={allowanceView}
            billingInterval={billingInterval}
            isSubscriptionError={subscriptionQuery.isError}
            isSubscriptionLoading={subscriptionQuery.isPending || subscriptionQuery.isFetching}
            plan={plan}
            subscription={subscriptionQuery.data ?? null}
          />
        ))}
      </div>
    </>
  );
}
