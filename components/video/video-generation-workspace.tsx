"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Lock,
  Loader2,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import { getCreativeAssetEditorHref } from "@/lib/edit/routes";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useBackgroundJob,
  useCancelBackgroundJob,
  usePersistedJobIdFromUrl,
  useRetryBackgroundJob,
} from "@/lib/jobs/background-job-client";
import type { Json } from "@/lib/jobs/background-jobs";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";
import {
  getAvatarDisplayName,
  getAvatarFallbackText,
} from "@/lib/video/avatar-display";

type VideoRatio = "9:16" | "1:1" | "4:5" | "16:9";
type VideoCount = 1 | 2 | 4;
type GenerationState = "empty" | "generating" | "completed" | "failed";

type AvatarOption = {
  id: string;
  label: string;
  selection: AvatarSelection;
  thumbnailUrl: string | null;
};

type AvatarRatio = "9:16" | "1:1" | "4:5" | "16:9" | "other";
type AvatarStatus = "ready" | "disabled" | "processing" | "failed";

type AvatarAsset = {
  avatarType: "global";
  createdAt: string;
  description: string | null;
  durationSeconds: number | null;
  height: number | null;
  id: string;
  metadata: unknown;
  name: string;
  ratio: AvatarRatio;
  sourceVideoUrl: string;
  status: AvatarStatus;
  thumbnailUrl: string | null;
  updatedAt: string;
  width: number | null;
};

type AvatarPreference = {
  avatarAssetId: string;
  id: string;
  isTrimmed: boolean;
  lastUsedAt: string | null;
  trimEnd: number | null;
  trimStart: number | null;
  updatedAt: string;
} | null;

type AvatarSelection = {
  avatarAssetId: string;
  isTrimmed: boolean;
  sourceVideoUrl: string;
  trimEnd: number | null;
  trimStart: number;
};

type AvatarLibraryItem = {
  asset: AvatarAsset;
  avatarSelection: AvatarSelection;
  preference: AvatarPreference;
};

type AvatarListResponse =
  | {
      avatars: AvatarLibraryItem[];
      ok: true;
    }
  | {
      error?: string;
      ok?: false;
    };

type GeneratedVideo = {
  avatarName: string;
  createdAt?: string;
  duration?: string;
  id: string;
  mediaAssetId?: string;
  prompt: string;
  ratio: VideoRatio;
  status: "Ready" | "Processing" | "Failed";
  title: string;
  url?: string;
};

const instagramVideoFormatLabels: Record<VideoRatio, string> = {
  "9:16": "Reel",
  "1:1": "Square",
  "4:5": "Feed",
  "16:9": "Landscape",
};

type GenerateVideoResponse =
  | {
      jobId: string;
      message: string;
      ok: true;
      videoId: string;
    }
  | {
      error: string;
      ok: false;
    };

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getVideoJobOutput(output: Json | null) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  return {
    url: typeof output.url === "string" ? output.url : null,
    videoId: typeof output.videoId === "string" ? output.videoId : null,
  };
}

function persistPendingVideoMetadata(
  jobId: string,
  metadata: { avatarName: string; prompt: string },
) {
  try {
    window.sessionStorage.setItem(
      `ugc-video-job:${jobId}`,
      JSON.stringify(metadata),
    );
  } catch {
    // Supabase remains authoritative; this metadata only restores local labels.
  }
}

function getPendingVideoMetadata(jobId: string) {
  try {
    const rawValue = window.sessionStorage.getItem(`ugc-video-job:${jobId}`);

    if (!rawValue) {
      return null;
    }

    const value = JSON.parse(rawValue) as Record<string, unknown>;

    return {
      avatarName:
        typeof value.avatarName === "string" ? value.avatarName : "",
      prompt: typeof value.prompt === "string" ? value.prompt : "",
    };
  } catch {
    return null;
  }
}

