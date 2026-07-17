"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  UserRound,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { HookVideoDeck } from "@/components/trending/hook-video-deck";
import {
  InfluencerVideoPickerModal,
  type HookVideoPickerSelection,
} from "@/components/trending/influencer-video-picker-modal";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  INITIAL_HOOK_VIDEO_FLOW_STATE,
  beginHookVideoComposition,
  type HookVideoFlowState,
} from "@/lib/trending/hook-video-flow";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
} from "@/lib/trending/hook-video-types";

type InfluencerListResponse =
  | { influencers: HookInfluencerSummary[]; ok: true }
  | { error?: string; ok?: false };

type PreviewSessionResponse =
  | { expiresAt: string; ok: true; previewUrl: string }
  | { error?: string; ok?: false };

export function HookVideoWorkspace({ active }: { active: boolean }) {
  const { loading: authLoading, user } = useAuth();
  const [flowState, setFlowState] = useState<HookVideoFlowState>(
    INITIAL_HOOK_VIDEO_FLOW_STATE,
  );
  const [influencers, setInfluencers] = useState<HookInfluencerSummary[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] =
    useState<HookInfluencerSummary | null>(null);
  const [videos, setVideos] = useState<HookInfluencerVideoSummary[]>([]);
  const [selectedVideo, setSelectedVideo] =
    useState<HookInfluencerVideoSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadAttempted, setLoadAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestId = useRef(0);

  const loadInfluencers = useCallback(async () => {
    if (authLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!user) {
        throw new Error("Sign in before creating hook videos.");
      }

      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before creating hook videos.");
      }

      const response = await fetch(
        "/api/trending/hook-videos/influencers",
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as InfluencerListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load influencers."));
      }

      setInfluencers(data.influencers);
      setSelectedInfluencer((current) =>
        current && data.influencers.some((item) => item.id === current.id)
          ? current
          : null,
      );
    } catch (error) {
      setInfluencers([]);
      setErrorMessage(getErrorMessage(error, "Could not load influencers."));
    } finally {
      setIsLoading(false);
      setLoadAttempted(true);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!active || authLoading || loadAttempted) {
      return;
    }

    const timer = window.setTimeout(() => void loadInfluencers(), 0);

    return () => window.clearTimeout(timer);
  }, [active, authLoading, loadAttempted, loadInfluencers]);

  async function loadProtectedPreview(video: HookInfluencerVideoSummary) {
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before previewing influencer videos.");
      }

      const response = await fetch(
        `/api/trending/hook-videos/videos/${encodeURIComponent(video.id)}/preview-session`,
        {
          body: JSON.stringify({
            influencerId: video.influencerId,
            sourceKind: video.sourceKind,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const data = (await response.json()) as PreviewSessionResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiError(data, "Could not load protected preview."),
        );
      }

      if (previewRequestId.current === requestId) {
        setPreviewUrl(`${data.previewUrl}?session=${Date.now()}`);
      }
    } catch (error) {
      if (previewRequestId.current === requestId) {
        setPreviewError(
          getErrorMessage(error, "Could not load protected preview."),
        );
      }
    } finally {
      if (previewRequestId.current === requestId) {
        setPreviewLoading(false);
      }
    }
  }

  function handleVideoSelection(selection: HookVideoPickerSelection) {
    setSelectedInfluencer(selection.influencer);
    setSelectedVideo(selection.video);
    setVideos(selection.videos);
    setFlowState(INITIAL_HOOK_VIDEO_FLOW_STATE);
    setNoticeMessage(null);
    void loadProtectedPreview(selection.video);
  }

  function handleSkip() {
    if (!selectedVideo || videos.length === 0) {
      return;
    }

    if (videos.length === 1) {
      setNoticeMessage("Choose another influencer to see a different video.");
      setPickerOpen(true);
      return;
    }

    const currentIndex = videos.findIndex(
      (video) => video.id === selectedVideo.id,
    );
    const nextVideo = videos[(currentIndex + 1) % videos.length];

    setSelectedVideo(nextVideo);
    setFlowState(INITIAL_HOOK_VIDEO_FLOW_STATE);
    setNoticeMessage(null);
    void loadProtectedPreview(nextVideo);
  }

  function handleCompose() {
    if (!selectedVideo) {
      return;
    }

    setFlowState(
      beginHookVideoComposition({
        influencerId: selectedVideo.influencerId,
        influencerVideoId: selectedVideo.id,
        sourceKind: selectedVideo.sourceKind,
        trimEnd: selectedVideo.trimEnd,
        trimStart: selectedVideo.trimStart,
      }),
    );
  }

  const selectedPosition = selectedVideo
    ? Math.max(0, videos.findIndex((video) => video.id === selectedVideo.id)) + 1
    : 0;

  return (
    <section
      className="mt-6 overflow-hidden rounded-panel border border-border bg-card shadow-card"
      data-hook-video-stage={flowState.stage}
    >
      <div className="flex min-h-14 items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Hook videos
        </p>
        <p className="text-xs font-medium text-muted">Browse</p>
      </div>

      {isLoading ? <HookWorkspaceLoading /> : null}

      {!isLoading && errorMessage ? (
        <HookWorkspaceError
          message={errorMessage}
          onRetry={() => {
            setLoadAttempted(false);
            void loadInfluencers();
          }}
        />
      ) : null}

      {!isLoading && !errorMessage && loadAttempted && influencers.length === 0 ? (
        <HookWorkspaceEmpty
          description="Add influencers to your Influencers library before creating hook videos."
          title="No influencers available"
          showChoose={false}
          onChoose={() => setPickerOpen(true)}
        />
      ) : null}

      {!isLoading &&
      !errorMessage &&
      influencers.length > 0 &&
      !selectedVideo ? (
        <HookWorkspaceEmpty
          description="Choose an influencer first, then select one of their videos."
          title="No influencer video selected"
          showChoose
          onChoose={() => setPickerOpen(true)}
        />
      ) : null}

      {!isLoading && selectedInfluencer && selectedVideo ? (
        <>
          <HookVideoDeck
            influencer={selectedInfluencer}
            position={selectedPosition}
            previewError={previewError}
            previewLoading={previewLoading}
            previewUrl={previewUrl}
            total={videos.length}
            video={selectedVideo}
            onChangeVideo={() => setPickerOpen(true)}
            onCompose={handleCompose}
            onPreviewError={() => {
              setPreviewUrl(null);
              setPreviewLoading(false);
              setPreviewError("Could not load protected preview.");
            }}
            onRetryPreview={() => void loadProtectedPreview(selectedVideo)}
            onSkip={handleSkip}
          />
          {noticeMessage ? (
            <div className="border-t border-border bg-card-muted/55 px-5 py-2.5 text-center text-xs font-semibold text-muted sm:text-left">
              {noticeMessage}
            </div>
          ) : null}
        </>
      ) : null}

      {pickerOpen ? (
        <InfluencerVideoPickerModal
          currentInfluencerId={selectedInfluencer?.id ?? null}
          currentVideoId={selectedVideo?.id ?? null}
          influencers={influencers}
          open
          onOpenChange={setPickerOpen}
          onSelect={handleVideoSelection}
        />
      ) : null}
    </section>
  );
}

