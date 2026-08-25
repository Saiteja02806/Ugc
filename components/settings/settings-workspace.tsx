"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Bug,
  CheckCircle2,
  CreditCard,
  Images,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Mail,
  Moon,
  Palette,
  Plug,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
import { AppScreenshotsSettings } from "@/components/settings/app-screenshots-settings";
import { SupportFeedbackSettings } from "@/components/settings/support-feedback-settings";
import { useTheme } from "@/components/providers/theme-provider";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useBillingSubscription } from "@/components/billing/use-billing-subscription";

const SETTINGS_SECTIONS = [
  {
    icon: UserRound,
    id: "account",
    label: "Account",
  },
  {
    icon: CreditCard,
    id: "subscription-billing",
    label: "Plan & billing",
  },
  {
    icon: Images,
    id: "app-screenshots",
    label: "App screenshots",
  },
  {
    icon: Plug,
    id: "instagram-publishing",
    label: "Connected accounts",
  },
  {
    icon: Palette,
    id: "preferences",
    label: "Preferences",
  },
  {
    icon: Bug,
    id: "raised-ticket",
    label: "Raise Ticket",
  },
  {
    icon: Lightbulb,
    id: "request-feature",
    label: "Request Feature",
  },
  {
    icon: ShieldCheck,
    id: "privacy-data",
    label: "Privacy & data",
  },
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export function SettingsWorkspace() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { locked: themeLocked, setTheme, theme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("account");
  const subscriptionQuery = useBillingSubscription();
  const subscription = subscriptionQuery.data;

  useEffect(() => {
    function syncSectionFromLocation() {
      setActiveSection(getSettingsSectionFromHash(window.location.hash));
    }

    const initialSync = window.setTimeout(syncSectionFromLocation, 0);
    window.addEventListener("hashchange", syncSectionFromLocation);
    window.addEventListener("popstate", syncSectionFromLocation);

    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("hashchange", syncSectionFromLocation);
      window.removeEventListener("popstate", syncSectionFromLocation);
    };
  }, []);

  function selectSection(sectionId: SettingsSectionId) {
    setActiveSection(sectionId);

    if (window.location.hash !== `#${sectionId}`) {
      window.history.pushState(null, "", `#${sectionId}`);
    }
  }

  function handleCloseSettings() {
    router.push("/dashboard");
  }

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
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-3 py-3 text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card md:grid md:min-h-[calc(100dvh-3.5rem)] md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col border-b border-border bg-card-muted/35 md:border-b-0 md:border-r">
          <div className="px-5 pb-3 pt-5 md:px-6 md:pb-5 md:pt-7">
            <h1 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Settings
            </h1>
          </div>

          <nav
            aria-label="Settings sections"
            className="flex gap-2 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible md:px-3"
          >
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const selected = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-11 shrink-0 items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card-muted md:w-full",
                    selected
                      ? "bg-brand-soft text-foreground-strong"
                      : "text-muted hover:bg-card hover:text-foreground-strong",
                  )}
                  onClick={() => selectSection(section.id)}
                >
                  <span
                    className={cn(
                      "absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-primary md:block",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0",
                      selected
                        ? "text-primary"
                        : "text-muted-subtle group-hover:text-muted",
                    )}
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap">{section.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto hidden border-t border-border p-3 md:block">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="w-full justify-start text-muted hover:text-foreground-strong"
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
            {signOutError ? (
              <p
                className="px-3 pb-1 pt-2 text-xs leading-5 text-error"
                role="alert"
              >
                {signOutError}
              </p>
            ) : null}
          </div>
        </aside>

        <main className="relative min-w-0 bg-card px-4 py-5 sm:px-6 sm:py-7 lg:px-9 lg:py-8">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={handleCloseSettings}
            aria-label="Close settings"
            title="Close settings"
            className="absolute top-3 right-3 z-10 text-muted hover:text-foreground-strong sm:top-5 sm:right-5 lg:top-6 lg:right-7"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
          {activeSection === "account" ? (
          <SettingsSection
            id="account"
            description="Review your profile and the sign-in methods connected to your account."
            icon={<UserRound className="size-5" aria-hidden="true" />}
            title="Account"
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

            <div className="border-t border-border px-5 py-4 md:hidden">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="w-full justify-start"
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
              {signOutError ? (
                <p className="pt-2 text-xs leading-5 text-error" role="alert">
                  {signOutError}
                </p>
              ) : null}
            </div>

          </SettingsSection>
          ) : null}

          {activeSection === "subscription-billing" ? (
          <SettingsSection
            id="subscription-billing"
            description="Manage your current plan, monthly generation credits, and billing interval."
            icon={<CreditCard className="size-5" aria-hidden="true" />}
            title="Plan & billing"
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
                      / {subscription?.instagramAccounts ?? 1} allowed
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
          ) : null}

          {activeSection === "app-screenshots" ? (
          <SettingsSection
            id="app-screenshots"
            description="Manage the real product screens available to eligible Slideshows."
            icon={<Images className="size-5" aria-hidden="true" />}
            title="App screenshots"
          >
            <AppScreenshotsSettings />
          </SettingsSection>
          ) : null}

          {activeSection === "instagram-publishing" ? (
          <SettingsSection
            id="instagram-publishing"
            description="Connect and manage the Instagram accounts available for publishing."
            icon={
              <SocialPlatformIcon
                className="size-5"
                platform="instagram"
              />
            }
            title="Connected accounts"
          >
            <InstagramAccountManager />
          </SettingsSection>
          ) : null}

          {activeSection === "preferences" ? (
          <SettingsSection
            id="preferences"
            description="Choose how UGC Pilot looks and behaves on this device."
            icon={<Palette className="size-5" aria-hidden="true" />}
            title="Preferences"
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
          ) : null}

          {activeSection === "raised-ticket" ? (
          <SettingsSection
            id="raised-ticket"
            description="Explain an issue so the UGC Pilot team can investigate it."
            icon={<Bug className="size-5" aria-hidden="true" />}
            title="Raise Ticket"
          >
            <SupportFeedbackSettings type="support_ticket" showOwnerInbox />
          </SettingsSection>
          ) : null}

          {activeSection === "request-feature" ? (
          <SettingsSection
            id="request-feature"
            description="Describe a feature you want UGC Pilot to build."
            icon={<Lightbulb className="size-5" aria-hidden="true" />}
            title="Request Feature"
          >
            <SupportFeedbackSettings type="feature_request" />
          </SettingsSection>
          ) : null}

          {activeSection === "privacy-data" ? (
          <SettingsSection
            id="privacy-data"
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
          ) : null}
        </main>
      </div>
    </section>
  );
}

function SettingsSection({
  children,
  description,
  id,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  id: SettingsSectionId;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section id={id} className="min-w-0" aria-labelledby={`${id}-title`}>
      <header className="flex items-start gap-3 px-5 py-5 pr-14 sm:px-6 sm:pr-16">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="text-xl font-bold tracking-[-0.025em] text-foreground-strong"
          >
            {title}
          </h2>
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

function getSettingsSectionFromHash(hash: string): SettingsSectionId {
  const sectionId = hash.replace(/^#/, "");
  const section = SETTINGS_SECTIONS.find((item) => item.id === sectionId);

  return section?.id ?? "account";
}
