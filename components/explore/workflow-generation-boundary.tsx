"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { useAuth } from "@/contexts/auth-context";
import { getAIStudioAccessMessage } from "@/lib/ai-studio/access-policy";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { createWorkflowGenerationClient, getWorkflowGenerationDraftError, persistWorkflowGenerationJobs, readWorkflowGenerationJobs, readWorkflowGenerationRequest, recoverWorkflowGenerationRequest, workflowGenerationRequestStorageKey, workflowGenerationStorageKey, type WorkflowGenerationBatch, type WorkflowGenerationDraft, type WorkflowImageSource, type WorkflowKind } from "@/lib/explore/workflow-generation-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { persistJobIdInUrl, useBackgroundJobs, usePersistedJobIdFromUrl } from "@/lib/jobs/background-job-client";
import type { MediaAsset } from "@/lib/media/types";

export type WorkflowGenerationView = {
  busy: boolean;
  disabled: boolean;
  error: string | null;
  notice: string | null;
  message: string;
  results: MediaAsset[];
  selected: MediaAsset | null;
  onGenerate: () => void;
  selectResult: (id: string) => void;
  refreshStatus: () => void;
};

const STORAGE_CHANGED = "ugc-explore:generation-jobs-changed";
const JOB_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const terminal = new Set(["completed", "failed", "cancelled"]);
const emptyView = (message: string): WorkflowGenerationView => ({
  busy: false, disabled: true, error: null, notice: null, message, results: [], selected: null,
  onGenerate() {}, selectResult() {}, refreshStatus() {},
});

/** Preview never mounts auth/access/job queries. Connected drafts reset on account change. */
export function WorkflowAccountBoundary({ enabled, children }: { enabled: boolean; children: (ownerId: string | null) => ReactNode }) {
  return enabled ? <AccountBoundary>{children}</AccountBoundary> : children(null);
}

function AccountBoundary({ children }: { children: (ownerId: string | null) => ReactNode }) {
  const { loading, user } = useAuth();
  return children(!loading && user ? user.uid : null);
}

export function WorkflowGenerationBoundary({ enabled, ownerId, draft, children }: {
  enabled: boolean;
  ownerId: string | null;
  draft: WorkflowGenerationDraft;
  children: (generation: WorkflowGenerationView | null) => ReactNode;
}) {
  if (!enabled) return children(null);
  if (!ownerId) return children(emptyView("Sign in before generating a video."));
  return <ConnectedGeneration key={`${ownerId}:${draft.kind}`} ownerId={ownerId} draft={draft}>{children}</ConnectedGeneration>;
}

function subscribeToStoredJobs(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(STORAGE_CHANGED, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(STORAGE_CHANGED, notify); };
}

function getStoredJobsSnapshot(ownerId: string, kind: WorkflowKind) {
  try { return window.localStorage.getItem(workflowGenerationStorageKey(ownerId, kind)) ?? ""; }
  catch { return ""; }
}

function getStoredRequestSnapshot(ownerId: string, kind: WorkflowKind) {
  try { return window.localStorage.getItem(workflowGenerationRequestStorageKey(ownerId, kind)) ?? ""; }
  catch { return "storage-unavailable"; }
}

