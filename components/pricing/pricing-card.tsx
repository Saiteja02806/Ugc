"use client";

import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CirclePlay,
} from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanSlug, PricingPlan } from "@/lib/pricing/plans";

type PricingCardProps = {
  onSelectPlan?: (plan: PlanSlug) => void;
  plan: PricingPlan;
};

export function PricingCard({ onSelectPlan, plan }: PricingCardProps) {
  const canSelectPlan = Boolean(onSelectPlan);

  return (
    <article
      className={cn(
        "relative flex h-full min-h-[620px] flex-col rounded-[var(--radius-panel)] border bg-card p-5 shadow-card transition duration-200 sm:p-6",
        plan.highlighted
          ? "border-primary/35 shadow-[0_18px_44px_rgb(201_71_22_/_0.12)]"
          : "border-border",
      )}
    >
      <div className="flex min-h-8 items-start justify-between gap-3">
        <PricingBadge visible={Boolean(plan.highlighted)}>
          Most Popular
        </PricingBadge>
      </div>

      <div className="mt-5">
        <h2 className="text-2xl font-black leading-tight tracking-normal text-foreground-strong">
          {plan.name}
        </h2>
        <p className="mt-3 min-h-12 text-sm font-medium leading-6 text-muted">
          {plan.description}
        </p>
      </div>

      <div className="mt-6 flex items-end gap-2">
        <span className="text-5xl font-black leading-none tracking-normal text-foreground-strong">
          ${plan.monthlyPrice}
        </span>
        <span className="pb-1.5 text-sm font-bold text-muted">
          {plan.billingText}
        </span>
      </div>

      <div className="mt-7 grid gap-3">
        <PricingCreditRow
          icon="image"
          label="Image Generation Credits"
          value={plan.imageCredits}
        />
        <PricingCreditRow
          icon="video"
          label="Video Generation Credits"
          value={plan.videoCredits}
        />
      </div>

      <div className="my-7 border-t border-border" />

      <PricingFeatureList features={plan.features} />

      <div className="mt-auto pt-8">
        {/* TODO: Wire this through onSelectPlan when Dodo checkout routes are added. */}
        <button
          type="button"
          disabled={!canSelectPlan}
          onClick={() => onSelectPlan?.(plan.slug)}
          className={buttonClassName({
            className: cn(
              "h-12 w-full gap-2 rounded-control text-sm",
              plan.highlighted
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "border-border-strong bg-card-muted text-foreground hover:bg-card",
              "disabled:cursor-default disabled:opacity-100",
            ),
          })}
        >
          {plan.buttonLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function PricingBadge({
  children,
  visible,
}: {
  children: string;
  visible: boolean;
}) {
  if (!visible) {
    return <span className="min-h-8" aria-hidden="true" />;
  }

  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-brand-soft px-3 text-xs font-black text-primary">
      <BadgeCheck className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

export function PricingCreditRow({
  icon,
  label,
  value,
}: {
  icon: "image" | "video";
  label: string;
  value: number;
}) {
  const Icon = icon === "image" ? Camera : CirclePlay;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-control border border-border bg-surface-subtle px-3 py-3">
      <span className="flex size-10 items-center justify-center rounded-control bg-card text-primary shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 text-sm font-bold leading-5 text-foreground-strong">
        {label}
      </span>
      <span className="rounded-small border border-border bg-card px-2.5 py-1 text-sm font-black tabular-nums text-foreground-strong">
        {value}
      </span>
    </div>
  );
}

export function PricingFeatureList({ features }: { features: string[] }) {
  return (
    <ul className="grid gap-3">
      {features.map((feature) => (
        <li key={feature} className="flex gap-3 text-sm font-semibold leading-6 text-foreground">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-success"
            aria-hidden="true"
          />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
