"use client";

/* eslint-disable @next/next/no-img-element */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, ImageIcon, Loader2, RefreshCw, UserRound, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CharacterHistory } from "@/components/characters/character-history";
import { FormatGenerationReferences } from "@/components/explore/format-generation-references";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import type { CharacterHistoryImage, CharacterHistoryPage } from "@/lib/characters/types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import {
  createHookKeyframeDraft, HOOK_KEYFRAME_MAX_PERSON_IMAGES, hookKeyframeDraftStorageKey,
  readHookKeyframeDraft, serializeHookKeyframeDraft, updateHookKeyframeDraft, hookKeyframeInputKey,
  recordHookKeyframeImage, approveHookKeyframeImage,
  type HookKeyframeDraft, type HookKeyframeScope,
} from "@/lib/explore/hook-keyframe-draft";
import { fetchHookStartingFrame, hookSourceSha256 } from "@/lib/explore/hook-starting-frame-client";
import { getHookKeyframeMotionReviewDraft } from "@/lib/explore/hook-keyframe-motion";
import { getHookKeyframePromptPreview } from "@/lib/explore/hook-keyframe-prompt-preview";
import { createHookKeyframeCheckpoint, hookKeyframeCheckpointKey, readHookKeyframeCheckpoint, verifiedHookKeyframeJob,
  type HookKeyframeCheckpoint, type HookKeyframeJob, type HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import styles from "./hook-starting-frame-workspace.module.css";

/** Only development fixtures supply this adapter. Production uses owned APIs. */
export type HookKeyframePreviewRuntime = {
  loadSource: (signal: AbortSignal) => ReturnType<typeof fetchHookStartingFrame>;
  resolvePhoto: (id: string, signal: AbortSignal) => Promise<AIStudioReferenceMedia["asset"]>;
  read: (query: string, signal?: AbortSignal) => Promise<Record<string, unknown>>;
  submit: (body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; value: Record<string, unknown> }>;
};
/** Admission remains behind the server release gate; opening never submits inference. */
export function HookStartingFrameWorkspace({ reference, ownerId, draftId, onClose, onUseStartingFrame, previewRuntime }: {
  reference: RecreateReference; ownerId: string | null; draftId: string; onClose: () => void;
  onUseStartingFrame?: (selection: HookStartingFrameSelection) => void;
  previewRuntime?: HookKeyframePreviewRuntime;
}) {
  const sourceSha256 = hookSourceSha256(reference.videoUrl);
  const scope = useMemo(() => ownerId && sourceSha256 ? { ownerId, draftId, referenceId: reference.id, sourceSha256 } : null,
    [ownerId, draftId, reference.id, sourceSha256]);
  if (!ownerId) return <PreparationDialog onClose={onClose}><p className="p-6" role="status">Sign in to choose your influencer and prepare a starting image.</p></PreparationDialog>;
  if (!sourceSha256) return <PreparationDialog onClose={onClose}><p className="p-6" role="alert">Choose an available Hook reference to prepare its opening frame.</p></PreparationDialog>;
  return <OwnedPreparation key={`${ownerId}:${draftId}:${reference.id}:${sourceSha256}`} reference={reference}
    scope={scope!} onClose={onClose} onUseStartingFrame={onUseStartingFrame}
    previewRuntime={process.env.NODE_ENV === "development" ? previewRuntime : undefined} />;
}

function PreparationDialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const title = useRef<HTMLHeadingElement | null>(null);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={styles.dialog} initialFocus={title}>
      <header className={styles.header}>
        <DialogTitle ref={title} tabIndex={-1} className={styles.title}>Create your starting frame</DialogTitle>
        <DialogDescription>Start with the reference scene and choose whose face to use. Review the image before making a video.</DialogDescription>
      </header>
      {children}
    </DialogContent>
  </Dialog>;
}

