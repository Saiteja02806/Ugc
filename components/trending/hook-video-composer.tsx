"use client";

import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Film,
  Library,
  Loader2,
  RefreshCw,
  Scissors,
  Sparkles,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { HookTextOverlay } from "@/components/trending/hook-text-overlay";
import {
  HookVideoScheduleDrawer,
  type HookVideoScheduleSelection,
} from "@/components/trending/hook-video-schedule-drawer";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useBackgroundJob,
  usePersistedJobIdFromUrl,
} from "@/lib/jobs/background-job-client";
import type { MediaAsset } from "@/lib/media/types";
import type { TrendingTextColor } from "@/lib/trending/text-color";
import { uploadHookVideoDemo } from "@/lib/trending/hook-video-client-upload";
import {
  returnToHookSuggestionSelection,
  returnToHookVideoDemoSelection,
  selectHookVideoDemo,
  selectHookVideoSuggestion,
  updateHookVideoTrim,
  type HookVideoFlowState,
} from "@/lib/trending/hook-video-flow";
import type {
  HookDemoSummary,
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
  HookSuggestion,
} from "@/lib/trending/hook-video-types";
import { cn } from "@/lib/utils";

type DemoListResponse =
  | { demos: HookDemoSummary[]; ok: true }
  | { error?: string; ok?: false };

type SuggestionResponse =
  | { jobId: string; ok: true }
  | { code?: string; error?: string; ok?: false };

type DraftMutationResponse =
  | { draft: { id: string }; ok: true }
  | { error?: string; ok?: false };

type ScheduleMutationResponse =
  | { draft: { id: string }; ok: true; scheduleId: string }
  | { error?: string; ok?: false };

type RenderMutationResponse =
  | { jobId: string | null; ok: true; status: string }
  | { message?: string; ok?: false };

type MediaDetailResponse =
  | { asset: MediaAsset; ok: true }
  | { error?: string; ok?: false };

