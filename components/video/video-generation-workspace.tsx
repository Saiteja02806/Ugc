"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImageIcon,
  Loader2,
  Pause,
  Play,
  ScanText,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AiStudioComposer,
  AiStudioSettingSelect,
} from "@/components/generation/ai-studio-composer";
import {
  AiStudioResults,
  type AiStudioResultsStatus,
} from "@/components/generation/ai-studio-results";
import { ReferenceMediaUpload } from "@/components/generation/reference-media-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
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
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import {
  AI_STUDIO_GENERATION_QUANTITIES,
  AI_STUDIO_VIDEO_ASPECT_RATIOS,
  getAIStudioRatioLabel,
  type AIStudioGenerationQuantity,
  type AIStudioVideoAspectRatio,
} from "@/lib/ai-studio/generation-settings";
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
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useBackgroundJobs,
  useCancelBackgroundJob,
  usePersistedJobIdFromUrl,
  useRetryBackgroundJob,
} from "@/lib/jobs/background-job-client";
import type { Json } from "@/lib/jobs/background-jobs";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";

type GenerationState = "empty" | "generating" | "completed" | "failed";

type AvatarOption = {
  id: string;
  label: string;
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
  influencerKey: string | null;
  metadata: unknown;
  name: string;
  ratio: AvatarRatio;
  sourceVideoUrl: string;
  status: AvatarStatus;
  thumbnailUrl: string | null;
  updatedAt: string;
  visualGroup: string | null;
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
      jobs: { jobId: string; videoId: string }[];
      message: string;
      ok: true;
      partial: boolean;
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
    ratio:
      typeof output.ratio === "string" &&
      AI_STUDIO_VIDEO_ASPECT_RATIOS.includes(
        output.ratio as AIStudioVideoAspectRatio,
      )
        ? (output.ratio as AIStudioVideoAspectRatio)
        : null,
    url: typeof output.url === "string" ? output.url : null,
    videoId: typeof output.videoId === "string" ? output.videoId : null,
  };
}

function persistPendingVideoMetadata(
  userId: string,
  jobs: readonly { jobId: string }[],
  metadata: {
    aspectRatio: AIStudioVideoAspectRatio;
    avatarName: string;
    prompt: string;
  },
) {
  try {
    const jobIds = jobs.map((job) => job.jobId);
    window.localStorage.setItem(
      `${VIDEO_JOB_STORAGE_PREFIX}${userId}`,
      JSON.stringify(jobIds),
    );
    for (const jobId of jobIds) {
      window.localStorage.setItem(
        `${VIDEO_JOB_METADATA_PREFIX}${userId}.${jobId}`,
        JSON.stringify(metadata),
      );
    }
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
      aspectRatio:
        typeof value.aspectRatio === "string" &&
        AI_STUDIO_VIDEO_ASPECT_RATIOS.includes(
          value.aspectRatio as AIStudioVideoAspectRatio,
        )
          ? (value.aspectRatio as AIStudioVideoAspectRatio)
          : "9:16",
      avatarName:
        typeof value.avatarName === "string" ? value.avatarName : "",
      prompt: typeof value.prompt === "string" ? value.prompt : "",
    };
  } catch {
    return null;
  }
}

function getStoredVideoJobIds(userId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      `${VIDEO_JOB_STORAGE_PREFIX}${userId}`,
    );

    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;

      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      return [rawValue];
    }
  } catch {
    return [];
  }
}

