import { Check } from "lucide-react";

import {
  formatPricingAmount,
  type PricingPlan,
} from "@/lib/pricing/plans";

type PricingComparisonProps = {
  plans: PricingPlan[];
};

const comparisonRows = [
  {
    label: "Monthly price",
    value: (plan: PricingPlan) => formatPricingAmount(plan.monthlyPrice),
  },
  {
    label: "Image credits",
    value: (plan: PricingPlan) => String(plan.imageCredits),
  },
  {
    label: "Video credits",
    value: (plan: PricingPlan) => String(plan.videoCredits),
  },
  {
    label: "Watermark-free exports",
    value: () => "Included",
  },
  {
    label: "Commercial usage",
    value: () => "Included",
  },
];

export function PricingComparison({ plans }: PricingComparisonProps) {
  return (
    <section
      aria-labelledby="plan-comparison-title"
      className="border-y border-border bg-card-muted text-foreground"
    >
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase text-primary">
              Plan comparison
            </p>
            <h2
              id="plan-comparison-title"
              className="mt-3 text-2xl font-bold leading-tight tracking-normal text-foreground-strong sm:text-3xl"
            >
              Compare monthly capacity.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-muted">
              Both plans include the same core workflow. Pro increases the
              monthly room for campaigns and creative variations.
            </p>
          </div>

          <div className="min-w-0 border-t border-border">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(72px,0.6fr)_minmax(72px,0.6fr)] border-b border-border py-3 text-xs font-semibold uppercase text-muted">
              <span>Included</span>
              {plans.map((plan) => (
                <span key={plan.slug} className="text-right">
                  {plan.name}
                </span>
              ))}
            </div>
            {comparisonRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(72px,0.6fr)_minmax(72px,0.6fr)] items-center border-b border-border py-3.5 text-sm"
              >
                <span className="pr-3 font-medium text-muted">
                  {row.label}
                </span>
                {plans.map((plan) => {
                  const value = row.value(plan);

                  return (
                    <span
                      key={plan.slug}
                      className="flex items-center justify-end gap-1.5 font-mono font-semibold tabular-nums text-foreground-strong"
                    >
                      {value === "Included" ? (
                        <Check className="size-4 text-success" aria-hidden="true" />
                      ) : null}
                      <span
                        className={
                          value === "Included" ? "sr-only sm:not-sr-only" : undefined
                        }
                      >
                        {value}
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
