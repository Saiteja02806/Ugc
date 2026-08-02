import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AiStudioResultsStatus = {
  label: string;
  tone: "error" | "progress" | "neutral";
};

export function AiStudioResults({
  ariaLabel,
  children,
  emptyDescription,
  emptyTitle,
  gridClassName,
  hasResults,
  loading = false,
  status,
}: {
  ariaLabel: string;
  children: ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  gridClassName?: string;
  hasResults: boolean;
  loading?: boolean;
  status?: AiStudioResultsStatus | null;
}) {
  return (
    <section
      aria-label={ariaLabel}
      aria-busy={loading}
      className="relative flex min-h-[420px] min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain md:min-h-0"
    >
      {status ? (
        <div className="sticky top-0 z-10 flex shrink-0 justify-start px-1 pb-2 pt-1">
          <Badge
            variant={status.tone === "error" ? "destructive" : "secondary"}
            role={status.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {status.tone === "progress" ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : status.tone === "error" ? (
              <AlertCircle data-icon="inline-start" aria-hidden="true" />
            ) : null}
            {status.label}
          </Badge>
        </div>
      ) : null}

      {loading ? (
        <div
          className={cn(
            "grid auto-rows-min grid-cols-1 gap-4 px-1 pb-8 pt-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
            gridClassName,
          )}
          role="status"
          aria-label={`Loading ${ariaLabel.toLowerCase()}`}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : hasResults ? (
        <div
          className={cn(
            "grid auto-rows-min grid-cols-1 gap-4 px-1 pb-8 pt-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
            gridClassName,
          )}
        >
          {children}
        </div>
      ) : (
        <Empty className="min-h-[360px] flex-1 px-5 pb-28 pt-16 sm:pb-32 md:min-h-0">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle ?? "No generations yet"}</EmptyTitle>
            <EmptyDescription>
              {emptyDescription ??
                "Describe what you want to create below. Your results will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