function OwnedPreparation({ reference, scope, onClose, onUseStartingFrame, previewRuntime }: {
  reference: RecreateReference; scope: HookKeyframeScope; onClose: () => void;
  onUseStartingFrame?: (selection: HookStartingFrameSelection) => void;
  previewRuntime?: HookKeyframePreviewRuntime;
}) {
  const [draft, setDraft] = useState<HookKeyframeDraft>(() => createHookKeyframeDraft(scope));
  const [images, setImages] = useState<AIStudioReferenceMedia[]>([]);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [choosingInfluencer, setChoosingInfluencer] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkpoint, setCheckpoint] = useState<HookKeyframeCheckpoint | null>(null);
  const [checkpointRestored, setCheckpointRestored] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [submittingImage, setSubmittingImage] = useState(false);
  const generationLock = useRef(false);
  const mounted = useRef(true);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const scrollBody = useRef<HTMLDivElement | null>(null);
  const generatedSection = useRef<HTMLElement | null>(null);
  const revision = useRef(0);
  const influencerRequest = useRef<AbortController | null>(null);
  const key = hookKeyframeDraftStorageKey(scope.ownerId, scope.draftId, scope.referenceId);
  const checkpointKey = hookKeyframeCheckpointKey(scope);
  const motionDraft = getHookKeyframeMotionReviewDraft(scope.referenceId, scope.sourceSha256);
  const frameQuery = useQuery({
    queryKey: ["hook-opening-frame", scope.ownerId, scope.referenceId, scope.sourceSha256],
    queryFn: ({ signal }) => previewRuntime ? previewRuntime.loadSource(signal) : fetchHookStartingFrame({ ...scope, signal }), retry: false,
    staleTime: 5 * 60_000, gcTime: 5 * 60_000,
  });
  const costQuery = useQuery({ queryKey: ["hook-starting-image-cost", scope.ownerId], retry: false, staleTime: 60_000,
    queryFn: ({ signal }) => keyframeRead("?cost=1", signal).then(body => {
      if (typeof body.creditCost !== "number" || !Number.isFinite(body.creditCost) || body.creditCost <= 0 || body.model !== "nano_banana_2") throw new Error("The starting-image price could not be verified.");
      return body.creditCost as number;
    }) });
  const imageJobQuery = useQuery({ queryKey: ["hook-starting-image-job", scope.ownerId, scope.draftId, checkpoint?.requestKey, checkpoint?.jobId],
    enabled: checkpointRestored && Boolean(checkpoint), retry: false,
    queryFn: async ({ signal }) => {
      if (!checkpoint) throw new Error("No saved image request.");
      const body = await keyframeRead(checkpoint.jobId ? `?jobId=${encodeURIComponent(checkpoint.jobId)}` : `?requestKey=${encodeURIComponent(checkpoint.requestKey)}`, signal);
      return verifiedHookKeyframeJob(body.job, checkpoint);
    }, refetchInterval: query => query.state.error || query.state.data?.isTerminal ? false : 3_000 });
  const completedImageAssetId = imageJobQuery.data?.output?.mediaAssetId;
  useEffect(() => {
    const body = scrollBody.current, section = generatedSection.current;
    if (completedImageAssetId && body && section) {
      body.scrollTo({ top: body.scrollTop + section.getBoundingClientRect().top - body.getBoundingClientRect().top, behavior: "instant" });
    }
  }, [completedImageAssetId]);
  async function keyframeRead(query: string, signal?: AbortSignal) {
    if (previewRuntime) return previewRuntime.read(query, signal);
    return withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(scope.ownerId);
      bounded.throwIfAborted();
      if (!token) throw new Error("Sign in to access this starting-image request.");
      const response = await fetch(`/api/explore/hook-keyframe${query}`, { cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || "The image request could not be confirmed. Check its status before submitting anything else.");
      return body;
    }, signal);
  }
  const history = useInfiniteQuery({
    queryKey: ["hook-influencer-history", scope.ownerId], enabled: historyOpen, retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => withReadDeadline(async bounded => {
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
      try { setCheckpoint(readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope)); setCheckpointRestored(true); }
      catch (cause) { setGenerationError(cause instanceof Error ? cause.message : "Your saved image request could not be restored."); }
    });
    return () => { mounted.current = false; };
  }, [checkpointKey, scope]);
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
    if (!restored || pending || choosingInfluencer) return;
    const request = ++revision.current;
    const controller = new AbortController();
    influencerRequest.current?.abort();
    influencerRequest.current = controller;
    setChoosingInfluencer(true); setError(null);
    try {
      const asset = await withReadDeadline(async signal => {
        const token = await getCurrentUserIdToken(scope.ownerId);
        signal.throwIfAborted();
        if (!token) throw new Error("Sign in to use your saved influencer.");
        return fetchAIStudioMediaAsset(image.mediaAssetId, token, { signal });
      }, controller.signal);
      if (request !== revision.current) return;
      if (asset.status !== "ready" || (asset.collection !== "image" && asset.collection !== "influencer") || asset.sourceType !== "generated_image" ||
        !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType) || asset.id !== image.mediaAssetId) {
        throw new Error("This influencer image is no longer available. Choose another image.");
      }
      // A different saved influencer starts a new person selection. It must not
      // inherit supporting photos belonging to the previous person.
      setImages([{ kind: "image", asset }]);
      setDraft(current => updateHookKeyframeDraft(current, { imageAssetIds: [asset.id] }));
      setSaved(false); setHistoryOpen(false);
    } catch (cause) { if (request === revision.current) setError(cause instanceof Error ? cause.message : "This influencer could not be selected."); }
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
    if (!ready || !checkpointRestored || generationLock.current || costQuery.data === undefined || checkpoint && !imageJobQuery.data?.isTerminal) return;
    if (!navigator.locks) { setGenerationError("Use a browser with Web Locks support to submit images safely."); return; }
    generationLock.current = true; setSubmittingImage(true); setGenerationError(null);
    const frozen = preparedDraft;
    const previousRequestKey = checkpoint?.requestKey ?? null;
    try {
      await navigator.locks.request(`hook-starting-image:${checkpointKey}`, { mode: "exclusive" }, async () => {
        const savedRequest = readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope);
        if ((savedRequest?.requestKey ?? null) !== previousRequestKey) throw new Error("Another tab has a saved image request. Reopen this preparation to recover it.");
        const saved = createHookKeyframeCheckpoint(frozen, crypto.randomUUID());
        // Freeze identity before authentication/network. Uncertain submissions are
        // recovered by GET only, never automatically submitted a second time.
        localStorage.setItem(checkpointKey, JSON.stringify(saved));
        if (mounted.current) setCheckpoint(saved);
        const token = previewRuntime ? "local-fixture" : await withReadDeadline(() => getCurrentUserIdToken(scope.ownerId));
        if (!token) throw new Error("Sign in before creating the starting image. Its request record is preserved.");
        const input = { referenceId: scope.referenceId, sourceSha256: scope.sourceSha256, draftId: scope.draftId,
          personImageAssetIds: frozen.imageAssetIds, instructions: frozen.instructions, idempotencyKey: saved.requestKey };
        const response = previewRuntime ? await previewRuntime.submit(input) : await fetch("/api/explore/hook-keyframe", {
          method: "POST", signal: AbortSignal.timeout(90_000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
        const body = "value" in response ? response.value : await response.json();
        if (!response.ok || !body.ok) {
          // These admission failures cannot have created a billed job. An explicit
          // future click may submit fresh inputs after the user fixes the problem.
          if ([400, 401, 402, 403, 422].includes(response.status)) {
            if (readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope)?.requestKey === saved.requestKey) localStorage.removeItem(checkpointKey);
            if (mounted.current) setCheckpoint(null);
          }
          throw new Error(body.message || "The image request could not be confirmed. Use Check image status; do not submit again.");
        }
        verifiedHookKeyframeJob({ id: body.jobId, status: "queued", isTerminal: false, error: null, receipt: body.receipt, output: null }, saved);
        const accepted = { ...saved, jobId: body.jobId as string };
        if (readHookKeyframeCheckpoint(localStorage.getItem(checkpointKey), scope)?.requestKey === saved.requestKey) localStorage.setItem(checkpointKey, JSON.stringify(accepted));
        if (mounted.current) setCheckpoint(accepted);
      });
    } catch (cause) { if (mounted.current) setGenerationError(cause instanceof Error ? cause.message : "The image request is unconfirmed. Check its status before trying anything else."); }
    finally { generationLock.current = false; if (mounted.current) setSubmittingImage(false); }
  }
  function selectStartingFrame(job: HookKeyframeJob) {
    if (!checkpoint || checkpoint.inputKey !== currentInput.current || !job.output || !onUseStartingFrame || promptPreview.requiresDecision || promptPreview.animationError || !promptPreview.directions.trim()) return;
    const verified = verifiedHookKeyframeJob(job, checkpoint);
    if (!verified.output) return;
    const approved = approveHookKeyframeImage(recordHookKeyframeImage(preparedDraft, { assetId: verified.output.mediaAssetId, inputKey: checkpoint.inputKey, promptVersion: 1 }));
    try { localStorage.setItem(key, serializeHookKeyframeDraft(approved)); }
    catch { setStorageError("Save this preparation before using the starting frame."); return; }
    setDraft(approved);
    onUseStartingFrame({ ...scope, assetId: verified.output.mediaAssetId, jobId: verified.id, url: verified.output.url,
      width: verified.output.width, height: verified.output.height, durationSeconds: promptPreview.durationSeconds === 8 ? 8 : 4,
      motionInstructions: promptPreview.directions, generateAudio: preparedDraft.generateAudio });
  }
  const busy = pending || choosingInfluencer || !restored || submittingImage;
  // Upload/lookup warnings must not discard already accepted, owned photos.
  const ready = restored && Boolean(frameQuery.data) && images.length > 0 && !busy;
  const promptPreview = getHookKeyframePromptPreview(preparedDraft);
  const imageJob = checkpoint && imageJobQuery.data ? imageJobQuery.data : null;
  const matchingImage = Boolean(checkpoint && checkpoint.inputKey === currentInputKey);
  const creatingImage = Boolean(checkpoint && !imageJob?.isTerminal);
  const historyImages = mergeCharacterHistoryPages(history.data?.pages ?? []);
  return <PreparationDialog onClose={() => {
    revision.current += 1;
    influencerRequest.current?.abort();
    onClose();
  }}>
    <nav className={styles.steps} aria-label="Hook recreation steps">
      <span aria-current="step"><span>1</span>Starting image</span>
      <span aria-disabled="true"><span>2</span>Use in video</span>
    </nav>
    <div ref={scrollBody} className={styles.body}>
      <section className={styles.scene} aria-label="Original opening frame">
        <div className={styles.sectionHeading}><div><h2>Reference scene</h2><p>{reference.title} · First frame</p></div><ImageIcon aria-hidden="true" /></div>
        <div className={styles.frame}>
          {frameQuery.data ? <img src={frameUrl ?? undefined} alt={`Actual first frame of ${reference.title}`} width={frameQuery.data.frame.width} height={frameQuery.data.frame.height} />
            : frameQuery.isPending ? <p role="status"><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Preparing the opening frame…</p>
            : <div role="alert"><p>{frameQuery.error?.message || "The opening frame could not be prepared."}</p><Button type="button" variant="outline" onClick={() => void frameQuery.refetch()}><RefreshCw aria-hidden="true" />Try again</Button></div>}
        </div>
        <p className={styles.caption}>This frame supplies the pose, clothing, hairstyle, camera, background and lighting. Creator captions will be removed when the starting image is made.</p>
        {motionDraft?.riskFlags.includes("no_person_in_opening_frame") ? <p className={styles.notice} role="status">This reference opens before the performer appears. Its starting image and reveal need review before it can be animated.</p> : null}
        {motionDraft?.riskFlags.some(flag => flag === "jump_cut" || flag === "multiple_takes") ? <p className={styles.notice} role="status">This reference contains a cut. Its action sequence needs review for animation from one image.</p> : null}
      </section>
      <section className={styles.person} aria-label="Person for the starting image">
        <div className={styles.sectionHeading}><div><h2>Your influencer</h2><p>Choose whose facial features and proportions to use.</p></div><UserRound aria-hidden="true" /></div>
        {restoreError ? <div className={styles.notice} role="alert"><p>{restoreError} Your saved preparation has not been overwritten.</p><Button type="button" variant="outline" onClick={() => { setDraft(createHookKeyframeDraft(scope)); setImages([]); setRestoreError(null); setRestored(true); }}>Start a new preparation</Button></div> : !restored ? <p role="status">Restoring your preparation…</p> : null}
        <Button type="button" variant="outline" disabled={busy || Boolean(previewRuntime)} onClick={() => { setHistoryOpen(true); void history.refetch(); }}>Choose saved influencer</Button>
        <div className={styles.photos}>
          <FormatGenerationReferences selection={null} imageSelections={images} imagePurpose="person" heading="Person photos"
            maxImages={HOOK_KEYFRAME_MAX_PERSON_IMAGES} ownerId={scope.ownerId} preview={Boolean(previewRuntime)}
            disabled={busy} videoInputEnabled={false} audioInputEnabled={false}
            onChange={selection => changeImages(selection?.kind === "image" ? [...images.filter(image => image.asset.id !== selection.asset.id), selection] : [])}
            onImagesChange={changeImages} onPendingChange={setPending} onErrorChange={setError} />
          <p>Use one clear main face photo. Two additional views of the same person can help show the nose, cheeks and jaw. Waist-up photos and a particular image ratio are optional.</p>
          {images.length ? <p className={styles.selectionStatus}><Check aria-hidden="true" />Main photo{images.length > 1 ? ` + ${images.length - 1} supporting ${images.length === 2 ? "view" : "views"}` : " selected"}</p> : null}
        </div>
        <a href="/explore/build-character" target="_blank" rel="noopener noreferrer" className={styles.builder}>Build an influencer <ExternalLink aria-hidden="true" /><span className="sr-only"> in a new tab</span></a>
        <p className={styles.caption}>Your preparation stays here. Return and choose the new influencer from your saved images.</p>
        <label className={styles.instructions}>Changes to the starting image <span>Optional</span>
          <textarea value={draft.instructions} disabled={busy} maxLength={2000} placeholder="For example, keep the same surprised expression."
            onChange={event => { setDraft(current => updateHookKeyframeDraft(current, { instructions: event.target.value })); setSaved(false); }} />
        </label>
        {promptPreview.imagePrompt ? <details className={styles.promptDetails}><summary>View image instructions</summary><p className={styles.compiledPrompt}>{promptPreview.imagePrompt}</p></details> : null}
        {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      </section>
      {checkpoint ? <section ref={generatedSection} className={styles.generated} aria-label="Generated starting image">
        <div className={styles.sectionHeading}><div><h2>Review your starting image</h2><p>Check the face, expression and scene before using this image to animate.</p></div></div>
        {previewRuntime ? <p className={styles.notice}>UI demonstration: the image below is a sample, not a generated result.</p> : null}
        {imageJob?.output ? <><div className={styles.generatedFrame}><img src={imageJob.output.url} width={imageJob.output.width} height={imageJob.output.height} alt="Generated starting frame to review before animation" /></div>
          {!matchingImage ? <p className={styles.notice} role="status">This image belongs to an earlier photo selection or image instructions. It cannot be used with your changed inputs.</p> : null}
          <p className={styles.caption}>Animation uses Seedance 2.5 through ReAPI. Using this frame selects that model and replaces the video and person-photo references. This button does not generate a video.</p>
        </> : <p role="status">{imageJob?.isTerminal ? imageJob.error || "The starting image did not complete. Review the status before making another request." : "Checking your saved image request. It will appear here when ready."}</p>}
        {imageJobQuery.error ? <p role="alert" className="text-destructive">{imageJobQuery.error.message} The saved request is preserved; no retry is submitted.</p> : null}
        <Button type="button" variant="outline" disabled={submittingImage || imageJobQuery.isFetching} onClick={() => void imageJobQuery.refetch()}>Check image status</Button>
      </section> : null}
      <section className={styles.animation} aria-label="Animation prompt preparation">
        <div className={styles.sectionHeading}><div><h2>Animation instructions</h2><p>Use after approving the starting image. These directions describe the actions; the approved image supplies the face and scene.</p></div>
          <button type="button" role="switch" aria-checked={draft.generateAudio} aria-label="Generate sound" disabled={busy}
            className={styles.soundSwitch} title={draft.generateAudio ? "Sound on" : "Sound off"}
            onClick={() => { setDraft(current => updateHookKeyframeDraft(current, { generateAudio: !current.generateAudio })); setSaved(false); }}>
            {draft.generateAudio ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}<span>Sound {draft.generateAudio ? "on" : "off"}</span>
          </button>
        </div>
        <label className={styles.instructions}>Actions, expression and camera
          <textarea aria-label="Animation instructions" value={promptPreview.directions} rows={8} maxLength={6000} disabled={busy}
            placeholder="Describe the opening expression, what happens next, camera movement and the final pose."
            onChange={event => { setDraft(current => updateHookKeyframeDraft(current, { motionInstructions: event.target.value })); setSaved(false); }} />
        </label>
        <div className={styles.promptStatus}><p>{promptPreview.customized ? "Your edited animation directions" : promptPreview.suggestedDirections ? "Filled from this Hook’s adapted motion plan" : "This Hook’s animation plan still needs adaptation"} · {promptPreview.durationSeconds}-second preview</p>
          {promptPreview.customized ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setDraft(current => updateHookKeyframeDraft(current, { motionInstructions: null })); setSaved(false); }}>Restore suggested instructions</Button> : null}
        </div>
        {promptPreview.requiresDecision ? <div className={styles.notice} role="status"><strong>This reference needs a decision before animation.</strong><ul>{promptPreview.decisionIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>
          : promptPreview.staticReview ? <p className={styles.caption}>Opening pose and action sequence checked against source frames. The {promptPreview.durationSeconds}-second version adapts the timing; generated output has not been tested.</p> : null}
        {promptPreview.animationError ? <p role="alert" className="text-xs text-destructive">{promptPreview.animationError}</p> : null}
        <p className={styles.caption}>Review these instructions against your approved starting image before generation. A reviewed prompt does not establish face consistency in the finished video.</p>
        {promptPreview.animationPrompt ? <details className={styles.promptDetails}><summary>View full animation prompt</summary><p className={styles.compiledPrompt}>{promptPreview.animationPrompt}</p></details> : null}
      </section>
    </div>
    <footer className={styles.footer}>
      <div><p>{checkpoint ? "Image request saved for recovery" : "Preparation preview · no generation is submitted until you choose Generate starting image"}</p><span>Next: review the starting image and use it, then press Generate video. Sound starts off.</span>
        <span>{costQuery.data !== undefined ? `Starting image: ${costQuery.data} AI credits · Nano Banana 2. Animation is charged separately.` : "Checking starting-image price…"}</span>
        {costQuery.error ? <p role="alert">{costQuery.error.message}</p> : null}
        {generationError ? <p role="alert" className="text-destructive">{generationError}</p> : null}
        {storageError ? <p role="alert" className="text-destructive">{storageError}</p> : saved ? <p role="status">Preparation saved on this browser.</p> : null}</div>
      <div className={styles.footerActions}>{!imageJob?.output ? <Button type="button" variant="outline" disabled={!ready} onClick={savePreparation}>Save preparation</Button> : null}
        <Button type="button" variant={imageJob?.output ? "outline" : "default"} disabled={!ready || !checkpointRestored || creatingImage || costQuery.data === undefined} onClick={() => void generateStartingImage()}>{submittingImage ? "Submitting image…" : imageJob?.isTerminal ? "Generate another starting image" : "Generate starting image"}</Button>
        {imageJob?.output ? <Button type="button" disabled={!matchingImage || !onUseStartingFrame || promptPreview.requiresDecision || Boolean(promptPreview.animationError) || !promptPreview.directions.trim() || busy} onClick={() => selectStartingFrame(imageJob)}>Use as starting frame</Button> : null}</div>
    </footer>
    <CharacterHistory open={historyOpen} onOpenChange={setHistoryOpen} images={historyImages}
      selectedJobId={null} onSelect={image => void selectInfluencer(image)} loading={history.isPending} error={history.error}
      onRetry={() => void history.refetch()} hasMore={history.hasNextPage} loadingMore={history.isFetchingNextPage}
      onLoadMore={() => void history.fetchNextPage()} signedIn busy={pending || choosingInfluencer} />
  </PreparationDialog>;
}
