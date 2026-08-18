"use client";

import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useViralReviewerAccess } from "@/components/viral/use-viral-reviewer-access";

export function ViralAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessState = useViralReviewerAccess();

  useEffect(() => {
    if (accessState === "locked") {
      router.replace("/dashboard");
    }
  }, [accessState, router]);

  if (accessState === "reviewer") {
    return children;
  }

  if (accessState === "unavailable") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
        <Alert
          variant="destructive"
          className="w-full max-w-lg bg-card shadow-card"
        >
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Explore reviewer access is not configured</AlertTitle>
          <AlertDescription>
            Add the approved reviewer email configuration to this environment,
            then refresh Explore.
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.location.reload()}
            className="mt-2 w-fit"
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Refresh Explore
          </Button>
        </Alert>
      </main>
    );
  }

  if (accessState === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
        <Alert
          variant="destructive"
          className="w-full max-w-lg bg-card shadow-card"
        >
          <AlertCircle aria-hidden="true" />
          <AlertTitle>We could not verify Explore access</AlertTitle>
          <AlertDescription>
            Check your connection, then try opening the workspace again.
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.location.reload()}
            className="mt-2 w-fit"
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        </Alert>
      </main>
    );
  }

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
        {accessState === "locked"
          ? "Returning to your workspace..."
          : "Checking Explore access..."}
      </div>
    </main>
  );
}
