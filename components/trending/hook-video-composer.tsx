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

import {
  HookVideoScheduleDrawer,
  type HookVideoScheduleSelection,
} from "@/components/trending/hook-video-schedule-drawer";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
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
  | { ok: true; suggestions: HookSuggestion[] }
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
  video,
  onClose,
  onStateChange,
}: {
  flowState: HookVideoFlowState;
  influencer: HookInfluencerSummary;
  openingPreviewUrl: string | null;
  video: HookInfluencerVideoSummary;
  onClose: () => void;
  onStateChange: (state: HookVideoFlowState) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openingVideoRef = useRef<HTMLVideoElement>(null);
  const demoMediaRequestId = useRef(0);
  const suggestionRequestId = useRef(0);
  const [demos, setDemos] = useState<HookDemoSummary[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<HookDemoSummary | null>(null);
  const [demoMediaUrl, setDemoMediaUrl] = useState<string | null>(null);
  const [demosLoading, setDemosLoading] = useState(true);
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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDemos(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDemos]);

  async function generateSuggestions(demo: HookDemoSummary) {
    const requestId = suggestionRequestId.current + 1;
    suggestionRequestId.current = requestId;
    setSuggestions([]);
    setSuggestionsError(null);
    setBusinessProfileRequired(false);
    setSuggestionsLoading(true);

    try {
      const token = await requireToken();
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
        setSuggestions(data.suggestions);
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
    onStateChange(selectHookVideoSuggestion(flowState, suggestion));
  }

  function openSuggestionDrawer() {
    if (!selectedDemo) return;

    setSuggestionDrawerOpen(true);
    if (!suggestionsLoading && suggestions.length === 0) {
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
      setActionNotice("Saved to Library.");
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

  const title = getStageTitle(flowState.stage);
  const description = getStageDescription(flowState.stage, influencer.name);
  const selectedHook = flowState.draft.hookText;
  const duration = video.durationSeconds;
  const trimEnd = flowState.draft.trimEnd ?? duration;
  const mutationPending = saving || scheduling;

  return (
    <div className="relative min-h-[520px] bg-card">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={flowState.stage === "select_demo" ? onClose : goBack}
            disabled={mutationPending}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            aria-label={flowState.stage === "select_demo" ? "Close composer" : "Go back"}
            title={flowState.stage === "select_demo" ? "Close" : "Back"}
          >
            {flowState.stage === "select_demo" ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <ArrowLeft className="size-4" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground-strong">
              {title}
            </h2>
            <p className="mt-1 truncate text-xs font-medium text-muted">
              {description}
            </p>
            <ComposerSteps stage={flowState.stage} />
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
        {flowState.stage === "select_demo" ? (
          <div className="grid items-start gap-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
            <ComposerOpeningPreview
              influencer={influencer}
              openingPreviewUrl={openingPreviewUrl}
              video={video}
            />
            <DemoSelection
              demos={demos}
              error={demosError}
              fileInputRef={fileInputRef}
              loading={demosLoading}
              uploading={uploading}
              onChoose={chooseDemo}
              onRetry={() => void loadDemos()}
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
            previewMode={previewMode}
            trimEnd={trimEnd}
            trimStart={flowState.draft.trimStart}
            video={video}
            onChangeTrim={changeTrim}
            onPreviewModeChange={setPreviewMode}
          />
        ) : null}

        {actionError ? (
          <p role="alert" className="mt-4 border-l-2 border-error px-3 py-1 text-sm font-semibold text-error">
            {actionError}
          </p>
        ) : null}
        {actionNotice ? (
          <p role="status" className="mt-4 border-l-2 border-success px-3 py-1 text-sm font-semibold text-[#087443]">
            {actionNotice}
          </p>
        ) : null}
      </div>

      {flowState.stage === "review" ? (
        <footer className="flex flex-col gap-2 border-t border-border bg-card-muted/55 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => void saveToLibrary()}
            disabled={mutationPending}
            className={secondaryButtonClass}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Library className="size-4" aria-hidden="true" />
            )}
            Save to Library
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
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <CalendarClock className="size-4" aria-hidden="true" />
              )}
              Schedule
            </button>
          )}
        </footer>
      ) : null}

      {suggestionDrawerOpen && flowState.stage === "select_hook" && selectedDemo ? (
        <SuggestionDrawer
          businessProfileRequired={businessProfileRequired}
          error={suggestionsError}
          loading={suggestionsLoading}
          suggestions={suggestions}
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
  influencer,
  openingPreviewUrl,
  video,
}: {
  influencer: HookInfluencerSummary;
  openingPreviewUrl: string | null;
  video: HookInfluencerVideoSummary;
}) {
  return (
    <section aria-labelledby="selected-opening-heading">
      <h3 id="selected-opening-heading" className="text-sm font-semibold text-foreground-strong">
        Opening
      </h3>
      <div className="relative mx-auto mt-3 aspect-[9/16] w-[132px] overflow-hidden rounded-control bg-[#20242a] text-white/60 shadow-[0_10px_28px_rgb(23_23_27_/_0.14)] sm:w-full">
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
      </div>
      <p className="mt-3 truncate text-center text-sm font-semibold text-foreground-strong sm:text-left">
        {influencer.name}
      </p>
      <p className="mt-0.5 truncate text-center text-xs font-medium text-muted sm:text-left">
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
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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
          <img src={posterUrl} alt="" className="size-full object-cover" />
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
  demos,
  error,
  fileInputRef,
  loading,
  uploading,
  onChoose,
  onRetry,
  onUpload,
}: {
  demos: HookDemoSummary[];
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  uploading: boolean;
  onChoose: (demo: HookDemoSummary) => void;
  onRetry: () => void;
  onUpload: (file: File | undefined) => void;
}) {
  return (
    <section aria-labelledby="product-demos-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3
            id="product-demos-heading"
            className="text-sm font-semibold text-foreground-strong"
          >
            Product demos
          </h3>
          <p className="mt-1 text-xs font-medium text-muted">
            Choose from Videos or upload a new demo.
          </p>
        </div>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(event) => onUpload(event.target.files?.[0])}
      />

      {error ? (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-control border border-error/20 bg-error/5 px-3 py-2.5">
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Retry loading product demos"
            title="Retry"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="group flex min-h-[190px] flex-col items-center justify-center rounded-panel border border-dashed border-border-strong bg-card-muted px-4 text-center transition-colors hover:border-primary hover:bg-brand-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[0_1px_2px_rgb(23_23_27_/_0.06)]">
            {uploading ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
          </span>
          <span className="mt-3 text-sm font-semibold text-foreground-strong">
            Upload demo
          </span>
          <span className="mt-1 text-xs font-medium text-muted">
            MP4, MOV, or WebM
          </span>
        </button>

        {demos.map((demo) => (
          <button
            key={demo.id}
            type="button"
            onClick={() => onChoose(demo)}
            className="group min-w-0 overflow-hidden rounded-panel border border-border bg-card text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-foreground-strong text-white/65">
              {demo.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={demo.thumbnailUrl}
                  alt=""
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              ) : (
                <Film className="size-6" aria-hidden="true" />
              )}
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
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

      {!loading && demos.length === 0 && !error ? (
        <p className="mt-4 text-center text-sm font-medium text-muted">
          No saved product demos yet.
        </p>
      ) : null}
    </section>
  );
}

function ReviewComposition({
  demo,
  demoMediaUrl,
  duration,
  hookText,
  openingPreviewUrl,
  openingVideoRef,
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
  previewMode: "demo" | "opening";
  trimEnd: number | null;
  trimStart: number;
  video: HookInfluencerVideoSummary;
  onChangeTrim: (trim: { trimEnd: number | null; trimStart: number }) => void;
  onPreviewModeChange: (mode: "demo" | "opening") => void;
}) {
  const effectiveEnd = trimEnd ?? duration;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:gap-8">
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

        <div className="relative mx-auto mt-3 aspect-[9/16] w-full max-w-[310px] overflow-hidden rounded-[16px] bg-[#17171a] shadow-[0_18px_40px_rgb(23_23_27_/_0.16)]">
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
            <div className="pointer-events-none absolute inset-x-3 bottom-14 rounded-control bg-black/72 px-3 py-2.5 text-center text-sm font-bold leading-5 text-white shadow-lg">
              {hookText}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-bold uppercase text-muted">Selected hook</p>
          <p className="mt-2 text-lg font-semibold leading-7 text-foreground-strong">
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

function ComposerSteps({ stage }: { stage: HookVideoFlowState["stage"] }) {
  const stages = [
    { id: "select_demo", label: "Demo" },
    { id: "select_hook", label: "Hook" },
    { id: "review", label: "Review" },
  ] as const;
  const currentIndex = stages.findIndex((item) => item.id === stage);

  return (
    <ol className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
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
                ? "border-primary bg-primary text-white"
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

function getStageDescription(
  stage: HookVideoFlowState["stage"],
  influencerName: string,
) {
  if (stage === "select_hook") return "Generated from your business profile";
  if (stage === "review") return "Opening, hook text, and product demo";
  return `Opening selected: ${influencerName}`;
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
  "inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";
