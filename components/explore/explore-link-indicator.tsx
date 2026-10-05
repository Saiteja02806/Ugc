"use client";

import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

// Keep this inside its Link: Next owns pending/cancellation state, so another
// card can still be opened without a timer, navigation lock or forced reload.
export function ExploreLinkIndicator({ label, className }: { label: string; className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <span data-explore-link-pending={pending} className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <ArrowUpRight className={cn("size-full", pending ? "invisible" : undefined)} aria-hidden="true" />
      {pending ? (
        <>
          <LoaderCircle className="absolute inset-0 size-full animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only" role="status">Opening {label}…</span>
        </>
      ) : null}
    </span>
  );
}