function ConnectedGeneration({ ownerId, draft, children }: {
  ownerId: string;
  draft: WorkflowGenerationDraft;
  children: (generation: WorkflowGenerationView) => ReactNode;
}) {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const queryClient = useQueryClient();
  const access = useAIStudioAccess();
  const billing = useBillingSubscription({ freshOnMount: true, refreshOnFocus: true });
  const [submittedIds, setSubmittedIds] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const recoveringRef = useRef(false);
  const submittingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const getSnapshot = useCallback(() => getStoredJobsSnapshot(ownerId, draft.kind), [ownerId, draft.kind]);
  const stored = useSyncExternalStore(subscribeToStoredJobs, getSnapshot, () => "");
  const storedIds = readWorkflowGenerationJobs({ getItem: () => stored }, ownerId, draft.kind);
  const getRequestSnapshot = useCallback(() => getStoredRequestSnapshot(ownerId, draft.kind), [ownerId, draft.kind]);
  const storedRequest = useSyncExternalStore(subscribeToStoredJobs, getRequestSnapshot, () => "");
  let requestError: string | null = null;
  try { readWorkflowGenerationRequest({ getItem: () => storedRequest }, ownerId, draft.kind); }
  catch (error) { requestError = error instanceof Error ? error.message : "Could not verify request recovery."; }
  const recoveryPending = Boolean(storedRequest);
  const urlParameter = draft.kind === "hook" ? "hookJob" : "phoneJob";
  const urlJob = usePersistedJobIdFromUrl(urlParameter);
  const jobIds = submittedIds ?? (storedIds.length ? storedIds : urlJob && JOB_ID.test(urlJob) ? [urlJob] : []);
  const jobQueries = useBackgroundJobs(jobIds);
  const jobs = jobQueries.flatMap((query) => query.data ? [query.data] : []);
  const invalidJob = jobs.some((job) => job.jobType !== "video_generation" || job.projectId !== "ai-studio");
  const assetIds = invalidJob ? [] : jobs.flatMap((job) => {
    const output = job.output;
    if (job.status !== "completed" || !output || typeof output !== "object" || Array.isArray(output)) return [];
    return typeof output.mediaAssetId === "string" && JOB_ID.test(output.mediaAssetId) ? [output.mediaAssetId] : [];
  });
  const distinctAssetIds = [...new Set(assetIds)];
  const mediaQueries = useQueries({ queries: distinctAssetIds.map((assetId) => ({
    queryKey: ["explore-generation-media", ownerId, assetId],
    queryFn: async () => {
      const token = await getCurrentUserIdToken(ownerId);
      if (!token) throw new Error("Sign in to view your generated video.");
      const asset = await fetchAIStudioMediaAsset(assetId, token);
      if (!active.current) throw new Error("This workflow is no longer active.");
      if (asset.id !== assetId || asset.collection !== "video" || asset.status !== "ready" || asset.sourceType !== "generated_video" || !asset.url.startsWith("https://")) {
        throw new Error("The generated video is not ready to preview.");
      }
      return asset;
    },
    retry: 1,
  })) });
  const results = mediaQueries.flatMap((query) => query.data ? [query.data] : []);
  const selected = results.find((asset) => asset.id === selectedId) ?? results[0] ?? null;
  const queryError = jobQueries.some((query) => query.isError) || mediaQueries.some((query) => query.isError);
  const pending = jobQueries.some((query) => query.isPending) || mediaQueries.some((query) => query.isPending);
  const busy = submitting || recovering || pending || jobs.some((job) => !terminal.has(job.status));
  const uncertainProvider = jobs.some((job) => job.error?.code === "provider_submission_uncertain");
  const failedJob = jobs.find((job) => job.status === "failed" || job.status === "cancelled");
  const missingOutput = jobs.some((job) => job.status === "completed") && assetIds.length < jobs.filter((job) => job.status === "completed").length;
  const draftError = getWorkflowGenerationDraftError(draft);
  const rate = billing.data?.videoGenerationCreditsPerSecond;
  const requiredCredits = draft.settings.duration * draft.settings.quantity * (rate ?? 0);
  const validBilling = Boolean(billing.data && billing.data.userId === ownerId && Number.isFinite(rate) && rate! > 0 && Number.isFinite(billing.data.creditsRemaining) && billing.data.creditsRemaining >= 0);
  const billingReady = !billing.isError && validBilling && !billing.isPending;
  const insufficientCredits = billingReady && billing.data!.creditsRemaining < requiredCredits;
  const disabled = access !== "pro" || !billingReady || insufficientCredits || busy || recoveryPending || queryError || invalidJob || missingOutput || uncertainProvider || Boolean(draftError);
  const statusError = requestError ?? (recoveryPending ? "The previous request is not confirmed. Refresh status to recover it; no new generation will be submitted."
    : billing.isError || (billing.data && !validBilling) ? "Could not confirm generation credits for this account. Refresh status before generating."
    : invalidJob ? "This saved job does not belong to video generation. Open the correct workflow."
    : queryError ? "Could not load the saved generation status. Refresh status before starting another request."
    : missingOutput ? "The saved job completed without a video reference. Contact support with the job ID."
    : failedJob?.error?.message ?? (failedJob?.status === "cancelled" ? "This generation was cancelled." : null));
  const terminalKey = jobs.filter((job) => terminal.has(job.status)).map((job) => `${job.id}:${job.status}`).join("|");
  useEffect(() => {
    if (terminalKey) void queryClient.invalidateQueries({ queryKey: ["billing-subscription", ownerId] });
  }, [terminalKey, queryClient, ownerId]);

  const [client] = useState(() => createWorkflowGenerationClient({
    getOwnerToken: () => getCurrentUserIdToken(ownerId),
    fetch: (...args) => fetch(...args),
    createIdempotencyKey: () => crypto.randomUUID(),
    assertActive() { if (!active.current) throw new Error("This workflow is no longer active."); },
    recovery: {
      ownerId, kind: draft.kind, storage: () => window.localStorage,
      onChange: () => window.dispatchEvent(new Event(STORAGE_CHANGED)),
      withLock: async (work) => {
        if (!navigator.locks) throw new Error("This browser cannot safely coordinate generation across tabs. Use a browser with Web Locks support.");
        return navigator.locks.request(workflowGenerationRequestStorageKey(ownerId, draft.kind), { ifAvailable: true }, (lock) => {
          if (!lock) throw new Error("Another tab is starting this workflow. Refresh status first.");
          return work();
        });
      },
    },
    async uploadImage(image: WorkflowImageSource) {
      let file = image.file;
      if (!file) {
        const reference = CREATOR_REFERENCES.find((item) => item.src === image.url);
        if (!reference) throw new Error("Choose or upload the reference image again.");
        if (!await getCurrentUserIdToken(ownerId)) throw new Error("Sign in before uploading a reference image.");
        const response = await fetch(reference.src);
        if (!response.ok) throw new Error("Could not load this creator image.");
        const blob = await response.blob();
        file = new File([blob], reference.fileName, { type: blob.type || "image/png" });
      }
      if (!active.current) throw new Error("This workflow is no longer active.");
      const uploaded = await uploadAIStudioReferenceMedia(file, "image", undefined, ownerId);
      return { url: uploaded.asset.url };
    },
    async uploadReference(source, kind) {
      if (!source.file) throw new Error(`Choose the reference ${kind} file again.`);
      const result = await uploadAIStudioReferenceMedia(source.file, kind, 30, ownerId, { maxAudioDurationSeconds: 30, requireVideoReferenceRatio: false });
      if (!active.current) throw new Error("This workflow is no longer active.");
      const duration = result.asset.durationSeconds;
      if (!duration || !Number.isFinite(duration)) throw new Error("The uploaded reference has no valid duration.");
      return { url: result.asset.url, assetId: result.asset.id, duration };
    },
  }));

  const acceptBatch = useCallback((batch: WorkflowGenerationBatch) => {
    setSubmittedIds(batch.jobs.map((job) => job.jobId));
    setSelectedId(null);
    setNotice(batch.partial ? batch.message : null);
    try { persistWorkflowGenerationJobs(window.localStorage, ownerId, draft.kind, batch); } catch { /* Server jobs remain authoritative. */ }
    try { persistJobIdInUrl(batch.jobs[0].jobId, urlParameter); } catch { /* Server jobs remain authoritative. */ }
    window.dispatchEvent(new Event(STORAGE_CHANGED));
    void queryClient.invalidateQueries({ queryKey: ["billing-subscription", ownerId] });
  }, [ownerId, draft.kind, urlParameter, queryClient]);

  const recover = useCallback(async (resolveUnreceived = false) => {
    if (!active.current || submittingRef.current || recoveringRef.current) return;
    recoveringRef.current = true;
    setRecovering(true);
    try {
      const recovered = await recoverWorkflowGenerationRequest({ storage: window.localStorage, ownerId, kind: draft.kind,
        getOwnerToken: () => getCurrentUserIdToken(ownerId), fetch: (...args) => fetch(...args),
        assertActive() { if (!active.current) throw new Error("This workflow is no longer active."); },
        resolveUnreceived,
      });
      if (!active.current) return;
      if (recovered.batch) acceptBatch(recovered.batch);
      if (recovered.message) setNotice(recovered.message);
      setActionError(recovered.resolved ? null : "The previous request is not fully confirmed. Refresh status later; starting another request is blocked to avoid duplicate charges.");
      window.dispatchEvent(new Event(STORAGE_CHANGED));
    } catch (error) {
      if (active.current) setActionError(error instanceof Error ? error.message : "Could not recover your request.");
    } finally { recoveringRef.current = false; if (active.current) setRecovering(false); }
  }, [ownerId, draft.kind, acceptBatch]);

  useEffect(() => { if (storedRequest) void recover(); }, [storedRequest, recover]);

  async function generate() {
    if (disabled || !active.current || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      const batch = await client.generate(draft);
      if (!active.current) return;
      acceptBatch(batch);
    } catch (error) {
      if (active.current) setActionError(error instanceof Error ? error.message : "Video generation could not start.");
    } finally {
      submittingRef.current = false;
      if (active.current) setSubmitting(false);
    }
  }

  const message = recovering ? "Recovering your saved request without starting another generation…"
    : recoveryPending ? "The previous request must be confirmed before another generation."
    : busy ? (submitting ? "Preparing your generation request…" : "Your video is generating. You can leave and return to its saved status.")
    : access !== "pro" ? getAIStudioAccessMessage(access, billing.data?.status) ?? "Sign in to generate."
    : !billingReady ? "Checking generation credits…"
    : insufficientCredits ? `This generation needs ${requiredCredits} AI credits. You have ${billing.data!.creditsRemaining}.`
    : draftError ?? `This generation uses ${requiredCredits} AI credits.`;

  return children({ busy, disabled, message, error: actionError ?? statusError, notice, results, selected,
    onGenerate: () => { void generate(); },
    selectResult: (id) => { if (results.some((asset) => asset.id === id)) setSelectedId(id); },
    refreshStatus: () => {
      void recover(true);
      for (const query of [...jobQueries, ...mediaQueries]) void query.refetch();
      void queryClient.invalidateQueries({ queryKey: ["billing-subscription", ownerId] });
      void queryClient.invalidateQueries({ queryKey: ["ai-studio-access", ownerId] });
    },
  });
}