export function VideoGenerationWorkspace() {
  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-[#1F1F1F] px-4 py-4 text-[#F5F3F0] sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-[#F5F3F0] sm:text-3xl">
            AI Studio
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#B9B5AF]">
            Generate images and videos from one focused workspace.
          </p>
        </div>

        <div className="inline-flex h-8 w-fit items-center gap-2 rounded-[var(--radius-control)] border border-[#383838] bg-[#242424] px-3 text-xs font-semibold text-[#B9B5AF]">
          <Lock className="size-3.5" aria-hidden="true" />
          Preview mode
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        <VideoGenerationStudioPanel />
      </div>
    </section>
  );
}

export function VideoGenerationStudioPanel({
  accessState = "locked",
  active = true,
}: {
  accessState?: AIStudioAccessState;
  active?: boolean;
}) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [avatarLibrary, setAvatarLibrary] = useState<AvatarLibraryItem[]>([]);
  const [personalAvatarAssets, setPersonalAvatarAssets] = useState<MediaAsset[]>([]);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
    null,
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [generationState, setGenerationState] =
    useState<GenerationState>("empty");
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl();
  const activeJobId = submittedJobId ?? persistedJobId;
  const activeJobQuery = useBackgroundJob(activeJobId);
  const cancelJob = useCancelBackgroundJob();
  const retryJob = useRetryBackgroundJob();
  const generationLocked = accessState !== "pro";
  const ratio: VideoRatio = "9:16";
  const videoCount: VideoCount = 1;

  const personalAvatars = useMemo(
    () => personalAvatarAssets.map(mapPersonalMediaToAvatarOption),
    [personalAvatarAssets],
  );
  const globalAvatars = useMemo(
    () => avatarLibrary.map(mapAvatarLibraryItemToOption),
    [avatarLibrary],
  );
  const avatarOptions = useMemo(
    () => [...personalAvatars, ...globalAvatars],
    [globalAvatars, personalAvatars],
  );
  const selectedAvatar = selectedAvatarId
    ? avatarOptions.find((avatar) => avatar.id === selectedAvatarId) ?? null
    : null;
  const durableJob = activeJobQuery.data;
  const durableOutput = durableJob
    ? getVideoJobOutput(durableJob.output)
    : null;
  const durableNotice =
    durableJob?.status === "cancelled"
      ? "Video generation was cancelled."
      : durableJob?.status === "failed"
        ? durableJob.error?.message || "Video generation failed. You can retry it."
        : durableJob?.status === "completed" && !durableOutput?.url
          ? "Video generation completed without a usable output."
          : null;
  const effectiveGenerationState: GenerationState =
    activeJobId && activeJobQuery.isPending
      ? "generating"
      : durableJob && !["cancelled", "completed", "failed"].includes(durableJob.status)
        ? "generating"
        : durableJob?.status === "failed" ||
            durableJob?.status === "cancelled" ||
            (durableJob?.status === "completed" && !durableOutput?.url)
          ? "failed"
          : generationState;
  const isGenerating =
    effectiveGenerationState === "generating";

  useEffect(() => {
    const job = activeJobQuery.data;

    if (!job || resolvedJobIdsRef.current.has(job.id)) {
      return;
    }

    if (job.status !== "completed") {
      return;
    }

    const output = getVideoJobOutput(job.output);

    if (!output?.url) {
      return;
    }

    const completedJob = job;
    const completedOutput = output;
    const outputUrl = output.url;

    let ignore = false;

    async function restoreCompletedVideo() {
      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to restore the generated video.");
        }

        const metadata = getPendingVideoMetadata(completedJob.id);
        const mediaAsset = await findGeneratedVideoAsset(completedJob.id, token);
        const videoId =
          mediaAsset?.id ?? completedOutput.videoId ?? completedJob.id;
        const nextVideo: GeneratedVideo = {
          avatarName: metadata?.avatarName || "Generated presenter",
          createdAt: "Just now",
          id: videoId,
          mediaAssetId: mediaAsset?.id,
          prompt: metadata?.prompt || "Generated video",
          ratio: "9:16",
          status: "Ready",
          title: getGeneratedVideoTitle(
            metadata?.prompt || "Generated video",
          ),
          url: mediaAsset?.url ?? outputUrl,
        };

        if (ignore) {
          return;
        }

        resolvedJobIdsRef.current.add(completedJob.id);
        setGeneratedVideos((currentVideos) =>
          currentVideos.some((video) => video.id === nextVideo.id)
            ? currentVideos
            : [nextVideo, ...currentVideos],
        );
        setSelectedVideoId(nextVideo.id);
        setGenerationState("completed");
        setActionNotice(null);
      } catch (error) {
        if (!ignore) {
          setGenerationState("failed");
          setActionNotice(
            getErrorMessage(error, "Could not restore the generated video."),
          );
        }
      }
    }

    void restoreCompletedVideo();

    return () => {
      ignore = true;
    };
  }, [activeJobQuery.data]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let ignore = false;

    async function loadAvatarLibrary() {
      if (authLoading) {
        return;
      }

      setAvatarErrorMessage(null);

      if (!user) {
        setAvatarLibrary([]);
        setPersonalAvatarAssets([]);
        setSelectedAvatarId(null);
        setAvatarLoading(false);
        setAvatarErrorMessage("Sign in before choosing a presenter.");
        return;
      }

      setAvatarLoading(true);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before choosing a presenter.");
        }

        const [libraryResult, personalResult] = await Promise.allSettled([
          fetchAvatarLibrary(token),
          fetchPersonalInfluencers(token),
        ]);

        if (ignore) {
          return;
        }

        const nextAvatarLibrary =
          libraryResult.status === "fulfilled" ? libraryResult.value : [];
        const nextPersonalAssets =
          personalResult.status === "fulfilled" ? personalResult.value : [];
        const partialErrors = [libraryResult, personalResult]
          .filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          )
          .map((result) =>
            getErrorMessage(result.reason, "Could not load presenters."),
          );

        setAvatarLibrary(nextAvatarLibrary);
        setPersonalAvatarAssets(nextPersonalAssets);
        setAvatarErrorMessage(
          partialErrors.length > 0 ? partialErrors.join(" ") : null,
        );
        setSelectedAvatarId((currentAvatarId) =>
          currentAvatarId &&
          (nextAvatarLibrary.some(
            (avatar) => avatar.asset.id === currentAvatarId,
          ) || nextPersonalAssets.some((asset) => asset.id === currentAvatarId))
            ? currentAvatarId
            : nextPersonalAssets[0]?.id ??
              nextAvatarLibrary[0]?.asset.id ??
              null,
        );
      } catch (error) {
        if (!ignore) {
          setAvatarLibrary([]);
          setPersonalAvatarAssets([]);
          setSelectedAvatarId(null);
          setAvatarErrorMessage(
            getErrorMessage(error, "Could not load presenters."),
          );
        }
      } finally {
        if (!ignore) {
          setAvatarLoading(false);
        }
      }
    }

    void loadAvatarLibrary();

    return () => {
      ignore = true;
    };
  }, [active, authLoading, user]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const trimmedPrompt = prompt.trim();

    if (generationLocked || !trimmedPrompt || isGenerating) {
      return;
    }

    if (!selectedAvatar) {
      setActionNotice(
        avatarLoading
          ? "Presenter library is still loading."
          : "Choose a presenter before generating.",
      );
      return;
    }

    if (!selectedAvatar.thumbnailUrl) {
      setActionNotice(
        "Choose a presenter with a preview image before generating.",
      );
      return;
    }

    setActionNotice(null);
    setGenerationState("generating");

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before generating a video.");
      }

      const idempotencyKey =
        submissionKeyRef.current ?? crypto.randomUUID();
      submissionKeyRef.current = idempotencyKey;

      const response = await fetch("/api/ai-studio/videos/generate", {
        body: JSON.stringify({
          avatarImageUrl: selectedAvatar.thumbnailUrl,
          idempotencyKey,
          prompt: trimmedPrompt,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const data = (await response.json()) as GenerateVideoResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.ok === false ? data.error : "Video generation could not start.",
        );
      }
      persistPendingVideoMetadata(data.jobId, {
        avatarName: selectedAvatar.label,
        prompt: trimmedPrompt,
      });
      persistJobIdInUrl(data.jobId);
      resolvedJobIdsRef.current.delete(data.jobId);
      setSubmittedJobId(data.jobId);
      submissionKeyRef.current = null;
      setPrompt("");
    } catch (error) {
      console.error("Video generation failed:", error);
      setActionNotice(
        getErrorMessage(error, "Video generation failed. Try again."),
      );
      setGenerationState("failed");
    }
  }

  async function handleCancelGeneration() {
    if (!activeJobId || cancelJob.isPending) {
      return;
    }

    try {
      await cancelJob.mutateAsync(activeJobId);
      setActionNotice(
        "Cancellation requested. The current checkpoint will stop safely.",
      );
    } catch (error) {
      setActionNotice(
        getErrorMessage(error, "Could not cancel this video job."),
      );
    }
  }

  async function handleRetryGeneration() {
    if (!activeJobId || retryJob.isPending) {
      return;
    }

    try {
      resolvedJobIdsRef.current.delete(activeJobId);
      await retryJob.mutateAsync(activeJobId);
      setGenerationState("generating");
      setActionNotice(null);
    } catch (error) {
      setActionNotice(getErrorMessage(error, "Could not retry this video job."));
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleEnhancePrompt() {
    const trimmedPrompt = prompt.trim();
    const enhancement =
      "Structure notes: lead with the stated hook, keep the message concise and direct, show only the described product context, and end with one clear action.";

    if (generationLocked || !trimmedPrompt) {
      return;
    }

    if (trimmedPrompt.includes("Structure notes:")) {
      return;
    }

    setPrompt(`${trimmedPrompt}\n\n${enhancement}`);
  }

  function handleEditVideo(video: GeneratedVideo) {
    setSelectedVideoId(video.id);

    if (!video.url) {
      setActionNotice("This video needs to finish generating before editing.");
      return;
    }

    if (!video.mediaAssetId) {
      setActionNotice(
        "The generated video is still being added to Creative Assets.",
      );
      return;
    }

    router.push(getCreativeAssetEditorHref(video.mediaAssetId));
  }

  function handleUseAsHook(video: GeneratedVideo) {
    setSelectedVideoId(video.id);
    setActionNotice("Hook asset selection will connect when generation storage is ready.");
  }

  return (
    <div
      id="ai-studio-videos-panel"
      role="tabpanel"
      aria-labelledby="ai-studio-videos-tab"
      hidden={!active}
      className={cn(
        "min-h-0 flex-1 flex-col gap-4",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <VideoResultsArea
        actionNotice={durableNotice ?? actionNotice}
        generatedVideos={generatedVideos}
        generationState={effectiveGenerationState}
        ratio={ratio}
        selectedVideoId={selectedVideoId}
        videoCount={videoCount}
        onEditVideo={handleEditVideo}
        onSelectVideo={setSelectedVideoId}
        onUseAsHook={handleUseAsHook}
      />

      <VideoPromptBar
        active={active}
        avatarErrorMessage={avatarErrorMessage}
        avatarLoading={avatarLoading}
        avatar={selectedAvatar}
        generationLocked={generationLocked}
        globalAvatars={globalAvatars}
        isGenerating={isGenerating}
        canRetry={
          activeJobQuery.data?.status === "failed" &&
          Boolean(activeJobQuery.data.error?.retryable)
        }
        personalAvatars={personalAvatars}
        prompt={prompt}
        selectedAvatarId={selectedAvatarId}
        onAvatarChange={(avatarId) => {
          submissionKeyRef.current = null;
          setSelectedAvatarId(avatarId);
        }}
        onCancel={() => void handleCancelGeneration()}
        onEnhancePrompt={handleEnhancePrompt}
        onPromptChange={(nextPrompt) => {
          submissionKeyRef.current = null;
          setPrompt(nextPrompt);
        }}
        onRetry={() => void handleRetryGeneration()}
        onSubmit={handleSubmit}
        onTextareaKeyDown={handleTextareaKeyDown}
      />
    </div>
  );
}

function mapAvatarLibraryItemToOption(avatar: AvatarLibraryItem): AvatarOption {
  return {
    id: avatar.asset.id,
    label: avatar.asset.name,
    selection: avatar.avatarSelection,
    thumbnailUrl: avatar.asset.thumbnailUrl,
  };
}

async function fetchAvatarLibrary(token: string) {
  const response = await fetch("/api/avatars", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as AvatarListResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not load the presenter library."));
  }

  return data.avatars;
}

async function fetchPersonalInfluencers(token: string) {
  const response = await fetch("/api/media?collection=influencer", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as
    | { assets: MediaAsset[]; ok: true }
    | { error?: string; ok?: false };

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not load your source videos."));
  }

  return data.assets;
}

async function findGeneratedVideoAsset(jobId: string, token: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch("/api/media?collection=video", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as
      | { assets: MediaAsset[]; ok: true }
      | { error?: string; ok?: false };

    if (response.ok && data.ok === true) {
      const asset = data.assets.find(
        (candidate) =>
          candidate.sourceType === "generated_video" &&
          candidate.sourceRecordId === jobId &&
          candidate.status === "ready",
      );

      if (asset) {
        return asset;
      }
    }

    if (attempt < 7) {
      await sleep(500);
    }
  }

  return null;
}

function mapPersonalMediaToAvatarOption(asset: MediaAsset): AvatarOption {
  return {
    id: asset.id,
    label: asset.title,
    selection: {
      avatarAssetId: asset.id,
      isTrimmed: false,
      sourceVideoUrl: asset.url,
      trimEnd: asset.durationSeconds,
      trimStart: 0,
    },
    thumbnailUrl: asset.thumbnailUrl,
  };
}

function getGeneratedVideoTitle(prompt: string) {
  const singleLinePrompt = prompt.replace(/\s+/g, " ").trim();

  return singleLinePrompt.length > 54
    ? `${singleLinePrompt.slice(0, 51)}…`
    : singleLinePrompt;
}

function getApiErrorMessage(response: unknown, fallback: string) {
  if (
    response &&
    typeof response === "object" &&
    "error" in response &&
    typeof response.error === "string"
  ) {
    return response.error;
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function VideoResultsArea({
  actionNotice,
  generatedVideos,
  generationState,
  onEditVideo,
  onSelectVideo,
  onUseAsHook,
  ratio,
  selectedVideoId,
  videoCount,
}: {
  actionNotice: string | null;
  generatedVideos: GeneratedVideo[];
  generationState: GenerationState;
  onEditVideo: (video: GeneratedVideo) => void;
  onSelectVideo: (videoId: string) => void;
  onUseAsHook: (video: GeneratedVideo) => void;
  ratio: VideoRatio;
  selectedVideoId: string | null;
  videoCount: VideoCount;
}) {
  return (
    <section className="relative flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-[#191919] shadow-[0_20px_55px_rgb(0_0_0_/_0.22)] md:min-h-0">
      <header className="relative z-10 flex min-h-12 items-center justify-between gap-3 border-b border-border/70 bg-card-muted/35 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Video className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Videos</h2>
          <span className="text-xs text-muted">
            {ratio} {instagramVideoFormatLabels[ratio]}
          </span>
        </div>
        <span className="text-xs font-medium text-muted">
          {generatedVideos.length > 0
            ? `${generatedVideos.length} generated`
            : `${videoCount} ${videoCount === 1 ? "output" : "outputs"}`}
        </span>
      </header>

      {generationState === "failed" ? (
        <div
          role="alert"
          className="absolute left-4 top-16 z-20 w-fit rounded-full border border-error/35 bg-[#2A2020] px-3 py-2 text-xs font-semibold text-error shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-5"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            Video generation failed. Review the prompt and try again.
          </div>
        </div>
      ) : null}

      {generationState === "generating" ? (
        <div
          role="status"
          className="absolute left-4 top-16 z-20 w-fit rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-5"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            Creating your video…
          </div>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-4 top-16 z-20 w-fit rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-xs font-medium text-muted shadow-card sm:left-5"
        >
          {actionNotice}
        </div>
      ) : null}

      {generatedVideos.length > 0 ? (
        <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {generatedVideos.map((video) => (
            <VideoResultCard
              key={video.id}
              selected={selectedVideoId === video.id}
              video={video}
              onEdit={() => onEditVideo(video)}
              onSelect={() => onSelectVideo(video.id)}
              onUseAsHook={() => onUseAsHook(video)}
            />
          ))}
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-8 text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_srgb,var(--instagram-violet)_13%,transparent),transparent_30%),radial-gradient(circle_at_58%_62%,color-mix(in_srgb,var(--instagram-rose)_11%,transparent),transparent_36%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]"
          />

          <div className="relative max-w-sm">
            <span className="mx-auto flex size-12 items-center justify-center rounded-[14px] border border-primary/25 bg-brand-soft text-primary shadow-sm">
              <Video className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No videos yet
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              Describe your Reel and choose a presenter below. Generated videos
              will appear here.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function VideoPromptBar({
  active,
  avatar,
  avatarErrorMessage,
  avatarLoading,
  canRetry,
  generationLocked,
  globalAvatars,
  isGenerating,
  onAvatarChange,
  onCancel,
  onEnhancePrompt,
  onPromptChange,
  onRetry,
  onSubmit,
  onTextareaKeyDown,
  personalAvatars,
  prompt,
  selectedAvatarId,
}: {
  active: boolean;
  avatar: AvatarOption | null;
  avatarErrorMessage: string | null;
  avatarLoading: boolean;
  canRetry: boolean;
  generationLocked: boolean;
  globalAvatars: AvatarOption[];
  isGenerating: boolean;
  onAvatarChange: (avatarId: string | null) => void;
  onCancel: () => void;
  onEnhancePrompt: () => void;
  onPromptChange: (prompt: string) => void;
  onRetry: () => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  personalAvatars: AvatarOption[];
  prompt: string;
  selectedAvatarId: string | null;
}) {
  const promptId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    if (!active) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 56), 112)}px`;
  }, [active, prompt]);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-[1120px] shrink-0 rounded-[var(--radius-panel)] border border-border bg-card p-3 shadow-[0_18px_48px_rgb(0_0_0_/_0.24)]"
    >
      <div className="rounded-[var(--radius-card)] border border-border bg-card-muted/65 px-3 py-2 transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={promptId}
            className="text-xs font-semibold text-foreground"
          >
            Describe the Reel
          </label>
          <span className="rounded-full border border-border bg-background/35 px-2.5 py-1 text-[11px] font-semibold text-muted">
            Pro video
          </span>
        </div>

        <textarea
          id={promptId}
          ref={textareaRef}
          rows={1}
          aria-label="Video prompt"
          autoComplete="off"
          name="videoPrompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          className="mt-1 max-h-28 min-h-14 w-full resize-none overflow-y-auto bg-transparent text-sm font-medium leading-6 text-foreground outline-none placeholder:text-muted-subtle"
          placeholder="Describe the hook, scene, movement, delivery, and closing action…"
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="Video format: 9:16 vertical"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground"
          >
            <span
              aria-hidden="true"
              className="inline-block h-5 w-3 shrink-0 rounded-[4px] border-2 border-muted"
            />
            9:16 vertical
          </div>
          <div
            aria-label="Output count: 1 video"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground"
          >
            <Video className="size-3.5" aria-hidden="true" />
            1 video
          </div>

          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <AvatarPicker
              avatarErrorMessage={avatarErrorMessage}
              avatarLoading={avatarLoading}
              globalAvatars={globalAvatars}
              personalAvatars={personalAvatars}
              selectedAvatarId={selectedAvatarId}
              selectedAvatar={avatar}
              onChange={onAvatarChange}
            />
          </div>

          <button
            type="button"
            onClick={onEnhancePrompt}
            disabled={generationLocked || !prompt.trim() || isGenerating}
            aria-label={
              generationLocked
                ? "Video prompt enhancement locked"
                : "Enhance video prompt"
            }
            title={
              generationLocked ? "Prompt enhancement is locked" : undefined
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Enhance
          </button>
        </div>

        <div className="flex w-full items-center gap-2 xl:w-auto">
          {isGenerating ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold text-muted transition-colors hover:border-error/45 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Cancel
            </button>
          ) : null}
          {canRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Retry
            </button>
          ) : null}
          <button
            type="submit"
          disabled={
            generationLocked ||
            !prompt.trim() ||
            isGenerating ||
            !avatar?.thumbnailUrl
          }
          aria-label={
            generationLocked
              ? "Video generation locked"
              : "Generate video"
          }
          title={
            generationLocked ? "Video generation is locked" : undefined
          }
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-primary/35 bg-brand-soft px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/55 hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-80 xl:min-w-[236px]"
        >
          {generationLocked ? (
            <>
              <Lock className="size-4" aria-hidden="true" />
              Generation unavailable in preview
            </>
          ) : isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Generating…
            </>
          ) : (
            <>
              Generate video
              <Sparkles className="size-4" aria-hidden="true" />
            </>
          )}
          </button>
        </div>
      </div>
    </form>
  );
}

function AvatarPicker({
  avatarErrorMessage,
  avatarLoading,
  globalAvatars,
  onChange,
  personalAvatars,
  selectedAvatar,
  selectedAvatarId,
}: {
  avatarErrorMessage: string | null;
  avatarLoading: boolean;
  globalAvatars: AvatarOption[];
  onChange: (avatarId: string | null) => void;
  personalAvatars: AvatarOption[];
  selectedAvatar: AvatarOption | null;
  selectedAvatarId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasOptions = personalAvatars.length > 0 || globalAvatars.length > 0;
  const triggerLabel = avatarLoading
    ? "Loading presenters"
    : selectedAvatar
      ? `Choose presenter, currently ${selectedAvatar.label}`
      : "Choose presenter";

  function selectAvatar(avatarId: string) {
    onChange(avatarId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full max-w-none justify-between"
            aria-label={triggerLabel}
            title={selectedAvatar?.label ?? "Choose presenter"}
          />
        }
      >
        {avatarLoading ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : selectedAvatar ? (
          <Avatar size="sm">
            {selectedAvatar.thumbnailUrl ? (
              <AvatarImage src={selectedAvatar.thumbnailUrl} alt="" />
            ) : null}
            <AvatarFallback>
              {getAvatarFallbackText(selectedAvatar.label)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <UserRound aria-hidden="true" />
        )}
        <span className="truncate">
          {avatarLoading ? "Loading…" : "Presenter"}
        </span>
        <ChevronDown
          data-icon="inline-end"
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[min(92vw,440px)] gap-0 p-0"
      >
        <PopoverHeader className="border-b border-border p-3">
          <PopoverTitle>Choose a presenter</PopoverTitle>
          <PopoverDescription>
            Select by face so the on-camera style is easy to compare.
          </PopoverDescription>
        </PopoverHeader>

        {avatarLoading ? <AvatarPickerSkeleton /> : null}

        {!avatarLoading && avatarErrorMessage ? (
          <Alert variant="destructive" className="m-3 w-auto">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>
              {hasOptions
                ? "Some presenters unavailable"
                : "Presenters unavailable"}
            </AlertTitle>
            <AlertDescription>{avatarErrorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!avatarLoading && hasOptions ? (
          <ScrollArea className="h-[min(62vh,430px)]">
            <div className="flex flex-col gap-5 p-3">
              <AvatarGroup
                emptyMessage="No uploaded source videos yet."
                label="Your source videos"
                options={personalAvatars}
                selectedAvatarId={selectedAvatarId}
                onSelect={selectAvatar}
              />
              <AvatarGroup
                emptyMessage="No library presenters are available yet."
                label="Presenter library"
                options={globalAvatars}
                selectedAvatarId={selectedAvatarId}
                onSelect={selectAvatar}
              />
            </div>
          </ScrollArea>
        ) : null}

        {!avatarLoading && !avatarErrorMessage && !hasOptions ? (
          <div className="p-4 text-sm font-medium text-muted">
            No presenters are available yet.
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AvatarGroup({
  emptyMessage,
  label,
  onSelect,
  options,
  selectedAvatarId,
}: {
  emptyMessage?: string;
  label: string;
  onSelect: (avatarId: string) => void;
  options: AvatarOption[];
  selectedAvatarId: string | null;
}) {
  const groupId = useId();

  return (
    <section aria-labelledby={groupId}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id={groupId} className="text-sm font-semibold text-foreground">
          {label}
        </h3>
        <span className="text-xs font-medium text-muted-subtle tabular-nums">
          {options.length}
        </span>
      </div>
      {options.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {options.map((avatar) => {
            const selected = avatar.id === selectedAvatarId;
            const displayName = getAvatarDisplayName(avatar.label);

            return (
              <button
                key={avatar.id}
                type="button"
                aria-label={`Choose ${avatar.label}`}
                aria-pressed={selected}
                title={avatar.label}
                onClick={() => onSelect(avatar.id)}
                className={cn(
                  "group min-w-0 rounded-lg p-1.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                  selected
                    ? "bg-brand-soft ring-2 ring-primary"
                    : "hover:bg-card-muted",
                )}
              >
                <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-[#1F1F1F]">
                  <Avatar className="size-full rounded-[inherit] after:rounded-[inherit]">
                    {avatar.thumbnailUrl ? (
                      <AvatarImage
                        src={avatar.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="rounded-[inherit]"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-[inherit] text-base font-semibold">
                      {getAvatarFallbackText(avatar.label)}
                    </AvatarFallback>
                  </Avatar>
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block truncate px-0.5 text-xs font-medium text-foreground">
                  {displayName}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[var(--radius-control)] bg-card-muted px-3 py-2 text-xs font-medium leading-5 text-muted">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function AvatarPickerSkeleton() {
  return (
    <div className="p-3" role="status" aria-label="Loading presenter library">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-[3/4] w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoResultCard({
  onEdit,
  onSelect,
  onUseAsHook,
  selected,
  video,
}: {
  onEdit: () => void;
  onSelect: () => void;
  onUseAsHook: () => void;
  selected: boolean;
  video: GeneratedVideo;
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border bg-card p-2 shadow-card transition-colors",
        selected ? "border-success/45" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full overflow-hidden rounded-[var(--radius-control)] bg-card-muted text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        style={{ aspectRatio: video.ratio.replace(":", " / ") }}
      >
        {video.url ? (
          <video
            src={video.url}
            className="size-full object-cover"
            muted
            playsInline
            controls
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="text-center">
              <Video className="mx-auto size-7 text-muted" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-muted">
                Video preview
              </p>
            </div>
          </div>
        )}
      </button>

      <div className="mt-3 flex flex-col gap-3 px-1 pb-1">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {video.title}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
                video.status === "Ready"
                  ? "bg-success/10 text-success"
                  : video.status === "Failed"
                    ? "bg-error/10 text-error"
                    : "bg-card-muted text-muted",
              )}
            >
              {video.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
            {video.duration ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3" aria-hidden="true" />
                {video.duration}
              </span>
            ) : null}
            {video.createdAt ? <span>{video.createdAt}</span> : null}
            <span>{video.avatarName}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onUseAsHook}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Use hook
          </button>
        </div>
      </div>
    </article>
  );
}
