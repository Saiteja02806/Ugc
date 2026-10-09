"use client";

import { History, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  AiStudioComposer,
  AiStudioSettingSelect,
  AiStudioRatioPicker,
} from "@/components/generation/ai-studio-composer";
import {
  AiStudioResults,
  type AiStudioResultsStatus,
} from "@/components/generation/ai-studio-results";
import { AiStudioResultActions } from "@/components/generation/ai-studio-result-actions";
import { ImageGenerationHistory } from "@/components/generation/image-generation-history";
import { ReferenceMediaUpload } from "@/components/generation/reference-media-upload";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { RecreateGenerationView } from "@/components/explore/recreate-generation-view";
import { FormatInstructionImageReference } from "@/components/explore/format-instruction-image-reference";
import { resolveSlideshowImage } from "@/lib/explore/slideshow-image";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import {
  AI_STUDIO_GENERATION_QUANTITIES,
  AI_STUDIO_IMAGE_ASPECT_RATIOS,
  AI_STUDIO_IMAGE_MODELS,
  DEFAULT_AI_STUDIO_IMAGE_MODEL,
  type AIStudioGenerationQuantity,
  type AIStudioImageAspectRatio,
  type AIStudioImageModel,
} from "@/lib/ai-studio/generation-settings";
import {
  fetchAIStudioMediaAsset,
  fetchAIStudioMediaAssets,
} from "@/lib/ai-studio/media-client";
import {
  getAIStudioImageResults,
  type AIStudioImageResult,
  upsertAIStudioResult,
} from "@/lib/ai-studio/media-results";
import {
  filterAIStudioImageHistory,
  getTodayAIStudioImages,
  groupAIStudioImageHistory,
} from "@/lib/ai-studio/image-history";
import {
  AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useRecoverableWorkflowJobs,
  useStoredBackgroundJobIds,
  useCancelBackgroundJob,
  usePersistedJobIdFromUrl,
  useRetryBackgroundJob,
} from "@/lib/jobs/background-job-client";
import type { Json } from "@/lib/jobs/background-jobs";
import { cn } from "@/lib/utils";

type GenerateResponse =
  | {
      generationId: string;
      jobId: string;
      jobs: { generationId: string; jobId: string }[];
      message: string;
      ok: true;
      partial: boolean;
    }
  | {
      message: string;
      ok: false;
    };

const IMAGE_JOB_STORAGE_PREFIX = "ugc-ai-studio.latest-image-job.v2.";
const IMAGE_JOB_METADATA_PREFIX = "ugc-ai-studio.image-job.v2.";
const IMAGE_JOB_URL_PARAMETER = "imageJob";
const IMAGE_PREVIEW_WIDTH_CLASS_NAMES: Record<
  AIStudioImageAspectRatio,
  string
> = {
  "4:5": "max-w-[min(320px,38dvh)]",
  "1:1": "max-w-[min(360px,46dvh)]",
  "9:16": "max-w-[min(240px,26dvh)]",
  "16:9": "max-w-[min(560px,82dvh)]",
};
const activeJobStatuses = new Set([
  "cancel_requested",
  "created",
  "processing",
  "queued",
  "rendering",
  "stalled",
  "uploading_output",
  "waiting_external_service",
]);

function getImageJobOutput(output: Json | null) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  return {
    generationId:
      typeof output.generationId === "string" ? output.generationId : null,
    mediaAssetId:
      typeof output.mediaAssetId === "string" ? output.mediaAssetId : null,
    ratio:
      typeof output.ratio === "string" &&
      AI_STUDIO_IMAGE_ASPECT_RATIOS.includes(
        output.ratio as AIStudioImageAspectRatio,
      )
        ? (output.ratio as AIStudioImageAspectRatio)
        : null,
    url: typeof output.url === "string" ? output.url : null,
  };
}

function persistImageJobs(
  userId: string,
  jobs: readonly { jobId: string }[],
  metadata: { aspectRatio: AIStudioImageAspectRatio; prompt: string },
) {
  try {
    const jobIds = jobs.map((job) => job.jobId);
    window.localStorage.setItem(
      `${IMAGE_JOB_STORAGE_PREFIX}${userId}`,
      JSON.stringify(jobIds),
    );
    for (const jobId of jobIds) {
      window.localStorage.setItem(
        `${IMAGE_JOB_METADATA_PREFIX}${userId}.${jobId}`,
        JSON.stringify(metadata),
      );
    }
  } catch {
    // The owner-scoped URL remains the resume fallback when storage is blocked.
  }
}

