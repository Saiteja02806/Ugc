"use client";

import { ChevronDown, ChevronUp, History, ImageIcon, Loader2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGenerationDiscovery } from "@/components/generation/use-generation-discovery";

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
import { useSlideshowPromptImprover } from "@/components/explore/slideshow-prompt-improver";
import { useSlideshowComposerDraft } from "@/components/explore/use-slideshow-composer-draft";
import { requiresScreenshotAttachment } from "@/lib/explore/slideshow-composer-draft";
import { MAX_IMAGE_REFERENCE_CONTEXT } from "@/worker/src/lib/image-reference-context";
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
import { pendingGenerationKey, readPendingGeneration, submitPendingGeneration, mergeStoredGenerationJobIds, type PendingGeneration, type RecoveredGeneration } from "@/lib/ai-studio/pending-generation";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { resolveSlideshowImage } from "@/lib/explore/slideshow-image";
import { readSlideshowGenerationSlot, type SlideshowGenerationSlot } from "@/worker/src/lib/slideshow-generation-batch";
import { groupSlideshowResultRows, slideshowGenerationGroups } from "@/lib/explore/slideshow-generation-groups";
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
    slideshowGeneration: readSlideshowGenerationSlot(output.slideshowGeneration) ?? undefined,
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
  merge = false,
) {
  try {
    const storageKey = `${IMAGE_JOB_STORAGE_PREFIX}${userId}`;
    const jobIds = merge ? mergeStoredGenerationJobIds(window.localStorage, storageKey, jobs) : jobs.map((job) => job.jobId);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(jobIds),
    );
    for (const { jobId } of jobs) {
      window.localStorage.setItem(
        `${IMAGE_JOB_METADATA_PREFIX}${userId}.${jobId}`,
        JSON.stringify(metadata),
      );
    }
    return true;
  } catch {
    // The owner-scoped URL remains the resume fallback when storage is blocked.
    return false;
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
  const metadataOwnerId = user ? workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid : null;
  const discoveredJobIdsRef = useRef(new Set<string>());
  const restoreDiscoveredJobs = useCallback((result: RecoveredGeneration, input: Record<string, unknown>) => {
    if (!metadataOwnerId || !persistImageJobs(metadataOwnerId, result.jobs, { aspectRatio: input.aspectRatio as AIStudioImageAspectRatio, prompt: String(input.prompt) }, true)) throw new Error("Could not save earlier job identities. Their recovery records are preserved.");
    for (const job of result.jobs) { discoveredJobIdsRef.current.add(job.jobId); foregroundJobIdsRef.current.delete(job.jobId); }
  }, [metadataOwnerId]);
  const earlierRequests = useGenerationDiscovery({ ownerId: user?.uid ?? null, kind: "image", scope: workflowFormat ?? "studio", enabled: active && !recreateView?.preview, onRecovered: restoreDiscoveredJobs });
  const queryClient = useQueryClient();
  const [studioPrompt, setStudioPrompt] = useState("");
  const composerDraft = useSlideshowComposerDraft(user?.uid ?? null, JSON.stringify({ references: recreateView?.referenceImageUrls ?? [recreateView?.referenceImageUrl ?? null], regeneration: recreateView?.referenceImageAssetId ?? null }), workflowFormat === "slideshow" && !recreateView?.preview);
  const prompt = workflowFormat === "slideshow" && !recreateView?.preview ? composerDraft.prompt : studioPrompt;
  const setPrompt = workflowFormat === "slideshow" && !recreateView?.preview ? composerDraft.setPrompt : setStudioPrompt;
  const [aspectRatio, setAspectRatio] =
    useState<AIStudioImageAspectRatio>(workflowFormat === "slideshow" ? "4:5" : "9:16");
  const [model, setModel] = useState<AIStudioImageModel>(
    workflowFormat === "slideshow" ? DEFAULT_SLIDESHOW_IMAGE_MODEL : DEFAULT_AI_STUDIO_IMAGE_MODEL,
  );
  const [quantity, setQuantity] =
    useState<AIStudioGenerationQuantity>(1);
  const [referenceImage, setReferenceImage] =
    useState<AIStudioReferenceMedia | null>(null);
  const instructionReferences = composerDraft.images;
  const missingScreenshot = workflowFormat === "slideshow" && requiresScreenshotAttachment(prompt) && !instructionReferences.length;
  const layoutReferenceCount = recreateView?.referenceImageUrls?.length ?? (recreateView?.referenceImageUrl ? 1 : 0);
  const regenerationReferenceCount = recreateView?.referenceImageAssetId && !instructionReferences.some(selection => selection.asset.id === recreateView.referenceImageAssetId) ? 1 : 0;
  const instructionReferenceLimit = Math.max(0, MAX_IMAGE_REFERENCE_CONTEXT - layoutReferenceCount - regenerationReferenceCount);
  const tooManyReferences = workflowFormat === "slideshow" && instructionReferences.length > instructionReferenceLimit;
  const [referenceUploadPending, setReferenceUploadPending] = useState(false);
  const [referenceUploadError, setReferenceUploadError] = useState<string | null>(null);
  const [selectingImage, setSelectingImage] = useState(false);
  const selectingImageRef = useRef(false);
  const [activePrompt, setActivePrompt] = useState("");
  const [activeSubmittedAt, setActiveSubmittedAt] = useState(() => new Date().toISOString());
  const [latestCompletedId, setLatestCompletedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [savedSubmission, setPendingSubmission] = useState<PendingGeneration | null>(null);
  const pendingSubmission = savedSubmission?.ownerId === user?.uid && savedSubmission?.scope === (workflowFormat ?? "studio") && !recreateView?.preview ? savedSubmission : null;
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
  const pendingOwnerId = user?.uid;
  useEffect(() => {
    let stopped = false;
    void Promise.resolve().then(() => {
      if (stopped) return;
      try {
        const saved = pendingOwnerId && !recreateView?.preview ? readPendingGeneration(localStorage.getItem(pendingGenerationKey(pendingOwnerId, "image", workflowFormat ?? "studio")), pendingOwnerId, "image", workflowFormat ?? "studio") : null;
        setPendingSubmission(saved);
        if (saved) { setPrompt(String(saved.input.prompt)); setActionNotice("A previous image submission needs confirmation. Recover saved request checks its original instructions and settings."); }
      } catch { setActionError("The saved image request could not be verified. Keep its recovery record."); }
    });
    return () => { stopped = true; };
  }, [pendingOwnerId, workflowFormat, recreateView?.preview, setPrompt]);
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
  const slideshowSlideCount = workflowFormat === "slideshow" ? recreateView?.slideshowSlideCount : undefined;
  const outputCount = pendingSubmission ? Number(pendingSubmission.input.quantity) * Number(pendingSubmission.input.slideshowSlideCount ?? 1) : quantity * (slideshowSlideCount ?? 1);
  const requiredCredits = creditCost * outputCount;
  const tooManySlides = Boolean(slideshowSlideCount && slideshowSlideCount > 10);
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
  const promptImprover = useSlideshowPromptImprover({
    owner: user?.uid ?? null, prompt,
    contextKey: JSON.stringify({ references: recreateView?.referenceImageUrls ?? [recreateView?.referenceImageUrl ?? null], regeneration: recreateView?.referenceImageAssetId, attachments: instructionReferences.map(selection => selection.asset.id) }),
    disabled: workflowFormat !== "slideshow" || generationLocked || isGenerating || selectingImage || referenceUploadPending || composerDraft.busy || Boolean(composerDraft.error) || Boolean(pendingSubmission) || tooManySlides || tooManyReferences,
    onChange: next => { submissionKeyRef.current = null; setActionError(null); setPrompt(next); },
  });
  const improvingPrompt = promptImprover.busy;
  const onWorkflowBusyChange = workflow?.onBusyChange;
  useEffect(() => { onWorkflowBusyChange?.(isGenerating || referenceUploadPending || selectingImage || improvingPrompt); }, [isGenerating, referenceUploadPending, selectingImage, improvingPrompt, onWorkflowBusyChange]);
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
            const savedPrompt = jobId ? submittedPromptsRef.current.get(jobId) ?? getImageJobPrompt(workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid, jobId) : null;
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
      if (!discoveredJobIdsRef.current.has(job.id) && (activeJobStatuses.has(job.status) || job.id === urlJobId)) {
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
      const isForeground = () => !discoveredJobIdsRef.current.has(completedJob.id) && isImageCompletionForeground(
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

        const storedPrompt = getImageJobPrompt(workflowFormat ? `${userId}.${workflowFormat}` : userId, completedJob.id);
        const savedPrompt = submittedPromptsRef.current.get(completedJob.id) ?? storedPrompt ?? output.prompt ?? persistedResult?.prompt;
        const nextResult: AIStudioImageResult = persistedResult
          ? { ...persistedResult, prompt: savedPrompt, remixTextSource: completedJob.remixTextSource ?? null, slideshowGeneration: completedJob.slideshowGeneration ?? output.slideshowGeneration }
          : {
            aspectRatio:
              output.ratio ??
              getImageJobAspectRatio(workflowFormat ? `${userId}.${workflowFormat}` : userId, completedJob.id),
            createdAt: completedJob.completedAt ?? completedJob.updatedAt,
            id: output.mediaAssetId ?? output.generationId ?? completedJob.id,
            mediaAssetId: output.mediaAssetId ?? null,
            sourceJobId: completedJob.id,
            remixTextSource: completedJob.remixTextSource ?? null,
            slideshowGeneration: completedJob.slideshowGeneration ?? output.slideshowGeneration,
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
      recreateView?.preview || (!pendingSubmission && (generationLocked || hasInsufficientCredits || referenceUploadPending || referenceUploadError || tooManyReferences || tooManySlides || !trimmedPrompt ||
      Boolean(workflow && !recreateView?.referenceImageUrl && !recreateView?.referenceImageAssetId && !instructionReferences.length))) || selectingImageRef.current ||
      isGenerating || improvingPrompt || composerDraft.busy || Boolean(composerDraft.error) || missingScreenshot || recoveringJobs || submittingRef.current
    ) {
      return;
    }
    setIsSubmitting(true);
    submittingRef.current = true;
    setSelectedHistoryImageId(null);
    foregroundAutoResumeRef.current = false;
    const submissionEpoch = foregroundEpochRef.current;
    setActivePrompt(trimmedPrompt);
    setActiveSubmittedAt(new Date().toISOString());
    setActionNotice(null);
    setActionError(null);

    try {
      workflow?.onGenerationStart();
      const token = await withReadDeadline(() => getCurrentUserIdToken(user?.uid));

      if (!token || !user) {
        throw new Error("Sign in before generating images.");
      }

      if (!navigator.locks) throw new Error("Use a browser with Web Locks support to recover generation safely.");
      const admitted = await submitPendingGeneration({ ownerId: user.uid, kind: "image", scope: workflowFormat ?? "studio", token, storage: localStorage, locks: navigator.locks,
        fetch, uuid: () => crypto.randomUUID(), assertActive() { if (activeUserIdRef.current !== user.uid) throw new Error("This account's generation is no longer active."); },
        onStored(saved) { setPendingSubmission(saved); submissionKeyRef.current = saved.requestKey; },
        input: {
          aspectRatio,
          exploreFormat: workflow?.format,
          model,
          prompt: trimmedPrompt,
          quantity,
          ...(slideshowSlideCount ? { slideshowSlideCount } : {}),
          referenceImageUrl: workflowFormat === "slideshow" ? recreateView?.referenceImageUrl ?? null : referenceImage?.asset.url ?? recreateView?.referenceImageUrl ?? null,
          ...(workflowFormat === "slideshow" && recreateView?.referenceImageUrls?.length ? { referenceImageUrls: recreateView.referenceImageUrls } : {}),
          ...(workflowFormat === "slideshow" && instructionReferences.length ? { referenceImageAssetIds: instructionReferences.map(selection => selection.asset.id) } : {}),
          ...(workflowFormat === "slideshow" && recreateView?.referenceImageAssetId ? { regenerationImageAssetId: recreateView.referenceImageAssetId } : {}),
        }, acknowledge(result, input) {
          if (!persistImageJobs(workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid, result.jobs, { aspectRatio: input.aspectRatio as AIStudioImageAspectRatio, prompt: String(input.prompt) })) throw new Error("Your generation is saved on the server. Its browser recovery record is preserved; recover it again.");
        } });
      if (!admitted) throw new Error("Could not confirm the generation lock.");
      const data = admitted.result as Extract<GenerateResponse, { ok: true }>;
      const submittedPrompt = String(admitted.input.prompt);
      setPendingSubmission(null); setActivePrompt(submittedPrompt);
      void queryClient.invalidateQueries({
        queryKey: ["billing-subscription", user.uid],
      });
      if (activeUserIdRef.current !== user.uid) {
        return;
      }
      persistJobIdInUrl(data.jobId, workflowFormat ? `explore-${workflowFormat}Job` : IMAGE_JOB_URL_PARAMETER);
      for (const job of data.jobs) {
        submittedPromptsRef.current.set(job.jobId, submittedPrompt);
        resolvedJobIdsRef.current.delete(job.jobId);
        if (submissionEpoch === foregroundEpochRef.current) {
          foregroundJobIdsRef.current.add(job.jobId);
        }
      }
      if (activeUserIdRef.current === user.uid) {
        setSubmittedPrompts((current) => ({ ...current, ...Object.fromEntries(data.jobs.map((job) => [job.jobId, submittedPrompt])) }));
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
      submittingRef.current = false;
      if (user && activeUserIdRef.current === user.uid) {
        try { setPendingSubmission(readPendingGeneration(localStorage.getItem(pendingGenerationKey(user.uid, "image", workflowFormat ?? "studio")), user.uid, "image", workflowFormat ?? "studio")); }
        catch { setActionError("Could not read the saved request. Its server result remains recoverable."); }
      }
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
      discoveredJobIdsRef.current.delete(retryableJob.id);
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
    slideshowGeneration?: SlideshowGenerationSlot;
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
        imageRows.push({ key: jobId, aspectRatio: asset.aspectRatio, createdAt: job?.createdAt ?? asset.createdAt, prompt: asset.prompt || MISSING_IMAGE_PROMPT, asset, slideshowGeneration: asset.slideshowGeneration ?? job?.slideshowGeneration });
      } else if (
        query?.isPending ||
        job?.jobType === "image_generation" && (
          activeJobStatuses.has(job.status) ||
          job.status === "completed" && resolvingImageJobIds.includes(jobId) && !resultId
        )
      ) {
        imageRows.push({
          key: jobId,
          aspectRatio: metadataOwnerId ? getImageJobAspectRatio(metadataOwnerId, jobId) : aspectRatio,
          createdAt: job?.createdAt ?? activeSubmittedAt,
          prompt: submittedPrompts[jobId] ?? (metadataOwnerId ? getImageJobPrompt(metadataOwnerId, jobId) ?? MISSING_IMAGE_PROMPT : activePrompt),
          asset: null,
          slideshowGeneration: job?.slideshowGeneration,
        });
      }
    }
  }

  for (const asset of visibleImages) {
    if (!renderedImageIds.has(asset.id)) {
      imageRows.push({ key: asset.id, aspectRatio: asset.aspectRatio, createdAt: asset.createdAt, prompt: asset.prompt || MISSING_IMAGE_PROMPT, asset, slideshowGeneration: asset.slideshowGeneration });
    }
  }

  if (!selectedHistoryImageId && isSubmitting) {
    for (let index = 0; index < outputCount; index += 1) {
      imageRows.push({ key: `submitting-${index}`, aspectRatio, createdAt: activeSubmittedAt, prompt: activePrompt, asset: null });
    }
  }
  imageRows.sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  function focusHistoryImage(imageId: string) {
    const image = generatedAssets.find(image => image.id === imageId);
    const group = image?.slideshowGeneration ? slideshowGenerationGroups(generatedAssets).find(group => group.key === `${image.slideshowGeneration!.batchKey}:${image.slideshowGeneration!.versionIndex}`) : null;
    if (workflowFormat === "slideshow" && group) { setCurrentResultIds(group.images.map(image => image.id)); setSelectedHistoryImageId(null); }
    else setSelectedHistoryImageId(imageId);
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

  // Opening a version is explicit: completion must not silently populate a draft.
  const slideshowResults = workflowFormat === "slideshow"
    ? groupSlideshowResultRows(imageRows)
    : { versions: [], individual: imageRows };

  async function selectSlideshowVersion(images: AIStudioImageResult[]) {
    if (!workflow?.onSelectSlideshow || selectingImageRef.current || !user) return;
    const ownerId = user.uid;
    selectingImageRef.current = true; setSelectingImage(true); setActionError(null);
    try {
      const token = await getCurrentUserIdToken(ownerId);
      if (!token) throw new Error("Sign in before opening these slides.");
      const owned = await Promise.all(images.map(image => resolveSlideshowImage(image, token)));
      if (activeUserIdRef.current === ownerId && !workflow.onSelectSlideshow(owned)) throw new Error("Finish restoring or saving the current draft before opening another version.");
    } catch (error) { if (activeUserIdRef.current === ownerId) setActionError(getErrorMessage(error, "Could not open this slideshow version.")); }
    finally { selectingImageRef.current = false; setSelectingImage(false); }
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
        emptyContentClassName={workflow ? "justify-center" : recreateView ? "items-start pt-8" : undefined}
        emptyTitle="What will you create?"
        emptyDescription="Describe an image below, or add a reference to guide the look. Your completed images are saved in History."
        gridClassName="grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"
        hasResults={imageRows.length > 0}
        loading={(resultsLoading || recoveringJobs) && !isGenerating && generatedAssets.length === 0}
        status={resultsStatus}
        dismissibleStatusKey={workflowFormat === "slideshow" ? JSON.stringify([user?.uid, activeSubmittedAt, activeJobIds, failedDurableJob?.id]) : undefined}
        statusPlacement="inline"
        scrollToLatestKey={!selectedHistoryImageId && isSubmitting ? activeSubmittedAt : null}
        toolbar={recreateView?.preview ? undefined :
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
            {<Button type="button" variant="outline" size="sm" disabled={resultsLoading} onClick={() => { setHistoryNow(new Date()); setHistoryOpen(true); }}>
              <History className="size-3.5" aria-hidden="true" />
              History
              {generatedAssets.length > 0 ? (
                <span className="rounded-full bg-card-muted px-1.5 py-0.5 text-[10px] tabular-nums">{generatedAssets.length}</span>
              ) : null}
            </Button>}
          </div>
        }
      >
        {slideshowResults.versions.map((group) => {
          const images = group.rows.flatMap(row => row.asset ? [row.asset] : []);
          const complete = images.length === group.slot.slideCount;
          return (
            <section key={group.key} aria-label={`Generated slideshow version ${group.slot.versionIndex}`} className="min-w-0 rounded-2xl border border-border bg-card/30 p-3 sm:p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Version {group.slot.versionIndex}</h3>
                  <p className="mt-1 text-xs text-muted">{images.length} of {group.slot.slideCount} slides ready</p>
                </div>
                <Button type="button" disabled={!images.length || selectingImage || isGenerating} onClick={() => void selectSlideshowVersion(images)}>
                  Edit {images.length === 1 ? "this slide" : `these ${images.length} slides`}
                </Button>
              </div>
              {!complete && !isGenerating ? <p className="mb-3 text-xs text-muted">Some slides are not ready. You can edit the ready slides and add others later.</p> : null}
              <div className="flex gap-4 overflow-x-auto overscroll-x-contain pb-3" tabIndex={0} aria-label={`Slides in version ${group.slot.versionIndex}`}>
                {group.rows.map(row => (
                  <div key={row.key} className="w-[min(220px,65vw)] shrink-0">
                    <p className="mb-2 text-xs font-medium text-muted">Slide {row.slideshowGeneration!.slideIndex}</p>
                    <ImageGenerationCard
                      asset={row.asset} aspectRatio={row.aspectRatio} prompt={row.prompt} createdAt={row.createdAt}
                      referenceImageUrl={referenceImage?.asset.url ?? null} isNew={row.asset?.id === latestCompletedId}
                      onOpenPreview={setPreviewImage}
                      onSelect={row.asset && workflow?.onSelectImage ? () => void selectWorkflowImage(row.asset!) : undefined}
                      selectionDisabled={selectingImage || isGenerating} compact selectionLabel={workflow?.imageSelectionLabel ?? "Add to slideshow"}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3"><ImagePromptBubble createdAt={group.rows[0].createdAt} prompt={group.rows[0].prompt} /></div>
            </section>
          );
        })}
        {slideshowResults.individual.map((row) => (
          <div key={row.key}>{row.slideshowGeneration ? <p className="mb-2 text-xs font-semibold text-muted">Version {row.slideshowGeneration.versionIndex} · Slide {row.slideshowGeneration.slideIndex} of {row.slideshowGeneration.slideCount}</p> : null}<ImageGenerationCard
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
            selectionLabel={workflowFormat === "slideshow" ? workflow?.imageSelectionLabel ?? "Add to slideshow" : undefined}
          /></div>
        ))}
      </AiStudioResults>

      <ImageGenerationHistory
        groups={historyGroups}
        open={!recreateView?.preview && historyOpen && active}
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
        settingsSummary={workflow ? `${getAIStudioImageModelLabel(model)} · ${aspectRatio} · ${slideshowSlideCount ? `${slideshowSlideCount} slides × ${quantity} versions` : `${quantity} image${quantity === 1 ? "" : "s"}`}` : undefined}
        compact={Boolean(recreateView)}
        contextBanner={recreateView?.contextBanner}
        accessMessage={tooManySlides ? "Select up to 10 slides per version." : tooManyReferences ? `Use up to ${MAX_IMAGE_REFERENCE_CONTEXT} reference images in total. Remove an attached image or select fewer slideshow references.` : composerMessage}
        active={workflow?.controlsActive ?? active}
        ariaLabel="Image prompt"
        generateDisabled={
          recreateView?.preview || (!pendingSubmission && (generationLocked ||
          hasInsufficientCredits ||
          referenceUploadPending ||
          Boolean(referenceUploadError) || selectingImage ||
          tooManyReferences || tooManySlides ||
          !prompt.trim() ||
          Boolean(workflow && !recreateView?.referenceImageUrl && !recreateView?.referenceImageAssetId && !instructionReferences.length))) ||
          isGenerating || improvingPrompt || composerDraft.busy || Boolean(composerDraft.error) || missingScreenshot || recoveringJobs
        }
        generateLabel={pendingSubmission ? "Recover saved request" : slideshowSlideCount ? `Generate ${outputCount} slides` : "Generate image"}
        generationLocked={generationLocked && !pendingSubmission}
        promptAttachmentControl={workflowFormat === "slideshow" ?
          <FormatInstructionImageReference
            key={user?.uid ?? "signed-out"}
            ownerId={user?.uid}
            active={workflow?.controlsActive ?? active}
            preview={recreateView?.preview}
            disabled={(generationLocked && !recreateView?.preview) || isGenerating || selectingImage || improvingPrompt || composerDraft.busy || Boolean(composerDraft.error)}
            selections={instructionReferences}
            maxImages={instructionReferenceLimit}
            onPendingChange={setReferenceUploadPending}
            onErrorChange={setReferenceUploadError}
            onChange={(update) => {
              submissionKeyRef.current = null;
              composerDraft.setImages(update);
            }}
          /> : undefined}
        hasAttachments={Boolean(referenceImage) || instructionReferences.length > 0 || referenceUploadPending}
        isGenerating={isGenerating}
        layout={workflow ? "workflow" : "unified"}
        showPromptHint={generationLocked || hasInsufficientCredits || tooManyReferences}
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
        promptAction={workflowFormat === "slideshow" ? promptImprover.action : undefined}
        promptFeedback={workflowFormat === "slideshow" ? <div className="space-y-2">{promptImprover.feedback}{composerDraft.busy ? <p role="status" className="text-xs text-muted">Restoring your instructions and attached images…</p> : null}{composerDraft.error ? <div role="alert" className="text-xs text-destructive"><p>{composerDraft.error}</p><Button type="button" variant="ghost" size="sm" onClick={composerDraft.retry}>Retry recovery</Button><Button type="button" variant="ghost" size="sm" onClick={composerDraft.reset}>Keep text, clear attachments</Button></div> : null}{missingScreenshot ? <p role="alert" className="text-xs text-destructive">Your instructions refer to a screenshot. Attach it with + before generating.</p> : null}</div> : undefined}
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
            {earlierRequests.available ? <Button type="button" variant="ghost" size="sm" disabled={earlierRequests.checking || isSubmitting} onClick={() => void earlierRequests.check()}>{earlierRequests.checking ? "Checking earlier requests…" : "Check earlier requests"}</Button> : null}
            {earlierRequests.error ? <span role="alert" className="text-xs text-destructive">{earlierRequests.error}</span> : null}
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
              fieldLabel={workflow ? "Versions" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              size={recreateView ? "sm" : "default"}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
              icon={<ImageIcon className="size-4" aria-hidden="true" />}
              options={AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({
                label: workflowFormat === "slideshow" ? `${count} version${count === 1 ? "" : "s"}` : `${count} image${count === 1 ? "" : "s"}`,
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
  selectionLabel = "Use image in slide",
  compact = false,
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
  selectionLabel?: string;
  compact?: boolean;
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
        <div data-image-preview className={cn("w-full shrink-0", !compact && "sm:mt-12", !compact && getImagePreviewWidthClassName(aspectRatio))}>
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
            {onSelect ? <Button type="button" variant={compact ? "outline" : "default"} disabled={selectionDisabled} onClick={onSelect}>{selectionLabel}</Button> : null}
            {asset ? (
              <AiStudioResultActions kind="image" title={asset.title} url={asset.url} />
            ) : null}
          </div>
        </div>
        {!compact ? <div data-image-details className="w-full min-w-0 self-start sm:ml-auto sm:max-w-[26rem] sm:flex-1">
          <ImagePromptBubble createdAt={createdAt} prompt={prompt} />
        </div> : null}
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
