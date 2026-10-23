"use client";

/* eslint-disable @next/next/no-img-element */
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ImageIcon, Loader2, RefreshCw, Scan, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { FormatGenerationReferences } from "@/components/explore/format-generation-references";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import type { CharacterHistoryImage, CharacterHistoryPage } from "@/lib/characters/types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { HookStartingImageReadError, startingImageStatusPolling } from "@/lib/explore/hook-starting-image-polling";
import {
  createHookKeyframeDraft, hookKeyframeMaxPersonImages, hookKeyframeDraftStorageKey,
  readHookKeyframeDraft, serializeHookKeyframeDraft, updateHookKeyframeDraft, hookKeyframeInputKey,
  recordHookKeyframeImage, approveHookKeyframeImage,
  type HookKeyframeDraft, type HookKeyframeScope, type HookKeyframeImageModel,
} from "@/lib/explore/hook-keyframe-draft";
import { fetchHookStartingFrame, hookSourceSha256 } from "@/lib/explore/hook-starting-frame-client";
import { getHookKeyframeMotionReviewDraft } from "@/lib/explore/hook-keyframe-motion";
import { getHookKeyframePromptPreview } from "@/lib/explore/hook-keyframe-prompt-preview";
import { hookKeyframeCheckpointKey, readHookKeyframeCheckpoint, verifiedHookKeyframeJob,
  type HookKeyframeJob, type HookStartingFrameSelection, type HookKeyframeCheckpoint } from "@/lib/explore/hook-keyframe-client";
import { createHookKeyframeVariationBatch, hookKeyframeVariationsKey, importHookKeyframeCheckpoint,
  readHookKeyframeVariations, selectHookKeyframeVariation, updateHookKeyframeVariation,
  type HookKeyframeVariationStore } from "@/lib/explore/hook-keyframe-variations";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import type { StartingFrameWorkflow } from "@/lib/explore/starting-frame-workflow";
import styles from "./hook-starting-frame-workspace.module.css";

/** Only development fixtures supply this adapter. Production uses owned APIs. */
export type HookKeyframePreviewRuntime = {
  generationDisabledReason?: string;
  loadInfluencers?: (cursor: string | null, signal: AbortSignal) => Promise<CharacterHistoryPage>;
  outputPreviewUrl?: string;
  outputPreviewUrls?: Record<string, string>;
  loadSource: (input: { reference: RecreateReference; scope: HookKeyframeScope; signal: AbortSignal }) => ReturnType<typeof fetchHookStartingFrame>;
  resolvePhoto: (id: string, signal: AbortSignal) => Promise<AIStudioReferenceMedia["asset"]>;
  read: (query: string, signal?: AbortSignal) => Promise<Record<string, unknown>>;
  submit: (body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; value: Record<string, unknown> }>;
};
/** Admission remains behind the server release gate; opening never submits inference. */
export function HookStartingFrameWorkspace({ reference, ownerId, draftId, onClose, onUseStartingFrame, previewRuntime, presentation = "dialog", preparationFormat = "hook" }: {
  reference: RecreateReference; ownerId: string | null; draftId: string; onClose: () => void;
  onUseStartingFrame?: (selection: HookStartingFrameSelection) => void;
  previewRuntime?: HookKeyframePreviewRuntime;
  presentation?: "dialog" | "workspace" | "recreation";
  preparationFormat?: StartingFrameWorkflow;
}) {
  const sourceSha256 = hookSourceSha256(reference.videoUrl) ?? (/^[a-f0-9]{64}$/.test(reference.sourceSha256 ?? "") ? reference.sourceSha256! : null);
  const scope = useMemo(() => ownerId && sourceSha256 ? { ownerId, draftId, referenceId: reference.id, sourceSha256 } : null,
    [ownerId, draftId, reference.id, sourceSha256]);
  if (!ownerId) return <PreparationDialog onClose={onClose} presentation={presentation}><p className="p-6" role="status">Sign in to choose your influencer and prepare a starting image.</p></PreparationDialog>;
  if (!sourceSha256) return <PreparationDialog onClose={onClose} presentation={presentation}><p className="p-6" role="alert">Choose an available Hook reference to prepare its opening frame.</p></PreparationDialog>;
  return <OwnedPreparation key={`${ownerId}:${draftId}:${reference.id}:${sourceSha256}`} reference={reference}
    scope={scope!} onClose={onClose} onUseStartingFrame={onUseStartingFrame} presentation={presentation} preparationFormat={preparationFormat}
    previewRuntime={process.env.NODE_ENV === "development" ? previewRuntime : undefined} />;
}

function PreparationDialog({ children, footer, onClose, presentation = "dialog" }: { children: React.ReactNode; footer?: React.ReactNode; onClose: () => void; presentation?: "dialog" | "workspace" | "recreation" }) {
  const title = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { if (presentation === "workspace") title.current?.focus({ preventScroll: true }); }, [presentation]);
  if (presentation === "workspace") return <section className={styles.workspace} aria-label="Create your starting frame">
    <header className={styles.workspaceHeader}>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}><ArrowLeft aria-hidden="true" />Back to references</Button>
      <h2 ref={title} tabIndex={-1} className={styles.title}>Create your starting frame</h2>
      <p>Keep the scene. Choose your person. Review the image before making a video.</p>
    </header>
    {children}
  </section>;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={`${styles.dialog} ${presentation === "recreation" ? styles.recreationDialog : ""}`} initialFocus={title}>
      <header className={styles.header}>
        <DialogTitle ref={title} tabIndex={-1} className={styles.title}>Create your starting frame</DialogTitle>
        <DialogDescription>Keep the scene. Choose your person. Review the image before making a video.</DialogDescription>
      </header>
      {presentation === "recreation" ? <div className={styles.recreationContent} data-recreation-scroll>{children}</div> : children}
      {footer}
    </DialogContent>
  </Dialog>;
}

