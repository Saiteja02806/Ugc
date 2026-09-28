"use client";

import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Eye,
  Images,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  type LucideIcon,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { ProductLogoMark } from "@/components/brand/product-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type ScopeDetails = {
  description: string;
  icon: LucideIcon;
  title: string;
};

const SCOPE_DETAILS: Record<string, ScopeDetails> = {
  "account:read": {
    title: "Account and plan",
    description: "View your account ID, subscription status, and available credits.",
    icon: UserRound,
  },
  "brand:read": {
    title: "Brand profile",
    description: "View your business name, product summary, audience, and saved source URL.",
    icon: BriefcaseBusiness,
  },
  "assets:read": {
    title: "Creative library",
    description: "View media you uploaded or generated in UGC Pilot.",
    icon: Images,
  },
  "assets:write": {
    title: "Upload media",
    description: "Add reference images to your UGC Pilot creative library.",
    icon: Upload,
  },
  "generation:write": {
    title: "Create media",
    description: "Submit supported generation jobs using your available credits.",
    icon: Sparkles,
  },
  "jobs:read": {
    title: "Generation progress",
    description: "Check job status and retrieve completed results.",
    icon: Eye,
  },
};

export function OAuthConsent({
  clientName,
  redirectHost,
  scopes,
  authorizationParams,
}: {
  clientName: string;
  redirectHost: string;
  scopes: string[];
  authorizationParams: string;
}) {
  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getCurrentUserIdToken(user.uid);
      if (!token) throw new Error("Sign in again to connect.");
      const response = await fetch("/oauth/authorize/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ authorizationParams, approve }),
      });
      const result = (await response.json()) as { redirect_url?: string };
      if (!response.ok || !result.redirect_url) {
        throw new Error("Connection could not be completed. Try again.");
      }
      window.location.assign(result.redirect_url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Connection failed.",
      );
      setBusy(false);
    }
  }

  async function switchAccount() {
    if (busy || switchingAccount) return;
    setSwitchingAccount(true);
    setError(null);

    try {
      await signOut();
    } catch {
      setError("Could not sign out. Refresh the page and try again.");
    } finally {
      setSwitchingAccount(false);
    }
  }

  const accountLabel = user?.email ?? user?.displayName ?? "UGC Pilot account";
  const clientInitial = clientName.trim().charAt(0).toUpperCase() || "A";

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-4 sm:px-6 sm:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_38%),linear-gradient(to_bottom,color-mix(in_srgb,var(--card)_42%,transparent),transparent_48%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:40px_40px]"
      />

      <section
        aria-labelledby="oauth-consent-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[660px] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_28px_90px_rgb(0_0_0/0.24)] sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <ProductLogoMark className="size-9 rounded-[11px] bg-primary p-1.5 shadow-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground-strong">
                UGC Pilot
              </p>
              <p className="text-xs text-muted">Secure connection</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Permission request
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
          <div className="mx-auto flex max-w-[520px] items-center justify-center" aria-hidden="true">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-brand-soft shadow-sm sm:size-16">
              <ProductLogoMark className="size-10 rounded-xl bg-primary p-1.5 sm:size-11" />
            </div>
            <div className="relative mx-2 h-px w-16 bg-border sm:mx-4 sm:w-24">
              <span className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm">
                <ArrowRight className="size-3.5" />
              </span>
            </div>
            <div className="flex size-14 items-center justify-center rounded-2xl border border-border-strong bg-card-muted text-xl font-black text-foreground-strong shadow-sm sm:size-16 sm:text-2xl">
              {clientInitial}
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-[540px] text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Connect an app
            </p>
            <h1
              id="oauth-consent-title"
              className="mt-2 text-balance text-[1.75rem] font-bold leading-tight tracking-[-0.035em] text-foreground-strong [overflow-wrap:anywhere] sm:text-[2rem]"
            >
              Allow {clientName} to access UGC Pilot?
            </h1>
            <p className="mx-auto mt-3 max-w-[480px] text-sm leading-6 text-muted sm:text-[15px]">
              Review what this app can use before connecting your account.
            </p>
          </div>

          {user ? (
            <div className="mx-auto mt-6 flex max-w-[540px] items-center gap-3 rounded-2xl border border-border bg-card-muted/65 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                <BadgeCheck className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted">Signed in as</p>
                <p className="truncate text-sm font-semibold text-foreground-strong">
                  {accountLabel}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || switchingAccount}
                onClick={() => void switchAccount()}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
              >
                {switchingAccount ? "Switching…" : "Switch account"}
              </button>
            </div>
          ) : null}

          <div className="mx-auto mt-6 max-w-[540px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-foreground-strong">
                This app is requesting
              </h2>
              <span className="text-xs text-muted">
                {scopes.length} {scopes.length === 1 ? "permission" : "permissions"}
              </span>
            </div>

            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background/35">
              {scopes.map((scope) => {
                const details = SCOPE_DETAILS[scope] ?? {
                  title: "Additional access",
                  description: `Use the ${scope} permission.`,
                  icon: KeyRound,
                };
                const Icon = details.icon;

                return (
                  <li key={scope} className="flex gap-3 px-4 py-3.5 sm:px-5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-strong">
                        {details.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted sm:text-[13px]">
                        {details.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mx-auto mt-4 flex max-w-[540px] items-start gap-3 rounded-xl border border-border/80 bg-card-muted/45 px-3.5 py-3 text-xs leading-5 text-muted">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
            <p>
              After approval, you&apos;ll return to{" "}
              <span className="break-all font-mono font-semibold text-foreground">
                {redirectHost}
              </span>
              . Only continue if you started this connection.
            </p>
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-8 sm:py-5">
          <div className="mx-auto max-w-[540px]">
            {loading ? (
              <div
                className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Checking your UGC Pilot sign-in…
              </div>
            ) : !user ? (
              <div className="rounded-2xl border border-border bg-card-muted/45 p-4 sm:p-5">
                <div className="mb-4 text-center">
                  <p className="text-sm font-bold text-foreground-strong">
                    Sign in to review and approve
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Use the UGC Pilot account you want this app to access.
                  </p>
                </div>
                <GoogleSignInButton
                  label="Sign in with Google"
                  successPath={`/oauth/authorize?${authorizationParams}`}
                />
              </div>
            ) : !user.emailVerified ? (
              <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3.5 text-sm leading-6 text-foreground">
                Verify the email address for this UGC Pilot account, then return here to continue.
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  size="auth-compact"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void decide(false)}
                  className="w-full px-5 sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="auth-compact"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => void decide(true)}
                  className="w-full px-5 font-semibold shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_24%,transparent)] sm:w-auto"
                >
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  )}
                  {busy ? "Connecting…" : "Allow access"}
                </Button>
              </div>
            )}

            {error ? (
              <p
                className="mt-4 rounded-xl border border-error/25 bg-error/10 px-3.5 py-3 text-sm font-medium text-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
        </footer>
      </section>
    </main>
  );
}
