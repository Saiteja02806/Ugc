"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isDevPreviewBypass = useSyncExternalStore(
    subscribeToPreviewBypass,
    getPreviewBypassSnapshot,
    getServerPreviewBypassSnapshot,
  );

  useEffect(() => {
    if (!isDevPreviewBypass && !loading && !user) {
      router.replace("/sign-in");
    }
  }, [isDevPreviewBypass, loading, router, user]);

  if (!isDevPreviewBypass && loading) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground"
      >
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" />
          Opening your workspace...
        </div>
      </main>
    );
  }

  if (!isDevPreviewBypass && !user) {
    return null;
  }

  return children;
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
