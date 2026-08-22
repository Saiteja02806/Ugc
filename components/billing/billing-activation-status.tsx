"use client";

import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";

const ACTIVATION_WAIT_MS = 60_000;

export function BillingActivationStatus() {
  const subscriptionQuery = useBillingSubscription({ activationPolling: true });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setTimedOut(true), ACTIVATION_WAIT_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  if (subscriptionQuery.data?.isActive) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-foreground-strong">
          {subscriptionQuery.data.displayName} is active
        </h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          Your account has {subscriptionQuery.data.creditsRemaining} AI credits
          available this month.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/ai-studio" className={buttonVariants({ size: "lg" })}>
            Open AI Studio
          </Link>
          <Link
            href="/settings#subscription-billing"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            View billing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <LoaderCircle
        className="animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <h1 className="mt-5 text-2xl font-bold text-foreground-strong">
        Confirming your subscription
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        We are waiting for Dodo Payments to confirm the subscription. Access is
        enabled only after the signed payment webhook is verified.
      </p>

      {subscriptionQuery.isError || timedOut ? (
        <Alert className="mt-6 max-w-lg text-left" variant="default">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Activation is taking longer than expected</AlertTitle>
          <AlertDescription>
            Refresh this page in a moment. If payment completed, your account will
            activate automatically when the verified webhook arrives.
          </AlertDescription>
        </Alert>
      ) : null}

      <Link
        href="/settings#subscription-billing"
        className={buttonVariants({
          className: "mt-6",
          size: "lg",
          variant: "outline",
        })}
      >
        Go to settings
      </Link>
    </div>
  );
}
