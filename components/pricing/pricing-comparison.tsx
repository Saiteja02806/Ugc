import { Check } from "lucide-react";

import {
  formatPricingAmount,
  type PricingPlan,
} from "@/lib/pricing/plans";

type PricingComparisonProps = {
  plans: PricingPlan[];
};

const includedRows = [
  "Trending format discovery",
  "AI image and short-video creation",
  "Creative editor and asset library",
  "Scheduling and performance analytics",
];

export function PricingComparison({ plans }: PricingComparisonProps) {
  return (
    <section
      aria-labelledby="plan-comparison-title"
      className="border-y border-border bg-card-muted text-foreground"
    >
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase text-foreground">
            Plan comparison
          </p>
          <h2
            id="plan-comparison-title"
            className="mt-2 text-2xl font-bold leading-tight tracking-normal text-foreground-strong sm:text-3xl"
          >
            Same workflow, different generation capacity
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-muted">
            Both plans cover the full content workflow. Choose Pro when you
            need more room for campaign volume and creative variations.
          </p>
        </div>

        <div className="mt-7 overflow-hidden rounded-card border border-border bg-card">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Creator and Pro price, credit, and feature comparison
            </caption>
            <colgroup>
              <col className="w-1/2" />
              <col className="w-1/4" />
              <col className="w-1/4" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-card-muted text-xs font-bold uppercase text-foreground">
                <th scope="col" className="px-3 py-3.5 sm:px-5">
                  Plan detail
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.slug}
                    scope="col"
                    className="px-2 py-3.5 text-right sm:px-5"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              <tr>
                <th
                  scope="row"
                  className="px-3 py-3.5 font-medium text-muted sm:px-5"
                >
                  Monthly subscription
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.slug}
                    className="px-2 py-3.5 text-right font-mono font-semibold tabular-nums text-foreground-strong sm:px-5"
                  >
                    {formatPricingAmount(plan.prices.monthly)}/mo
                  </td>
                ))}
              </tr>
              <tr>
                <th
                  scope="row"
                  className="px-3 py-3.5 font-medium text-muted sm:px-5"
                >
                  Annual subscription
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.slug}
                    className="px-2 py-3.5 text-right font-mono font-semibold tabular-nums text-foreground-strong sm:px-5"
                  >
                    {formatPricingAmount(plan.prices.yearly)}/yr
                  </td>
                ))}
              </tr>
              <tr>
                <th
                  scope="row"
                  className="px-3 py-3.5 font-medium text-muted sm:px-5"
                >
                  Shared credits refreshed monthly
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.slug}
                    className="px-2 py-3.5 text-right font-mono font-semibold tabular-nums text-foreground-strong sm:px-5"
                  >
                    {plan.sharedMonthlyCredits}
                  </td>
                ))}
              </tr>
              {includedRows.map((label) => (
                <tr key={label}>
                  <th
                    scope="row"
                    className="px-3 py-3.5 font-medium leading-5 text-muted sm:px-5"
                  >
                    {label}
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.slug} className="px-2 py-3.5 sm:px-5">
                      <span className="flex justify-end">
                        <Check
                          className="size-4 text-success"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Included</span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
