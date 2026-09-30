import { CreditCard, ShieldCheck, Zap } from "lucide-react";

import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";

export function LandingBottomCta({
  initialHasSession,
}: {
  initialHasSession: boolean;
}) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-[1200px] rounded-[28px] border border-border bg-card px-6 py-12 text-center sm:px-10 sm:py-16">
        <p className="text-sm font-semibold text-primary">From your next idea to your next post</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
          More time for your business.<br />
          Your content, ready to go.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
          Create, review, and schedule from one workspace.
          You stay in control of every post.
        </p>
        <div className="mt-7 flex justify-center">
          <LandingAuthCta
            className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            initialHasSession={initialHasSession}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-amber-500" aria-hidden="true" />
            2-minute setup
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="size-3.5 text-primary" aria-hidden="true" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
            Human approval before publishing
          </span>
        </div>
      </div>
    </section>
  );
}
