"use client";

import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Mail,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { buttonClassName } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const platformAccessItems = [
  "TikTok publishing permission",
  "Instagram professional account access",
  "YouTube channel upload authorization",
];

export function SettingsWorkspace() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutError("Could not sign out. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "UGC Pilot user";
  const email = user?.email || "No email available";

  return (
    <section className="min-h-dvh flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7 xl:px-10">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
              <Settings2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">
                Account controls
              </p>
              <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground-strong sm:text-[32px]">
                Profile & settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Manage account access, connected publishing accounts, data
                requests, and your current session from one place.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            Signed-in workspace
          </span>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SettingsPanel
            icon={<UserRound className="size-5" aria-hidden="true" />}
            title="Account"
            description="Your current UGC Pilot session and sign-in details."
          >
            <div className="rounded-lg border border-border bg-card-muted/45 p-4">
              <p className="text-sm font-semibold text-foreground-strong">
                {displayName}
              </p>
              <p className="mt-1 text-sm text-muted">{email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill
                  checked={user?.emailVerified === true}
                  label={
                    user?.emailVerified === true
                      ? "Email verified"
                      : "Email not verified"
                  }
                />
                {user?.providerIds?.map((providerId) => (
                  <span
                    key={providerId}
                    className="inline-flex rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted"
                  >
                    {getProviderLabel(providerId)}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className={buttonClassName({
                  className: "gap-2",
                  variant: "secondary",
                })}
              >
                {isSigningOut ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <LogOut className="size-4" aria-hidden="true" />
                )}
                Sign out
              </button>
              {signOutError ? (
                <p role="alert" className="mt-3 text-sm font-semibold text-error">
                  {signOutError}
                </p>
              ) : null}
            </div>
          </SettingsPanel>

          <SettingsPanel
            icon={<ExternalLink className="size-5" aria-hidden="true" />}
            title="Connected account access"
            description="Review or remove social accounts used for publishing."
          >
            <ul className="space-y-2 text-sm leading-6 text-muted">
              {platformAccessItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-1 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/connected-accounts"
              className={buttonClassName({
                className: "mt-5 w-fit gap-2",
                variant: "primary",
              })}
            >
              Manage connected accounts
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </SettingsPanel>

          <SettingsPanel
            icon={<Trash2 className="size-5" aria-hidden="true" />}
            title="Account data"
            description="Use these controls for deletion requests and platform review."
            className="lg:col-span-2"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card-muted/45 p-4">
                <p className="text-sm font-semibold text-foreground-strong">
                  Delete connected account data
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Disconnect a social account to revoke publishing access in UGC
                  Pilot. Published posts must still be removed on the original
                  platform.
                </p>
                <Link
                  href="/connected-accounts"
                  className={buttonClassName({
                    className: "mt-4 w-fit gap-2",
                    variant: "secondary",
                  })}
                >
                  Open Accounts
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="rounded-lg border border-error/20 bg-error/5 p-4">
                <p className="text-sm font-semibold text-foreground-strong">
                  Delete account and data
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Send a deletion request to privacy support. Include the email
                  address on this account so we can verify the request.
                </p>
                <a
                  href="mailto:privacy@getugcpilot.com?subject=Delete%20UGC%20Pilot%20account%20and%20data"
                  className={buttonClassName({
                    className: "mt-4 w-fit gap-2",
                    variant: "secondary",
                  })}
                >
                  <Mail className="size-4" aria-hidden="true" />
                  Request account deletion
                </a>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted">
              Public deletion instructions remain available at{" "}
              <Link href="/data-deletion" className="font-semibold text-primary">
                Data Deletion
              </Link>
              .
            </p>
          </SettingsPanel>
        </div>
      </div>
    </section>
  );
}

function SettingsPanel({
  children,
  className,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-[0_12px_28px_rgb(24_24_27_/_0.04)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-card-muted text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground-strong">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function StatusPill({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        checked
          ? "border-success/20 bg-success/10 text-success"
          : "border-warning/20 bg-warning/10 text-warning",
      )}
    >
      {label}
    </span>
  );
}

function getProviderLabel(providerId: string) {
  if (providerId === "google.com") return "Google sign-in";
  if (providerId === "password") return "Email sign-in";
  return providerId;
}
