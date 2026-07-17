"use client";

import { Check, Loader2, UserRound, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function InfluencerVideoPickerModal({
  currentInfluencerId,
  currentVideoId,
  influencers,
  open,
  onOpenChange,
  onSelect,
}: {
  currentInfluencerId: string | null;
  currentVideoId: string | null;
  influencers: HookInfluencerSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: HookVideoPickerSelection) => void;
}) {
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(
    currentInfluencerId,
  );
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    currentVideoId,
  );
  const [videos, setVideos] = useState<HookInfluencerVideoSummary[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVideos = useCallback(async (influencerId: string) => {
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
      const data = (await response.json()) as VideoListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load influencer videos."));
      }

      setVideos(data.videos);
      setSelectedVideoId((currentId) =>
        currentId && data.videos.some((video) => video.id === currentId)
          ? currentId
          : null,
      );
    } catch (error) {
      setVideos([]);
      setSelectedVideoId(null);
      setErrorMessage(getErrorMessage(error, "Could not load influencer videos."));
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !currentInfluencerId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadVideos(currentInfluencerId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentInfluencerId, loadVideos, open]);

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
    if (!selectedInfluencer || !selectedVideo) {
      return;
    }

    onSelect({ influencer: selectedInfluencer, video: selectedVideo, videos });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[900px] flex-col overflow-hidden p-0 sm:max-w-[calc(100%-2rem)]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14">
          <DialogTitle className="text-lg font-semibold text-foreground-strong">
            Choose an influencer
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Select a person first, then choose one of their videos.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {influencers.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {influencers.map((influencer) => {
                const selected = influencer.id === selectedInfluencerId;

                return (
                  <button
                    key={influencer.id}
                    type="button"
                    onClick={() => chooseInfluencer(influencer.id)}
                    aria-pressed={selected}
                    className={cn(
                      "relative min-w-0 overflow-hidden rounded-panel border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                      selected
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-card-muted text-muted">
                      {influencer.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={influencer.thumbnailUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <UserRound className="size-6" aria-hidden="true" />
                      )}
                      {selected ? (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="size-3.5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                    <span className="block px-3 py-2.5">
                      <span className="block truncate text-sm font-semibold text-foreground-strong">
                        {influencer.name}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted">
                        {influencer.videoCount} {influencer.videoCount === 1 ? "video" : "videos"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-36 items-center justify-center rounded-panel border border-dashed border-border-strong px-5 text-center text-sm font-medium text-muted">
              No influencers are available yet.
            </div>
          )}

          {selectedInfluencerId ? (
            <section className="mt-6 border-t border-border pt-5" aria-labelledby="influencer-videos-heading">
              <div className="flex items-center justify-between gap-3">
                <h3 id="influencer-videos-heading" className="text-sm font-semibold text-foreground-strong">
                  Videos from {selectedInfluencer?.name ?? "this influencer"}
                </h3>
                {loadingVideos ? (
                  <Loader2 className="size-4 animate-spin text-muted motion-reduce:animate-none" aria-hidden="true" />
                ) : null}
              </div>

              {errorMessage ? (
                <div role="alert" className="mt-3 rounded-control border border-error/20 bg-error/5 px-3 py-2 text-sm font-semibold text-error">
                  {errorMessage}
                </div>
              ) : null}

              {!loadingVideos && !errorMessage && videos.length === 0 ? (
                <div className="mt-3 flex min-h-28 items-center justify-center rounded-panel border border-dashed border-border-strong px-5 text-center text-sm font-medium text-muted">
                  No videos are available for this influencer.
                </div>
              ) : null}

              {videos.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {videos.map((video) => {
                    const selected = video.id === selectedVideoId;

                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => setSelectedVideoId(video.id)}
                        aria-pressed={selected}
                        className={cn(
                          "min-w-0 overflow-hidden rounded-panel border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                          selected
                            ? "border-primary ring-1 ring-primary"
                            : "border-border hover:border-border-strong",
                        )}
                      >
                        <span className="relative flex aspect-[9/12] items-center justify-center overflow-hidden bg-foreground-strong text-white/65">
                          {video.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <Video className="size-6" aria-hidden="true" />
                          )}
                          {selected ? (
                            <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-white">
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </span>
                        <span className="block px-3 py-2.5">
                          <span className="block truncate text-xs font-semibold text-foreground-strong">
                            {video.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-medium text-muted">
                            {formatDuration(video.durationSeconds)} - {video.ratio === "other" ? "Custom" : video.ratio}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border bg-card-muted/55 px-5 py-4 sm:justify-between">
          <DialogClose className="inline-flex h-10 items-center justify-center rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            Cancel
          </DialogClose>
          <button
            type="button"
            onClick={confirmSelection}
            disabled={!selectedVideo}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Video className="size-4" aria-hidden="true" />
            Use video
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));

  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
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
