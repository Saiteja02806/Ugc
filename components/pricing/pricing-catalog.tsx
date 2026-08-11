"use client";

import { useEffect, useState } from "react";

import { PricingCard } from "@/components/pricing/pricing-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  pricingPlans,
  type BillingInterval,
  parseBillingInterval,
} from "@/lib/pricing/plans";

type PricingCatalogProps = {
  initialBillingInterval: BillingInterval;
};

export function PricingCatalog({
  initialBillingInterval,
}: PricingCatalogProps) {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>(initialBillingInterval);

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

  return (
    <>
      <div className="mt-7 flex flex-col items-center gap-2.5">
        <ToggleGroup
          aria-label="Billing interval"
          value={[billingInterval]}
          onValueChange={(value) => {
            const nextInterval = value[0] as BillingInterval | undefined;

            if (nextInterval) {
              updateBillingInterval(nextInterval);
            }
          }}
          spacing={1}
          className="grid w-full max-w-sm grid-cols-2 rounded-card border border-border bg-card-muted p-1"
        >
          <ToggleGroupItem
            value="monthly"
            className="h-10 rounded-small px-3 text-sm font-semibold text-muted hover:bg-card/70 hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground-strong aria-pressed:shadow-card"
          >
            Monthly
          </ToggleGroupItem>
          <ToggleGroupItem
            value="yearly"
            className="h-10 rounded-small px-3 text-sm font-semibold text-muted hover:bg-card/70 hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground-strong aria-pressed:shadow-card"
          >
            Yearly
            <span className="text-xs font-bold text-success">2 months free</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-center text-xs font-medium text-muted">
          Generation credits refresh monthly on both billing options.
        </p>
      </div>

      <div
        aria-label="Pricing plans"
        className="mt-7 grid items-stretch gap-5 md:grid-cols-2"
      >
        {pricingPlans.map((plan) => (
          <PricingCard
            key={plan.slug}
            billingInterval={billingInterval}
            plan={plan}
          />
        ))}
      </div>
    </>
  );
}