export function HookVideoComposer({
  flowState,
  influencer,
  openingPreviewUrl,
  overlayFontSize = 52,
  overlayLines = null,
  overlayPosition = null,
  overlayTextColor,
  video,
  onCommitted,
  onClose,
  onStateChange,
}: {
  flowState: HookVideoFlowState;
  influencer: HookInfluencerSummary;
  openingPreviewUrl: string | null;
  overlayFontSize?: number;
  overlayLines?: readonly string[] | null;
  overlayPosition?: { x: number; y: number } | null;
  overlayTextColor?: TrendingTextColor;
  video: HookInfluencerVideoSummary;
  onCommitted?: () => Promise<void>;
  onClose: () => void;
  onStateChange: (state: HookVideoFlowState) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openingVideoRef = useRef<HTMLVideoElement>(null);
  const demoMediaRequestId = useRef(0);
  const suggestionRequestId = useRef(0);
  const suggestionIdempotencyKeyRef = useRef<string | null>(null);
  const suggestionIdempotencyInputRef = useRef<string | null>(null);
  const committedRef = useRef(false);
  const [demos, setDemos] = useState<HookDemoSummary[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<HookDemoSummary | null>(null);
  const [demoMediaUrl, setDemoMediaUrl] = useState<string | null>(null);
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const [demosLoading, setDemosLoading] = useState(false);
  const [demosError, setDemosError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<HookSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [businessProfileRequired, setBusinessProfileRequired] = useState(false);
  const [suggestionDrawerOpen, setSuggestionDrawerOpen] = useState(false);
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"demo" | "opening">(
    "opening",
  );
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledPostId, setScheduledPostId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl();
  const suggestionJobQuery = useBackgroundJob(persistedJobId);
  const suggestionJob =
    suggestionJobQuery.data?.jobType === "hook_text_generation"
      ? suggestionJobQuery.data
      : null;
  const suggestionsPending =
    suggestionsLoading ||
    Boolean(persistedJobId && suggestionJobQuery.isLoading) ||
    Boolean(
      suggestionJob &&
        !["cancelled", "completed", "failed"].includes(suggestionJob.status),
    );
  const restoredSuggestions =
    suggestionJob?.status === "completed" && selectedDemo
      ? getMatchingSuggestionOutput({
          demoAssetId: selectedDemo.id,
          influencerId: influencer.id,
          output: suggestionJob.output,
          videoId: video.id,
        })
      : null;
  const visibleSuggestions = restoredSuggestions ?? suggestions;
  const visibleSuggestionsError =
    suggestionsError ??
    (suggestionJob?.status === "failed" ||
    suggestionJob?.status === "cancelled"
      ? suggestionJob.error?.message ?? "Could not generate hooks."
      : null);

  const loadDemos = useCallback(async () => {
    setDemosLoading(true);
    setDemosError(null);

    try {
      const token = await requireToken();
      const response = await fetch("/api/trending/hook-videos/demos", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | DemoListResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load product demos."));
      }

      setDemos(data.demos);
    } catch (error) {
      setDemosError(getErrorMessage(error, "Could not load product demos."));
    } finally {
      setDemosLoading(false);
    }
  }, []);

  async function generateSuggestions(demo: HookDemoSummary) {
    const requestId = suggestionRequestId.current + 1;
    suggestionRequestId.current = requestId;
    setSuggestions([]);
    setSuggestionsError(null);
    setBusinessProfileRequired(false);
    setSuggestionsLoading(true);

    try {
      const token = await requireToken();
      const idempotencyInput = [
        demo.id,
        influencer.id,
        video.id,
        video.sourceKind,
      ].join(":");

      if (
        suggestionIdempotencyInputRef.current !== idempotencyInput ||
        suggestionJob?.status === "failed" ||
        suggestionJob?.status === "cancelled"
      ) {
        suggestionIdempotencyInputRef.current = idempotencyInput;
        suggestionIdempotencyKeyRef.current = crypto.randomUUID();
      }

      const idempotencyKey =
        suggestionIdempotencyKeyRef.current ?? crypto.randomUUID();
      suggestionIdempotencyKeyRef.current = idempotencyKey;
      const response = await fetch("/api/trending/hook-videos/suggestions", {
        body: JSON.stringify({
          demoAssetId: demo.id,
          influencerId: influencer.id,
          influencerVideoId: video.id,
          sourceKind: video.sourceKind,
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | SuggestionResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        if (
          data?.ok !== true &&
          data?.code === "business_profile_required" &&
          suggestionRequestId.current === requestId
        ) {
          setBusinessProfileRequired(true);
        }
        throw new Error(getApiError(data, "Could not generate hooks."));
      }

      if (suggestionRequestId.current === requestId) {
        persistJobIdInUrl(data.jobId);
      }
    } catch (error) {
      if (suggestionRequestId.current === requestId) {
        setSuggestionsError(getErrorMessage(error, "Could not generate hooks."));
      }
    } finally {
      if (suggestionRequestId.current === requestId) {
        setSuggestionsLoading(false);
      }
    }
  }

  async function loadDemoMedia(demoId: string) {
    const requestId = demoMediaRequestId.current + 1;
    demoMediaRequestId.current = requestId;
    setDemoMediaUrl(null);

    try {
      const token = await requireToken();
      const response = await fetch(`/api/media/${encodeURIComponent(demoId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | MediaDetailResponse
        | null;

      if (
        response.ok &&
        data?.ok === true &&
        demoMediaRequestId.current === requestId
      ) {
        setDemoMediaUrl(data.asset.url);
      }
    } catch {
      if (demoMediaRequestId.current === requestId) {
        setDemoMediaUrl(null);
      }
    }
  }

  function chooseDemo(demo: HookDemoSummary, mediaUrl?: string | null) {
    setDemoPickerOpen(false);
    setSelectedDemo(demo);
    demoMediaRequestId.current += 1;
    setDemoMediaUrl(mediaUrl ?? null);
    setActionError(null);
    setActionNotice(null);
    onStateChange(selectHookVideoDemo(flowState, demo.id));
    if (!mediaUrl) {
      void loadDemoMedia(demo.id);
    }
  }

  function openDemoPicker() {
    setDemoPickerOpen(true);
    if (!demosLoading && demos.length === 0) {
      void loadDemos();
    }
  }

  async function uploadDemo(file: File | undefined) {
    if (!file || uploading) {
      return;
    }

    setUploading(true);
    setDemosError(null);

    try {
      const asset = await uploadHookVideoDemo(file);
      const demo = mapMediaAssetToDemo(asset);
      setDemos((current) => [
        demo,
        ...current.filter((item) => item.id !== demo.id),
      ]);
      chooseDemo(demo, asset.url);
    } catch (error) {
      setDemosError(getErrorMessage(error, "Could not upload this demo."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function chooseSuggestion(suggestion: HookSuggestion) {
    setActionError(null);
    setActionNotice(null);
    setPreviewMode("opening");
    setSuggestionDrawerOpen(false);
    persistJobIdInUrl(null);
    onStateChange(selectHookVideoSuggestion(flowState, suggestion));
  }

  function openSuggestionDrawer() {
    if (!selectedDemo) return;

    setSuggestionDrawerOpen(true);
    if (!suggestionsPending && visibleSuggestions.length === 0) {
      void generateSuggestions(selectedDemo);
    }
  }

  function goBack() {
    setActionError(null);
    setActionNotice(null);

    if (flowState.stage === "review") {
      setSuggestionDrawerOpen(false);
      onStateChange(returnToHookSuggestionSelection(flowState));
      return;
    }

    if (flowState.stage === "select_hook") {
      suggestionRequestId.current += 1;
      demoMediaRequestId.current += 1;
      setSelectedDemo(null);
      setDemoMediaUrl(null);
      setSuggestions([]);
      setSuggestionsError(null);
      setBusinessProfileRequired(false);
      setSuggestionDrawerOpen(false);
      onStateChange(returnToHookVideoDemoSelection(flowState));
    }
  }

  function changeTrim(next: { trimEnd: number | null; trimStart: number }) {
    onStateChange(updateHookVideoTrim(flowState, next));
    const element = openingVideoRef.current;
    if (element && Number.isFinite(next.trimStart)) {
      element.currentTime = next.trimStart;
    }
  }

  async function saveToLibrary() {
    const payload = getDraftPayload(flowState);

    if (!payload) {
      setActionError("Choose a demo and hook before saving.");
      return;
    }

    setSaving(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const token = await requireToken();
      const response = await fetch("/api/trending/hook-videos/drafts", {
        body: JSON.stringify(payload),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | DraftMutationResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not save this Hook video."));
      }

      onStateChange({
        ...flowState,
        draft: { ...flowState.draft, id: data.draft.id },
      });
      setActionNotice("Saved to Creative Assets as a Hook composition.");

      try {
        await recordCommittedSelection();
      } catch (error) {
        setActionError(
          `Saved to Creative Assets, but Trending could not be updated. ${getErrorMessage(
            error,
            "Refresh the page to try again.",
          )}`,
        );
      }
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not save this Hook video."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmSchedule(selection: HookVideoScheduleSelection) {
    const payload = getDraftPayload(flowState);

    if (!payload) {
      setActionError("Choose a demo and hook before scheduling.");
      return;
    }

    setScheduling(true);
    setActionError(null);
    setActionNotice(null);
    let scheduleCreated = false;

    try {
      const token = await requireToken();
      const response = await fetch(
        "/api/trending/hook-videos/drafts/schedule",
        {
          body: JSON.stringify({
            ...payload,
            ...selection,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => null)) as
        | ScheduleMutationResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not prepare this schedule."));
      }

      scheduleCreated = true;
      onStateChange({
        ...flowState,
        draft: { ...flowState.draft, id: data.draft.id },
      });

      const renderResponse = await fetch(
        `/api/schedules/${encodeURIComponent(data.scheduleId)}/render`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          method: "POST",
        },
      );
      const renderData = (await renderResponse.json().catch(() => null)) as
        | RenderMutationResponse
        | null;

      if (!renderResponse.ok || !renderData || renderData.ok !== true) {
        throw new Error(
          getApiMessage(renderData, "Could not start preparing this video."),
        );
      }

      setScheduledPostId(data.scheduleId);
      setScheduleDrawerOpen(false);
      setActionNotice("Schedule saved. Video preparation is queued.");

      try {
        await recordCommittedSelection();
      } catch (error) {
        setActionError(
          `The schedule was saved, but Trending could not be updated. ${getErrorMessage(
            error,
            "Refresh the page to try again.",
          )}`,
        );
      }
    } catch (error) {
      const message = getErrorMessage(error, "Could not prepare this schedule.");
      setActionError(
        scheduleCreated
          ? `The schedule was saved, but video preparation did not start. Open Scheduling to retry it. ${message}`
          : message,
      );
      throw error;
    } finally {
      setScheduling(false);
    }
  }

  async function recordCommittedSelection() {
    if (!onCommitted || committedRef.current) {
      return;
    }

    await onCommitted();
    committedRef.current = true;
  }

  const title = getStageTitle(flowState.stage);
  const selectedHook = flowState.draft.hookText;
  const duration = video.durationSeconds;
  const trimEnd = flowState.draft.trimEnd ?? duration;
  const mutationPending = saving || scheduling;
  const isTrendingComposition = flowState.draft.hookSource === "trending";

  return (
    <div className="relative min-h-[520px] bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={flowState.stage === "select_demo" ? onClose : goBack}
              disabled={mutationPending}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
              aria-label={
                flowState.stage === "select_demo" ? "Close composer" : "Go back"
              }
              title={flowState.stage === "select_demo" ? "Close" : "Back"}
            >
              {flowState.stage === "select_demo" ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <ArrowLeft className="size-4" aria-hidden="true" />
              )}
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground-strong">
                {title}
              </h2>
              <p className="mt-0.5 truncate text-xs font-medium text-muted">
                {isTrendingComposition
                  ? "Pair this opening with one product demo."
                  : "Choose the clips and review the final sequence."}
              </p>
            </div>
          </div>
          <ComposerSteps
            isTrendingComposition={isTrendingComposition}
            stage={flowState.stage}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        {flowState.stage === "select_demo" ? (
          <div className="grid items-start gap-7 md:grid-cols-[168px_minmax(0,1fr)] lg:gap-10">
            <ComposerOpeningPreview
              hookText={selectedHook}
              influencer={influencer}
              openingPreviewUrl={openingPreviewUrl}
              overlayFontSize={overlayFontSize}
              overlayLines={overlayLines}
              overlayPosition={overlayPosition}
              overlayTextColor={overlayTextColor}
              video={video}
            />
            <DemoSelection
              error={demosError}
              fileInputRef={fileInputRef}
              uploading={uploading}
              onChooseExisting={openDemoPicker}
              onUpload={(file) => void uploadDemo(file)}
            />
          </div>
        ) : null}

        {flowState.stage === "select_hook" && selectedDemo ? (
          <HookTextStage
            demo={selectedDemo}
            demoMediaUrl={demoMediaUrl}
            openingPreviewUrl={openingPreviewUrl}
            video={video}
            onOpenSuggestions={openSuggestionDrawer}
          />
        ) : null}

        {flowState.stage === "review" && selectedDemo && selectedHook ? (
          <ReviewComposition
            demo={selectedDemo}
            demoMediaUrl={demoMediaUrl}
            duration={duration}
            hookText={selectedHook}
            openingPreviewUrl={openingPreviewUrl}
            openingVideoRef={openingVideoRef}
            overlayFontSize={overlayFontSize}
            overlayLines={overlayLines}
            overlayPosition={overlayPosition}
            overlayTextColor={overlayTextColor}
            previewMode={previewMode}
            trimEnd={trimEnd}
            trimStart={flowState.draft.trimStart}
            video={video}
            onChangeTrim={changeTrim}
            onPreviewModeChange={setPreviewMode}
          />
        ) : null}

        {actionError ? (
          <p
            role="alert"
            className="mt-5 border-l-2 border-error px-3 py-1 text-sm font-semibold text-error"
          >
            {actionError}
          </p>
        ) : null}
        {actionNotice ? (
          <div
            role="status"
            className="mt-5 flex flex-col gap-1 border-l-2 border-success px-3 py-1 text-sm font-semibold text-success sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{actionNotice}</span>
            {actionNotice.startsWith("Saved to Creative Assets") ? (
              <Link
                href="/avatars?tab=saved"
                className="shrink-0 underline underline-offset-4"
              >
                View Saved
              </Link>
            ) : null}
          </div>
        ) : null}
      </main>

      {flowState.stage === "review" ? (
        <footer className="sticky bottom-0 z-10 border-t border-border bg-background">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => void saveToLibrary()}
              disabled={mutationPending}
              className={secondaryButtonClass}
            >
              {saving ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Library className="size-4" aria-hidden="true" />
              )}
              Save to Creative Assets
            </button>
            {scheduledPostId ? (
              <Link
                href={`/scheduling?draft=${encodeURIComponent(scheduledPostId)}`}
                className={primaryButtonClass}
              >
                <CalendarClock className="size-4" aria-hidden="true" />
                View schedule
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setScheduleDrawerOpen(true)}
                disabled={mutationPending}
                className={primaryButtonClass}
              >
                {scheduling ? (
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <CalendarClock className="size-4" aria-hidden="true" />
                )}
                Schedule
              </button>
            )}
          </div>
        </footer>
      ) : null}

      <DemoPickerDialog
        demos={demos}
        error={demosError}
        loading={demosLoading}
        open={demoPickerOpen}
        onChoose={chooseDemo}
        onOpenChange={setDemoPickerOpen}
        onRetry={() => void loadDemos()}
      />

      {suggestionDrawerOpen &&
      flowState.stage === "select_hook" &&
      selectedDemo ? (
        <SuggestionDrawer
          businessProfileRequired={businessProfileRequired}
          error={visibleSuggestionsError}
          loading={suggestionsPending}
          suggestions={visibleSuggestions}
          onChoose={chooseSuggestion}
          onClose={() => setSuggestionDrawerOpen(false)}
          onRetry={() => void generateSuggestions(selectedDemo)}
        />
      ) : null}

      {scheduleDrawerOpen &&
      flowState.stage === "review" &&
      selectedDemo &&
      selectedHook ? (
        <HookVideoScheduleDrawer
          onClose={() => {
            if (!scheduling) setScheduleDrawerOpen(false);
          }}
          onConfirm={confirmSchedule}
          summary={{
            demoTitle: selectedDemo.title,
            hookText: selectedHook,
            influencerName: influencer.name,
          }}
        />
      ) : null}
    </div>
  );
}

function ComposerOpeningPreview({
  hookText,
  influencer,
  openingPreviewUrl,
  overlayFontSize,
  overlayLines,
  overlayPosition,
  overlayTextColor,
  video,
}: {
  hookText: string | null;
  influencer: HookInfluencerSummary;
  openingPreviewUrl: string | null;
  overlayFontSize: number;
  overlayLines: readonly string[] | null;
  overlayPosition: { x: number; y: number } | null;
  overlayTextColor: TrendingTextColor | undefined;
  video: HookInfluencerVideoSummary;
}) {
  return (
    <section aria-labelledby="selected-opening-heading">
      <div className="flex items-center justify-between gap-3">
        <h3
          id="selected-opening-heading"
          className="text-sm font-semibold text-foreground-strong"
        >
          Selected opening
        </h3>
        <span className="text-xs font-medium text-muted">9:16</span>
      </div>
      <div className="relative mx-auto mt-3 aspect-[9/16] w-[146px] overflow-hidden rounded-[10px] border border-border bg-[#20242a] text-white/60 md:w-full">
        {openingPreviewUrl ? (
          <video
            src={openingPreviewUrl}
            aria-label={video.title}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Video className="size-6" aria-hidden="true" />
          </div>
        )}
        <HookTextOverlay
          color={overlayTextColor}
          fontSize={overlayFontSize}
          lines={overlayLines}
          position={overlayPosition}
          size="compact"
          text={hookText}
        />
      </div>
      <p className="mt-3 truncate text-center text-sm font-semibold text-foreground-strong md:text-left">
        {influencer.name}
      </p>
      <p className="mt-0.5 truncate text-center text-xs font-medium text-muted md:text-left">
        {video.title}
      </p>
    </section>
  );
}

function HookTextStage({
  demo,
  demoMediaUrl,
  openingPreviewUrl,
  video,
  onOpenSuggestions,
}: {
  demo: HookDemoSummary;
  demoMediaUrl: string | null;
  openingPreviewUrl: string | null;
  video: HookInfluencerVideoSummary;
  onOpenSuggestions: () => void;
}) {
  return (
    <section aria-labelledby="hook-text-heading" className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h3 id="hook-text-heading" className="text-sm font-semibold text-foreground-strong">
            Hook text
          </h3>
          <p className="mt-1 truncate text-xs font-medium text-muted">
            {demo.title}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSuggestions}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          aria-label="Open AI hook suggestions"
          title="AI hook suggestions"
        >
          <Sparkles className="size-4.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 sm:gap-5">
        <MediaSequencePreview
          label="Opening"
          mediaUrl={openingPreviewUrl}
          posterUrl={video.thumbnailUrl}
        />
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
        <MediaSequencePreview
          label="Product demo"
          mediaUrl={demoMediaUrl}
          posterUrl={demo.thumbnailUrl}
        />
      </div>
    </section>
  );
}

function MediaSequencePreview({
  label,
  mediaUrl,
  posterUrl,
}: {
  label: string;
  mediaUrl: string | null;
  posterUrl: string | null;
}) {
  return (
    <div className="min-w-0 text-center">
      <div className="relative aspect-[9/16] w-[124px] overflow-hidden rounded-control bg-[#20242a] text-white/60 shadow-[0_8px_22px_rgb(23_23_27_/_0.12)] sm:w-[156px]">
        {mediaUrl ? (
          <video
            src={mediaUrl}
            poster={posterUrl ?? undefined}
            aria-label={label}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            width={312}
            height={554}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Video className="size-5" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="mt-2 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function SuggestionDrawer({
  businessProfileRequired,
  error,
  loading,
  suggestions,
  onChoose,
  onClose,
  onRetry,
}: {
  businessProfileRequired: boolean;
  error: string | null;
  loading: boolean;
  suggestions: HookSuggestion[];
  onChoose: (suggestion: HookSuggestion) => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label="Close AI hook suggestions"
        className="absolute inset-0 cursor-default bg-foreground-strong/24 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-hooks-heading"
        className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col border-t border-border bg-card shadow-[0_-16px_42px_rgb(23_23_27_/_0.16)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[390px] sm:border-l sm:border-t-0 sm:shadow-[-16px_0_42px_rgb(23_23_27_/_0.14)]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h3 id="ai-hooks-heading" className="text-sm font-semibold text-foreground-strong">
              AI hook suggestions
            </h3>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Close AI hook suggestions"
            title="Close"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-2" aria-label="Generating hook suggestions">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-[68px] animate-pulse border border-border bg-card-muted motion-reduce:animate-none" />
              ))}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="border-l-2 border-error px-3 py-1">
              <p role="alert" className="text-sm font-semibold leading-5 text-error">
                {error}
              </p>
              {businessProfileRequired ? (
                <Link
                  href="/onboarding"
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Complete business profile
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Try again
                </button>
              )}
            </div>
          ) : null}

          {!loading && !error && suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => onChoose(suggestion)}
                  className="group flex w-full items-start gap-3 border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary hover:bg-brand-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card-muted text-xs font-bold text-muted group-hover:bg-primary group-hover:text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-foreground-strong">
                    {suggestion.text}
                  </span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted group-hover:text-primary" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DemoSelection({
  error,
  fileInputRef,
  uploading,
  onChooseExisting,
  onUpload,
}: {
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onChooseExisting: () => void;
  onUpload: (file: File | undefined) => void;
}) {
  return (
    <section aria-labelledby="product-demos-heading">
      <div>
        <h3
          id="product-demos-heading"
          className="text-base font-semibold text-foreground-strong"
        >
          Add a product demo
        </h3>
        <p className="mt-1 text-sm font-medium text-muted">
          Upload a new video or choose one you already saved.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        aria-label="Upload demo video"
        onChange={(event) => onUpload(event.target.files?.[0])}
      />

      {error ? (
        <div className="mt-4 border-l-2 border-error px-3 py-1">
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid max-w-[620px] gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          size="lg"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="h-auto min-h-20 justify-start whitespace-normal rounded-[14px] px-4 py-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-card-muted text-primary">
            {uploading ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Upload data-icon="inline-start" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground-strong">
              {uploading ? "Uploading video…" : "Upload demo video"}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-muted">
              MP4, MOV, or WebM
            </span>
          </span>
        </Button>

        <Button
          variant="outline"
          size="lg"
          disabled={uploading}
          onClick={onChooseExisting}
          className="h-auto min-h-20 justify-start whitespace-normal rounded-[14px] px-4 py-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-card-muted text-primary">
            <Library data-icon="inline-start" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground-strong">
              Choose existing
            </span>
            <span className="mt-0.5 block text-xs font-medium text-muted">
              Browse saved demo videos
            </span>
          </span>
        </Button>
      </div>
    </section>
  );
}

function DemoPickerDialog({
  demos,
  error,
  loading,
  open,
  onChoose,
  onOpenChange,
  onRetry,
}: {
  demos: HookDemoSummary[];
  error: string | null;
  loading: boolean;
  open: boolean;
  onChoose: (demo: HookDemoSummary) => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-overlay [backdrop-filter:none] supports-backdrop-filter:[backdrop-filter:none]"
        className="max-h-[calc(100dvh-1rem)] gap-0 overflow-hidden rounded-[18px] border border-border bg-background p-0 ring-0 sm:max-w-[760px]"
      >
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>Choose an existing demo</DialogTitle>
          <DialogDescription>
            Select one of your saved demo videos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[min(58dvh,480px)]">
          <div className="p-4 sm:p-5">
            {loading ? (
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                aria-label="Loading saved demo videos"
              >
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="overflow-hidden rounded-[14px] border border-border">
                    <Skeleton className="aspect-[4/3] rounded-none" />
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && error ? (
              <div className="flex min-h-52 flex-col items-center justify-center text-center">
                <p role="alert" className="max-w-sm text-sm font-semibold text-error">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={onRetry}
                >
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : null}

            {!loading && !error && demos.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center text-center">
                <span className="flex size-11 items-center justify-center rounded-[12px] bg-card-muted text-muted">
                  <Film aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground-strong">
                  No saved demos yet
                </p>
                <p className="mt-1 max-w-xs text-sm font-medium text-muted">
                  Close this window and upload your first demo video.
                </p>
              </div>
            ) : null}

            {!loading && !error && demos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {demos.map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => onChoose(demo)}
                    className="group min-w-0 overflow-hidden rounded-[14px] border border-border bg-transparent text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-card-muted text-muted">
                      {demo.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={demo.thumbnailUrl}
                          alt=""
                          width={320}
                          height={240}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Film className="size-6" aria-hidden="true" />
                      )}
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {formatDuration(demo.durationSeconds)}
                      </span>
                    </span>
                    <span className="block px-3 py-2.5">
                      <span className="block truncate text-sm font-semibold text-foreground-strong">
                        {demo.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted">
                        {demo.ratio === "other" ? "Custom ratio" : demo.ratio}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ReviewComposition({
  demo,
  demoMediaUrl,
  duration,
  hookText,
  openingPreviewUrl,
  openingVideoRef,
  overlayFontSize,
  overlayLines,
  overlayPosition,
  overlayTextColor,
  previewMode,
  trimEnd,
  trimStart,
  video,
  onChangeTrim,
  onPreviewModeChange,
}: {
  demo: HookDemoSummary;
  demoMediaUrl: string | null;
  duration: number | null;
  hookText: string;
  openingPreviewUrl: string | null;
  openingVideoRef: React.RefObject<HTMLVideoElement | null>;
  overlayFontSize: number;
  overlayLines: readonly string[] | null;
  overlayPosition: { x: number; y: number } | null;
  overlayTextColor: TrendingTextColor | undefined;
  previewMode: "demo" | "opening";
  trimEnd: number | null;
  trimStart: number;
  video: HookInfluencerVideoSummary;
  onChangeTrim: (trim: { trimEnd: number | null; trimStart: number }) => void;
  onPreviewModeChange: (mode: "demo" | "opening") => void;
}) {
  const effectiveEnd = trimEnd ?? duration;

  return (
    <div className="mx-auto grid max-w-[980px] items-start gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div>
        <div className="mx-auto flex w-fit rounded-control border border-border bg-card-muted p-1">
          <button
            type="button"
            aria-pressed={previewMode === "opening"}
            onClick={() => onPreviewModeChange("opening")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-[5px] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              previewMode === "opening"
                ? "bg-card text-foreground-strong shadow-[0_1px_2px_rgb(23_23_27_/_0.08)]"
                : "text-muted",
            )}
          >
            <UserRound className="size-3.5" aria-hidden="true" />
            Opening
          </button>
          <button
            type="button"
            aria-pressed={previewMode === "demo"}
            onClick={() => onPreviewModeChange("demo")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-[5px] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              previewMode === "demo"
                ? "bg-card text-foreground-strong shadow-[0_1px_2px_rgb(23_23_27_/_0.08)]"
                : "text-muted",
            )}
          >
            <Film className="size-3.5" aria-hidden="true" />
            Demo
          </button>
        </div>

        <div className="relative mx-auto mt-3 aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[10px] border border-border bg-[#17171a]">
          {previewMode === "opening" && openingPreviewUrl ? (
            <video
              ref={openingVideoRef}
              key={openingPreviewUrl}
              src={openingPreviewUrl}
              controls
              playsInline
              preload="metadata"
              className="size-full object-contain"
              onLoadedMetadata={(event) => {
                event.currentTarget.currentTime = trimStart;
              }}
              onTimeUpdate={(event) => {
                if (
                  effectiveEnd !== null &&
                  event.currentTarget.currentTime >= effectiveEnd
                ) {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = trimStart;
                }
              }}
            />
          ) : null}

          {previewMode === "demo" && demoMediaUrl ? (
            <video
              key={demoMediaUrl}
              src={demoMediaUrl}
              controls
              playsInline
              preload="metadata"
              className="size-full object-contain"
            />
          ) : null}

          {((previewMode === "opening" && !openingPreviewUrl) ||
            (previewMode === "demo" && !demoMediaUrl)) ? (
            <div className="flex size-full items-center justify-center text-white/60">
              <Video className="size-7" aria-hidden="true" />
            </div>
          ) : null}

          {previewMode === "opening" ? (
            <HookTextOverlay
              color={overlayTextColor}
              fontSize={overlayFontSize}
              lines={overlayLines}
              position={overlayPosition}
              size="review"
              text={hookText}
            />
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-bold uppercase text-muted">Selected hook</p>
          <p className="mt-2 whitespace-pre-line text-lg font-semibold leading-7 text-foreground-strong">
            {hookText}
          </p>
        </div>

        <div className="grid gap-4 border-b border-border py-5 sm:grid-cols-2">
          <ReviewAsset icon={UserRound} label="Opening" title={video.title} />
          <ReviewAsset icon={Film} label="Product demo" title={demo.title} />
        </div>

        <section aria-labelledby="trim-heading" className="pt-5">
          <div className="flex items-center gap-2">
            <Scissors className="size-4 text-primary" aria-hidden="true" />
            <h3 id="trim-heading" className="text-sm font-semibold text-foreground-strong">
              Opening clip trim
            </h3>
          </div>
          {duration !== null ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-muted">
                Start
                <span className="mt-1.5 flex h-10 items-center rounded-control border border-border bg-card px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <input
                    type="number"
                    name="opening-trim-start"
                    autoComplete="off"
                    inputMode="decimal"
                    min={0}
                    max={Math.max(0, (effectiveEnd ?? duration) - 0.1)}
                    step={0.1}
                    value={trimStart.toFixed(1)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      const max = Math.max(0, (effectiveEnd ?? duration) - 0.1);
                      onChangeTrim({
                        trimEnd: effectiveEnd,
                        trimStart: clamp(value, 0, max),
                      });
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground-strong outline-none"
                  />
                  <span className="text-xs font-medium text-muted">sec</span>
                </span>
              </label>
              <label className="text-xs font-semibold text-muted">
                End
                <span className="mt-1.5 flex h-10 items-center rounded-control border border-border bg-card px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <input
                    type="number"
                    name="opening-trim-end"
                    autoComplete="off"
                    inputMode="decimal"
                    min={trimStart + 0.1}
                    max={duration}
                    step={0.1}
                    value={(effectiveEnd ?? duration).toFixed(1)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      onChangeTrim({
                        trimEnd: clamp(value, trimStart + 0.1, duration),
                        trimStart,
                      });
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground-strong outline-none"
                  />
                  <span className="text-xs font-medium text-muted">sec</span>
                </span>
              </label>
            </div>
          ) : (
            <p className="mt-3 text-sm font-medium text-muted">
              Clip duration is unavailable, so the full opening will be used.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewAsset({
  icon: Icon,
  label,
  title,
}: {
  icon: typeof UserRound;
  label: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground-strong">
          {title}
        </p>
      </div>
    </div>
  );
}

function ComposerSteps({
  isTrendingComposition,
  stage,
}: {
  isTrendingComposition: boolean;
  stage: HookVideoFlowState["stage"];
}) {
  const stages = isTrendingComposition
    ? ([
        { id: "select_demo", label: "Choose demo" },
        { id: "review", label: "Review" },
      ] as const)
    : ([
        { id: "select_demo", label: "Choose demo" },
        { id: "select_hook", label: "Choose hook" },
        { id: "review", label: "Review" },
      ] as const);
  const currentIndex = stages.findIndex((item) => item.id === stage);

  return (
    <ol
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      aria-label="Hook video progress"
    >
      {stages.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "flex items-center gap-2 text-xs font-semibold",
            index <= currentIndex ? "text-foreground-strong" : "text-muted",
          )}
          aria-current={item.id === stage ? "step" : undefined}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px] font-bold",
              index < currentIndex
                ? "border-primary bg-primary text-primary-foreground"
                : index === currentIndex
                  ? "border-primary text-primary"
                  : "border-border text-muted",
            )}
          >
            {index < currentIndex ? (
              <Check className="size-3" aria-hidden="true" />
            ) : (
              index + 1
            )}
          </span>
          {item.label}
          {index < stages.length - 1 ? (
            <span className="ml-2 hidden h-px w-6 bg-border sm:block" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function getDraftPayload(state: HookVideoFlowState) {
  const draft = state.draft;

  if (
    !draft.demoAssetId ||
    !draft.influencerId ||
    !draft.influencerVideoId ||
    !draft.selectedHookId ||
    !draft.sourceKind
  ) {
    return null;
  }

  return {
    demoAssetId: draft.demoAssetId,
    draftId: draft.id,
    influencerId: draft.influencerId,
    influencerVideoId: draft.influencerVideoId,
    selectedHookId: draft.selectedHookId,
    sourceKind: draft.sourceKind,
    trimEnd: draft.trimEnd,
    trimStart: draft.trimStart,
  };
}

function mapMediaAssetToDemo(asset: MediaAsset): HookDemoSummary {
  return {
    durationSeconds: asset.durationSeconds,
    id: asset.id,
    ratio: asset.ratio,
    sourceType: asset.sourceType,
    thumbnailUrl: asset.thumbnailUrl,
    title: asset.title,
  };
}

function getStageTitle(stage: HookVideoFlowState["stage"]) {
  if (stage === "select_hook") return "Choose a hook";
  if (stage === "review") return "Review Hook video";
  return "Add a product demo";
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function getMatchingSuggestionOutput(params: {
  demoAssetId: string;
  influencerId: string;
  output: unknown;
  videoId: string;
}): HookSuggestion[] | null {
  if (
    !params.output ||
    typeof params.output !== "object" ||
    Array.isArray(params.output)
  ) {
    return null;
  }

  const output = params.output as Record<string, unknown>;

  const matches =
    output.operation === "composition_suggestions" &&
    output.demoAssetId === params.demoAssetId &&
    output.influencerId === params.influencerId &&
    output.influencerVideoId === params.videoId &&
    Array.isArray(output.suggestions) &&
    output.suggestions.every(
      (suggestion) =>
        Boolean(
          suggestion &&
            typeof suggestion === "object" &&
            !Array.isArray(suggestion) &&
            typeof suggestion.id === "string" &&
            typeof suggestion.text === "string",
        ),
    );

  return matches ? (output.suggestions as HookSuggestion[]) : null;
}

async function requireToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before creating Hook videos.");
  }

  return token;
}

function getApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}

function getApiMessage(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";
