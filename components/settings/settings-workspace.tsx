"use client";

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  Mail,
  Moon,
  Palette,
  ShieldCheck,
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
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function SettingsWorkspace() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { setTheme, theme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
                    <Badge variant="secondary">Saved on this device</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                    Your choice overrides the product default and is applied
                    before the page appears.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-full sm:w-auto"
              >
                {theme === "light" ? (
                  <Moon data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <Sun data-icon="inline-start" aria-hidden="true" />
                )}
                Use {theme === "light" ? "dark" : "light"} theme
              </Button>
            </div>
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

            <div className="flex flex-col gap-4 bg-error/5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted text-primary">
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