function HookWorkspaceLoading() {
  return (
    <div className="flex min-h-[340px] items-center justify-center px-5 py-8">
      <div className="text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-muted">
          Loading influencers
        </p>
      </div>
    </div>
  );
}

function HookWorkspaceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[340px] items-center justify-center px-5 py-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-error/10 text-error">
          <AlertCircle className="size-4.5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground-strong">
          Could not load Hook videos
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}

function HookWorkspaceEmpty({
  description,
  showChoose,
  title,
  onChoose,
}: {
  description: string;
  showChoose: boolean;
  title: string;
  onChoose: () => void;
}) {
  return (
    <div className="flex min-h-[340px] items-center justify-center px-5 py-8 sm:px-8">
      <div className="grid w-full max-w-[600px] items-center gap-7 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-10">
        <div aria-hidden="true" className="mx-auto flex aspect-[9/16] w-[148px] items-center justify-center rounded-[18px] border border-dashed border-border-strong bg-card-muted sm:w-40">
          <span className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted shadow-[0_1px_2px_rgb(23_23_27_/_0.06)]">
            <Video className="size-5" />
          </span>
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand-soft text-primary sm:mx-0">
            <UserRound className="size-4.5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground-strong">
            {title}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
            {description}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {showChoose ? (
              <button
                type="button"
                onClick={onChoose}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <Video className="size-4" aria-hidden="true" />
                Choose video
              </button>
            ) : null}
            <Link
              href="/avatars"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Open Influencers
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
