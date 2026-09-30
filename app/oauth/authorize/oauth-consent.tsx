"use client";

import {
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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { RedirectDestination } from "@/lib/mcp/client-validation";

import { ConsentBrandMark } from "./consent-brand-mark";

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
    title: "Manage media",
    description: "Upload reference media and delete media you select in UGC Pilot.",
    icon: Upload,
  },
  "generation:write": {
    title: "Generate images",
    description: "Create images using credits available in your UGC Pilot plan.",
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
  redirectDestination,
  scopes,
  authorizationParams,
}: {
  clientName: string;
  redirectHost: string;
  redirectDestination: RedirectDestination;
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
  const redirectTitle = redirectDestination === "chatgpt"
    ? "Return to ChatGPT"
    : redirectDestination === "claude"
      ? "Return to Claude"
      : redirectDestination === "loopback"
        ? "Return to the app on this device"
        : `Return to ${redirectHost}`;
  const redirectDescription = redirectDestination === "chatgpt"
    ? "After approval, this browser will return securely to ChatGPT."
    : redirectDestination === "claude"
      ? "After approval, this browser will return securely to Claude."
      : redirectDestination === "loopback"
        ? "This local address returns control to the desktop or command-line app that started the connection. Keep that app open."
        : "After approval, this browser will return to the requesting app.";

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
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[640px] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_28px_90px_rgb(0_0_0/0.24)] sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <ConsentBrandMark className="size-9 rounded-[11px] shadow-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground-strong">
                UGC Pilot
              </p>
              <p className="text-xs text-muted">Secure connection</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-success">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Secure OAuth
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
          <div className="mx-auto max-w-[540px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card-muted/70 px-2.5 py-1.5 text-xs font-semibold text-foreground-strong">
              <ConsentBrandMark className="size-5 rounded-md" />
              <span>UGC Pilot</span>
              <span aria-hidden="true" className="text-muted-subtle">/</span>
              <span className="max-w-52 truncate" translate="no">{clientName}</span>
            </div>
            <h1
              id="oauth-consent-title"
              className="mt-4 text-balance text-[1.7rem] font-bold leading-tight tracking-[-0.035em] text-foreground-strong [overflow-wrap:anywhere] sm:text-[1.9rem]"
            >
              Review what {clientName} can access
            </h1>
            <p className="mt-2 max-w-[510px] text-sm leading-6 text-muted sm:text-[15px]">
              Only the permissions shown below will be granted to this connection.
            </p>
          </div>

          {user ? (
            <div className="mx-auto mt-5 flex max-w-[540px] items-center gap-3 rounded-2xl border border-border bg-card-muted/65 px-4 py-3">
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
                className="min-h-11 shrink-0 touch-manipulation rounded-md px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
              >
                {switchingAccount ? "Switching…" : "Switch account"}
              </button>
            </div>
          ) : null}

          <div className="mx-auto mt-5 max-w-[540px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-foreground-strong">
                Requested permissions
              </h2>
              <span className="shrink-0 text-xs text-muted">
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
            <p className="mt-3 text-xs leading-5 text-muted">
              If {clientName} needs another permission later, you will review a separate request before it is granted.
            </p>
          </div>

          <div className="mx-auto mt-4 flex max-w-[540px] items-start gap-3 rounded-xl border border-border/80 bg-card-muted/45 px-3.5 py-3 text-xs leading-5 text-muted">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {redirectTitle}
              </p>
              <p className="mt-0.5">
                {redirectDescription}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] font-semibold text-muted-subtle" translate="no">
                {redirectDestination === "loopback" ? "Local callback" : "Callback"}: {redirectHost}
              </p>
              <p className="mt-1 text-muted-subtle">
                Your password and payment details are not shared with {clientName}. Only continue if you started this connection.
              </p>
              <p className="mt-2 text-muted-subtle">
                <a
                  className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary-hover focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  href="https://getugcpilot.com/privacy"
                  rel="noreferrer"
                  target="_blank"
                >
                  Privacy Policy
                </a>
                <span aria-hidden="true"> · </span>
                <a
                  className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary-hover focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  href="https://getugcpilot.com/terms"
                  rel="noreferrer"
                  target="_blank"
                >
                  Terms of Service
                </a>
              </p>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-3.5 sm:px-8 sm:py-4">
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
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  size="auth-compact"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void decide(false)}
                  className="min-h-11 w-full touch-manipulation px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="auth-compact"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => void decide(true)}
                  className="min-h-11 w-full touch-manipulation px-4 font-semibold shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_24%,transparent)]"
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
