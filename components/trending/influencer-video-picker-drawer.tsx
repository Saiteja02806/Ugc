"use client";

import {
  Check,
  Loader2,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
} from "@/lib/trending/hook-video-types";
import { cn } from "@/lib/utils";

type VideoListResponse =
  | { ok: true; videos: HookInfluencerVideoSummary[] }
  | { error?: string; ok?: false };

export type HookVideoPickerSelection = {
  influencer: HookInfluencerSummary;
  video: HookInfluencerVideoSummary;
  videos: HookInfluencerVideoSummary[];
};

export function InfluencerVideoPickerDrawer({
  currentInfluencerId,
  currentVideoId,
  influencers,
  onClose,
  onSelect,
  onSurprise,
}: {
  currentInfluencerId: string | null;
  currentVideoId: string | null;
  influencers: HookInfluencerSummary[];
  onClose: () => void;
  onSelect: (selection: HookVideoPickerSelection) => void;
  onSurprise: () => Promise<void>;
}) {
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(
    currentInfluencerId,
  );
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    currentVideoId,
  );
  const [videos, setVideos] = useState<HookInfluencerVideoSummary[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingSurprise, setLoadingSurprise] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoRequestId = useRef(0);

  const loadVideos = useCallback(async (influencerId: string) => {
    const requestId = videoRequestId.current + 1;
    videoRequestId.current = requestId;
    setLoadingVideos(true);
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before choosing an influencer.");
      }

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

      if (videoRequestId.current === requestId) {
        setVideos(data.videos);
        setSelectedVideoId((currentId) =>
          currentId && data.videos.some((video) => video.id === currentId)
            ? currentId
            : null,
        );
      }
    } catch (error) {
      if (videoRequestId.current === requestId) {
        setVideos([]);
        setSelectedVideoId(null);
        setErrorMessage(
          getErrorMessage(error, "Could not load influencer videos."),
        );
      }
    } finally {
      if (videoRequestId.current === requestId) {
        setLoadingVideos(false);
      }
    }
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (!currentInfluencerId) return;

    const timer = window.setTimeout(() => {
      void loadVideos(currentInfluencerId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentInfluencerId, loadVideos]);

  const selectedInfluencer =
    influencers.find((item) => item.id === selectedInfluencerId) ?? null;
  const selectedVideo =
    videos.find((item) => item.id === selectedVideoId) ?? null;

  function chooseInfluencer(influencerId: string) {
    setSelectedInfluencerId(influencerId);
    setSelectedVideoId(null);
    void loadVideos(influencerId);
  }

  function confirmSelection() {
    if (!selectedInfluencer || !selectedVideo) return;
    onSelect({ influencer: selectedInfluencer, video: selectedVideo, videos });
    onClose();
  }

  async function chooseSurprise() {
    setLoadingSurprise(true);
    setErrorMessage(null);

    try {
      await onSurprise();
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load Surprise me."));
    } finally {
      setLoadingSurprise(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label="Close video chooser"
        className="absolute inset-0 cursor-default bg-foreground-strong/24 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        aria-label="Choose an influencer video"
        aria-modal="true"
        role="dialog"
        className="absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col border-t border-border bg-card shadow-[0_-16px_42px_rgb(23_23_27_/_0.16)] sm:inset-y-0 sm:left-0 sm:right-auto sm:h-auto sm:w-[380px] sm:border-r sm:border-t-0 sm:shadow-[16px_0_42px_rgb(23_23_27_/_0.14)]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold text-foreground-strong">
            Choose video
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Close video chooser"
            title="Close"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
          <div
            className={cn(
              "min-h-0 overflow-y-auto pr-1",
              selectedInfluencerId ? "max-h-[42%] shrink-0" : "flex-1",
            )}
          >
            <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => void chooseSurprise()}
              disabled={loadingSurprise}
              className="flex min-h-24 min-w-0 flex-col items-start justify-between border border-primary/35 bg-brand-soft p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {loadingSurprise ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="text-sm font-semibold text-foreground-strong">
                Surprise me
              </span>
            </button>

            {influencers.map((influencer) => {
              const selected = influencer.id === selectedInfluencerId;

              return (
                <button
                  key={influencer.id}
                  type="button"
                  onClick={() => chooseInfluencer(influencer.id)}
                  aria-pressed={selected}
                  className={cn(
                    "relative min-h-24 min-w-0 overflow-hidden border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="absolute inset-0 bg-card-muted">
                    {influencer.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={influencer.thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted">
                        <UserRound className="size-6" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 bg-foreground-strong/76 px-2.5 py-2 text-white">
                    <span className="block truncate text-xs font-semibold">
                      {influencer.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-white/72">
                      {influencer.sourceKind === "user"
                        ? "Uploaded"
                        : `${influencer.videoCount} ${influencer.videoCount === 1 ? "video" : "videos"}`}
                    </span>
                  </span>
                  {selected ? (
                    <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
            </div>
          </div>

          {selectedInfluencerId ? (
            <section className="flex min-h-0 flex-1 flex-col border-t border-border pt-4" aria-labelledby="hook-picker-videos">
              <div className="flex min-h-6 items-center justify-between gap-3">
                <h3 id="hook-picker-videos" className="truncate text-xs font-semibold text-foreground-strong">
                  {selectedInfluencer?.name ?? "Videos"}
                </h3>
                {loadingVideos ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted motion-reduce:animate-none" aria-hidden="true" />
                ) : null}
              </div>

              {errorMessage ? (
                <p role="alert" className="mt-3 border-l-2 border-error px-3 py-1 text-xs font-semibold leading-5 text-error">
                  {errorMessage}
                </p>
              ) : null}

              {!loadingVideos && !errorMessage && videos.length === 0 ? (
                <p className="mt-3 border border-dashed border-border-strong px-3 py-5 text-center text-xs font-medium text-muted">
                  No videos available.
                </p>
              ) : null}

              {videos.length > 0 ? (
                <div className="mt-3 grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pr-1">
                  {videos.map((video) => {
                    const selected = video.id === selectedVideoId;

                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => setSelectedVideoId(video.id)}
                        aria-label={video.title}
                        aria-pressed={selected}
                        className={cn(
                          "relative aspect-[9/14] min-w-0 overflow-hidden border bg-card-muted text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                          selected
                            ? "border-primary ring-1 ring-primary"
                            : "border-border-strong hover:border-primary/65",
                        )}
                      >
                        {video.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <Video className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
                        )}
                        {selected ? (
                          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3.5" aria-hidden="true" />
                          </span>
                        ) : null}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-card/85 px-2 py-1.5 text-left text-[10px] font-semibold text-foreground">
                          {video.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={confirmSelection}
            disabled={!selectedVideo}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Video className="size-4" aria-hidden="true" />
            Use video
          </button>
        </footer>
      </aside>
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
