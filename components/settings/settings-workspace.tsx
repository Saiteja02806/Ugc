"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Images,
  LoaderCircle,
  LogOut,
  Mail,
  Moon,
  Palette,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { InstagramAccountManager } from "@/components/settings/instagram-account-manager";
import { CarouselAdminSettings } from "@/components/settings/carousel-admin-settings";
import { AppScreenshotsSettings } from "@/components/settings/app-screenshots-settings";
import { useTheme } from "@/components/providers/theme-provider";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useBillingSubscription } from "@/components/billing/use-billing-subscription";

export function SettingsWorkspace() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { locked: themeLocked, setTheme, theme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const subscriptionQuery = useBillingSubscription();
  const subscription = subscriptionQuery.data;

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutError("Could not sign out. Check your connection and try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleOpenBillingPortal() {
    setIsOpeningBilling(true);
    setBillingError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again before opening billing.");
      }

      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; portalUrl?: string }
        | null;

      if (!response.ok || !data?.portalUrl) {
        throw new Error(data?.error || "Could not open the billing portal.");
      }

      window.location.assign(data.portalUrl);
    } catch (error) {
      setIsOpeningBilling(false);
      setBillingError(
        error instanceof Error
          ? error.message
          : "Could not open the billing portal.",
      );
    }
  }

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "UGC Pilot user";
  const email = user?.email || "No email available";
  const initials = getInitials(displayName, email);

  return (
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="border-b border-border pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Workspace settings
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted sm:text-base">
            Manage your account, Instagram publishing access, and privacy from
            one place.
          </p>
        </header>

        <div className="mt-6 flex flex-col gap-5">
          <SettingsSection
            description="Your identity, sign-in method, and current session."
            icon={<UserRound className="size-5" aria-hidden="true" />}
            title="Account & session"
          >
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground-strong">
                    {displayName}
                  </p>
                  <p className="mt-0.5 break-all text-sm text-muted">{email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      variant={
                        user?.emailVerified === true
                          ? "outline"
                          : "destructive"
                      }
                    >
                      {user?.emailVerified === true ? (
                        <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                      ) : null}
                      {user?.emailVerified === true
                        ? "Email verified"
                        : "Email not verified"}
                    </Badge>
                    {user?.providerIds?.map((providerId) => (
                      <Badge
                        key={providerId}
                        variant="secondary"
                        className="max-w-full"
                        title={providerId}
                      >
                        <span className="truncate">
                          {getProviderLabel(providerId)}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-sm font-bold text-foreground-strong">
                  Current session
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Sign out of UGC Pilot on this device.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="w-full sm:w-auto"
              >
                {isSigningOut ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <LogOut data-icon="inline-start" aria-hidden="true" />
                )}
                {isSigningOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>

            {signOutError ? (
              <div className="px-5 pb-5 sm:px-6">
                <Alert variant="destructive" aria-live="polite">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Sign-out failed</AlertTitle>
                  <AlertDescription>{signOutError}</AlertDescription>
                </Alert>
              </div>
            ) : null}
          </SettingsSection>

          <SettingsSection
            id="subscription-billing"
            description="Manage your current plan, monthly generation credits, and billing interval."
            icon={<CreditCard className="size-5" aria-hidden="true" />}
            title="Subscription & billing"
            accent
          >
            <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                    <Sparkles className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-foreground-strong">
                        {subscription ? `${subscription.displayName} Plan` : "Loading plan"}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-bold",
                          subscription?.isActive
                            ? "text-success border-success/30"
                            : "text-muted border-border",
                        )}
                      >
                        {subscription?.isActive
                          ? subscription.cancelAtPeriodEnd
                            ? "Cancels at period end"
                            : "Active"
                          : subscription?.status === "on_hold"
                            ? "Payment required"
                            : "Free tier"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {subscription?.isActive
                        ? `Your ${subscription.displayName} subscription includes ${subscription.dailyContentPieces} daily drops and ${subscription.sharedMonthlyCredits} monthly AI credits.`
                        : "Free includes 10 daily ready-to-post concepts and no AI generation credits."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {subscription?.isActive ? (
                    <Button
                      type="button"
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={() => void handleOpenBillingPortal()}
                      disabled={isOpeningBilling}
                    >
                      {isOpeningBilling ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <CreditCard data-icon="inline-start" aria-hidden="true" />
                      )}
                      {isOpeningBilling ? "Opening billing" : "Manage billing"}
                    </Button>
                  ) : (
                    <Link
                      href="/pricing"
                      className={buttonVariants({
                        variant: "default",
                        size: "lg",
                        className: "w-full sm:w-auto font-semibold",
                      })}
                    >
                      <span>Upgrade plan</span>
                      <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>

              {billingError ? (
                <Alert variant="destructive" aria-live="polite">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Billing portal unavailable</AlertTitle>
                  <AlertDescription>{billingError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
                <div className="py-4 sm:pr-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-subtle">
                    AI credits remaining
                  </p>
                  <p className="mt-1 text-lg font-black text-foreground-strong font-mono">
                    {subscription?.creditsRemaining ?? 0}{" "}
                    <span className="text-xs font-normal text-muted">/ {subscription?.sharedMonthlyCredits ?? 0}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {subscription?.creditsUsed ?? 0} used this month
                  </p>
                </div>

                <div className="border-t border-border py-4 sm:border-t-0 sm:px-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-subtle">
                    Daily Drops
                  </p>
                  <p className="mt-1 text-lg font-black text-foreground-strong font-mono">
                    {subscription ? subscription.dailyContentPieces : "Limited"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">Up to 50 daily on Growth</p>
                </div>

                <div className="border-t border-border py-4 sm:border-t-0 sm:pl-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-subtle">
                    Connected Accounts
                  </p>
                  <p className="mt-1 text-lg font-black text-foreground-strong font-mono">
                    {subscription?.connectedInstagramAccounts ?? 0}{" "}
                    <span className="text-xs font-normal text-muted">
                      / {subscription?.instagramAccounts ?? 0} allowed
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">Up to 3 on Growth</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs font-medium text-muted">
                Need higher generation volume, custom brand models, or team seats?
              </p>
              <Link
                href="/pricing"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-xs font-semibold text-primary hover:text-primary-hover",
                })}
              >
                View all plan comparison matrix →
              </Link>
            </div>
          </SettingsSection>

          <SettingsSection
            description="Choose how UGC Pilot looks on this device. New users always start in light mode."
            icon={<Palette className="size-5" aria-hidden="true" />}
            title="Appearance"
          >
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
                  {theme === "light" ? (
                    <Sun className="size-5" aria-hidden="true" />
                  ) : (
                    <Moon className="size-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground-strong">
                      {theme === "light" ? "Light theme" : "Dark theme"}
                    </p>
                    <Badge variant="secondary">
                      {themeLocked ? "Theme locked" : "Saved on this device"}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                    {themeLocked
                      ? "Theme switching is locked on this environment."
                      : "Your choice overrides the product default and is applied before the page appears."}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                disabled={themeLocked}
                className="w-full sm:w-auto"
              >
                {theme === "light" ? (
                  <Moon data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <Sun data-icon="inline-start" aria-hidden="true" />
                )}
                {themeLocked
                  ? "Theme locked"
                  : `Use ${theme === "light" ? "dark" : "light"} theme`}
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="app-screenshots"
            description="Keep real product screens ready for Structure 2 carousels."
            icon={<Images className="size-5" aria-hidden="true" />}
            title="App screenshots"
          >
            <AppScreenshotsSettings />
          </SettingsSection>

          <SettingsSection
            id="instagram-publishing"
            description="The real Instagram account available for scheduled publishing."
            icon={
              <SocialPlatformIcon
                className="size-5"
                platform="instagram"
              />
            }
            title="Instagram publishing"
            accent
          >
            <InstagramAccountManager />
          </SettingsSection>

          <CarouselAdminSettings />

          <SettingsSection
            description="Review privacy information and request changes to your data."
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            title="Privacy & data"
          >
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-sm font-bold text-foreground-strong">
                  Privacy controls
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                  Review how UGC Pilot handles account information and the
                  public instructions for requesting data deletion.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Link
                  href="/privacy"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                  })}
                >
                  Privacy policy
                </Link>
                <Link
                  href="/data-deletion"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                  })}
                >
                  Deletion instructions
                </Link>
              </div>
            </div>

            <Separator />

            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-error/20 bg-error/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-error/10 text-error">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground-strong">
                      Request account deletion
                    </p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                      This opens a privacy support request. Your account is not
                      deleted immediately, and support will verify the request
                      before removing data.
                    </p>
                  </div>
                </div>
                <a
                  href="mailto:privacy@getugcpilot.com?subject=Delete%20UGC%20Pilot%20account%20and%20data"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "destructive" }),
                    "w-full sm:w-auto",
                  )}
                >
                  <Mail data-icon="inline-start" aria-hidden="true" />
                  Request deletion
                </a>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </section>
  );
}

function SettingsSection({
  accent = false,
  children,
  description,
  id,
  icon,
  title,
}: {
  accent?: boolean;
  children: ReactNode;
  description: string;
  id?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-6 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card",
        accent && "border-primary/25",
      )}
    >
      {accent ? (
        <span
          className="absolute inset-y-0 left-0 w-1 bg-primary"
          aria-hidden="true"
        />
      ) : null}
      <header className="flex items-start gap-3 px-5 py-5 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground-strong">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
      </header>
      <Separator />
      {children}
    </section>
  );
}

function getInitials(displayName: string, email: string) {
  const nameInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (nameInitials) {
    return nameInitials;
  }

  return email.slice(0, 2).toUpperCase();
}

function getProviderLabel(providerId: string) {
  if (providerId === "google.com") return "Google sign-in";
  if (providerId === "password") return "Email sign-in";
  return providerId;
}