function OwnedPreparation({ reference, scope, onClose, onUseStartingFrame, previewRuntime, presentation, preparationFormat }: {
  reference: RecreateReference; scope: HookKeyframeScope; onClose: () => void;
  onUseStartingFrame?: (selection: HookStartingFrameSelection) => void;
  previewRuntime?: HookKeyframePreviewRuntime;
  presentation?: "dialog" | "workspace" | "recreation";
  preparationFormat: StartingFrameWorkflow;
}) {
  const [draft, setDraft] = useState<HookKeyframeDraft>(() => createHookKeyframeDraft(scope));
  const [images, setImages] = useState<AIStudioReferenceMedia[]>([]);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [choosingInfluencer, setChoosingInfluencer] = useState(false);
  const [saved, setSaved] = useState(false);
  const [variations, setVariations] = useState<HookKeyframeVariationStore | null>(null);
  const [variationCount, setVariationCount] = useState(1);
  const [checkpointRestored, setCheckpointRestored] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [submittingImage, setSubmittingImage] = useState(false);
  const generationLock = useRef(false);
  const mounted = useRef(true);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; title: string; alt: string; width: number; height: number } | null>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const scrollBody = useRef<HTMLDivElement | null>(null);
  const generatedSection = useRef<HTMLElement | null>(null);
  const revision = useRef(0);
  const influencerRequest = useRef<AbortController | null>(null);
  const key = hookKeyframeDraftStorageKey(scope.ownerId, scope.draftId, scope.referenceId);
  const checkpointKey = hookKeyframeCheckpointKey(scope);
  const variationsKey = hookKeyframeVariationsKey(scope);
  const motionDraft = getHookKeyframeMotionReviewDraft(scope.referenceId, scope.sourceSha256);
  const frameQuery = useQuery({
    queryKey: ["hook-opening-frame", scope.ownerId, scope.referenceId, scope.sourceSha256],
    queryFn: ({ signal }) => previewRuntime ? previewRuntime.loadSource({ reference, scope, signal }) : fetchHookStartingFrame({ ...scope, signal }), retry: false,
    staleTime: 5 * 60_000, gcTime: 5 * 60_000,
  });
  const incompatibleAnimationShape = preparationFormat !== "hook" && frameQuery.data &&
    frameQuery.data.frame.width * 16 !== frameQuery.data.frame.height * 9 && frameQuery.data.frame.width * 9 !== frameQuery.data.frame.height * 16;
  const generationDisabledReason = previewRuntime?.generationDisabledReason ?? (incompatibleAnimationShape ? "This reference has a shape that cannot be animated without cropping. Choose a 9:16 or 16:9 reference before generating an image." : undefined);
  const costQuery = useQuery({ queryKey: ["hook-starting-image-cost", scope.ownerId, draft.imageModel], enabled: restored && !generationDisabledReason, retry: false, staleTime: 60_000,
    queryFn: ({ signal }) => keyframeRead(`?cost=1&model=${draft.imageModel}`, signal).then(body => {
      if (typeof body.creditCost !== "number" || !Number.isFinite(body.creditCost) || body.creditCost <= 0 || body.model !== draft.imageModel) throw new Error("The starting-image price could not be verified.");
      return body.creditCost as number;
    }) });
  const readableEntries = variations?.entries.filter(entry => entry.state !== "planned" && entry.state !== "rejected") ?? [];
  const imageJobQueries = useQueries({ queries: readableEntries.map(({ checkpoint }) => ({
    queryKey: ["hook-starting-image-job", scope.ownerId, scope.draftId, checkpoint.requestKey, checkpoint.jobId],
    enabled: checkpointRestored, ...startingImageStatusPolling,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const body = await keyframeRead(checkpoint.jobId ? `?jobId=${encodeURIComponent(checkpoint.jobId)}` : `?requestKey=${encodeURIComponent(checkpoint.requestKey)}`, signal);
      return verifiedHookKeyframeJob(body.job, checkpoint);
    },
  })) });
  const selectedEntry = variations?.entries.find(entry => entry.checkpoint.requestKey === variations.selectedRequestKey) ?? readableEntries.at(-1) ?? null;
  const checkpoint = selectedEntry?.checkpoint ?? null;
  const imageJobQuery = imageJobQueries[readableEntries.findIndex(entry => entry.checkpoint.requestKey === checkpoint?.requestKey)];
  const completedImageAssetId = imageJobQuery?.data?.output?.mediaAssetId;
  const terminalJobsKey = JSON.stringify(imageJobQueries.flatMap((query, index) => query.data?.isTerminal
    ? [{ requestKey: readableEntries[index].checkpoint.requestKey, job: query.data }] : []));
  useEffect(() => {
    if (submittingImage || !checkpointRestored || !navigator.locks) return;
    const terminalJobs = JSON.parse(terminalJobsKey) as { requestKey: string; job: HookKeyframeJob }[];
    if (!terminalJobs.length) return;
    void navigator.locks.request(`hook-starting-image:${checkpointKey}`, { mode: "exclusive" }, () => {
      let stored = readHookKeyframeVariations(localStorage.getItem(variationsKey), scope);
      if (!stored) return;
      const previousRevision = stored.revision;
      for (const { requestKey, job } of terminalJobs) {
        const entry = stored.entries.find(item => item.checkpoint.requestKey === requestKey);
        if (!entry || entry.state !== "submitting" && entry.state !== "accepted") continue;
        verifiedHookKeyframeJob(job, entry.checkpoint);
        stored = updateHookKeyframeVariation(stored, requestKey, { state: "settled", jobId: job.id });
        if (!stored.selectedRequestKey && job.output) stored = selectHookKeyframeVariation(stored, requestKey);
        if (readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope)?.requestKey === requestKey) {
          localStorage.setItem(checkpointKey, JSON.stringify({ ...entry.checkpoint, jobId: job.id }));
        }
      }
      if (stored.revision !== previousRevision) {
        localStorage.setItem(variationsKey, JSON.stringify(stored));
        if (mounted.current) setVariations(stored);
      }
    }).catch(() => { if (mounted.current) setStorageError("Your image results could not be saved in this browser. Check their status before generating more."); });
  }, [terminalJobsKey, checkpointRestored, submittingImage, checkpointKey, variationsKey, scope]);
  useEffect(() => {
    const body = scrollBody.current, section = generatedSection.current;
    if (completedImageAssetId && body && section) {
      const scroller = presentation === "recreation" ? body.closest<HTMLElement>("[data-recreation-scroll]") ?? body : presentation === "workspace" ? body.closest<HTMLElement>("[data-starting-frame-stage]") ?? body : body;
      const viewport = scroller.getBoundingClientRect(), result = section.getBoundingClientRect();
      const actions = presentation === "workspace" ? body.querySelector<HTMLElement>('[aria-label="Starting image actions"]')?.getBoundingClientRect() : null;
      const visibleBottom = actions && actions.top > viewport.top && actions.top < viewport.bottom ? actions.top : viewport.bottom;
      if (result.top < viewport.top || result.bottom > visibleBottom) {
        scroller.scrollTo({ top: scroller.scrollTop + result.top - viewport.top - 12, behavior: "instant" });
      }
    }
  }, [completedImageAssetId, presentation]);
  async function keyframeRead(query: string, signal?: AbortSignal) {
    if (previewRuntime) return previewRuntime.read(query, signal);
    return withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(scope.ownerId);
      bounded.throwIfAborted();
      if (!token) throw new Error("Sign in to access this starting-image request.");
      const response = await fetch(`/api/explore/hook-keyframe${query}`, { cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(cause => { if (!response.ok) return null; throw cause; });
      if (!response.ok || !body?.ok) throw new HookStartingImageReadError(body?.message || "The image request could not be confirmed. Check its status before submitting anything else.", response.ok ? 0 : response.status);
      return body;
    }, signal);
  }
  const history = useInfiniteQuery({
    queryKey: ["hook-influencer-history", scope.ownerId], enabled: restored, retry: false,
    staleTime: 60_000, gcTime: 5 * 60_000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => withReadDeadline(async bounded => {
      if (previewRuntime?.loadInfluencers) return previewRuntime.loadInfluencers(pageParam, bounded);
      const token = await getCurrentUserIdToken(scope.ownerId);
      bounded.throwIfAborted();
      if (!token) throw new Error("Sign in to choose your saved influencer.");
      const response = await fetch(`/api/characters/history${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`, {
        cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json() as CharacterHistoryPage & { error?: string };
      if (!response.ok || !body.ok || !Array.isArray(body.images)) throw new Error(body.error || "Your influencer images could not be loaded.");
      return body;
    }, signal),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });

  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (!mounted.current) return;
      try {
        const stored = readHookKeyframeVariations(localStorage.getItem(variationsKey), scope);
        const legacy = readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope);
        if (stored && legacy && !stored.entries.some(entry => entry.checkpoint.requestKey === legacy.requestKey)) {
          throw new Error("Another tab has a different saved image request. Reopen this preparation to recover it.");
        }
        const recovered = stored ?? (legacy ? importHookKeyframeCheckpoint(legacy) : null);
        if (recovered && !stored) localStorage.setItem(variationsKey, JSON.stringify(recovered));
        setVariations(recovered); setCheckpointRestored(true);
      }
      catch (cause) { setGenerationError(cause instanceof Error ? cause.message : "Your saved image request could not be restored."); }
    });
    return () => { mounted.current = false; };
  }, [checkpointKey, variationsKey, scope]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const previous = readHookKeyframeDraft(localStorage.getItem(key), scope);
        if (!previous) { if (active) setRestored(true); return; }
        const restoredImages = await withReadDeadline(async signal => {
          const token = previewRuntime ? "local-fixture" : await getCurrentUserIdToken(scope.ownerId);
          signal.throwIfAborted();
          if (!token) throw new Error("Sign in to restore your person photos.");
          return Promise.all(previous.imageAssetIds.map(async id => {
            const asset = previewRuntime ? await previewRuntime.resolvePhoto(id, signal) : await fetchAIStudioMediaAsset(id, token, { signal });
            if ((asset.collection !== "image" && asset.collection !== "influencer") || asset.status !== "ready" || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) {
              throw new Error("A selected photo is no longer available. Choose your photos again.");
            }
            return { kind: "image" as const, asset };
          }));
        }, controller.signal);
        if (active) { setDraft(previous); setImages(restoredImages); setRestored(true); }
      } catch (cause) {
        if (active) setRestoreError(cause instanceof Error ? cause.message : "Your preparation could not be restored.");
      }
    });
    return () => { active = false; controller.abort(); influencerRequest.current?.abort(); revision.current += 1; };
  }, [key, scope, previewRuntime]);

  useEffect(() => {
    if (!frameQuery.data) return;
    let active = true;
    const url = URL.createObjectURL(frameQuery.data.blob);
    queueMicrotask(() => { if (active) setFrameUrl(url); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [frameQuery.data]);

  // The provenance comes from the extraction receipt, never from the poster.
  const preparedDraft = useMemo(() => frameQuery.data
    ? updateHookKeyframeDraft(draft, { sourceFrame: frameQuery.data.frame }) : draft, [draft, frameQuery.data]);
  const currentInputKey = hookKeyframeInputKey(preparedDraft);
  const currentInput = useRef(currentInputKey);
  useEffect(() => { currentInput.current = currentInputKey; }, [currentInputKey]);
  useEffect(() => {
    if (!restored) return;
    let active = true;
    let message: string | null = null;
    try { localStorage.setItem(key, serializeHookKeyframeDraft(preparedDraft)); }
    catch { message = "Your choices could not be saved in this browser. Keep this screen open while you continue."; }
    queueMicrotask(() => { if (active) setStorageError(message); });
    return () => { active = false; };
  }, [key, preparedDraft, restored]);

  function changeImages(next: AIStudioReferenceMedia[]) {
    if (!restored || choosingInfluencer) return;
    setImages(next); setDraft(current => updateHookKeyframeDraft(current, { imageAssetIds: next.map(image => image.asset.id) })); setSaved(false);
  }
  async function selectInfluencer(image: CharacterHistoryImage) {
    if (!restored || pending || choosingInfluencer) return false;
    if (images[0]?.asset.id === image.mediaAssetId) return true;
    const request = ++revision.current;
    const controller = new AbortController();
    influencerRequest.current?.abort();
    influencerRequest.current = controller;
    setChoosingInfluencer(true); setError(null);
    try {
      const asset = await withReadDeadline(async signal => {
        if (previewRuntime) return previewRuntime.resolvePhoto(image.mediaAssetId, signal);
        const token = await getCurrentUserIdToken(scope.ownerId);
        signal.throwIfAborted();
        if (!token) throw new Error("Sign in to use your saved influencer.");
        return fetchAIStudioMediaAsset(image.mediaAssetId, token, { signal });
      }, controller.signal);
      if (request !== revision.current) return false;
      if (asset.status !== "ready" || (asset.collection !== "image" && asset.collection !== "influencer") || asset.sourceType !== "generated_image" ||
        !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType) || asset.id !== image.mediaAssetId) {
        throw new Error("This influencer image is no longer available. Choose another image.");
      }
      // A different saved influencer starts a new person selection. It must not
      // inherit supporting photos belonging to the previous person.
      setImages([{ kind: "image", asset }]);
      setDraft(current => updateHookKeyframeDraft(current, { imageAssetIds: [asset.id] }));
      setSaved(false); return true;
    } catch (cause) { if (request === revision.current) setError(cause instanceof Error ? cause.message : "This influencer could not be selected."); return false; }
    finally {
      if (influencerRequest.current === controller) influencerRequest.current = null;
      if (request === revision.current) setChoosingInfluencer(false);
    }
  }
  function savePreparation() {
    try { localStorage.setItem(key, serializeHookKeyframeDraft(preparedDraft)); setStorageError(null); setSaved(true); }
    catch { setStorageError("Your choices could not be saved in this browser. Keep this screen open while you continue."); }
  }
  async function generateStartingImage() {
    if (generationDisabledReason) return;
    if (!ready || !checkpointRestored || generationLock.current || costQuery.data === undefined || creatingImage) return;
    if (!navigator.locks) { setGenerationError("Use a browser with Web Locks support to submit images safely."); return; }
    generationLock.current = true; setSubmittingImage(true); setGenerationError(null);
    const frozen = preparedDraft.version === 1 ? updateHookKeyframeDraft(preparedDraft, { imageModel: preparedDraft.imageModel }) : preparedDraft;
    const expectedRevision = variations?.revision ?? null;
    try {
      await navigator.locks.request(`hook-starting-image:${checkpointKey}`, { mode: "exclusive" }, async () => {
        const savedVariations = readHookKeyframeVariations(localStorage.getItem(variationsKey), scope);
        const savedRequest = readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope);
        if ((savedVariations?.revision ?? null) !== expectedRevision || savedRequest && !savedVariations?.entries.some(entry => entry.checkpoint.requestKey === savedRequest.requestKey)) {
          throw new Error("Another tab has changed the saved image requests. Reopen this preparation to recover them.");
        }
        let batch = createHookKeyframeVariationBatch(savedVariations, frozen, Array.from({ length: variationCount }, () => crypto.randomUUID()));
        localStorage.setItem(key, serializeHookKeyframeDraft(frozen));
        if (mounted.current) setDraft(frozen);
        const persist = () => {
          localStorage.setItem(variationsKey, JSON.stringify(batch));
          if (mounted.current) setVariations(batch);
        };
        persist();
        const token = previewRuntime ? "local-fixture" : await withReadDeadline(() => getCurrentUserIdToken(scope.ownerId));
        if (!token) throw new Error("Sign in before creating starting images. No new image was submitted.");
        const plans = batch.entries.filter(entry => entry.batchId === batch.batchId);
        for (const plan of plans) {
          // Closing stops only never-submitted plans. Accepted requests keep
          // running and recover by GET; no restore or polling path creates jobs.
          if (!mounted.current) break;
          const saved = plan.checkpoint;
          batch = updateHookKeyframeVariation(batch, saved.requestKey, { state: "submitting" });
          persist();
          localStorage.setItem(checkpointKey, JSON.stringify(saved));
          const input = { referenceId: scope.referenceId, sourceSha256: scope.sourceSha256, draftId: scope.draftId,
            personImageAssetIds: frozen.imageAssetIds, instructions: frozen.instructions, idempotencyKey: saved.requestKey,
            imageModel: frozen.imageModel };
          const response = previewRuntime ? await previewRuntime.submit(input) : await fetch("/api/explore/hook-keyframe", {
            method: "POST", signal: AbortSignal.timeout(90_000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
          const body = "value" in response ? response.value : await response.json();
          if (!response.ok || !body.ok) {
            if ([400, 401, 402, 403, 422].includes(response.status)) {
              batch = updateHookKeyframeVariation(batch, saved.requestKey, { state: "rejected", error: String(body.message || "Image request rejected.").slice(0, 1000) });
              persist();
              if (readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope)?.requestKey === saved.requestKey) localStorage.removeItem(checkpointKey);
            }
            throw new Error(body.message || "The image request is unconfirmed. Check its status before generating more images.");
          }
          verifiedHookKeyframeJob({ id: body.jobId, status: "queued", isTerminal: false, error: null, receipt: body.receipt, output: null }, saved);
          batch = updateHookKeyframeVariation(batch, saved.requestKey, { state: "accepted", jobId: body.jobId as string });
          if (plan === plans[0]) batch = selectHookKeyframeVariation(batch, saved.requestKey);
          persist();
          localStorage.setItem(checkpointKey, JSON.stringify({ ...saved, jobId: body.jobId as string }));
        }
      });
    } catch (cause) { if (mounted.current) setGenerationError(cause instanceof Error ? cause.message : "The image request is unconfirmed. Check its status before trying anything else."); }
    finally { generationLock.current = false; if (mounted.current) setSubmittingImage(false); }
  }
  async function chooseVariation(requestKey: string) {
    if (!navigator.locks) return;
    try {
      await navigator.locks.request(`hook-starting-image:${checkpointKey}`, { mode: "exclusive" }, () => {
        const stored = readHookKeyframeVariations(localStorage.getItem(variationsKey), scope);
        if (!stored) return;
        const next = selectHookKeyframeVariation(stored, requestKey);
        localStorage.setItem(variationsKey, JSON.stringify(next));
        if (mounted.current) setVariations(next);
      });
    } catch { if (mounted.current) setGenerationError("This variation could not be selected. Reopen the preparation to recover your images."); }
  }
  function selectStartingFrame(job: HookKeyframeJob, target: HookKeyframeCheckpoint | null = checkpoint) {
    if (!target || target.inputKey !== currentInput.current || !job.output || !onUseStartingFrame || promptPreview.requiresDecision || promptPreview.animationError || !promptPreview.directions.trim()) return;
    const verified = verifiedHookKeyframeJob(job, target);
    if (!verified.output) return;
    const approved = approveHookKeyframeImage(recordHookKeyframeImage(preparedDraft, { assetId: verified.output.mediaAssetId, inputKey: target.inputKey, promptVersion: verified.receipt.promptVersion ?? 1 }));
    try { localStorage.setItem(key, serializeHookKeyframeDraft(approved)); }
    catch { setStorageError("Save this preparation before using the starting frame."); return; }
    setDraft(approved);
    onUseStartingFrame({ ...scope, assetId: verified.output.mediaAssetId, jobId: verified.id,
      url: previewRuntime?.outputPreviewUrls?.[verified.output.mediaAssetId] ?? previewRuntime?.outputPreviewUrl ?? verified.output.url,
      width: verified.output.width, height: verified.output.height, durationSeconds: promptPreview.durationSeconds === 8 ? 8 : 4,
      motionInstructions: promptPreview.directions, generateAudio: preparedDraft.generateAudio });
  }
  const busy = pending || choosingInfluencer || !restored || submittingImage;
  // Upload/lookup warnings must not discard already accepted, owned photos.
  const maxPersonImages = hookKeyframeMaxPersonImages(draft.imageModel);
  const tooManyImages = images.length > maxPersonImages;
  const ready = restored && Boolean(frameQuery.data) && images.length > 0 && !tooManyImages && !busy;
  const promptPreview = getHookKeyframePromptPreview(preparedDraft, preparationFormat);
  const imageJob = checkpoint && imageJobQuery?.data ? imageJobQuery.data : null;
  const matchingImage = Boolean(checkpoint && checkpoint.inputKey === currentInputKey);
  const creatingImage = readableEntries.some((entry, index) => (entry.state === "submitting" || entry.state === "accepted") && !imageJobQueries[index]?.data?.isTerminal);
  const historyImages = mergeCharacterHistoryPages(history.data?.pages ?? []);
  const frameStyle = { "--frame-ratio": frameQuery.data ? frameQuery.data.frame.width / frameQuery.data.frame.height : 9 / 16 } as CSSProperties;
  const resultStyle = { "--frame-ratio": imageJob?.output ? imageJob.output.width / imageJob.output.height : 9 / 16 } as CSSProperties;
  const selectedIndex = readableEntries.findIndex(entry => entry.checkpoint.requestKey === checkpoint?.requestKey);
  const cannotUseFrame = !imageJob?.output || !matchingImage || !onUseStartingFrame || busy || promptPreview.requiresDecision || Boolean(promptPreview.animationError) || !promptPreview.directions.trim();
  const cannotGenerate = Boolean(generationDisabledReason) || !ready || !checkpointRestored || creatingImage || costQuery.data === undefined;
  const generateLabel = submittingImage ? "Submitting images…" : variationCount > 1 ? `Generate ${variationCount} starting images` : imageJob?.isTerminal ? "Generate another starting image" : "Generate starting image";
  return <PreparationDialog presentation={presentation} footer={presentation === "recreation" ? <footer className={styles.approvalFooter} aria-label="Starting frame approval">
    <div className={styles.approvalSummary} aria-live="polite"><strong>{imageJob?.output ? `Selected: ${selectedIndex + 1} of ${readableEntries.length}` : "Choose your starting frame"}</strong>
      <span>{imageJob?.output && !matchingImage ? "Inputs changed. Generate a new frame to use them." : promptPreview.requiresDecision || promptPreview.animationError || !promptPreview.directions.trim() ? "Motion needs review before this image can be used." : imageJob?.output ? "Check the face, pose and scene before continuing." : creatingImage ? "Your images are generating. You can review them here." : "Generate an image, then select it to continue."}</span>
    </div>
    <div className={styles.footerActions}>
      <div className={styles.footerGenerate}>{!generationDisabledReason ? <span>{costQuery.data !== undefined ? `${costQuery.data * variationCount} ${costQuery.data * variationCount === 1 ? "credit" : "credits"} total` : "Checking price…"}</span> : null}
        <Button type="button" variant={readableEntries.length ? "outline" : "default"} disabled={cannotGenerate} onClick={() => void generateStartingImage()}>{readableEntries.length && !submittingImage ? `Generate ${variationCount > 1 ? `${variationCount} more images` : "another image"}` : generateLabel}</Button>
      </div>
      <Button type="button" disabled={cannotUseFrame} onClick={() => { if (imageJob) selectStartingFrame(imageJob); }}>Use selected frame</Button>
    </div>
  </footer> : undefined} onClose={() => {
    mounted.current = false;
    revision.current += 1;
    influencerRequest.current?.abort();
    onClose();
  }}>
    <div ref={scrollBody} className={styles.body} data-has-result={Boolean(readableEntries.length)}>
      <div className={styles.visuals}>
      <section className={styles.scene} style={frameStyle} aria-label="Original opening frame">
        <div className={styles.sectionHeading}><div><h2>Source frame</h2><p>{reference.title} · Original scene</p></div><ImageIcon aria-hidden="true" /></div>
        <div className={styles.frame} style={frameStyle}>
          {frameQuery.data ? <button type="button" className={styles.enlargeButton} aria-label="Enlarge source frame" title="Enlarge source frame" disabled={!frameUrl}
            onClick={event => { if (!frameUrl || !frameQuery.data) return; previewTrigger.current = event.currentTarget;
              setEnlargedImage({ url: frameUrl, title: "Source frame", alt: `Actual first frame of ${reference.title}`, width: frameQuery.data.frame.width, height: frameQuery.data.frame.height }); }}>
            <img src={frameUrl ?? undefined} alt={`Actual first frame of ${reference.title}`} width={frameQuery.data.frame.width} height={frameQuery.data.frame.height} /><span className={styles.enlargeHint}><Scan aria-hidden="true" /></span>
          </button>
            : frameQuery.isPending ? <p role="status"><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Preparing the opening frame…</p>
            : <div role="alert"><p>{frameQuery.error?.message || "The opening frame could not be prepared."}</p><Button type="button" variant="outline" onClick={() => void frameQuery.refetch()}><RefreshCw aria-hidden="true" />Try again</Button></div>}
        </div>
        <p className={styles.caption}>Keep this scene, pose and clothing. Remove the captions.</p>
        {motionDraft?.requiresDecision && motionDraft.riskFlags.includes("no_person_in_opening_frame") ? <p className={styles.notice} role="status">This reference opens before the performer appears. Its starting image and reveal need review before it can be animated.</p> : null}
        {motionDraft?.requiresDecision && motionDraft.riskFlags.some(flag => flag === "jump_cut" || flag === "multiple_takes") ? <p className={styles.notice} role="status">This reference contains a cut. Its action sequence needs review for animation from one image.</p> : null}
      </section>
      {checkpoint && presentation !== "recreation" ? <section ref={generatedSection} className={styles.generated} style={resultStyle} aria-label="Generated starting image">
        <div className={styles.sectionHeading}><div><h2>Your starting image</h2><p>{previewRuntime ? "Sample result · layout only" : "Compare with the source"}</p></div></div>
        {imageJob?.output ? <><div className={styles.frame} style={resultStyle}><button type="button" className={styles.enlargeButton} aria-label="Enlarge generated starting image" title="Enlarge generated starting image"
          onClick={event => { if (!imageJob.output) return; previewTrigger.current = event.currentTarget;
            setEnlargedImage({ url: previewRuntime?.outputPreviewUrls?.[imageJob.output.mediaAssetId] ?? previewRuntime?.outputPreviewUrl ?? imageJob.output.url,
              title: "Your starting image", alt: "Generated starting frame to inspect in detail", width: imageJob.output.width, height: imageJob.output.height }); }}>
          <img src={previewRuntime?.outputPreviewUrls?.[imageJob.output.mediaAssetId] ?? previewRuntime?.outputPreviewUrl ?? imageJob.output.url} width={imageJob.output.width} height={imageJob.output.height} alt="Generated starting frame to review before animation" /><span className={styles.enlargeHint}><Scan aria-hidden="true" /></span>
          </button></div>
          {!matchingImage ? <p className={styles.notice} role="status">Your photos, model or image instructions have changed. Generate a new image before using it.</p> : null}
        </> : <div className={styles.imageStatus} role="status"><ImageIcon aria-hidden="true" /><p>{imageJob?.isTerminal ? imageJob.error || "The image did not complete. Check its status before trying again." : "Creating your starting image…"}</p></div>}
        {imageJobQuery?.error ? <p role="alert" className="text-destructive">{imageJobQuery.error.message} Your request is preserved.</p> : null}
        {readableEntries.length > 1 ? <div className={styles.variations} role="group" aria-label="Starting image variations">
          {readableEntries.map((entry, index) => {
            const job = imageJobQueries[index]?.data;
            return <button key={entry.checkpoint.requestKey} type="button" className={styles.variation}
              aria-label={`View starting image ${index + 1}${job?.output ? "" : job?.isTerminal ? ", failed" : ", pending"}`}
              aria-pressed={entry.checkpoint.requestKey === checkpoint?.requestKey} disabled={submittingImage || entry.state === "submitting"}
              onClick={() => void chooseVariation(entry.checkpoint.requestKey)}>
              {job?.output ? <img src={previewRuntime?.outputPreviewUrls?.[job.output.mediaAssetId] ?? previewRuntime?.outputPreviewUrl ?? job.output.url} alt="" width={38} height={52} /> : job?.isTerminal ? "Failed" : "…"}<span>{index + 1}</span>
            </button>;
          })}
        </div> : null}
        {readableEntries.length > 1 ? <p className={styles.variationProgress} role="status">{imageJobQueries.filter(query => query.data?.output).length} of {readableEntries.length} ready · Choose an image to review.</p> : null}
        {imageJob?.output ? <>
          <p className={styles.caption}>Check face, pose and scene.</p>
          <Button className={styles.useFrame} type="button" disabled={!matchingImage || !onUseStartingFrame || promptPreview.requiresDecision || Boolean(promptPreview.animationError) || !promptPreview.directions.trim() || busy} onClick={() => selectStartingFrame(imageJob)}>Use as starting frame</Button>
        </> : null}
        {creatingImage || imageJobQuery?.error ? <Button type="button" variant="ghost" size="sm" disabled={submittingImage || imageJobQueries.some(query => query.isFetching)} onClick={() => void Promise.all(imageJobQueries.map(query => query.refetch()))}>Check image status</Button> : null}
        {promptPreview.requiresDecision || promptPreview.animationError ? <p className={styles.notice} role="status">This Hook’s video instructions need review before its starting image can be used for animation.</p> : null}
      </section> : null}
      </div>
      <div className={styles.controls}>
      <section className={styles.person} aria-label="Face reference">
        <div className={styles.sectionHeading}><div><h2>Face reference</h2><p>Choose whose face to use.</p></div><UserRound aria-hidden="true" /></div>
        {restoreError ? <div className={styles.notice} role="alert"><p>{restoreError} Your saved preparation has not been overwritten.</p><Button type="button" variant="outline" onClick={() => { setDraft(createHookKeyframeDraft(scope)); setImages([]); setRestoreError(null); setRestored(true); }}>Start a new preparation</Button></div> : !restored ? <p role="status">Restoring your preparation…</p> : null}
        <div className={styles.photos} data-unified-face-picker data-selected-face-photos={images.length}>
          <FormatGenerationReferences selection={null} imageSelections={images} imagePurpose="person" heading="Person photos"
            influencerLibrary={{ images: historyImages, loading: history.isPending, error: history.error, selectionError: error,
              onRetry: () => void history.refetch(), hasMore: history.hasNextPage, loadingMore: history.isFetchingNextPage,
              onLoadMore: () => void history.fetchNextPage(), onSelect: selectInfluencer }}
            maxImages={maxPersonImages} ownerId={scope.ownerId} preview={Boolean(previewRuntime)}
            disabled={busy} videoInputEnabled={false} audioInputEnabled={false}
            onChange={selection => changeImages(selection?.kind === "image" ? [...images.filter(image => image.asset.id !== selection.asset.id), selection] : [])}
            onImagesChange={changeImages} onPendingChange={setPending} onErrorChange={setError} />
          <p>Use one clear face photo. Extra views are optional.</p>
        </div>
        {tooManyImages ? <p className={styles.notice} role="alert">To generate a new image, Gemini 3.1 Flash supports up to {maxPersonImages} person photos. Remove an extra photo or choose Gemini 3 Pro.</p> : null}
        <a href="/explore/build-character" target="_blank" rel="noopener noreferrer" className={styles.builder}>Create a new influencer <ExternalLink aria-hidden="true" /><span className="sr-only"> in a new tab; your preparation stays here</span></a>
        <details className={styles.promptDetails}><summary>Adjust image instructions <span>Optional</span></summary>
        <label className={styles.instructions}>Changes to the starting image
          <textarea name="starting-image-instructions" autoComplete="off" value={draft.instructions} disabled={busy} maxLength={2000} placeholder="For example, keep the same surprised expression."
            onChange={event => { setDraft(current => updateHookKeyframeDraft(current, { instructions: event.target.value })); setSaved(false); }} />
        </label>
        {promptPreview.imagePrompt ? <details className={styles.promptDetails}><summary>View image instructions</summary><p className={styles.compiledPrompt}>{promptPreview.imagePrompt}</p></details> : null}
        </details>
        {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      </section>
      </div>
      <section className={styles.actions} aria-label="Starting image actions">
        {presentation === "recreation" ? <h2 className={styles.settingsHeading}>Generation settings</h2> : null}
        {preparationFormat === "talking_head" ? <p className={styles.notice}>After choosing an image, review your own spoken script and Sound setting. Your Demo stays separate.</p> : preparationFormat === "wall_text" ? <p className={styles.notice}>Create the background image here. Add and style your editable overlay text in Edit after generating the video.</p> : null}
        <div className={styles.actionMeta}>
          <div className={styles.generationChoices}>
          <div className={styles.modelField}>{presentation === "recreation" ? <span>Image model</span> : null}<AiStudioSettingSelect ariaLabel="Starting image model" className={styles.modelChoice} size="sm"
            value={draft.imageModel} disabled={busy || creatingImage} onChange={(value: HookKeyframeImageModel) => {
              setDraft(current => updateHookKeyframeDraft(current, { imageModel: value })); setSaved(false);
            }} options={[{ value: "gemini_3_pro", label: "Gemini 3 Pro" }, { value: "nano_banana_2", label: "Gemini 3.1 Flash" }]} /></div>
          <label className={styles.variationCount}>Variations<select name="starting-image-count" aria-label="Number of starting frame variations" value={variationCount} disabled={busy || creatingImage} onChange={event => setVariationCount(Number(event.target.value))}>
            {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}
          </select></label></div>
          {!generationDisabledReason ? <p className={styles.price}>{costQuery.data !== undefined ? `${costQuery.data * variationCount} ${costQuery.data * variationCount === 1 ? "credit" : "credits"} total` : "Checking image price…"}<span>{costQuery.data !== undefined ? `${costQuery.data} per image` : ""}</span></p> : null}
        </div>
        {promptPreview.requiresDecision || promptPreview.animationError || !promptPreview.directions.trim() ? <p className={styles.notice} role="status">Image generation uses credits. This reference’s motion still needs review, so its image cannot currently be used to generate a video. Choose another reference to continue to animation.</p> : null}
        {generationDisabledReason ? <p className={styles.notice} role="status">{generationDisabledReason}</p> : null}
        {costQuery.error ? <p role="alert">{costQuery.error.message}</p> : null}
        {generationError ? <p role="alert" className="text-destructive">{generationError}</p> : null}
        {variations?.entries.some(entry => entry.state === "planned" || entry.state === "rejected") && !submittingImage ? <p className={styles.variationProgress} role="status">Some images were not submitted or were rejected. Accepted requests are preserved; remaining images will not retry automatically.</p> : null}
        {storageError ? <p role="alert" className="text-destructive">{storageError}</p> : saved ? <p role="status">Preparation saved on this browser.</p> : null}
      {presentation !== "recreation" ? <div className={styles.actionButtons}>{presentation === "dialog" && !imageJob?.output ? <Button type="button" variant="ghost" disabled={!ready} onClick={savePreparation}>Save preparation</Button> : null}
        <Button type="button" variant={imageJob?.output ? "outline" : "default"} disabled={Boolean(generationDisabledReason) || !ready || !checkpointRestored || creatingImage || costQuery.data === undefined} onClick={() => void generateStartingImage()}>{submittingImage ? "Submitting images…" : variationCount > 1 ? `Generate ${variationCount} starting images` : imageJob?.isTerminal ? "Generate another starting image" : "Generate starting image"}</Button>
        </div> : null}
      </section>
    </div>
    {presentation === "recreation" && readableEntries.length ? <section ref={generatedSection} className={styles.generatedGallery} aria-label="Generated starting frames">
      <div className={styles.galleryHeading}><h3>Your starting frames</h3><p>Select an image below. Use the enlarge button to inspect details.</p></div>
      <div className={styles.generatedGrid} data-variation-count={readableEntries.length}>
        {readableEntries.map((entry, index) => {
          const job = imageJobQueries[index]?.data;
          const output = job?.output;
          const matches = entry.checkpoint.inputKey === currentInputKey;
          const selected = entry.checkpoint.requestKey === checkpoint?.requestKey;
          return <article key={entry.checkpoint.requestKey} className={styles.generatedCard} data-selected={selected}>
            {output ? <><button type="button" className={styles.resultPreview} aria-label={`Select variation ${index + 1}`} aria-pressed={selected}
              disabled={submittingImage} onClick={() => void chooseVariation(entry.checkpoint.requestKey)}
              style={{ "--frame-ratio": output.width / output.height } as CSSProperties}>
              <img src={previewRuntime?.outputPreviewUrls?.[output.mediaAssetId] ?? previewRuntime?.outputPreviewUrl ?? output.url}
                alt={`Starting frame variation ${index + 1}`} width={output.width} height={output.height} />
              <span className={styles.selectionBadge}>{selected ? "Selected" : `Variation ${index + 1}`}</span>
            </button><button type="button" className={styles.enlargeResult} aria-label={`Enlarge variation ${index + 1}`}
              style={{ "--frame-ratio": output.width / output.height } as CSSProperties}
              onClick={event => { previewTrigger.current = event.currentTarget; setEnlargedImage({
                url: previewRuntime?.outputPreviewUrls?.[output.mediaAssetId] ?? previewRuntime?.outputPreviewUrl ?? output.url,
                title: `Variation ${index + 1}`, alt: `Starting frame variation ${index + 1}`, width: output.width, height: output.height }); }}>
              <Scan aria-hidden="true" /><span>Enlarge</span>
            </button></> : <div className={styles.resultPlaceholder} role="status">{imageJobQueries[index]?.error ? "Could not check this image. Your request is saved."
              : job?.isTerminal ? job.error || "Image unavailable" : "Generating…"}</div>}
            {!matches && output ? <p className={styles.variationProgress}>Inputs changed. Generate a new frame to use these changes.</p> : null}
          </article>;
        })}
      </div>
      {creatingImage || imageJobQueries.some(query => query.error) ? <Button type="button" variant="ghost" size="sm"
        disabled={submittingImage || imageJobQueries.some(query => query.isFetching)} onClick={() => void Promise.all(imageJobQueries.map(query => query.refetch()))}>Check image status</Button> : null}
      {promptPreview.requiresDecision || promptPreview.animationError ? <p className={styles.notice} role="status">This Hook’s motion instructions need review before animation.</p> : null}
    </section> : null}
    <Dialog open={Boolean(enlargedImage)} onOpenChange={open => { if (!open) setEnlargedImage(null); }}>
      <DialogContent className={styles.zoomDialog} finalFocus={previewTrigger}>
        <div className={styles.zoomHeader}><DialogTitle>{enlargedImage?.title ?? "Image preview"}</DialogTitle>
          <DialogDescription>{previewRuntime && !generationDisabledReason ? "Sample image · layout demonstration" : "Inspect the face and scene before choosing your starting frame."}</DialogDescription></div>
        {enlargedImage ? <img className={styles.zoomImage} src={enlargedImage.url} alt={enlargedImage.alt} width={enlargedImage.width} height={enlargedImage.height} /> : null}
      </DialogContent>
    </Dialog>
  </PreparationDialog>;
}
