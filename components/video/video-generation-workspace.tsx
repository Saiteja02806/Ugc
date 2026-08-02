"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  AiStudioComposer,
  AiStudioSetting,
} from "@/components/generation/ai-studio-composer";
import {
  AiStudioResults,
  type AiStudioResultsStatus,
} from "@/components/generation/ai-studio-results";
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
import {
  fetchAIStudioMediaAsset,
  fetchAIStudioMediaAssets,
} from "@/lib/ai-studio/media-client";
import {
  getAIStudioVideoResults,
  type AIStudioVideoResult,
  upsertAIStudioResult,
} from "@/lib/ai-studio/media-results";
import {
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
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

type GeneratedVideo = AIStudioVideoResult;

const VIDEO_JOB_STORAGE_PREFIX = "ugc-ai-studio.latest-video-job.v2.";
const VIDEO_JOB_METADATA_PREFIX = "ugc-ai-studio.video-job.v2.";
const VIDEO_JOB_URL_PARAMETER = "videoJob";

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

function getVideoJobOutput(output: Json | null) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  return {
    mediaAssetId:
      typeof output.mediaAssetId === "string" ? output.mediaAssetId : null,
    url: typeof output.url === "string" ? output.url : null,
    videoId: typeof output.videoId === "string" ? output.videoId : null,
  };
}

function persistPendingVideoMetadata(
  userId: string,
  jobId: string,
  metadata: { avatarName: string; prompt: string },
) {
  try {
    window.localStorage.setItem(`${VIDEO_JOB_STORAGE_PREFIX}${userId}`, jobId);
    window.localStorage.setItem(
      `${VIDEO_JOB_METADATA_PREFIX}${userId}.${jobId}`,
      JSON.stringify(metadata),
    );
  } catch {
    // Supabase remains authoritative; this metadata only restores local labels.
  }
}

function getPendingVideoMetadata(userId: string, jobId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      `${VIDEO_JOB_METADATA_PREFIX}${userId}.${jobId}`,
    );

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

