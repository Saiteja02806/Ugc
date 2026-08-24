"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  BUSINESS_PROFILE_GATE_GC_TIME_MS,
  BUSINESS_PROFILE_GATE_STALE_TIME_MS,
  fetchBusinessProfileGate,
  getBusinessProfileGateQueryKey,
} from "@/lib/business-profiles/profile-gate-query";

type AuthGuardProps = {
  children: ReactNode;
  requireAuthentication?: boolean;
  requireBusinessProfile?: boolean;
};

export function AuthGuard({
  children,
  requireAuthentication = true,
  requireBusinessProfile = true,
}: AuthGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isDevPreviewBypass = useSyncExternalStore(
    subscribeToPreviewBypass,
    getPreviewBypassSnapshot,
    getServerPreviewBypassSnapshot,
  );
  const profileGateEnabled =
    requireAuthentication &&
    !isDevPreviewBypass &&
    requireBusinessProfile &&
    !loading &&
    Boolean(user?.emailVerified);
  const profileGateQuery = useQuery({
    enabled: profileGateEnabled,
    gcTime: BUSINESS_PROFILE_GATE_GC_TIME_MS,
    queryFn: ({ signal }) => fetchBusinessProfileGate(signal),
    queryKey: getBusinessProfileGateQueryKey(user?.uid ?? "signed-out"),
    refetchOnWindowFocus: false,
    staleTime: BUSINESS_PROFILE_GATE_STALE_TIME_MS,
  });

  useEffect(() => {
    if (!requireAuthentication) {
      return;
    }

    if (!isDevPreviewBypass && !loading && !user) {
      router.replace("/sign-in");
      return;
    }

    if (!isDevPreviewBypass && !loading && user && !user.emailVerified) {
      router.replace("/verify-email");
    }
  }, [isDevPreviewBypass, loading, requireAuthentication, router, user]);

  useEffect(() => {
    if (
      profileGateEnabled &&
      profileGateQuery.data?.onboardingComplete === false
    ) {
      router.replace("/onboarding");
    }
  }, [profileGateEnabled, profileGateQuery.data, router]);

  if (!requireAuthentication) {
    return children;
  }

  if (!isDevPreviewBypass) {
    if (loading || (profileGateEnabled && profileGateQuery.isPending)) {
      return <GuardLoadingState label="Opening your workspace..." />;
    }

    if (!user || !user.emailVerified) {
      return (
        <GuardLoadingState
          label={user ? "Opening email verification..." : "Opening sign in..."}
        />
      );
    }

    if (
      profileGateEnabled &&
      profileGateQuery.data?.onboardingComplete === false
    ) {
      return <GuardLoadingState label="Finishing your business setup..." />;
    }

    if (profileGateEnabled && profileGateQuery.isError) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
          <Alert
            variant="destructive"
            className="w-full max-w-lg bg-card shadow-card"
          >
            <AlertCircle aria-hidden="true" />
            <AlertTitle>We could not verify your business setup</AlertTitle>
            <AlertDescription>
              {profileGateQuery.error instanceof Error &&
              profileGateQuery.error.message.trim()
                ? profileGateQuery.error.message
                : "Check your connection, then try opening the workspace again."}
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void profileGateQuery.refetch()}
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
