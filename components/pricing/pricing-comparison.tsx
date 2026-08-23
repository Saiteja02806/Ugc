import { Check, Minus } from "lucide-react";

import {
  formatPricingAmount,
  type PricingPlan,
} from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

type PricingComparisonProps = {
  plans: PricingPlan[];
};

type FeatureRow = {
  free: string | boolean;
  growth: string | boolean;
  label: string;
  starter: string | boolean;
};

const featureMatrix: FeatureRow[] = [
  {
    label: "Proven viral format discovery",
    free: true,
    starter: true,
    growth: true,
  },
  {
    label: "Reel hooks, Wall-text & Carousels",
    free: false,
    starter: true,
    growth: true,
  },
  {
    label: "Product asset editor & library",
    free: "Preview only",
    starter: true,
    growth: true,
  },
  {
    label: "1-Click Instagram scheduling",
    free: false,
    starter: true,
    growth: true,
  },
  {
    label: "Performance & reach analytics",
    free: false,
    starter: "Advanced",
    growth: "Advanced",
  },
  {
    label: "Priority generation queues",
    free: false,
    starter: false,
    growth: true,
  },
];

export function PricingComparison({ plans }: PricingComparisonProps) {
  return (
    <section
      aria-labelledby="plan-comparison-title"
      className="overflow-x-hidden border-y border-border/80 bg-card-muted/30 py-14 text-foreground sm:py-16"
    >
      <div className="mx-auto min-w-0 max-w-5xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Feature Comparison
          </p>
          <h2
            id="plan-comparison-title"
            className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-3xl"
          >
            Compare plan features &amp; limits
          </h2>
          <p className="mt-2 text-sm font-normal text-muted">
            Detailed breakdown of daily ready-to-post drops, allowances, and tools included with each plan.
          </p>
        </div>

        <div className="mt-8 min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[620px] table-fixed border-collapse text-left">
              <caption className="sr-only">
                Free, Starter, and Growth price, credit, and feature comparison
              </caption>
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-card-muted/60 text-xs font-semibold uppercase text-foreground">
                  <th scope="col" className="px-5 py-4">
                    Plan Detail
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.slug}
                      scope="col"
                      className={cn(
                        "px-4 py-4 text-center text-sm font-semibold tracking-tight",
                        plan.highlighted
                          ? "bg-primary/[0.06] text-primary"
                          : "text-foreground-strong",
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                <tr className="hover:bg-card-muted/30 transition-colors">
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-normal text-muted"
                  >
                    Monthly subscription
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-3.5 text-center font-mono text-xs font-semibold tabular-nums text-foreground-strong",
                        plan.highlighted ? "bg-primary/[0.04]" : "",
                      )}
                    >
                      {plan.prices.monthly === 0
                        ? "Free"
                        : `${formatPricingAmount(plan.prices.monthly)}/mo`}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-card-muted/30 transition-colors">
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-normal text-muted"
                  >
                    Annual subscription
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-3.5 text-center font-mono text-xs font-semibold tabular-nums text-foreground-strong",
                        plan.highlighted ? "bg-primary/[0.04]" : "",
                      )}
                    >
                      {plan.prices.yearly === 0
                        ? "Free"
                        : `${formatPricingAmount(plan.prices.yearly)}/yr`}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-card-muted/30 transition-colors">
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-normal text-muted"
                  >
                    Monthly AI generation credits
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-3.5 text-center font-mono text-xs font-semibold tabular-nums text-foreground-strong",
                        plan.highlighted ? "bg-primary/[0.04] text-primary" : "",
                      )}
                    >
                      {plan.sharedMonthlyCredits}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-card-muted/30 transition-colors">
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-normal text-muted"
                  >
                    Daily ready-to-post pieces
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-3.5 text-center text-xs font-medium text-foreground-strong",
                        plan.highlighted ? "bg-primary/[0.04] text-primary" : "",
                      )}
                    >
                      {typeof plan.dailyContentPieces === "number"
                        ? `${plan.dailyContentPieces} / day`
                        : plan.dailyContentPieces}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-card-muted/30 transition-colors">
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-normal text-muted"
                  >
                    Connected Instagram accounts
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-3.5 text-center text-xs font-medium text-foreground-strong",
                        plan.highlighted ? "bg-primary/[0.04]" : "",
                      )}
                    >
                      {plan.instagramAccounts === 0
                        ? "—"
                        : plan.instagramAccounts}
                    </td>
                  ))}
                </tr>
                {featureMatrix.map((row) => (
                  <tr key={row.label} className="hover:bg-card-muted/30 transition-colors">
                    <th
                      scope="row"
                      className="px-5 py-3 text-xs font-normal text-foreground"
                    >
                      {row.label}
                    </th>
                    {plans.map((plan) => {
                      const val =
                        plan.slug === "free"
                          ? row.free
                          : plan.slug === "starter"
                            ? row.starter
                            : row.growth;

                      return (
                        <td
                          key={plan.slug}
                          className={cn(
                            "px-4 py-3 text-center",
                            plan.highlighted ? "bg-primary/[0.04]" : "",
                          )}
                        >
                          {typeof val === "boolean" ? (
                            val ? (
                              <span
                                className="inline-flex justify-center"
                                aria-label="Included"
                              >
                                <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <Check
                                    className="size-2.5 stroke-[3]"
                                    aria-hidden="true"
                                  />
                                </span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex justify-center"
                                aria-label="Not included"
                              >
                                <Minus
                                  className="size-3.5 text-muted/30"
                                  aria-hidden="true"
                                />
                              </span>
                            )
                          ) : (
                            <span className="inline-block rounded-md bg-card-muted px-2 py-0.5 text-xs font-medium text-foreground">
                              {val}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