export function VideoGenerationStudioPanel({
  accessMessage,
  accessState = "locked",
  active = true,
}: {
  accessMessage?: string | null;
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
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [storedJobId, setStoredJobId] = useState<string | null>(null);
  const [ignoredPersistedJobId, setIgnoredPersistedJobId] = useState<
    string | null
  >(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl(VIDEO_JOB_URL_PARAMETER);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const activeJobId = submittedJobId ?? urlJobId ?? storedJobId;
  const activeJobQuery = useBackgroundJob(activeJobId);
  const cancelJob = useCancelBackgroundJob();
  const retryJob = useRetryBackgroundJob();
  const generationLocked = accessState !== "pro";

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
  const queriedJob = activeJobQuery.data;
  const durableJob =
    queriedJob?.jobType === "video_generation" ? queriedJob : null;
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
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadGeneratedVideos() {
      if (!user) {
        if (!ignore) {
          setGeneratedVideos([]);
          setStoredJobId(null);
          setResultsError("Sign in to view your generated videos.");
          setResultsLoading(false);
        }
        return;
      }

      setResultsLoading(true);
      setResultsError(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to view your generated videos.");
        }

        const assets = await fetchAIStudioMediaAssets({
          collection: "video",
          sourceType: "generated_video",
          token,
        });

        if (!ignore) {
          setGeneratedVideos(getAIStudioVideoResults(assets));
          setSubmittedJobId(null);
          setIgnoredPersistedJobId(null);
          setStoredJobId(
            window.localStorage.getItem(
              `${VIDEO_JOB_STORAGE_PREFIX}${user.uid}`,
            ),
          );
        }
      } catch (error) {
        if (!ignore) {
          setResultsError(
            getErrorMessage(error, "Could not load your generated videos."),
          );
        }
      } finally {
        if (!ignore) {
          setResultsLoading(false);
        }
      }
    }

    void loadGeneratedVideos();

    return () => {
      ignore = true;
    };
  }, [active, authLoading, user]);

  useEffect(() => {
    if (
      queriedJob &&
      queriedJob.jobType !== "video_generation" &&
      activeJobId === persistedJobId
    ) {
      const timeoutId = window.setTimeout(
        () => setIgnoredPersistedJobId(persistedJobId),
        0,
      );

      return () => window.clearTimeout(timeoutId);
    }
  }, [activeJobId, persistedJobId, queriedJob]);

  useEffect(() => {
    const job = durableJob;

    if (!job || resolvedJobIdsRef.current.has(job.id) || !user) {
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
    const completedOutputUrl = output.url;
    const userId = user.uid;
    let ignore = false;

    async function restoreCompletedVideo() {
      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to restore the generated video.");
        }

        const metadata = getPendingVideoMetadata(userId, completedJob.id);
        let persistedVideo: GeneratedVideo | null = null;

        try {
          if (completedOutput.mediaAssetId) {
            const mediaAsset = await fetchAIStudioMediaAsset(
              completedOutput.mediaAssetId,
              token,
            );
            persistedVideo = getAIStudioVideoResults([mediaAsset], 1)[0] ?? null;
          } else {
            const assets = await fetchAIStudioMediaAssets({
              collection: "video",
              sourceType: "generated_video",
              token,
            });
            persistedVideo =
              getAIStudioVideoResults(
                assets.filter(
                  (asset) => asset.sourceRecordId === completedJob.id,
                ),
                1,
              )[0] ?? null;
          }
        } catch {
          // Keep the completed output playable while media persistence catches
          // up or the media endpoint is temporarily unavailable.
        }

        const nextVideo: GeneratedVideo =
          persistedVideo ?? {
            createdAt: completedJob.completedAt ?? completedJob.updatedAt,
            durationSeconds: null,
            id:
              completedOutput.mediaAssetId ??
              completedOutput.videoId ??
              completedJob.id,
            mediaAssetId: completedOutput.mediaAssetId,
            ratio: "9:16",
            status: "Ready",
            title: getGeneratedVideoTitle(
              metadata?.prompt || "Generated video",
            ),
            url: completedOutputUrl,
          };

        if (ignore) {
          return;
        }

        resolvedJobIdsRef.current.add(completedJob.id);
        setGeneratedVideos((currentVideos) =>
          upsertAIStudioResult(currentVideos, nextVideo),
        );
        setGenerationState("completed");
        setActionNotice(null);
        setActionError(null);
      } catch (error) {
        if (!ignore) {
          setGenerationState("failed");
          setActionError(
            getErrorMessage(error, "Could not restore the generated video."),
          );
        }
      }
    }

    void restoreCompletedVideo();

    return () => {
      ignore = true;
    };
  }, [durableJob, user]);

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

    const trimmedPrompt = normalizeAIStudioPrompt(prompt);
    const promptLengthError = getAIStudioPromptLengthError(
      trimmedPrompt,
      AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    );

    if (generationLocked || !trimmedPrompt || isGenerating) {
      return;
    }

    if (promptLengthError) {
      setActionError(promptLengthError);
      return;
    }

    if (!selectedAvatar) {
      setActionError(
        avatarLoading
          ? "Presenter library is still loading."
          : "Choose a presenter before generating.",
      );
      return;
    }

    if (!selectedAvatar.thumbnailUrl) {
      setActionError(
        "Choose a presenter with a preview image before generating.",
      );
      return;
    }

    setActionNotice(null);
    setActionError(null);
    setGenerationState("generating");

    try {
      const token = await getCurrentUserIdToken();

      if (!token || !user) {
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
      persistPendingVideoMetadata(user.uid, data.jobId, {
        avatarName: selectedAvatar.label,
        prompt: trimmedPrompt,
      });
      persistJobIdInUrl(data.jobId, VIDEO_JOB_URL_PARAMETER);
      resolvedJobIdsRef.current.delete(data.jobId);
      setStoredJobId(data.jobId);
      setSubmittedJobId(data.jobId);
      submissionKeyRef.current = null;
      setPrompt("");
    } catch (error) {
      console.error("Video generation failed:", error);
      setActionError(
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
      setActionError(null);
      setActionNotice(
        "Cancellation requested. The current checkpoint will stop safely.",
      );
    } catch (error) {
      setActionError(
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
      setActionError(null);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not retry this video job."));
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleEnhancePrompt() {
    const trimmedPrompt = normalizeAIStudioPrompt(prompt);
    const enhancement =
      "Structure notes: lead with the stated hook, keep the message concise and direct, show only the described product context, and end with one clear action.";

    if (generationLocked || !trimmedPrompt) {
      return;
    }

    if (trimmedPrompt.includes("Structure notes:")) {
      return;
    }

    const enhancedPrompt = `${trimmedPrompt}\n\n${enhancement}`;
    const promptLengthError = getAIStudioPromptLengthError(
      enhancedPrompt,
      AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    );

    if (promptLengthError) {
      setActionError(promptLengthError);
      return;
    }

    setActionError(null);
    setPrompt(enhancedPrompt);
  }

  function handleEditVideo(video: GeneratedVideo) {
    if (!video.mediaAssetId) {
      setActionError(
        "The generated video is still being added to Creative Assets.",
      );
      return;
    }

    router.push(getCreativeAssetEditorHref(video.mediaAssetId));
  }

  const jobQueryError = activeJobQuery.isError
    ? getErrorMessage(
        activeJobQuery.error,
        "Could not retrieve the video generation job.",
      )
    : null;
  const resultsErrorMessage =
    actionError ??
    jobQueryError ??
    (effectiveGenerationState === "failed" ? durableNotice : null) ??
    resultsError;
  const resultsStatus: AiStudioResultsStatus | null =
    resultsErrorMessage
      ? {
          label: resultsErrorMessage,
          tone: "error",
        }
      : effectiveGenerationState === "generating"
        ? { label: "Creating your video…", tone: "progress" }
        : actionNotice ?? durableNotice
          ? { label: actionNotice ?? durableNotice ?? "", tone: "neutral" }
          : null;
  const canRetry =
    durableJob?.status === "failed" && Boolean(durableJob.error?.retryable);

  return (
    <div
      id="ai-studio-videos-panel"
      role="tabpanel"
      aria-labelledby="ai-studio-videos-tab"
      hidden={!active}
      className={cn(
        "min-h-0 flex-1 flex-col",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <AiStudioResults
        ariaLabel="Generated videos"
        emptyDescription="Describe the presenter video you want below. Finished generations are saved to your account."
        gridClassName="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        hasResults={generatedVideos.length > 0}
        loading={resultsLoading}
        status={resultsStatus}
      >
        {generatedVideos.map((video) => (
          <VideoResultCard
            key={video.id}
            video={video}
            onEdit={() => handleEditVideo(video)}
          />
        ))}
      </AiStudioResults>

      <AiStudioComposer
        accessMessage={accessMessage}
        active={active}
        ariaLabel="Video prompt"
        generateDisabled={
          generationLocked ||
          !prompt.trim() ||
          isGenerating ||
          !selectedAvatar?.thumbnailUrl
        }
        generateLabel="Generate video"
        generationLocked={generationLocked}
        isGenerating={isGenerating}
        maxLength={AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH}
        name="videoPrompt"
        placeholder="Describe the video you want to create…"
        prompt={prompt}
        onPromptChange={(nextPrompt) => {
          submissionKeyRef.current = null;
          setActionError(null);
          setPrompt(nextPrompt);
        }}
        onSubmit={handleSubmit}
        onTextareaKeyDown={handleTextareaKeyDown}
        secondaryActions={
          <>
            {isGenerating ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={cancelJob.isPending}
                onClick={() => void handleCancelGeneration()}
              >
                Cancel
              </Button>
            ) : null}
            {canRetry ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={retryJob.isPending}
                onClick={() => void handleRetryGeneration()}
              >
                Retry
              </Button>
            ) : null}
          </>
        }
        settings={
          <>
            <AiStudioSetting
              icon={
                <span
                  aria-hidden="true"
                  className="inline-block h-5 w-3 shrink-0 rounded-[4px] border-2 border-muted"
                />
              }
              label="9:16 vertical"
            />
            <AiStudioSetting
              icon={<Video className="size-4" aria-hidden="true" />}
              label="1 video"
            />
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <AvatarPicker
                avatarErrorMessage={avatarErrorMessage}
                avatarLoading={avatarLoading}
                globalAvatars={globalAvatars}
                personalAvatars={personalAvatars}
                selectedAvatarId={selectedAvatarId}
                selectedAvatar={selectedAvatar}
                onChange={(avatarId) => {
                  submissionKeyRef.current = null;
                  setSelectedAvatarId(avatarId);
                }}
              />
            </div>
            <Button
              type="button"
              variant="muted"
              size="lg"
              onClick={handleEnhancePrompt}
              disabled={generationLocked || !prompt.trim() || isGenerating}
              aria-label={
                generationLocked
                  ? "Video prompt enhancement locked"
                  : "Enhance video prompt"
              }
              title={generationLocked ? accessMessage ?? undefined : undefined}
            >
              <Sparkles data-icon="inline-start" aria-hidden="true" />
              Enhance
            </Button>
          </>
        }
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
          {avatarLoading
            ? "Loading…"
            : selectedAvatar
              ? getAvatarDisplayName(selectedAvatar.label)
              : "Presenter"}
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
  video,
}: {
  onEdit: () => void;
  video: GeneratedVideo;
}) {
  return (
    <article className="group min-w-0">
      <div
        className="w-full overflow-hidden rounded-[var(--radius-card)] bg-card-muted text-foreground ring-1 ring-border"
        style={{ aspectRatio: video.ratio.replace(":", " / ") }}
      >
        <video
          src={video.url}
          aria-label={video.title}
          className="size-full object-cover"
          muted
          playsInline
          controls
          preload="metadata"
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 px-1">
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
            {video.durationSeconds !== null ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3" aria-hidden="true" />
                {formatVideoDuration(video.durationSeconds)}
              </span>
            ) : null}
            <span>{formatGeneratedAt(video.createdAt)}</span>
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={onEdit}
          disabled={!video.mediaAssetId}
          title={
            video.mediaAssetId
              ? "Edit this generated video"
              : "Adding this video to Creative Assets"
          }
          className="w-full"
        >
          Edit
        </Button>
      </div>
    </article>
  );
}

function formatVideoDuration(durationSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Generated"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
