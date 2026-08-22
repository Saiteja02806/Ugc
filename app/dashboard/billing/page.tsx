import type { Metadata } from "next";

import { BillingActivationStatus } from "@/components/billing/billing-activation-status";

export const metadata: Metadata = {
  title: "Confirming subscription",
  description: "Confirm your UGC Pilot subscription activation.",
};

export default function DashboardBillingPage() {
  return (
    <section className="flex min-h-dvh min-w-0 flex-1 items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-2xl rounded-[var(--radius-panel)] border border-border bg-card p-7 shadow-card sm:p-10">
        <BillingActivationStatus />
      </div>
    </section>
  );
}
