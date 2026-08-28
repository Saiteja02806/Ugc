"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";

import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { Badge } from "@/components/ui/badge";
import { VideoGenerationStudioPanel } from "@/components/video/video-generation-workspace";
import { ImageGenerationStudioPanel } from "@/components/workspace/ugc-chat-workspace";
import {
  getAIStudioAccessMessage,
  type AIStudioAccessState,
} from "@/lib/ai-studio/access-policy";
import { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND } from "@/lib/billing/generation-credit-policy";
import { cn } from "@/lib/utils";

export type AIStudioMode = "images" | "videos";

const studioModes: Array<{
  label: string;
  value: AIStudioMode;
}> = [
  {
    label: "Images",
    value: "images",
  },
  {
    label: "Videos",
    value: "videos",
  },
];

export function AIStudioWorkspace({
  initialMode,
}: {
  initialMode: AIStudioMode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = toAIStudioMode(searchParams.get("mode") ?? initialMode);
  const accessState = useAIStudioAccess();
  const subscriptionQuery = useBillingSubscription();
  const subscription = subscriptionQuery.data;
  const accessMessage = getAIStudioAccessMessage(accessState);

  function selectMode(nextMode: AIStudioMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", nextMode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-x-hidden bg-background px-3 text-foreground sm:px-5 md:h-dvh md:min-h-0 md:overflow-hidden lg:px-7">
      <div className="mx-auto flex min-h-0 w-full max-w-[1560px] flex-1 flex-col">
        <header className="flex shrink-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                AI Studio
              </h1>
              <AIStudioAccessBadge state={accessState} />
              <Link
                href={subscription?.isActive ? "/settings#subscription-billing" : "/pricing"}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                title="Manage AI generation credits"
              >
                <Sparkles className="size-3" aria-hidden="true" />
                <span>{subscription?.creditsRemaining ?? 0} AI credits</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  · {subscription?.isActive ? "Manage" : "Upgrade"}
                </span>
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted">
              Create platform-ready images and presenter videos from a prompt.
            </p>
          </div>
          <div className="shrink-0">
            <AIStudioModeToggle value={mode} onChange={selectMode} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col pb-1">
          <ImageGenerationStudioPanel
            accessState={accessState}
            accessMessage={accessMessage}
            active={mode === "images"}
            creditCost={subscription?.imageGenerationCreditCost ?? 1}
            creditsRemaining={subscription?.creditsRemaining ?? null}
          />
          <VideoGenerationStudioPanel
            accessState={accessState}
            accessMessage={accessMessage}
            active={mode === "videos"}
            creditsPerSecond={
              subscription?.videoGenerationCreditsPerSecond ??
              DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND
            }
            creditsRemaining={subscription?.creditsRemaining ?? null}
          />
        </div>
      </div>
    </section>
  );
}

function AIStudioModeToggle({
  onChange,
  value,
}: {
  onChange: (mode: AIStudioMode) => void;
  value: AIStudioMode;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = studioModes.findIndex((mode) => mode.value === value);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % studioModes.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + studioModes.length) % studioModes.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = studioModes.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextMode = studioModes[nextIndex]?.value;

    if (nextMode) {
      onChange(nextMode);
      window.requestAnimationFrame(() => {
        document.getElementById(`ai-studio-${nextMode}-tab`)?.focus();
      });
    }
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card-muted/80 p-1 shadow-xs backdrop-blur-xs"
      role="tablist"
      aria-label="AI Studio mode"
    >
      {studioModes.map((mode) => {
        const selected = value === mode.value;
        const panelId = `ai-studio-${mode.value}-panel`;
        const tabId = `ai-studio-${mode.value}-tab`;

        return (
          <button
            key={mode.value}
            id={tabId}
            type="button"
            role="tab"
            aria-controls={panelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "inline-flex h-8 min-w-[76px] items-center justify-center rounded-full px-4 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none sm:min-w-[86px] sm:text-sm",
              selected
                ? "bg-card text-foreground-strong shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                : "bg-transparent text-muted hover:text-foreground",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function AIStudioAccessBadge({ state }: { state: AIStudioAccessState }) {
  if (state !== "pro") {
    return null;
  }

  return (
    <Badge variant="pro" role="status" aria-live="polite">
      Pro
    </Badge>
  );
}

export function toAIStudioMode(value: string | null | undefined): AIStudioMode {
  return value === "videos" ? "videos" : "images";
}