function extractInstagramShortcode(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      (segments[0] === "reel" || segments[0] === "p" || segments[0] === "tv") &&
      segments[1]
    ) {
      return segments[1];
    }
    return null;
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refTypeParam = searchParams.get("refType");
  const refIdParam = searchParams.get("refId");
  const sourceUrlParam = searchParams.get("sourceUrl");
  const referenceParamContext: {
    id: string;
    shortcode: string | null;
    sourceUrl: string;
    type: "hook" | "wall_text";
  } | null =
    (refTypeParam === "hook" || refTypeParam === "wall_text") && refIdParam
      ? {
          id: refIdParam,
          shortcode: extractInstagramShortcode(sourceUrlParam),
          sourceUrl: sourceUrlParam ?? "",
          type: refTypeParam,
        }
      : null;
  const referenceParamKey = referenceParamContext
    ? `${referenceParamContext.type}:${referenceParamContext.id}:${referenceParamContext.sourceUrl}`
    : null;
  const [dismissedReferenceKey, setDismissedReferenceKey] = useState<
    string | null
  >(null);
  const referenceContext =
    referenceParamKey && dismissedReferenceKey !== referenceParamKey
      ? referenceParamContext
      : null;

  function handleDismissReference() {
    setDismissedReferenceKey(referenceParamKey);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("refType");
    nextParams.delete("refId");
    nextParams.delete("sourceUrl");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const { loading: authLoading, user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] =
    useState<AIStudioVideoAspectRatio>("9:16");
  const [quantity, setQuantity] =
    useState<AIStudioGenerationQuantity>(1);
  const [avatarLibrary, setAvatarLibrary] = useState<AvatarLibraryItem[]>([]);
  const [personalAvatarAssets, setPersonalAvatarAssets] = useState<MediaAsset[]>([]);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
    null,
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [uploadedReference, setUploadedReference] =
    useState<AIStudioReferenceMedia | null>(null);
  const [activeVideoPrompt, setActiveVideoPrompt] = useState("");
  const [latestCompletedVideoId, setLatestCompletedVideoId] = useState<string | null>(null);
  const [generationState, setGenerationState] =
    useState<GenerationState>("empty");
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [submittedJobIds, setSubmittedJobIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [storedJobIds, setStoredJobIds] = useState<string[]>([]);
  const [ignoredPersistedJobId, setIgnoredPersistedJobId] = useState<
    string | null
  >(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl(VIDEO_JOB_URL_PARAMETER);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const activeJobIds = Array.from(
    new Set([
      ...submittedJobIds,
      ...(urlJobId ? [urlJobId] : []),
      ...storedJobIds,
    ]),
  );
  const activeJobQueries = useBackgroundJobs(activeJobIds);
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
  const uploadedReferenceImage =
    uploadedReference?.kind === "image" ? uploadedReference : null;
  const uploadedReferenceVideo =
    uploadedReference?.kind === "video" ? uploadedReference : null;
  const activeReferenceImageUrl =
    uploadedReferenceImage?.asset.url ?? selectedAvatar?.thumbnailUrl ?? null;
  const queriedJobs = activeJobQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const durableJobs = queriedJobs.filter(
    (job) => job.jobType === "video_generation",
  );
  const failedDurableJob = durableJobs.find((job) => job.status === "failed");
  const cancelledDurableJob = durableJobs.find(
    (job) => job.status === "cancelled",
  );
  const completedWithoutOutput = durableJobs.find(
    (job) =>
      job.status === "completed" && !getVideoJobOutput(job.output)?.url,
  );
  const durableNotice =
    cancelledDurableJob
      ? "Video generation was cancelled."
      : failedDurableJob
        ? failedDurableJob.error?.message ||
          "Video generation failed. You can retry it."
        : completedWithoutOutput
          ? "Video generation completed without a usable output."
          : null;
  const effectiveGenerationState: GenerationState =
    activeJobQueries.some((query) => query.isPending)
      ? "generating"
      : durableJobs.some(
            (job) =>
              !["cancelled", "completed", "failed"].includes(job.status),
          )
        ? "generating"
        : failedDurableJob || cancelledDurableJob || completedWithoutOutput
          ? "failed"
          : generationState;
  const isGenerating =
    effectiveGenerationState === "generating";
  const pendingGenerationCount =
    generationState === "generating" && activeJobIds.length === 0
    ? quantity
    : activeJobQueries.reduce((count, query) => {
        if (query.isPending) {
          return count + 1;
        }

        return query.data &&
          !["cancelled", "completed", "failed"].includes(query.data.status)
          ? count + 1
          : count;
      }, 0);

  useEffect(() => {
    activeUserIdRef.current = user?.uid ?? null;
    resolvedJobIdsRef.current.clear();

    return () => {
      activeUserIdRef.current = null;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadGeneratedVideos() {
      if (!user) {
        if (!ignore) {
          setGeneratedVideos([]);
          setStoredJobIds([]);
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
          setSubmittedJobIds([]);
          setIgnoredPersistedJobId(null);
          setStoredJobIds(getStoredVideoJobIds(user.uid));
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
      persistedJobId &&
      queriedJobs.some(
        (job) =>
          job?.id === persistedJobId && job.jobType !== "video_generation",
      )
    ) {
      const timeoutId = window.setTimeout(
        () => setIgnoredPersistedJobId(persistedJobId),
        0,
      );

      return () => window.clearTimeout(timeoutId);
    }
  }, [persistedJobId, queriedJobs]);

  useEffect(() => {
    const completedJobs = durableJobs.filter(
      (job) =>
        job.status === "completed" &&
        !resolvedJobIdsRef.current.has(job.id) &&
        Boolean(getVideoJobOutput(job.output)?.url),
    );

    if (!user || completedJobs.length === 0) {
      return;
    }
    for (const completedJob of completedJobs) {
      resolvedJobIdsRef.current.add(completedJob.id);
    }

    const userId = user.uid;

    async function restoreCompletedVideo(
      completedJob: (typeof completedJobs)[number],
    ) {
      const completedOutput = getVideoJobOutput(completedJob.output);

      if (!completedOutput?.url) {
        return;
      }

      const completedOutputUrl = completedOutput.url;

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

        const completedPrompt = metadata?.prompt || "Generated video";
        const nextVideo: GeneratedVideo = persistedVideo
          ? {
              ...persistedVideo,
              prompt: metadata?.prompt || persistedVideo.prompt,
            }
          : {
              createdAt: completedJob.completedAt ?? completedJob.updatedAt,
              durationSeconds: null,
              id:
                completedOutput.mediaAssetId ??
                completedOutput.videoId ??
                completedJob.id,
              mediaAssetId: completedOutput.mediaAssetId,
              prompt: completedPrompt,
              ratio:
                completedOutput.ratio ?? metadata?.aspectRatio ?? "9:16",
              status: "Ready",
              title: getGeneratedVideoTitle(completedPrompt),
              url: completedOutputUrl,
            };

        if (activeUserIdRef.current !== userId) {
          return;
        }

        setGeneratedVideos((currentVideos) =>
          upsertAIStudioResult(currentVideos, nextVideo),
        );
        setLatestCompletedVideoId(nextVideo.id);
        setTimeout(() => setLatestCompletedVideoId(null), 3500);
        setActiveVideoPrompt("");
        setGenerationState("completed");
        setActionNotice(null);
        setActionError(null);
      } catch (error) {
        resolvedJobIdsRef.current.delete(completedJob.id);
        if (activeUserIdRef.current === userId) {
          setGenerationState("failed");
          setActionError(
            getErrorMessage(error, "Could not restore the generated video."),
          );
        }
      }
    }

    void Promise.all(completedJobs.map(restoreCompletedVideo));
  }, [durableJobs, user]);

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
        setAvatarErrorMessage("Sign in before choosing a reference image.");
        return;
      }

      setAvatarLoading(true);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before choosing a reference image.");
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
            getErrorMessage(result.reason, "Could not load reference images."),
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
            : null,
        );
      } catch (error) {
        if (!ignore) {
          setAvatarLibrary([]);
          setPersonalAvatarAssets([]);
          setSelectedAvatarId(null);
          setAvatarErrorMessage(
            getErrorMessage(error, "Could not load reference images."),
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

    setActionNotice(null);
    setActionError(null);
    setActiveVideoPrompt(trimmedPrompt);
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
          aspectRatio,
          avatarImageUrl: activeReferenceImageUrl,
          idempotencyKey,
          prompt: trimmedPrompt,
          quantity,
          referenceVideoDurationSeconds:
            uploadedReferenceVideo?.asset.durationSeconds ?? null,
          referenceVideoUrl: uploadedReferenceVideo?.asset.url ?? null,
          referenceId: referenceContext?.id ?? null,
          referenceType: referenceContext?.type ?? null,
          referenceUrl: referenceContext?.sourceUrl ?? null,
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
      persistPendingVideoMetadata(user.uid, data.jobs, {
        aspectRatio,
        avatarName:
          uploadedReference?.asset.title ?? selectedAvatar?.label ?? "",
        prompt: trimmedPrompt,
      });
      persistJobIdInUrl(data.jobId, VIDEO_JOB_URL_PARAMETER);
      for (const job of data.jobs) {
        resolvedJobIdsRef.current.delete(job.jobId);
      }
      const jobIds = data.jobs.map((job) => job.jobId);
      setStoredJobIds(jobIds);
      setSubmittedJobIds(jobIds);
      if (data.partial) {
        setActionNotice(data.message);
      }
      submissionKeyRef.current = null;
    } catch (error) {
      console.error("Video generation failed:", error);
      setActionError(
        getErrorMessage(error, "Video generation failed. Try again."),
      );
      setGenerationState("failed");
    }
  }

  async function handleCancelGeneration() {
    const cancellableJobIds = durableJobs
      .filter((job) => !["cancelled", "completed", "failed"].includes(job.status))
      .map((job) => job.id);

    if (cancellableJobIds.length === 0 || cancelJob.isPending) {
      return;
    }

    try {
      for (const jobId of cancellableJobIds) {
        await cancelJob.mutateAsync(jobId);
      }
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
    const retryableJob = durableJobs.find(
      (job) => job.status === "failed" && Boolean(job.error?.retryable),
    );

    if (!retryableJob || retryJob.isPending) {
      return;
    }

    try {
      resolvedJobIdsRef.current.delete(retryableJob.id);
      await retryJob.mutateAsync(retryableJob.id);
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

  const failedJobQuery = activeJobQueries.find((query) => query.isError);
  const jobQueryError = failedJobQuery
    ? getErrorMessage(
        failedJobQuery.error,
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
  const canRetry = durableJobs.some(
    (job) => job.status === "failed" && Boolean(job.error?.retryable),
  );

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
        emptyDescription="Describe the video you want below. Finished generations are saved to your account."
        gridClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"
        hasResults={generatedVideos.length > 0 || isGenerating}
        loading={resultsLoading}
        status={resultsStatus}
      >
        {isGenerating
          ? Array.from(
              { length: Math.max(1, pendingGenerationCount) },
              (_, index) => (
                <OptimisticVideoCard
                  key={`pending-video-${index}`}
                  aspectRatio={aspectRatio}
                  avatarThumbnail={activeReferenceImageUrl}
                  avatarLabel={
                    uploadedReference?.asset.title ?? selectedAvatar?.label ?? null
                  }
                  prompt={activeVideoPrompt}
                />
              ),
            )
          : null}
        {generatedVideos.map((video) => (
          <VideoResultCard
            key={video.id}
            video={video}
            isNew={video.id === latestCompletedVideoId}
          />
        ))}
      </AiStudioResults>

      <AiStudioComposer
        accessMessage={accessMessage}
        active={active}
        ariaLabel="Video prompt"
        contextBanner={
          referenceContext ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-foreground shadow-sm">
              <div className="flex items-center gap-2 truncate">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-selected text-primary">
                  {referenceContext.type === "hook" ? (
                    <Video className="size-3" aria-hidden="true" />
                  ) : (
                    <ScanText className="size-3" aria-hidden="true" />
                  )}
                </span>
                <span className="font-semibold text-foreground-strong">
                  {referenceContext.type === "hook"
                    ? "Reference Hook"
                    : "Reference Format"}
                </span>
                <span className="truncate text-muted">
                  {referenceContext.shortcode
                    ? `• Instagram (${referenceContext.shortcode})`
                    : "• Attached Context"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismissReference}
                aria-label="Remove reference context"
                title="Remove reference"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-card hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null
        }
        generateDisabled={
          generationLocked ||
          !prompt.trim() ||
          isGenerating
        }
        generateLabel="Generate video"
        generationLocked={generationLocked}
        isGenerating={isGenerating}
        layout="unified"
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
            <AiStudioSettingSelect
              ariaLabel="Video aspect ratio"
              icon={
                <span
                  aria-hidden="true"
                  className="inline-block h-5 w-3 shrink-0 rounded-[4px] border-2 border-muted"
                />
              }
              options={AI_STUDIO_VIDEO_ASPECT_RATIOS.map((ratio) => ({
                label: getAIStudioRatioLabel(ratio),
                value: ratio,
              }))}
              value={aspectRatio}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setAspectRatio(value);
              }}
            />
            <AiStudioSettingSelect
              ariaLabel="Number of videos"
              icon={<Video className="size-4" aria-hidden="true" />}
              options={AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({
                label: `${count} video${count === 1 ? "" : "s"}`,
                value: String(count),
              }))}
              value={String(quantity)}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setQuantity(Number(value) as AIStudioGenerationQuantity);
              }}
            />
            <div className="shrink-0">
              <ReferenceImagePicker
                avatarErrorMessage={avatarErrorMessage}
                avatarLoading={avatarLoading}
                compact
                referenceImages={avatarOptions}
                selectedAvatarId={selectedAvatarId}
                selectedAvatar={selectedAvatar}
                onChange={(avatarId) => {
                  submissionKeyRef.current = null;
                  setUploadedReference(null);
                  setSelectedAvatarId(avatarId);
                }}
              />
            </div>
            <ReferenceMediaUpload
              allowedKinds={["image", "video"]}
              disabled={generationLocked || isGenerating}
              selection={uploadedReference}
              onChange={(selection) => {
                submissionKeyRef.current = null;
                setUploadedReference(selection);

                if (selection) {
                  setSelectedAvatarId(null);
                }

                if (
                  selection?.kind === "video" &&
                  (selection.asset.ratio === "9:16" ||
                    selection.asset.ratio === "16:9")
                ) {
                  setAspectRatio(selection.asset.ratio);
                }
              }}
            />
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
    throw new Error(getApiErrorMessage(data, "Could not load reference images."));
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
    throw new Error(getApiErrorMessage(data, "Could not load your reference images."));
  }

  return data.assets;
}

