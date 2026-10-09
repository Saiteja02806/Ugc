"use client";

import { ChevronDown, ChevronUp, History, ImageIcon, Loader2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { AiStudioCopyButton } from "@/components/generation/ai-studio-copy-button";
import { ImageGenerationHistory } from "@/components/generation/image-generation-history";
import { ImagePreviewDialog } from "@/components/generation/image-preview-dialog";
import { ReferenceMediaUpload } from "@/components/generation/reference-media-upload";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { RecreateGenerationView } from "@/components/explore/recreate-generation-view";
import { FormatInstructionImageReference } from "@/components/explore/format-instruction-image-reference";
import creation from "@/components/explore/workflow-creation.module.css";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import {
  AI_STUDIO_GENERATION_QUANTITIES,
  AI_STUDIO_IMAGE_ASPECT_RATIOS,
  AI_STUDIO_IMAGE_MODELS,
  SLIDESHOW_IMAGE_MODELS,
  DEFAULT_AI_STUDIO_IMAGE_MODEL,
  DEFAULT_SLIDESHOW_IMAGE_MODEL,
  getAIStudioImageModelLabel,
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
  getVisibleAIStudioImages,
  groupAIStudioImageHistory,
  isImageCompletionForeground,
  mergeAIStudioImageHistory,
} from "@/lib/ai-studio/image-history";
import { normalizeAIStudioPrompt } from "@/lib/ai-studio/prompt-policy";
import { resolveSlideshowImage } from "@/lib/explore/slideshow-image";
import { appendAIStudioSessionResultIds } from "@/lib/ai-studio/generation-session";
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
const MISSING_IMAGE_PROMPT = "The prompt wasn't saved for this image.";
const IMAGE_PREVIEW_WIDTH_CLASS_NAMES: Record<
  AIStudioImageAspectRatio,
  string
> = {
  "4:5": "max-w-[min(240px,32dvh)]",
  "1:1": "max-w-[min(280px,38dvh)]",
  "9:16": "max-w-[min(200px,24dvh)]",
  "16:9": "max-w-[min(420px,56dvh)]",
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
    prompt: typeof output.prompt === "string" && output.prompt.trim() ? output.prompt : null,
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
      : null;
  } catch {
    return null;
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
    useState<AIStudioImageAspectRatio>("9:16");
  const [model, setModel] = useState<AIStudioImageModel>(
    workflowFormat === "slideshow" ? DEFAULT_SLIDESHOW_IMAGE_MODEL : DEFAULT_AI_STUDIO_IMAGE_MODEL,
  );
  const [quantity, setQuantity] =
    useState<AIStudioGenerationQuantity>(1);
  const [referenceImage, setReferenceImage] =
    useState<AIStudioReferenceMedia | null>(null);
  const [referenceUploadPending, setReferenceUploadPending] = useState(false);
  const [referenceUploadError, setReferenceUploadError] = useState<string | null>(null);
  const [selectingImage, setSelectingImage] = useState(false);
  const selectingImageRef = useRef(false);
  const [activePrompt, setActivePrompt] = useState("");
  const [activeSubmittedAt, setActiveSubmittedAt] = useState(() => new Date().toISOString());
  const [latestCompletedId, setLatestCompletedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<
    AIStudioImageResult[]
  >([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyNow, setHistoryNow] = useState(() => new Date());
  const [selectedHistoryImageId, setSelectedHistoryImageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<AIStudioImageResult | null>(null);
  const [currentResultIds, setCurrentResultIds] = useState<string[]>([]);
  const [reconciledResultByJob, setReconciledResultByJob] = useState<Record<string, string>>({});
  const [submittedPrompts, setSubmittedPrompts] = useState<Record<string, string>>({});
  const [resolvingImageJobIds, setResolvingImageJobIds] = useState<string[]>([]);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const storedJobIds = useStoredBackgroundJobIds(user ? `${IMAGE_JOB_STORAGE_PREFIX}${workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid}` : null);
  const [submittedJobIds, setSubmittedJobIds] = useState<string[]>([]);
  const [ignoredPersistedJobId, setIgnoredPersistedJobId] = useState<
    string | null
  >(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const foregroundJobIdsRef = useRef(new Set<string>());
  const foregroundEpochRef = useRef(0);
  const foregroundAutoResumeRef = useRef(true);
  const reconciledResultsRef = useRef(new Map<string, AIStudioImageResult>());
  const submittedPromptsRef = useRef(new Map<string, string>());
  const historyOwnerIdRef = useRef<string | null>(null);
  const billingSyncedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl(workflowFormat ? `explore-${workflowFormat}Job` : IMAGE_JOB_URL_PARAMETER);
  const referenceContextKey = JSON.stringify(recreateView?.referenceImageUrls ?? null);
  useEffect(() => {
    submissionKeyRef.current = null;
  }, [recreateView?.referenceImageUrl, recreateView?.referenceImageAssetId, referenceContextKey]);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const activeJobIds = recreateView?.preview ? [] : Array.from(
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
  const generationLocked = recreateView?.preview === true || accessState !== "pro";
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
  useEffect(() => { onWorkflowBusyChange?.(isGenerating || referenceUploadPending || selectingImage); }, [isGenerating, referenceUploadPending, selectingImage, onWorkflowBusyChange]);
  useEffect(() => {
    activeUserIdRef.current = user?.uid ?? null;
    resolvedJobIdsRef.current.clear();
    foregroundJobIdsRef.current.clear();
    foregroundEpochRef.current += 1;
    foregroundAutoResumeRef.current = true;
    reconciledResultsRef.current.clear();
    submittedPromptsRef.current.clear();
    billingSyncedJobIdsRef.current.clear();

    return () => {
      activeUserIdRef.current = null;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadResults() {
      setHistoryOpen(false);
      setHistoryQuery("");
      if (recreateView?.preview) {
        setGeneratedAssets([]);
        setSubmittedJobIds([]);
        setCurrentResultIds([]);
        setSelectedHistoryImageId(null);
        setResultsError(null);
        setResultsLoading(false);
        return;
      }
      if (historyOwnerIdRef.current !== (user?.uid ?? null)) {
        historyOwnerIdRef.current = user?.uid ?? null;
        setGeneratedAssets([]);
        setCurrentResultIds([]);
        setSelectedHistoryImageId(null);
        setPreviewImage(null);
        setReconciledResultByJob({});
        setSubmittedPrompts({});
        setResolvingImageJobIds([]);
      }
      if (!user) {
        if (!ignore) {
          setGeneratedAssets([]);
          setCurrentResultIds([]);
          setSelectedHistoryImageId(null);
          setResultsError("Sign in to view your generated images.");
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
          const assetJobs = new Map(assets.map((asset) => [asset.id, asset.sourceRecordId]));
          const loadedImages = getAIStudioImageResults(assets, assets.length).map((image) => {
            const jobId = assetJobs.get(image.id);
            const savedPrompt = jobId ? submittedPromptsRef.current.get(jobId) ?? getImageJobPrompt(user.uid, jobId) : null;
            return savedPrompt
              ? { ...image, prompt: savedPrompt }
              : image;
          });
          setGeneratedAssets(current => mergeAIStudioImageHistory(loadedImages, [
            ...current, ...Array.from(reconciledResultsRef.current.values()),
          ]));
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
    if (!foregroundAutoResumeRef.current) return;
    for (const job of durableJobs) {
      if (activeJobStatuses.has(job.status) || job.id === urlJobId) {
        foregroundJobIdsRef.current.add(job.id);
      }
    }
  }, [durableJobs, urlJobId]);

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
      const completionEpoch = foregroundEpochRef.current;
      const isForeground = () => isImageCompletionForeground(
        completedJob.id,
        completionEpoch,
        foregroundEpochRef.current,
        foregroundJobIdsRef.current,
      );
      const output = getImageJobOutput(completedJob.output);

      if (!output?.url) {
        if (activeUserIdRef.current === userId && isForeground()) {
          setActionError("Image generation completed without a usable output.");
        }
        return;
      }

      try {
        if (isForeground()) {
          setResolvingImageJobIds((current) => current.includes(completedJob.id) ? current : [...current, completedJob.id]);
        }
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

        const storedPrompt = getImageJobPrompt(userId, completedJob.id);
        const savedPrompt = submittedPromptsRef.current.get(completedJob.id) ?? storedPrompt ?? output.prompt ?? persistedResult?.prompt;
        const nextResult: AIStudioImageResult = persistedResult
          ? { ...persistedResult, prompt: savedPrompt }
          : {
            aspectRatio:
              output.ratio ??
              getImageJobAspectRatio(workflowFormat ? `${userId}.${workflowFormat}` : userId, completedJob.id),
            createdAt: completedJob.completedAt ?? completedJob.updatedAt,
            id: output.mediaAssetId ?? output.generationId ?? completedJob.id,
            mediaAssetId: output.mediaAssetId ?? null,
            sourceJobId: completedJob.id,
            prompt: savedPrompt,
            title: storedPrompt ?? "Generated image",
            url: output.url,
          };

        if (activeUserIdRef.current === userId) {
          reconciledResultsRef.current.set(nextResult.id, nextResult);
          setReconciledResultByJob((current) => ({ ...current, [completedJob.id]: nextResult.id }));
          setGeneratedAssets((current) =>
            upsertAIStudioResult(current, nextResult, current.length + 1),
          );
          if (isForeground()) {
            setCurrentResultIds((current) =>
              appendAIStudioSessionResultIds(current, nextResult.id),
            );
            setLatestCompletedId(nextResult.id);
            setTimeout(() => setLatestCompletedId(null), 3500);
            setActionNotice(null);
            setActionError(null);
          }
        }
      } catch (error) {
        resolvedJobIdsRef.current.delete(completedJob.id);
        if (activeUserIdRef.current === userId && isForeground()) {
          setActionError(
            getErrorMessage(error, "Could not restore the generated image."),
          );
        }
      } finally {
        if (activeUserIdRef.current === userId) {
          setResolvingImageJobIds((current) => current.filter((jobId) => jobId !== completedJob.id));
        }
      }
    }

    void Promise.all(completedJobs.map(reconcileCompletedImage));
  }, [durableJobs, user, workflowFormat]);

  async function generateFromPrompt(rawPrompt: string) {
    const trimmedPrompt = normalizeAIStudioPrompt(rawPrompt);

    if (
      generationLocked ||
      hasInsufficientCredits ||
      referenceUploadPending ||
      referenceUploadError || selectingImageRef.current ||
      !trimmedPrompt ||
      Boolean(workflow && !recreateView?.referenceImageUrl && !recreateView?.referenceImageAssetId) ||
      isGenerating || recoveringJobs
    ) {
      return;
    }
    setIsSubmitting(true);
    setSelectedHistoryImageId(null);
    foregroundAutoResumeRef.current = false;
    const submissionEpoch = foregroundEpochRef.current;
    setActivePrompt(trimmedPrompt);
    setActiveSubmittedAt(new Date().toISOString());
    setActionNotice(null);
    setActionError(null);

    try {
      workflow?.onGenerationStart();
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
          referenceImageUrl: workflowFormat === "slideshow" ? recreateView?.referenceImageUrl ?? null : referenceImage?.asset.url ?? recreateView?.referenceImageUrl ?? null,
          ...(workflowFormat === "slideshow" && recreateView?.referenceImageUrls ? { referenceImageUrls: recreateView.referenceImageUrls } : {}),
          ...(workflowFormat === "slideshow" ? { referenceImageAssetId: referenceImage?.asset.id ?? recreateView?.referenceImageAssetId ?? null } : {}),
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
      if (activeUserIdRef.current !== user.uid) {
        return;
      }
      persistJobIdInUrl(data.jobId, workflowFormat ? `explore-${workflowFormat}Job` : IMAGE_JOB_URL_PARAMETER);
      for (const job of data.jobs) {
        submittedPromptsRef.current.set(job.jobId, trimmedPrompt);
        resolvedJobIdsRef.current.delete(job.jobId);
        if (submissionEpoch === foregroundEpochRef.current) {
          foregroundJobIdsRef.current.add(job.jobId);
        }
      }
      if (activeUserIdRef.current === user.uid) {
        setSubmittedPrompts((current) => ({ ...current, ...Object.fromEntries(data.jobs.map((job) => [job.jobId, trimmedPrompt])) }));
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

  async function selectWorkflowImage(image: AIStudioImageResult) {
    if (!workflow?.onSelectImage || selectingImageRef.current) return;
    if (workflowFormat !== "slideshow" || recreateView?.preview) {
      workflow.onSelectImage(image);
      return;
    }
    const ownerId = user?.uid;
    selectingImageRef.current = true;
    setSelectingImage(true);
    setActionError(null);
    try {
      const token = await getCurrentUserIdToken();
      if (!token || !ownerId) throw new Error("Sign in before adding this image to your slides.");
      const ownedImage = await resolveSlideshowImage(image, token);
      if (activeUserIdRef.current === ownerId) workflow.onSelectImage(ownedImage);
    } catch (error) {
      if (activeUserIdRef.current === ownerId) setActionError(getErrorMessage(error, "Could not add this image. Try again."));
    } finally {
      selectingImageRef.current = false;
      setSelectingImage(false);
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
      foregroundJobIdsRef.current.add(retryableJob.id);
      setSelectedHistoryImageId(null);
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
  const historyGroups = useMemo(
    () => groupAIStudioImageHistory(filterAIStudioImageHistory(generatedAssets, historyQuery), historyNow),
    [generatedAssets, historyQuery, historyNow],
  );
  const visibleImages = useMemo(
    () => getVisibleAIStudioImages(generatedAssets, currentResultIds, selectedHistoryImageId),
    [generatedAssets, currentResultIds, selectedHistoryImageId],
  );
  type ImageDisplayRow = {
    key: string;
    aspectRatio: AIStudioImageAspectRatio;
    createdAt: string;
    prompt: string;
    asset: AIStudioImageResult | null;
  };
  const imageRows: ImageDisplayRow[] = [];
  const renderedImageIds = new Set<string>();

  if (!selectedHistoryImageId) {
    for (const [index, jobId] of activeJobIds.entries()) {
      const resultId = reconciledResultByJob[jobId];
      const asset = visibleImages.find((image) => image.id === resultId);
      const query = activeJobQueries[index];
      const job = query?.data;
      if (asset) {
        renderedImageIds.add(asset.id);
        imageRows.push({ key: jobId, aspectRatio: asset.aspectRatio, createdAt: job?.createdAt ?? asset.createdAt, prompt: asset.prompt || MISSING_IMAGE_PROMPT, asset });
      } else if (
        query?.isPending ||
        job?.jobType === "image_generation" && (
          activeJobStatuses.has(job.status) ||
          job.status === "completed" && resolvingImageJobIds.includes(jobId) && !resultId
        )
      ) {
        imageRows.push({
          key: jobId,
          aspectRatio: user ? getImageJobAspectRatio(user.uid, jobId) : aspectRatio,
          createdAt: job?.createdAt ?? activeSubmittedAt,
          prompt: submittedPrompts[jobId] ?? (user ? getImageJobPrompt(user.uid, jobId) ?? MISSING_IMAGE_PROMPT : activePrompt),
          asset: null,
        });
      }
    }
  }

  for (const asset of visibleImages) {
    if (!renderedImageIds.has(asset.id)) {
      imageRows.push({ key: asset.id, aspectRatio: asset.aspectRatio, createdAt: asset.createdAt, prompt: asset.prompt || MISSING_IMAGE_PROMPT, asset });
    }
  }

  if (!selectedHistoryImageId && isSubmitting) {
    for (let index = 0; index < quantity; index += 1) {
      imageRows.push({ key: `submitting-${index}`, aspectRatio, createdAt: activeSubmittedAt, prompt: activePrompt, asset: null });
    }
  }
  imageRows.sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  function focusHistoryImage(imageId: string) {
    setSelectedHistoryImageId(imageId);
    setHistoryOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`ai-studio-image-result-${imageId}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  function startNewImage() {
    foregroundEpochRef.current += 1;
    foregroundAutoResumeRef.current = false;
    foregroundJobIdsRef.current.clear();
    setResolvingImageJobIds([]);
    setSelectedHistoryImageId(null);
    setCurrentResultIds([]);
    setSubmittedJobIds([]);
    setIgnoredPersistedJobId(persistedJobId);
    setActionError(null);
    setActionNotice(null);
    submissionKeyRef.current = null;
    if (user) {
      try {
        window.localStorage.removeItem(`${IMAGE_JOB_STORAGE_PREFIX}${user.uid}`);
      } catch { /* Saved images remain available in History when local storage is blocked. */ }
    }
    persistJobIdInUrl(null, IMAGE_JOB_URL_PARAMETER);
    document.querySelector<HTMLTextAreaElement>('textarea[name="imagePrompt"]')?.focus();
  }

  const hasSessionActions = Boolean(selectedHistoryImageId) || (visibleImages.length > 0 && !isGenerating);

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
        emptyContentClassName={workflow ? "justify-center" : recreateView ? "items-start pt-8" : undefined}
        emptyTitle="What will you create?"
        emptyDescription="Describe an image below, or add a reference to guide the look. Your completed images are saved in History."
        gridClassName="grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"
        hasResults={imageRows.length > 0}
        loading={(resultsLoading || recoveringJobs) && !isGenerating && generatedAssets.length === 0}
        status={resultsStatus}
        statusPlacement="inline"
        scrollToLatestKey={!selectedHistoryImageId && isSubmitting ? activeSubmittedAt : null}
        toolbar={recreateView?.preview ? undefined : recreateView && !hasSessionActions ? undefined :
          <div className="flex items-center gap-2">
            {selectedHistoryImageId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedHistoryImageId(null)}>Back to session</Button>
            ) : null}
            {visibleImages.length > 0 && !isGenerating ? (
              <Button type="button" variant="ghost" size="sm" onClick={startNewImage}>
                <Plus className="size-3.5" aria-hidden="true" />
                New session
              </Button>
            ) : null}
            {!recreateView ? <Button type="button" variant="outline" size="sm" disabled={resultsLoading} onClick={() => { setHistoryNow(new Date()); setHistoryOpen(true); }}>
              <History className="size-3.5" aria-hidden="true" />
              History
              {generatedAssets.length > 0 ? (
                <span className="rounded-full bg-card-muted px-1.5 py-0.5 text-[10px] tabular-nums">{generatedAssets.length}</span>
              ) : null}
            </Button> : null}
          </div>
        }
      >
        {imageRows.map((row) => (
          <ImageGenerationCard
            key={row.key}
            asset={row.asset}
            aspectRatio={row.aspectRatio}
            prompt={row.prompt}
            createdAt={row.createdAt}
            referenceImageUrl={referenceImage?.asset.url ?? null}
            isNew={row.asset?.id === latestCompletedId}
            onOpenPreview={setPreviewImage}
            onSelect={row.asset && workflow?.onSelectImage ? () => void selectWorkflowImage(row.asset!) : undefined}
            selectionDisabled={selectingImage || isGenerating}
          />
        ))}
      </AiStudioResults>

      <ImageGenerationHistory
        groups={historyGroups}
        open={!recreateView && historyOpen && active}
        onOpenChange={setHistoryOpen}
        query={historyQuery}
        onQueryChange={setHistoryQuery}
        onSelectImage={focusHistoryImage}
        selectedImageId={selectedHistoryImageId}
      />

      <ImagePreviewDialog image={active ? previewImage : null} onClose={() => setPreviewImage(null)} />

      <AiStudioComposer
        portalTarget={workflow?.controlsTarget}
        actionsTarget={workflow?.actionsTarget}
        workflowDesign={workflow ? "classic" : undefined}
        referenceControls={workflow ? recreateView?.contextBanner : undefined}
        settingsLabel="Image generation settings"
        settingsClassName={workflow ? creation.imageSettings : undefined}
        settingsSummary={workflow ? `${getAIStudioImageModelLabel(model)} · ${aspectRatio} · ${quantity} image${quantity === 1 ? "" : "s"}` : undefined}
        compact={Boolean(recreateView)}
        contextBanner={recreateView?.contextBanner}
        accessMessage={composerMessage}
        active={workflow?.controlsActive ?? active}
        ariaLabel="Image prompt"
        generateDisabled={
          generationLocked ||
          hasInsufficientCredits ||
          referenceUploadPending ||
          Boolean(referenceUploadError) || selectingImage ||
          !prompt.trim() ||
          Boolean(workflow && !recreateView?.referenceImageUrl && !recreateView?.referenceImageAssetId) ||
          isGenerating || recoveringJobs
        }
        generateLabel="Generate image"
        generationLocked={generationLocked}
        promptAttachmentControl={workflowFormat === "slideshow" ?
          <FormatInstructionImageReference
            key={user?.uid ?? "signed-out"}
            ownerId={user?.uid}
            active={workflow?.controlsActive ?? active}
            preview={recreateView?.preview}
            disabled={(generationLocked && !recreateView?.preview) || isGenerating || selectingImage}
            selection={referenceImage}
            onPendingChange={setReferenceUploadPending}
            onErrorChange={setReferenceUploadError}
            onChange={(selection) => {
              submissionKeyRef.current = null;
              setReferenceImage(selection);
            }}
          /> : undefined}
        hasAttachments={Boolean(referenceImage) || referenceUploadPending}
        isGenerating={isGenerating}
        layout={workflow ? "workflow" : "unified"}
        showPromptHint={generationLocked || hasInsufficientCredits}
        leadingControl={workflow ? undefined :
          <ReferenceMediaUpload
            active={active}
            allowedKinds={["image"]}
            disabled={generationLocked || isGenerating}
            selection={referenceImage}
            onPendingChange={setReferenceUploadPending}
            onChange={(selection) => {
              submissionKeyRef.current = null;
              setReferenceImage(selection);
            }}
          />
        }
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
                size="sm"
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
                size="sm"
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
              fieldLabel={workflow ? "Model" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              size={recreateView ? "sm" : "default"}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
              options={(workflowFormat === "slideshow" ? SLIDESHOW_IMAGE_MODELS : AI_STUDIO_IMAGE_MODELS).map((value) => ({
                label: getAIStudioImageModelLabel(value),
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
              fieldLayout={workflow ? "classic" : undefined}
              size={recreateView ? "sm" : "default"}
              value={aspectRatio}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setAspectRatio(value);
              }}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
            />
            <AiStudioSettingSelect
              ariaLabel="Number of images"
              fieldLabel={workflow ? "Versions for this slide" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              size={recreateView ? "sm" : "default"}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
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

function ImageGenerationCard({
  asset,
  aspectRatio,
  createdAt,
  prompt,
  referenceImageUrl,
  isNew = false,
  onOpenPreview,
  onSelect,
  selectionDisabled = false,
}: {
  asset: AIStudioImageResult | null;
  aspectRatio: AIStudioImageAspectRatio;
  createdAt: string;
  prompt: string;
  referenceImageUrl: string | null;
  isNew?: boolean;
  onOpenPreview: (image: AIStudioImageResult) => void;
  onSelect?: () => void;
  selectionDisabled?: boolean;
}) {
  return (
    <article
      id={asset ? `ai-studio-image-result-${asset.id}` : undefined}
      className={cn(
        "mx-auto w-full max-w-[54rem] scroll-mt-4",
        isNew && "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-300",
      )}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
        <div data-image-preview className={cn("w-full shrink-0 sm:mt-12", getImagePreviewWidthClassName(aspectRatio))}>
          <div
            className={cn("relative overflow-hidden rounded-2xl border bg-card-muted/70", asset ? "border-border" : "border-primary/20")}
            style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
          >
            {asset ? (
              <button
                type="button"
                onClick={() => onOpenPreview(asset)}
                aria-label="Enlarge generated image"
                aria-haspopup="dialog"
                className="block size-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={asset.title} width={1200} height={getGeneratedImageHeight(aspectRatio)} loading="lazy" decoding="async" className="size-full object-contain" />
              </button>
            ) : (
              <>
                {referenceImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={referenceImageUrl} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-15 blur-xl" />
                ) : null}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" role="status" aria-live="polite">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card/90">
                    <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-foreground">Creating your image</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted">It will appear here when ready.</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="mt-2.5 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
              <span>{aspectRatio}</span>
              {asset ? <span className="text-foreground">Ready</span> : null}
            </div>
            {onSelect ? <Button type="button" disabled={selectionDisabled} onClick={onSelect}>Use image in slide</Button> : null}
            {asset ? (
              <AiStudioResultActions kind="image" title={asset.title} url={asset.url} />
            ) : null}
          </div>
        </div>
        <div data-image-details className="w-full min-w-0 self-start sm:ml-auto sm:max-w-[26rem] sm:flex-1">
          <ImagePromptBubble createdAt={createdAt} prompt={prompt} />
        </div>
      </div>
    </article>
  );
}

function ImagePromptBubble({ createdAt, prompt }: { createdAt: string; prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5 text-[11px] font-medium text-muted">
        <span className="text-foreground-strong">Prompt</span>
        <span>{formatGeneratedAt(createdAt)}</span>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse image prompt" : "Show full image prompt"}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start gap-3 rounded-[14px] border border-border bg-card-muted/50 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
      >
        <span className={cn("min-w-0 flex-1 whitespace-pre-wrap text-sm font-normal leading-6 text-foreground [overflow-wrap:anywhere]", expanded ? "max-h-48 overflow-y-auto overscroll-contain pr-2" : "line-clamp-3")}>
          {prompt}
        </span>
        {expanded ? <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" /> : <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />}
      </button>
      {prompt !== MISSING_IMAGE_PROMPT ? (
        <div className="mt-1 flex justify-end"><AiStudioCopyButton kind="prompt" value={prompt} /></div>
      ) : null}
    </div>
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
