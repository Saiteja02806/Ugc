"use client";

import { AlertCircle, Loader2, RefreshCw, UserRound, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { HookVideoComposer } from "@/components/trending/hook-video-composer";
import { HookVideoDeck } from "@/components/trending/hook-video-deck";
import {
  InfluencerVideoPickerDrawer,
  type HookVideoPickerSelection,
} from "@/components/trending/influencer-video-picker-drawer";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  INITIAL_HOOK_VIDEO_FLOW_STATE,
  beginHookVideoComposition,
  type HookVideoFlowState,
} from "@/lib/trending/hook-video-flow";
import {
  createNonRepeatingHookVideoCycle,
  getHookVideoBrowseEntryKey,
} from "@/lib/trending/hook-video-source-logic";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
  HookVideoBrowseEntry,
} from "@/lib/trending/hook-video-types";

type HookBrowseMode = "influencer" | "surprise";

type InfluencerListResponse =
  | { influencers: HookInfluencerSummary[]; ok: true }
  | { error?: string; ok?: false };

type VideoListResponse =
  | { ok: true; videos: HookInfluencerVideoSummary[] }
  | { error?: string; ok?: false };

type SurpriseResponse =
  | { entries: HookVideoBrowseEntry[]; ok: true }
  | { error?: string; ok?: false };

type PreviewSessionResponse =
  | { expiresAt: string; ok: true; previewUrl: string }
  | { error?: string; ok?: false };