function mapPersonalMediaToAvatarOption(asset: MediaAsset): AvatarOption {
  return {
    id: asset.id,
    label: asset.title,
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

function ReferenceImagePicker({
  avatarErrorMessage,
  avatarLoading,
  compact = false,
  onChange,
  referenceImages,
  selectedAvatar,
  selectedAvatarId,
}: {
  avatarErrorMessage: string | null;
  avatarLoading: boolean;
  compact?: boolean;
  onChange: (avatarId: string | null) => void;
  referenceImages: AvatarOption[];
  selectedAvatar: AvatarOption | null;
  selectedAvatarId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const visibleReferenceImages = useMemo(() => {
    const seenUrls = new Set<string>();

    return referenceImages.filter((image) => {
      const thumbnailUrl = image.thumbnailUrl?.trim();

      if (!thumbnailUrl || seenUrls.has(thumbnailUrl)) {
        return false;
      }

      seenUrls.add(thumbnailUrl);
      return true;
    });
  }, [referenceImages]);
  const hasOptions = visibleReferenceImages.length > 0;
  const triggerLabel = avatarLoading
    ? "Loading reference images"
    : selectedAvatar
      ? "Change optional reference image"
      : "Choose optional reference image";

  function selectReferenceImage(imageId: string) {
    onChange(imageId);
    setOpen(false);
  }

  function clearReferenceImage() {
    onChange(null);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon-lg" : "lg"}
            className={cn(
              !compact && "w-full max-w-none justify-between",
              compact && "overflow-hidden p-0",
            )}
            aria-label={triggerLabel}
            title={selectedAvatar ? "Change reference image" : "Optional reference image"}
          />
        }
      >
        {avatarLoading ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : selectedAvatar ? (
          <Avatar
            size="sm"
            className={cn(
              compact && "size-full rounded-[inherit] after:rounded-[inherit]",
            )}
          >
            {selectedAvatar.thumbnailUrl ? (
              <AvatarImage
                src={selectedAvatar.thumbnailUrl}
                alt=""
                className={cn(compact && "rounded-[inherit]")}
              />
            ) : null}
          </Avatar>
        ) : (
          <ImageIcon aria-hidden="true" />
        )}
        <span className={cn("truncate", compact && "sr-only")}>
          {avatarLoading
            ? "Loading…"
            : selectedAvatar
              ? "Reference image selected"
              : "Optional reference"}
        </span>
        <ChevronDown
          data-icon="inline-end"
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            compact && "hidden",
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
          <PopoverTitle>Choose a reference image</PopoverTitle>
          <PopoverDescription>
            Optional. Pick an image to guide the generated video, or generate
            directly from your prompt.
          </PopoverDescription>
        </PopoverHeader>

        {avatarLoading ? <ReferenceImagePickerSkeleton /> : null}

        {!avatarLoading && avatarErrorMessage ? (
          <Alert variant="destructive" className="m-3 w-auto">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>
              {hasOptions
                ? "Some images unavailable"
                : "Reference images unavailable"}
            </AlertTitle>
            <AlertDescription>{avatarErrorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!avatarLoading && hasOptions ? (
          <ScrollArea className="h-[min(62vh,430px)]">
            <div className="flex flex-col gap-4 p-3">
              <button
                type="button"
                aria-pressed={!selectedAvatarId}
                onClick={clearReferenceImage}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus",
                  !selectedAvatarId
                    ? "border-primary bg-brand-soft"
                    : "border-border bg-card hover:border-border-strong hover:bg-card-muted",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card-muted text-muted">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    No reference image
                  </span>
                  <span className="block text-xs leading-5 text-muted">
                    Generate directly from your prompt.
                  </span>
                </span>
              </button>

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Reference images
                </h3>
                <span className="text-xs font-medium text-muted-subtle tabular-nums">
                  {visibleReferenceImages.length}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {visibleReferenceImages.map((image, index) => {
                  const selected = image.id === selectedAvatarId;

                  return (
                    <button
                      key={image.id}
                      type="button"
                      aria-label={`Choose reference image ${index + 1}`}
                      aria-pressed={selected}
                      title={`Reference image ${index + 1}`}
                      onClick={() => selectReferenceImage(image.id)}
                      className={cn(
                        "group relative aspect-[3/4] min-w-0 overflow-hidden rounded-xl bg-[#1F1F1F] outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                        selected
                          ? "ring-2 ring-primary"
                          : "hover:ring-2 hover:ring-border-strong",
                      )}
                    >
                      <Avatar className="size-full rounded-[inherit] after:rounded-[inherit]">
                        <AvatarImage
                          src={image.thumbnailUrl ?? undefined}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="rounded-[inherit] object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
                        />
                      </Avatar>
                      {selected ? (
                        <span className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        ) : null}

        {!avatarLoading && !avatarErrorMessage && !hasOptions ? (
          <div className="p-4 text-sm font-medium text-muted">
            No reference images are available yet. You can still generate from
            your prompt.
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function ReferenceImagePickerSkeleton() {
  return (
    <div className="p-3" role="status" aria-label="Loading reference images">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[3/4] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function OptimisticVideoCard({
  aspectRatio,
  avatarThumbnail,
  avatarLabel,
  prompt,
}: {
  aspectRatio: AIStudioVideoAspectRatio;
  avatarThumbnail?: string | null;
  avatarLabel?: string | null;
  prompt?: string;
}) {
  return (
    <article className="grid min-w-0 gap-5 border-b border-border py-5 first:pt-1 last:border-b-0 animate-in fade-in-0 duration-300 lg:grid-cols-[minmax(0,1fr)_216px] lg:items-center">
      <div className="order-2 min-w-0 space-y-3 lg:order-1 lg:py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Your prompt
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary shadow-xs backdrop-blur-md">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Rendering…
          </span>
        </div>
        <h3 className="max-w-3xl text-base font-medium leading-7 text-foreground/85 sm:text-lg">
          {prompt || "Creating presenter video…"}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1.5 animate-pulse text-primary">
            <Sparkles className="size-3" aria-hidden="true" />
            Synthesizing avatar & audio…
          </span>
        </div>
      </div>

      <div className="order-1 w-full max-w-[216px] justify-self-start lg:order-2 lg:justify-self-end">
        <div
          className="relative overflow-hidden rounded-[20px] bg-card-muted ring-1 ring-primary/30 shadow-sm"
          style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.04] via-transparent to-primary/[0.08]" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
            {avatarThumbnail ? (
              <div className="relative size-12 overflow-hidden rounded-full border-2 border-primary/40 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarThumbnail}
                  alt={avatarLabel ?? "Avatar"}
                  className="size-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <Loader2 className="size-5 animate-spin text-white" aria-hidden="true" />
                </span>
              </div>
            ) : (
              <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/30 bg-card/90 shadow-sm backdrop-blur-md">
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/85 px-2.5 py-0.5 text-[10px] font-semibold text-foreground-strong backdrop-blur-md">
              <Sparkles className="size-2.5 text-primary" aria-hidden="true" />
              Rendering video
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function VideoResultCard({
  video,
  isNew = false,
}: {
  video: GeneratedVideo;
  isNew?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds ?? 0);
  const displayDuration = duration || video.durationSeconds || 0;

  useEffect(() => {
    const player = videoRef.current;

    return () => {
      player?.pause();
    };
  }, [video.id, video.url]);

  async function togglePlayback() {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    if (player.paused) {
      try {
        await player.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    player.pause();
  }

  function toggleMuted() {
    const player = videoRef.current;
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);

    if (player) {
      player.muted = nextMuted;
    }
  }

  return (
    <article
      className={cn(
        "grid min-w-0 gap-5 border-b border-border py-5 first:pt-1 last:border-b-0 transition-[transform,box-shadow] duration-300 lg:grid-cols-[minmax(0,1fr)_216px] lg:items-center",
        isNew &&
          "animate-in fade-in-50 zoom-in-[0.98] duration-500 rounded-[var(--radius-card)] ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background px-3",
      )}
    >
      <div className="order-2 min-w-0 space-y-3 lg:order-1 lg:py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Your prompt
          </p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
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
        <h3 className="max-w-3xl text-base font-medium leading-7 text-foreground sm:text-lg">
          {video.prompt}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
          {displayDuration > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden="true" />
              {formatVideoDuration(displayDuration)}
            </span>
          ) : null}
          <span>{formatGeneratedAt(video.createdAt)}</span>
        </div>
      </div>

      <div className="order-1 w-full max-w-[216px] justify-self-start lg:order-2 lg:justify-self-end">
        <div
          className="relative overflow-hidden rounded-[20px] bg-black shadow-sm"
          style={{ aspectRatio: video.ratio.replace(":", " / ") }}
        >
          <video
            key={video.url}
            ref={videoRef}
            src={video.url}
            aria-label={`${video.title} preview`}
            className="size-full object-cover"
            muted={isMuted}
            playsInline
            preload="metadata"
            onEnded={() => {
              setCurrentTime(displayDuration);
              setIsPlaying(false);
            }}
            onLoadedMetadata={(event) => {
              const nextDuration = event.currentTarget.duration;

              setCurrentTime(0);
              setIsPlaying(false);

              if (Number.isFinite(nextDuration)) {
                setDuration(nextDuration);
              }
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={(event) =>
              setCurrentTime(event.currentTarget.currentTime)
            }
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-9">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="bg-card/90 shadow-sm"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                  aria-pressed={isPlaying}
                  onClick={() => void togglePlayback()}
                >
                  {isPlaying ? (
                    <Pause aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                </Button>
                <span className="rounded-md bg-black/55 px-1.5 py-1 text-[11px] font-medium tabular-nums text-white">
                  {formatVideoDuration(currentTime)} / {formatVideoDuration(displayDuration)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="bg-card/90 shadow-sm"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                aria-pressed={!isMuted}
                onClick={toggleMuted}
              >
                {isMuted ? (
                  <VolumeX aria-hidden="true" />
                ) : (
                  <Volume2 aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </div>
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