function getImageJobPrompt(userId: string, jobId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      `${IMAGE_JOB_METADATA_PREFIX}${userId}.${jobId}`,
    );
    const value = rawValue ? (JSON.parse(rawValue) as unknown) : null;

    return value &&
      typeof value === "object" &&
      "prompt" in value &&
      typeof value.prompt === "string"
      ? value.prompt
      : "Generated image";
  } catch {
    return "Generated image";
  }
}

function getImageJobAspectRatio(
  userId: string,
  jobId: string,
): AIStudioImageAspectRatio {
  try {
    const rawValue = window.localStorage.getItem(
      `${IMAGE_JOB_METADATA_PREFIX}${userId}.${jobId}`,
    );
    const value = rawValue ? (JSON.parse(rawValue) as unknown) : null;

    return value &&
      typeof value === "object" &&
      "aspectRatio" in value &&
      AI_STUDIO_IMAGE_ASPECT_RATIOS.includes(
        value.aspectRatio as AIStudioImageAspectRatio,
      )
      ? (value.aspectRatio as AIStudioImageAspectRatio)
      : "9:16";
  } catch {
    return "9:16";
  }
}

export function ImageGenerationStudioPanel({
  accessMessage,
  accessState = "locked",
  active = true,
  creditCost = 1,
  creditsRemaining = null,
  recreateView,
}: {
  accessMessage?: string | null;
  accessState?: AIStudioAccessState;
  active?: boolean;
  creditCost?: number;
  creditsRemaining?: number | null;
  recreateView?: RecreateGenerationView;
}) {
  const workflow = recreateView?.workflow;
  const workflowFormat = workflow?.format;
  const { loading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] =
    useState<AIStudioImageAspectRatio>(workflow ? "4:5" : "9:16");
  const [model, setModel] = useState<AIStudioImageModel>(
    DEFAULT_AI_STUDIO_IMAGE_MODEL,
  );
  const [quantity, setQuantity] =
    useState<AIStudioGenerationQuantity>(1);
  const [referenceImage, setReferenceImage] =
    useState<AIStudioReferenceMedia | null>(null);
  const [referencePending, setReferencePending] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState("");
  const [latestCompletedId, setLatestCompletedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectingImage, setSelectingImage] = useState(false);
  const selectingImageRef = useRef(false);
  const [generatedAssets, setGeneratedAssets] = useState<
    AIStudioImageResult[]
  >([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [selectedHistoryImageId, setSelectedHistoryImageId] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(() => new Date());
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const storedJobIds = useStoredBackgroundJobIds(user ? `${IMAGE_JOB_STORAGE_PREFIX}${workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid}` : null);
  const [submittedJobIds, setSubmittedJobIds] = useState<string[]>([]);
  const [ignoredPersistedJobId, setIgnoredPersistedJobId] = useState<
    string | null
  >(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const billingSyncedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl(workflowFormat ? `explore-${workflowFormat}Job` : IMAGE_JOB_URL_PARAMETER);
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
  const { queries: activeJobQueries, recovering: recoveringJobs, recoveryError } = useRecoverableWorkflowJobs(activeJobIds, {
    enabled: active && !recreateView?.preview,
    exploreFormat: workflowFormat,
    jobType: "image_generation",
  });
  const cancelJob = useCancelBackgroundJob();
  const retryJob = useRetryBackgroundJob();
  const queriedJobs = activeJobQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const durableJobs = queriedJobs.filter(
    (job) => job.jobType === "image_generation" && (!workflowFormat || job.exploreFormat === workflowFormat),
  );
  const generationLocked = accessState !== "pro" || Boolean(recreateView?.preview);
  const requiredCredits = creditCost * quantity;
  const hasInsufficientCredits =
    accessState === "pro" &&
    creditsRemaining !== null &&
    creditsRemaining < requiredCredits;
  const composerMessage = generationLocked
    ? accessMessage
    : hasInsufficientCredits
      ? `This generation needs ${requiredCredits} AI credits. You have ${creditsRemaining}.`
      : `This generation uses ${requiredCredits} AI credit${requiredCredits === 1 ? "" : "s"}.`;
  const isGenerating =
    isSubmitting ||
    activeJobQueries.some((query) => query.isPending) ||
    durableJobs.some((job) => activeJobStatuses.has(job.status));
  const onWorkflowBusyChange = workflow?.onBusyChange;
  useEffect(() => { onWorkflowBusyChange?.(isGenerating || selectingImage); }, [isGenerating, selectingImage, onWorkflowBusyChange]);
  const pendingGenerationCount = isSubmitting
    ? quantity
    : activeJobQueries.reduce((count, query) => {
        if (query.isPending) {
          return count + 1;
        }

        return query.data && activeJobStatuses.has(query.data.status)
          ? count + 1
          : count;
      }, 0);

  useEffect(() => {
    activeUserIdRef.current = user?.uid ?? null;
    resolvedJobIdsRef.current.clear();
    billingSyncedJobIdsRef.current.clear();

    return () => {
      activeUserIdRef.current = null;
    };
  }, [user?.uid]);

  useEffect(() => {
    let day = new Date().toDateString();
    let timeoutId: number;
    function updateDay() {
      const now = new Date();
      if (now.toDateString() !== day) {
        day = now.toDateString();
        setCurrentDay(now);
        setSelectedHistoryImageId(null);
      }
      window.clearTimeout(timeoutId);
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timeoutId = window.setTimeout(updateDay, nextDay.getTime() - now.getTime() + 100);
    }
    updateDay();
    window.addEventListener("focus", updateDay);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", updateDay);
    };
  }, []);

  useEffect(() => {
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadResults() {
      setHistoryOpen(false);
      setHistoryQuery("");
      setSelectedHistoryImageId(null);
      if (!user) {
        if (!ignore) {
          setGeneratedAssets([]);
          setResultsError(recreateView?.preview ? null : "Sign in to view your generated images.");
          setResultsLoading(false);
        }
        return;
      }

      setResultsLoading(true);
      setResultsError(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to view your generated images.");
        }

        const assets = await fetchAIStudioMediaAssets({
          collection: "image",
          sourceType: "generated_image",
          token,
        });

        if (!ignore) {
          const history = getAIStudioImageResults(workflowFormat ? assets.filter(asset => asset.metadata.exploreFormat === workflowFormat) : assets, assets.length);
          setGeneratedAssets(current => [...current, ...history.filter(image => !current.some(result => result.id === image.id))]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
        }
      } catch (error) {
        if (!ignore) {
          setResultsError(
            getErrorMessage(error, "Could not load your generated images."),
          );
        }
      } finally {
        if (!ignore) {
          setResultsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      ignore = true;
    };
  }, [active, authLoading, user, recreateView?.preview, workflowFormat]);

  useEffect(() => {
    if (
      persistedJobId &&
      queriedJobs.some(
        (job) =>
          job?.id === persistedJobId && job.jobType !== "image_generation",
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
    if (!user) {
      return;
    }

    const terminalJobs = durableJobs.filter(
      (job) =>
        ["cancelled", "completed", "failed"].includes(job.status) &&
        !billingSyncedJobIdsRef.current.has(`${job.id}:${job.status}:${job.updatedAt}`),
    );

    if (terminalJobs.length === 0) {
      return;
    }

    terminalJobs.forEach((job) => billingSyncedJobIdsRef.current.add(`${job.id}:${job.status}:${job.updatedAt}`));
    void queryClient.invalidateQueries({
      queryKey: ["billing-subscription", user.uid],
    });
  }, [durableJobs, queryClient, user]);

  useEffect(() => {
    const completedJobs = durableJobs.filter(
      (job) =>
        job.status === "completed" &&
        !resolvedJobIdsRef.current.has(job.id),
    );

    if (!user || completedJobs.length === 0) {
      return;
    }

    for (const completedJob of completedJobs) {
      resolvedJobIdsRef.current.add(completedJob.id);
    }

    const userId = user.uid;

    async function reconcileCompletedImage(
      completedJob: (typeof completedJobs)[number],
    ) {
      const output = getImageJobOutput(completedJob.output);

      if (!output?.url) {
        if (activeUserIdRef.current === userId) {
          setActionError("Image generation completed without a usable output.");
        }
        return;
      }

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to restore the generated image.");
        }

        let persistedResult: AIStudioImageResult | null = null;

        try {
          if (output.mediaAssetId) {
            const asset = await fetchAIStudioMediaAsset(
              output.mediaAssetId,
              token,
            );
            persistedResult = getAIStudioImageResults([asset], 1)[0] ?? null;
          } else {
            const assets = await fetchAIStudioMediaAssets({
              collection: "image",
              sourceType: "generated_image",
              token,
            });
            persistedResult =
              getAIStudioImageResults(
                assets.filter(
                  (asset) => asset.sourceRecordId === completedJob.id,
                ),
                1,
              )[0] ?? null;
          }
        } catch {
          // The durable job output is still usable while media persistence
          // catches up or the media endpoint is temporarily unavailable.
        }

        const nextResult: AIStudioImageResult =
          persistedResult ?? {
            aspectRatio:
              output.ratio ??
              getImageJobAspectRatio(workflowFormat ? `${userId}.${workflowFormat}` : userId, completedJob.id),
            createdAt: completedJob.completedAt ?? completedJob.updatedAt,
            id: output.mediaAssetId ?? output.generationId ?? completedJob.id,
            mediaAssetId: output.mediaAssetId ?? null,
            sourceJobId: completedJob.id,
            title: getImageJobPrompt(workflowFormat ? `${userId}.${workflowFormat}` : userId, completedJob.id),
            url: output.url,
          };

        if (activeUserIdRef.current === userId) {
          setGeneratedAssets((current) =>
            upsertAIStudioResult(current, nextResult, current.length + 1),
          );
          setLatestCompletedId(nextResult.id);
          setTimeout(() => setLatestCompletedId(null), 3500);
          setActivePrompt("");
          setActionNotice(null);
          setActionError(null);
        }
      } catch (error) {
        resolvedJobIdsRef.current.delete(completedJob.id);
        if (activeUserIdRef.current === userId) {
          setActionError(
            getErrorMessage(error, "Could not restore the generated image."),
          );
        }
      }
    }

    void Promise.all(completedJobs.map(reconcileCompletedImage));
  }, [durableJobs, user, workflowFormat]);

  async function generateFromPrompt(rawPrompt: string) {
    const trimmedPrompt = normalizeAIStudioPrompt(rawPrompt);
    const promptLengthError = getAIStudioPromptLengthError(
      trimmedPrompt,
      AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
    );

    if (
      generationLocked ||
      hasInsufficientCredits ||
      !trimmedPrompt ||
      Boolean(workflow && !recreateView?.referenceImageUrl && !referenceImage) ||
      referencePending || Boolean(referenceError) || Boolean(workflow?.editingBusy) ||
      isGenerating || selectingImageRef.current || recoveringJobs
    ) {
      return;
    }

    if (promptLengthError) {
      setActionError(promptLengthError);
      return;
    }

    setIsSubmitting(true);
    setSelectedHistoryImageId(null);
    setActivePrompt(trimmedPrompt);
    workflow?.onGenerationStart();
    setActionNotice(null);
    setActionError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token || !user) {
        throw new Error("Sign in before generating images.");
      }

      const idempotencyKey =
        submissionKeyRef.current ?? crypto.randomUUID();
      submissionKeyRef.current = idempotencyKey;

      const response = await fetch("/api/ai-studio/images/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          aspectRatio,
          exploreFormat: workflow?.format,
          idempotencyKey,
          model,
          prompt: trimmedPrompt,
          quantity,
          referenceImageUrl: workflow ? recreateView?.referenceImageUrl ?? null : referenceImage?.asset.url ?? recreateView?.referenceImageUrl ?? null,
          ...(workflow && referenceImage ? { referenceImageAssetId: referenceImage.asset.id } : {}),
        }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.ok === false ? data.message : "Generation could not start.",
        );
      }

      persistImageJobs(workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid, data.jobs, { aspectRatio, prompt: trimmedPrompt });
      void queryClient.invalidateQueries({
        queryKey: ["billing-subscription", user.uid],
      });
      persistJobIdInUrl(data.jobId, workflowFormat ? `explore-${workflowFormat}Job` : IMAGE_JOB_URL_PARAMETER);
      for (const job of data.jobs) {
        resolvedJobIdsRef.current.delete(job.jobId);
      }
      const jobIds = data.jobs.map((job) => job.jobId);
      setSubmittedJobIds(jobIds);
      if (data.partial) {
        setActionNotice(data.message);
      }
      submissionKeyRef.current = null;
      setPrompt("");
    } catch (error) {
      console.error("Image generation failed:", error);
      setActionError(
        getErrorMessage(error, "Image generation failed. Try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelGeneration() {
    const cancellableJobIds = durableJobs
      .filter((job) => activeJobStatuses.has(job.status))
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
        getErrorMessage(error, "Could not cancel this image job."),
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
      setActionNotice(null);
      setActionError(null);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not retry this image job."));
    }
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    void generateFromPrompt(prompt);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void generateFromPrompt(prompt);
    }
  }

  const failedJobQuery = activeJobQueries.find((query) => query.isError);
  const jobQueryError = failedJobQuery
    ? getErrorMessage(
        failedJobQuery.error,
        "Could not retrieve an image generation job.",
      )
    : null;
  const failedDurableJob = durableJobs.find((job) => job.status === "failed");
  const cancelledDurableJob = durableJobs.find(
    (job) => job.status === "cancelled",
  );
  const durableError = failedDurableJob
    ? failedDurableJob.error?.message || "Image generation failed. Try again."
    : null;
  const durableNotice = cancelledDurableJob
    ? "Image generation was cancelled."
    : null;
  const resultsErrorMessage = actionError ?? jobQueryError ?? durableError ?? (isGenerating ? null : resultsError ?? recoveryError);
  const resultsStatus: AiStudioResultsStatus | null = resultsErrorMessage
    ? { label: resultsErrorMessage, tone: "error" }
    : isGenerating
      ? { label: "Creating your image…", tone: "progress" }
      : actionNotice ?? durableNotice
        ? { label: actionNotice ?? durableNotice ?? "", tone: "neutral" }
        : null;
  const canRetry = durableJobs.some(
    (job) => job.status === "failed" && Boolean(job.error?.retryable),
  );
  const historyGroups = groupAIStudioImageHistory(
    filterAIStudioImageHistory(generatedAssets, historyQuery),
    currentDay,
  );
  const selectedHistoryImage = generatedAssets.find((asset) => asset.id === selectedHistoryImageId);
  const visibleImages = selectedHistoryImage
    ? [selectedHistoryImage]
    : getTodayAIStudioImages(generatedAssets, currentDay);

  function focusHistoryImage(imageId: string) {
    setSelectedHistoryImageId(imageId);
    setHistoryOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`ai-studio-image-result-${imageId}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  return (
    <div
      id="ai-studio-images-panel"
      role={workflow ? undefined : "tabpanel"}
      aria-labelledby={workflow ? undefined : "ai-studio-images-tab"}
      hidden={!active}
      className={workflow ? "contents" : cn(
        "min-h-0 flex-1 flex-col",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <AiStudioResults
        portalTarget={workflow?.resultsTarget}
        ariaLabel="Generated images"
        emptyContent={recreateView?.emptyContent}
        gridClassName={recreateView ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 2xl:grid-cols-1" : undefined}
        emptyTitle="Create an image"
        emptyDescription="Start a new image below. Your earlier generations are in History."
        hasResults={visibleImages.length > 0 || isGenerating}
        loading={(resultsLoading || recoveringJobs) && !isGenerating && visibleImages.length === 0}
        status={resultsStatus}
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selectedHistoryImage ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedHistoryImageId(null)}>
                Back to today
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" disabled={resultsLoading} onClick={() => setHistoryOpen(true)}>
              <History className="size-4" aria-hidden="true" />
              History
              {generatedAssets.length > 0 ? (
                <span className="rounded-full bg-card-muted px-1.5 py-0.5 text-[10px] tabular-nums">{generatedAssets.length}</span>
              ) : null}
            </Button>
          </div>
        }
      >
        {isGenerating
          ? Array.from(
              { length: Math.max(1, pendingGenerationCount) },
              (_, index) => (
                <OptimisticImageCard
                  key={`pending-image-${index}`}
                  aspectRatio={aspectRatio}
                  prompt={activePrompt}
                />
              ),
            )
          : null}
        {visibleImages.map((asset) => (
          <GeneratedAssetCard
            key={asset.id}
            asset={asset}
            isNew={asset.id === latestCompletedId}
            selectionDisabled={selectingImage || isGenerating || referencePending || Boolean(workflow?.editingBusy)}
            onSelect={workflow?.onSelectImage ? () => { void (async () => {
              if (selectingImageRef.current || isGenerating || referencePending || workflow.editingBusy) return;
              const ownerId = user?.uid;
              selectingImageRef.current = true; setSelectingImage(true); onWorkflowBusyChange?.(true);
              try {
                if (!ownerId) throw new Error("Sign in to use your image.");
                const token = await getCurrentUserIdToken(ownerId);
                if (!token) throw new Error("Sign in to use your image.");
                const owned = await resolveSlideshowImage(asset, token);
                if (activeUserIdRef.current === ownerId) { setActionError(null); workflow.onSelectImage?.(owned); }
              } catch (error) { if (activeUserIdRef.current === ownerId) setActionError(getErrorMessage(error, "Could not load your saved image. Try Use this image again.")); }
              finally { selectingImageRef.current = false; if (activeUserIdRef.current === ownerId) setSelectingImage(false); }
            })(); } : undefined}
          />
        ))}
      </AiStudioResults>

      <ImageGenerationHistory
        groups={historyGroups}
        open={historyOpen && active}
        onOpenChange={setHistoryOpen}
        query={historyQuery}
        onQueryChange={setHistoryQuery}
        onSelectImage={focusHistoryImage}
        selectedImageId={selectedHistoryImageId ?? latestCompletedId}
      />

      <AiStudioComposer
        portalTarget={workflow?.controlsTarget}
        actionsTarget={workflow?.actionsTarget}
        settingsSummary={workflow ? `${model === "nano_banana_2" ? "Nano Banana 2.1" : "Seedream 5.0 Pro"} · ${aspectRatio} · ${quantity} image${quantity === 1 ? "" : "s"}` : undefined}
        compact={Boolean(recreateView)}
        contextBanner={recreateView?.contextBanner}
        accessMessage={composerMessage}
        active={workflow?.controlsActive ?? active}
        ariaLabel="Image prompt"
        generateDisabled={
          generationLocked ||
          hasInsufficientCredits ||
          !prompt.trim() ||
          Boolean(workflow && !recreateView?.referenceImageUrl && !referenceImage) ||
          referencePending || Boolean(referenceError) || Boolean(workflow?.editingBusy) ||
          isGenerating || selectingImage || recoveringJobs
        }
        generateLabel="Generate image"
        generationLocked={generationLocked}
        isGenerating={isGenerating}
        layout={workflow ? "workflow" : "unified"}
        promptAttachmentControl={workflow ? <FormatInstructionImageReference key={user?.uid ?? "signed-out"} selection={referenceImage} ownerId={user?.uid} active={workflow.controlsActive ?? active} preview={recreateView?.preview} disabled={generationLocked && !recreateView?.preview || isGenerating || selectingImage || Boolean(workflow.editingBusy)} onPendingChange={setReferencePending} onErrorChange={setReferenceError} onChange={selection => { submissionKeyRef.current = null; setReferenceImage(selection); }} /> : undefined}
        leadingControl={!workflow ?
          <ReferenceMediaUpload
            active={active}
            allowedKinds={["image"]}
            disabled={generationLocked || isGenerating}
            selection={referenceImage}
            onChange={(selection) => {
              submissionKeyRef.current = null;
              setReferenceImage(selection);
            }}
          /> : undefined}
        maxLength={AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH}
        name="imagePrompt"
        placeholder={recreateView ? "What would you like to change?" : "Describe the image you want to create…"}
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
              ariaLabel="Image model"
              className={workflow ? "col-span-2" : undefined}
              fieldLabel={workflow ? "Model" : undefined}
              disabled={generationLocked || isGenerating || selectingImage || Boolean(workflow?.editingBusy)}
              options={AI_STUDIO_IMAGE_MODELS.map((value) => ({
                label: value === "nano_banana_2" ? "Nano Banana 2.1" : "Seedream 5.0 Pro",
                value,
              }))}
              value={model}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setModel(value as AIStudioImageModel);
              }}
            />
            <AiStudioRatioPicker
              fieldLabel={workflow ? "Ratio" : undefined}
              value={aspectRatio}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setAspectRatio(value);
              }}
              disabled={generationLocked || isGenerating || selectingImage || Boolean(workflow?.editingBusy)}
            />
            <AiStudioSettingSelect
              ariaLabel="Number of images"
              fieldLabel={workflow ? "Images" : undefined}
              disabled={generationLocked || isGenerating || selectingImage || Boolean(workflow?.editingBusy)}
              icon={<ImageIcon className="size-4" aria-hidden="true" />}
              options={AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({
                label: `${count} image${count === 1 ? "" : "s"}`,
                value: String(count),
              }))}
              value={String(quantity)}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setQuantity(Number(value) as AIStudioGenerationQuantity)
              }}
            />
          </>
        }
      />
    </div>
  );
}

function OptimisticImageCard({
  aspectRatio,
  prompt,
}: {
  aspectRatio: AIStudioImageAspectRatio;
  prompt?: string;
}) {
  return (
    <article
      className={cn(
        "group w-full min-w-0 justify-self-start animate-in fade-in-0 duration-300",
        getImagePreviewWidthClassName(aspectRatio),
      )}
    >
      <div
        className="relative overflow-hidden rounded-[var(--radius-card)] bg-card-muted/70 ring-1 ring-primary/30"
        style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.04] via-transparent to-primary/[0.08]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full border border-primary/30 bg-card/90 shadow-sm backdrop-blur-md">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-card/85 px-2.5 py-1 text-[11px] font-semibold text-foreground-strong shadow-xs backdrop-blur-md">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            Generating image…
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-semibold text-foreground/85">
            {prompt || "Creating image…"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-subtle animate-pulse">
            Polishing details…
          </p>
        </div>
      </div>
    </article>
  );
}

function GeneratedAssetCard({
  asset,
  isNew = false,
  onSelect,
  selectionDisabled = false,
}: {
  asset: AIStudioImageResult;
  isNew?: boolean;
  onSelect?: () => void;
  selectionDisabled?: boolean;
}) {
  return (
    <article
      id={`ai-studio-image-result-${asset.id}`}
      className={cn(
        "group w-full min-w-0 justify-self-start transition-[transform,box-shadow] duration-300",
        getImagePreviewWidthClassName(asset.aspectRatio),
        isNew &&
          "animate-in fade-in-50 zoom-in-[0.98] duration-500 rounded-[var(--radius-card)] ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background",
      )}
    >
      <div
        className="overflow-hidden rounded-[var(--radius-card)] bg-card-muted ring-1 ring-border"
        style={{ aspectRatio: asset.aspectRatio.replace(":", " / ") }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.title}
          width={1200}
          height={getGeneratedImageHeight(asset.aspectRatio)}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold text-foreground">
            {asset.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-subtle">
            {formatGeneratedAt(asset.createdAt)}
          </p>
        </div>
        {onSelect ? <Button type="button" onClick={onSelect} disabled={selectionDisabled}>Use this image</Button> : null}
        <AiStudioResultActions
          kind="image"
          title={asset.title}
          url={asset.url}
        />
      </div>
    </article>
  );
}

function getImagePreviewWidthClassName(
  aspectRatio: AIStudioImageAspectRatio,
) {
  return IMAGE_PREVIEW_WIDTH_CLASS_NAMES[aspectRatio];
}

function getGeneratedImageHeight(
  aspectRatio: AIStudioImageResult["aspectRatio"],
) {
  const heights: Record<AIStudioImageResult["aspectRatio"], number> = {
    "4:5": 1500,
    "1:1": 1200,
    "9:16": 2133,
    "16:9": 675,
  };

  return heights[aspectRatio];
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