export function HookVideoWorkspace({ active }: { active: boolean }) {
  const { loading: authLoading, user } = useAuth();
  const [flowState, setFlowState] = useState<HookVideoFlowState>(
    INITIAL_HOOK_VIDEO_FLOW_STATE,
  );
  const [browseMode, setBrowseMode] = useState<HookBrowseMode>("influencer");
  const [influencers, setInfluencers] = useState<HookInfluencerSummary[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] =
    useState<HookInfluencerSummary | null>(null);
  const [videos, setVideos] = useState<HookInfluencerVideoSummary[]>([]);
  const [selectedVideo, setSelectedVideo] =
    useState<HookInfluencerVideoSummary | null>(null);
  const [surpriseQueue, setSurpriseQueue] = useState<HookVideoBrowseEntry[]>([]);
  const [surpriseIndex, setSurpriseIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [loadAttempted, setLoadAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestId = useRef(0);
  const surpriseRequestInFlight = useRef(false);

  const loadProtectedPreview = useCallback(
    async (video: HookInfluencerVideoSummary) => {
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
        const data = (await response.json().catch(() => null)) as
          | PreviewSessionResponse
          | null;

        if (!response.ok || !data || data.ok !== true) {
          throw new Error(getApiError(data, "Could not load protected preview."));
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
    },
    [],
  );

  const showBrowseEntry = useCallback(
    (params: {
      entry: HookVideoBrowseEntry;
      mode: HookBrowseMode;
      videos: HookInfluencerVideoSummary[];
    }) => {
      setBrowseMode(params.mode);
      setSelectedInfluencer(params.entry.influencer);
      setSelectedVideo(params.entry.video);
      setVideos(params.videos);
      setFlowState(INITIAL_HOOK_VIDEO_FLOW_STATE);
      setNoticeMessage(null);
      void loadProtectedPreview(params.entry.video);
    },
    [loadProtectedPreview],
  );

  const loadInfluencers = useCallback(async () => {
    if (authLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      if (!user) {
        throw new Error("Sign in before creating hook videos.");
      }

      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before creating hook videos.");
      }

      const response = await fetch("/api/trending/hook-videos/influencers", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | InfluencerListResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load influencers."));
      }

      setInfluencers(data.influencers);

      for (const influencer of data.influencers) {
        try {
          const influencerVideos = await fetchHookInfluencerVideos(
            influencer.id,
            token,
          );
          const firstVideo = influencerVideos[0];

          if (firstVideo) {
            showBrowseEntry({
              entry: { influencer, video: firstVideo },
              mode: "influencer",
              videos: influencerVideos,
            });
            return;
          }
        } catch (error) {
          console.warn(
            `Could not load the default Hook video for ${influencer.id}:`,
            error,
          );
        }
      }

      setSelectedInfluencer(null);
      setSelectedVideo(null);
      setVideos([]);
      setNoticeMessage("No influencer videos are ready yet.");
    } catch (error) {
      setInfluencers([]);
      setSelectedInfluencer(null);
      setSelectedVideo(null);
      setVideos([]);
      setErrorMessage(getErrorMessage(error, "Could not load influencers."));
    } finally {
      setIsLoading(false);
      setLoadAttempted(true);
    }
  }, [authLoading, showBrowseEntry, user]);

  useEffect(() => {
    if (!active || authLoading || loadAttempted) return;

    const timer = window.setTimeout(() => void loadInfluencers(), 0);
    return () => window.clearTimeout(timer);
  }, [active, authLoading, loadAttempted, loadInfluencers]);

  const markSurpriseSeen = useCallback(
    (entry: HookVideoBrowseEntry, seenKeys?: Set<string>) => {
      if (!user) return;

      const nextSeen = seenKeys ?? readSeenEntryKeys(user.uid);
      nextSeen.add(getHookVideoBrowseEntryKey(entry));
      writeSeenEntryKeys(user.uid, nextSeen);
    },
    [user],
  );

  const startSurprise = useCallback(async () => {
    if (surpriseRequestInFlight.current) return;
    if (!user) throw new Error("Sign in before choosing Surprise me.");

    surpriseRequestInFlight.current = true;
    setSurpriseLoading(true);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before choosing Surprise me.");
      }

      const response = await fetch("/api/trending/hook-videos/surprise", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | SurpriseResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load Surprise me."));
      }

      const seenKeys = readSeenEntryKeys(user.uid);
      const cycle = createNonRepeatingHookVideoCycle(data.entries, seenKeys);
      const firstEntry = cycle.entries[0];

      if (!firstEntry) {
        throw new Error("No influencer videos are ready for Surprise me.");
      }

      if (cycle.resetCycle) seenKeys.clear();

      setSurpriseQueue(cycle.entries);
      setSurpriseIndex(0);
      showBrowseEntry({
        entry: firstEntry,
        mode: "surprise",
        videos: cycle.entries.map((entry) => entry.video),
      });
      markSurpriseSeen(firstEntry, seenKeys);
    } finally {
      surpriseRequestInFlight.current = false;
      setSurpriseLoading(false);
    }
  }, [markSurpriseSeen, showBrowseEntry, user]);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  function handleVideoSelection(selection: HookVideoPickerSelection) {
    setSurpriseQueue([]);
    setSurpriseIndex(0);
    showBrowseEntry({
      entry: {
        influencer: selection.influencer,
        video: selection.video,
      },
      mode: "influencer",
      videos: selection.videos,
    });
  }

  function handleSkip() {
    if (!selectedVideo) return;

    if (browseMode === "surprise") {
      const nextIndex = surpriseIndex + 1;
      const nextEntry = surpriseQueue[nextIndex];

      if (nextEntry) {
        setSurpriseIndex(nextIndex);
        showBrowseEntry({
          entry: nextEntry,
          mode: "surprise",
          videos: surpriseQueue.map((entry) => entry.video),
        });
        markSurpriseSeen(nextEntry);
        return;
      }

      void startSurprise().catch((error) => {
        setNoticeMessage(getErrorMessage(error, "Could not load another video."));
      });
      return;
    }

    const currentIndex = videos.findIndex((video) => video.id === selectedVideo.id);
    const nextVideo = videos[currentIndex + 1];

    if (!nextVideo) {
      setNoticeMessage("Choose another influencer or use Surprise me.");
      setPickerOpen(true);
      return;
    }

    showBrowseEntry({
      entry: { influencer: selectedInfluencer!, video: nextVideo },
      mode: "influencer",
      videos,
    });
  }

  function handleCompose() {
    if (!selectedVideo) return;

    setPickerOpen(false);
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

  const selectedVideoIndex = selectedVideo
    ? videos.findIndex((video) => video.id === selectedVideo.id)
    : -1;
  const selectedPosition =
    browseMode === "surprise"
      ? surpriseIndex + 1
      : selectedVideoIndex >= 0
        ? selectedVideoIndex + 1
        : 0;
  const selectedTotal =
    browseMode === "surprise" ? surpriseQueue.length : videos.length;
  const nextVideo =
    browseMode === "surprise"
      ? surpriseQueue[surpriseIndex + 1]?.video ?? null
      : selectedVideoIndex >= 0
        ? videos[selectedVideoIndex + 1] ?? null
        : null;

  return (
    <section
      className="relative mt-6"
      data-hook-browse-mode={browseMode}
      data-hook-video-stage={flowState.stage}
    >
      {isLoading ? <HookWorkspaceLoading /> : null}

      {!isLoading && errorMessage ? (
        <HookWorkspaceError
          message={errorMessage}
          onRetry={() => void loadInfluencers()}
        />
      ) : null}

      {!isLoading && !errorMessage && loadAttempted && influencers.length === 0 ? (
        <HookWorkspaceEmpty
          description="No influencer videos are ready yet."
          title="No influencers available"
          showChoose={false}
          onChoose={() => setPickerOpen(true)}
        />
      ) : null}

      {!isLoading && !errorMessage && influencers.length > 0 && !selectedVideo ? (
        <HookWorkspaceEmpty
          description="Choose an available influencer video."
          title="No video available"
          showChoose
          onChoose={() => setPickerOpen(true)}
        />
      ) : null}

      {!isLoading &&
      flowState.stage === "browse" &&
      selectedInfluencer &&
      selectedVideo ? (
        <>
          <HookVideoDeck
            browseMode={browseMode}
            influencer={selectedInfluencer}
            nextVideo={nextVideo}
            position={selectedPosition}
            previewError={previewError}
            previewLoading={previewLoading}
            previewUrl={previewUrl}
            surpriseLoading={surpriseLoading}
            total={selectedTotal}
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
            <p className="mt-3 text-center text-xs font-semibold text-muted">
              {noticeMessage}
            </p>
          ) : null}
        </>
      ) : null}

      {flowState.stage !== "browse" && selectedInfluencer && selectedVideo ? (
        <HookVideoComposer
          flowState={flowState}
          influencer={selectedInfluencer}
          openingPreviewUrl={previewUrl}
          video={selectedVideo}
          onClose={() => setFlowState(INITIAL_HOOK_VIDEO_FLOW_STATE)}
          onStateChange={setFlowState}
        />
      ) : null}

      {pickerOpen ? (
        <InfluencerVideoPickerDrawer
          currentInfluencerId={selectedInfluencer?.id ?? null}
          currentVideoId={browseMode === "influencer" ? selectedVideo?.id ?? null : null}
          influencers={influencers}
          onClose={closePicker}
          onSelect={handleVideoSelection}
          onSurprise={startSurprise}
        />
      ) : null}
    </section>
  );
}

