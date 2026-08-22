import { Check, Minus, Sparkles } from "lucide-react";

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
      className="overflow-x-hidden border-y border-border/80 bg-card-muted/30 py-16 text-foreground sm:py-20 backdrop-blur-xs"
    >
      <div className="mx-auto min-w-0 max-w-5xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            <span>Full Matrix</span>
          </div>
          <h2
            id="plan-comparison-title"
            className="mt-3 text-2xl font-black tracking-tight text-foreground-strong sm:text-3xl lg:text-4xl"
          >
            Compare plan features &amp; limits
          </h2>
          <p className="mt-2 text-sm font-medium text-muted sm:text-base">
            Detailed breakdown of daily ready-to-post drops, allowances, and tools included with each plan.
          </p>
        </div>

        <div className="mt-10 min-w-0 max-w-full overflow-hidden rounded-3xl border border-border/80 bg-card/85 shadow-md backdrop-blur-xl ring-1 ring-border/50">
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
                <tr className="border-b border-border/80 bg-card-muted/60 text-xs font-bold uppercase text-foreground">
                  <th scope="col" className="px-6 py-5">
                    Plan Detail
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.slug}
                      scope="col"
                      className={cn(
                        "px-4 py-5 text-center text-sm font-black tracking-tight",
                        plan.highlighted
                          ? "bg-primary/[0.08] text-primary"
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
                    className="px-6 py-4 font-semibold text-muted"
                  >
                    Monthly subscription
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-4 text-center font-mono font-bold tabular-nums text-foreground-strong",
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
                    className="px-6 py-4 font-semibold text-muted"
                  >
                    Annual subscription
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-4 text-center font-mono font-bold tabular-nums text-foreground-strong",
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
                    className="px-6 py-4 font-semibold text-muted"
                  >
                    Monthly AI generation credits
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-4 text-center font-mono font-black tabular-nums text-foreground-strong",
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
                    className="px-6 py-4 font-semibold text-muted"
                  >
                    Daily ready-to-post pieces
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-4 text-center font-bold text-foreground-strong",
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
                    className="px-6 py-4 font-semibold text-muted"
                  >
                    Connected Instagram accounts
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.slug}
                      className={cn(
                        "px-4 py-4 text-center font-bold text-foreground-strong",
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
                      className="px-6 py-4 font-medium leading-5 text-foreground-strong"
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
                            "px-4 py-4 text-center",
                            plan.highlighted ? "bg-primary/[0.04]" : "",
                          )}
                        >
                          {typeof val === "boolean" ? (
                            val ? (
                              <span
                                className="inline-flex justify-center"
                                aria-label="Included"
                              >
                                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
                                  <Check
                                    className="size-3 stroke-[3]"
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
                                  className="size-4 text-muted/30"
                                  aria-hidden="true"
                                />
                              </span>
                            )
                          ) : (
                            <span className="inline-block rounded-lg bg-card-muted px-2.5 py-1 text-xs font-bold text-foreground">
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
