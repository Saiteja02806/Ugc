"use client";

import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type ProfileGateState = "checking" | "error" | "ready" | "redirecting";

type AuthGuardProps = {
  children: ReactNode;
  requireBusinessProfile?: boolean;
};

export function AuthGuard({
  children,
  requireBusinessProfile = true,
}: AuthGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isDevPreviewBypass = useSyncExternalStore(
    subscribeToPreviewBypass,
    getPreviewBypassSnapshot,
    getServerPreviewBypassSnapshot,
  );
  const [profileGateState, setProfileGateState] = useState<ProfileGateState>(
    requireBusinessProfile ? "checking" : "ready",
  );
  const [profileGateError, setProfileGateError] = useState<string | null>(null);
  const [profileCheckAttempt, setProfileCheckAttempt] = useState(0);

  useEffect(() => {
    if (!isDevPreviewBypass && !loading && !user) {
      router.replace("/sign-in");
      return;
    }

    if (!isDevPreviewBypass && !loading && user && !user.emailVerified) {
      router.replace("/verify-email");
    }
  }, [isDevPreviewBypass, loading, router, user]);

  useEffect(() => {
    if (isDevPreviewBypass || !requireBusinessProfile) {
      return;
    }

    if (loading || !user || !user.emailVerified) {
      return;
    }

    const controller = new AbortController();

    async function verifyCompletedProfile() {
      setProfileGateError(null);
      setProfileGateState("checking");

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Could not verify your sign-in session.");
        }

        const response = await fetch("/api/business-profile", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as {
          message?: string;
          ok?: boolean;
          profile?: { onboardingComplete?: boolean } | null;
        } | null;

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.message ?? "Could not verify your business profile.",
          );
        }

        if (data.profile?.onboardingComplete !== true) {
          setProfileGateState("redirecting");
          router.replace("/onboarding");
          return;
        }

        setProfileGateState("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setProfileGateError(
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not verify your business profile.",
        );
        setProfileGateState("error");
      }
    }

    void verifyCompletedProfile();

    return () => controller.abort();
  }, [
    isDevPreviewBypass,
    loading,
    profileCheckAttempt,
    requireBusinessProfile,
    router,
    user,
  ]);

  const retryProfileCheck = useCallback(() => {
    setProfileCheckAttempt((attempt) => attempt + 1);
  }, []);

  if (!isDevPreviewBypass) {
    if (loading || (requireBusinessProfile && profileGateState === "checking")) {
      return <GuardLoadingState label="Opening your workspace..." />;
    }

    if (!user || !user.emailVerified) {
      return null;
    }

    if (requireBusinessProfile && profileGateState === "redirecting") {
      return <GuardLoadingState label="Finishing your business setup..." />;
    }

    if (requireBusinessProfile && profileGateState === "error") {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
          <Alert
            variant="destructive"
            className="w-full max-w-lg bg-card shadow-card"
          >
            <AlertCircle aria-hidden="true" />
            <AlertTitle>We could not verify your business setup</AlertTitle>
            <AlertDescription>
              {profileGateError ??
                "Check your connection, then try opening the workspace again."}
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={retryProfileCheck}
              className="mt-2 w-fit"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Try again
            </Button>
          </Alert>
        </main>
      );
    }
  }

  return children;
}

function GuardLoadingState({ label }: { label: string }) {
  return (
    <main
      aria-busy="true"
      className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground"
    >
      <div
        role="status"
        className="flex items-center gap-3 text-sm font-semibold text-muted"
      >
        <LoaderCircle
          className="size-5 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        {label}
      </div>
    </main>
  );
}

function subscribeToPreviewBypass(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function getPreviewBypassSnapshot() {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function getServerPreviewBypassSnapshot() {
  return false;
}