function HookWorkspaceLoading() {
  return (
    <div className="flex min-h-[430px] items-center justify-center px-5 py-8">
      <div className="text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-muted">
          Loading influencer videos
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
    <div className="flex min-h-[430px] items-center justify-center px-5 py-8">
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
    <div className="flex min-h-[430px] items-center justify-center px-5 py-8 sm:px-8">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand-soft text-primary">
          {showChoose ? (
            <UserRound className="size-5" aria-hidden="true" />
          ) : (
            <Video className="size-5" aria-hidden="true" />
          )}
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground-strong">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        {showChoose ? (
          <button
            type="button"
            onClick={onChoose}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <Video className="size-4" aria-hidden="true" />
            Choose
          </button>
        ) : null}
      </div>
    </div>
  );
}

async function fetchHookInfluencerVideos(influencerId: string, token: string) {
  const response = await fetch(
    `/api/trending/hook-videos/influencers/${encodeURIComponent(influencerId)}/videos`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = (await response.json().catch(() => null)) as
    | VideoListResponse
    | null;

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(getApiError(data, "Could not load influencer videos."));
  }

  return data.videos;
}

function getSurpriseStorageKey(userId: string) {
  return `ugc-pilot:hook-video-surprise-seen:${userId}`;
}

function readSeenEntryKeys(userId: string) {
  try {
    const value = window.sessionStorage.getItem(getSurpriseStorageKey(userId));
    const parsed = value ? (JSON.parse(value) as unknown) : [];

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function writeSeenEntryKeys(userId: string, seenKeys: Set<string>) {
  try {
    window.sessionStorage.setItem(
      getSurpriseStorageKey(userId),
      JSON.stringify([...seenKeys]),
    );
  } catch {
    // The in-memory queue still prevents repeats when storage is unavailable.
  }
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
