import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectedAccountsWorkspace } from "@/components/social/connected-accounts-workspace";

export const metadata: Metadata = {
  title: "Connected Accounts",
  description: "Connect TikTok, Instagram, and YouTube accounts for publishing.",
};

export default function ConnectedAccountsPage() {
  return (
    <AuthGuard>
      <AppShell activeKey="connected-accounts">
        <Suspense fallback={<ConnectedAccountsFallback />}>
          <ConnectedAccountsWorkspace />
        </Suspense>
      </AppShell>
    </AuthGuard>
  );
}

function ConnectedAccountsFallback() {
  return (
    <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="h-24 animate-pulse rounded-lg bg-card-muted" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="h-56 animate-pulse rounded-lg bg-card-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-card-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-card-muted" />
        </div>
      </div>
    </section>
  );
}
