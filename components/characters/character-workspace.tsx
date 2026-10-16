"use client";

import { ArrowLeft, Check, History, ImageIcon, Images, Loader2, RectangleVertical, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AiStudioComposer, AiStudioSetting, AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CharacterImageCount, CharacterImageModel } from "@/lib/characters/types";
import { CHARACTER_IMAGE_MODEL_OPTIONS, MAX_CHARACTER_REFERENCES, getCharacterImageModelLabel, getCharacterPromptLimit } from "@/lib/characters/image-models";
import { characterBatchProgress } from "@/lib/characters/batch-progress";
import { useCharacterBuilder } from "./use-character-builder";
import { CharacterHistory } from "./character-history";
import { ImageDownloadButton } from "./image-download-button";
import { ReferenceMediaUpload } from "@/components/generation/reference-media-upload";
import { ReferenceUploadPreview } from "@/components/generation/reference-upload-preview";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import styles from "./character-workspace.module.css";

const COUNT_OPTIONS = [1, 2, 3].map((count) => ({ value: String(count), label: String(count) }));
const REFERENCE_IMAGE_KINDS = ["image"] as const;

const EXAMPLE_PORTRAITS = [
  { src: "/explore/characters/creator-bedroom.webp", alt: "Example AI influencer holding a small microphone" },
  { src: "/explore/characters/creator-selfie.webp", alt: "Example AI influencer in a casual selfie portrait" },
  { src: "/explore/characters/creator-window.webp", alt: "Example AI influencer recording at home" },
  { src: "/explore/characters/creator-office-v2.webp", alt: "Example AI influencer in a home office" },
] as const;

export function CharacterWorkspace({ localPreview = false }: { localPreview?: boolean }) {
  const { user, loading } = useAuth();
  return <CharacterSessionScreen key={user?.uid ?? "signed-out"} userId={user?.uid ?? null} authLoading={loading} localPreview={localPreview} />;
}

type CharacterScreenProps = { userId: string | null; authLoading: boolean; localPreview: boolean };

function CharacterSessionScreen(props: CharacterScreenProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [referencePending, setReferencePending] = useState(false);
  const builder = useCharacterBuilder(props.userId, historyOpen, referencePending);
  // A fresh session also clears the draft and uploaded reference. The builder
  // stays mounted so an outstanding request and its recovery receipt survive.
  return <CharacterScreen key={builder.sessionResetVersion} {...props} builder={builder}
    historyOpen={historyOpen} setHistoryOpen={setHistoryOpen} referencePending={referencePending} setReferencePending={setReferencePending} />;
}

function CharacterScreen({ userId, authLoading, localPreview, builder, historyOpen, setHistoryOpen, referencePending, setReferencePending }: CharacterScreenProps & {
  builder: ReturnType<typeof useCharacterBuilder>; historyOpen: boolean; setHistoryOpen: (open: boolean) => void;
  referencePending: boolean; setReferencePending: (pending: boolean) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<CharacterImageModel>("gpt_image");
  const [count, setCount] = useState<CharacterImageCount>(1);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<string[]>([]);
  const [workspaceNotice, setWorkspaceNotice] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!workspaceNotice) return;
    const timer = window.setTimeout(() => setWorkspaceNotice(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [workspaceNotice]);
  const [imageReference, setImageReference] = useState<AIStudioReferenceMedia | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceControlVersion, setReferenceControlVersion] = useState(0);
  const touchSession = builder.touchSession;
  const referencePendingRef = useRef(false);
  const referenceErrorRef = useRef<string | null>(null);
  const updateReferencePending = useCallback((value: boolean) => {
    referencePendingRef.current = value;
    setReferencePending(value);
    touchSession();
  }, [touchSession, setReferencePending]);
  const updateReferenceError = useCallback((message: string | null) => {
    referenceErrorRef.current = message;
    setReferenceError(message);
  }, []);
  const access = builder.access.data?.access;
  const generationBusy = builder.generate.isPending || builder.inProgress || builder.restoring || builder.select.isPending;
  const busy = generationBusy || referencePending;
  const pending = builder.session.pendingRequest;
  const promptLimit = getCharacterPromptLimit(model);
  const promptTooLong = prompt.length > promptLimit;
  const accessLoading = Boolean(userId) && builder.access.isPending;
  const quantityAffordable = Boolean(access && count <= access.affordableImageCount);
  const manualLocked = authLoading || !userId || !quantityAffordable || accessLoading || builder.access.isError;
  const error = builder.generate.error || builder.select.error;
  const progress = characterBatchProgress(builder.visibleJobs, builder.visibleStatuses);
  const selected = imageReference ? null : builder.selected;
  const references = imageReference ? [] : builder.selectedCharacters;
  const selectedReferenceIds = imageReference ? [] : builder.session.selectedCharacterIds?.length ? builder.session.selectedCharacterIds
    : builder.session.selectedCharacterId ? [builder.session.selectedCharacterId] : references.map((reference) => reference.id);
  const unresolvedReferences = selectedReferenceIds.length !== references.length;
  const referencesLocked = busy || Boolean(pending);
  const countOptions = access
    ? COUNT_OPTIONS.filter((option) => Number(option.value) <= access.affordableImageCount || Number(option.value) === count)
    : COUNT_OPTIONS;

  function resetImageReference() {
    setImageReference(null);
    updateReferenceError(null);
    setReferenceControlVersion((version) => version + 1);
  }

  function submitPrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || unresolvedReferences || referencePendingRef.current || referenceErrorRef.current || manualLocked || pending || promptTooLong || !prompt.trim()) return;
    builder.generate.mutate({
      mode: "custom", prompt: prompt.trim(), model, imageCount: count,
      ...(imageReference ? { referenceImageAssetId: imageReference.asset.id } : references.length > 1
        ? { referenceCharacterIds: references.map((reference) => reference.id) } : selected ? { referenceCharacterId: selected.id } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
  }
  function openLibrary() {
    builder.touchSession();
    setLibrarySelection(references.map((reference) => reference.id));
    setLibraryOpen(true);
    if (userId) void builder.characters.refetch();
  }
  function toggleReference(id: string) {
    if (referencesLocked) return;
    const ids = references.map((reference) => reference.id);
    if (!ids.includes(id) && ids.length >= MAX_CHARACTER_REFERENCES) {
      setWorkspaceNotice({ message: `Use up to ${MAX_CHARACTER_REFERENCES} reference images at a time.` });
      return;
    }
    resetImageReference();
    builder.chooseCharacters(ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id]);
    setWorkspaceNotice(null);
  }
  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); submitPrompt();
    }
  }
  const usageLabel = !userId ? "Sign in to generate your influencer."
    : accessLoading ? "Checking generation access…"
    : builder.access.isError ? "Could not load generation access. Try again."
    : access ? `${count} image${count === 1 ? "" : "s"} · ${count * access.imageCreditCost} credit${count * access.imageCreditCost === 1 ? "" : "s"} · ${access.creditsRemaining} available${quantityAffordable ? "" : access.affordableImageCount > 0 ? " — Choose fewer images or get more credits." : " — Get more credits to continue."}`
    : "Checking generation access…";

  return (
    <section className={styles.workspace} aria-label="Build AI influencer workspace">
      <header className={styles.header}>
        <div className={styles.heading}>
          <Link href={localPreview ? "/explore?preview=1" : "/explore"} aria-label="Back to Explore"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground-strong sm:text-2xl">Build AI influencer</h1>
        </div>
        <div className={styles.headerActions} role="group" aria-label="Your influencer images">
          <Button variant="ghost" size="sm" onClick={() => { builder.touchSession(); setHistoryOpen(true); }} aria-label="Influencer image history" title="Influencer image history" className={styles.historyButton}>
            <History className="size-3.5" aria-hidden="true" /><span>History</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openLibrary} aria-label="My influencers" title="My influencers" className={styles.libraryButton}>
            <UserRound className="size-3.5" aria-hidden="true" /><span>My influencers</span>
          </Button>
        </div>
      </header>

      <div className={styles.stage} aria-live="polite" aria-busy={busy}>
        {builder.visibleJobs.length ? <div className={styles.resultsPanel}>
          <div className={styles.resultsToolbar}>
            <p className={styles.resultsHeading} role="status">{builder.historyImage ? "Image from your character history." : progress.message}</p>
            {builder.historyImage ? <Button variant="ghost" size="sm" onClick={builder.returnToSession}>Back to session</Button> : null}
          </div>
          <p className={styles.selectionHint}>Select images to use as references in your next prompt. The × only removes an image from this workspace.</p>
          <div className={styles.results}>
            {builder.visibleJobs.map((receipt, index) => {
              const job = builder.visibleStatuses?.find((candidate) => candidate.id === receipt.jobId);
              const output = job?.output;
              const saved = Boolean(output && (builder.characters.data?.characters.some((character) => character.id === output.mediaAssetId) || builder.historyImage?.jobId === receipt.jobId && builder.historyImage.saved));
              const active = Boolean(output && references.some((reference) => reference.id === output.mediaAssetId));
              const saving = builder.select.isPending && builder.select.variables === receipt.jobId;
              return <article key={receipt.jobId} className={styles.candidate} data-selected={active} aria-label={`Influencer candidate ${index + 1}`}>
                {job?.isTerminal ? <button type="button" className={styles.removeImage} aria-label={`Remove image ${index + 1} from workspace`} title="Remove from workspace. Kept in My influencers and History." onClick={() => {
                  builder.dismissImage(receipt.jobId);
                  setWorkspaceNotice({ message: output ? "Image removed from this workspace. It is still saved in My influencers and History." : "Result removed from this workspace. Your generation history is unchanged." });
                }}><X className="size-4" aria-hidden="true" /></button> : null}
                <button type="button" className={styles.portrait} aria-label={`Select influencer image ${index + 1}`} aria-pressed={active}
                  disabled={!output || referencesLocked} onClick={() => output && toggleReference(output.mediaAssetId)}>
                  {output ? <>
                    <span className={styles.selectionMark} aria-hidden="true">{active ? <Check className="size-4" /> : null}</span>
                    {/* Generated provider URLs are validated by the owned status endpoint. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={output.url} alt={`Generated influencer candidate ${index + 1}`} />
                  </> : job?.isTerminal ? <p className="px-5 text-center text-sm text-muted">{job.error || "This candidate could not be created."}</p>
                    : builder.jobs.isError || job?.checkError ? <p className="px-5 text-center text-sm text-muted">{job?.checkError || "Could not check this image. Retry below."}</p>
                    : <div className="flex flex-col items-center gap-3 text-muted"><Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="text-xs">Creating candidate {index + 1}</span></div>}
                </button>
                <div className={styles.candidateFooter}>
                  <span className="text-xs text-muted">Image {index + 1}{job?.model ? ` · ${getCharacterImageModelLabel(job.model)}` : ""}</span>
                  {saving ? <span className={styles.saveStatus}><Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />Selecting…</span>
                    : saved || active ? <span className={styles.saveStatus}><Check className="size-3" aria-hidden="true" />Saved</span> : null}
                </div>
                {output ? <div className={styles.candidateActions}>
                  <span className="text-xs text-muted">{active ? `Reference ${references.findIndex((reference) => reference.id === output.mediaAssetId) + 1}` : "Select as reference"}</span>
                  <ImageDownloadButton assetId={output.mediaAssetId} userId={userId} name={`image ${index + 1}`} className={styles.downloadImage} />
                </div> : null}
              </article>;
            })}
          </div>
        </div> : <div className={styles.empty}>
          <div className={styles.emptyCopy}>
            <p className={styles.eyebrow}>A face for your ideas</p>
            <h2 className={styles.emptyTitle}>Your creator starts here.</h2>
            <p className={styles.emptyDescription}>Build an AI influencer for yourself or your business. Describe the look, setting and style you want.</p>
          </div>
          <div className={styles.examples} role="group" aria-label="AI influencer examples">
            <div className={styles.exampleStrip}>
              {EXAMPLE_PORTRAITS.map((portrait) => <div key={portrait.src} className={styles.examplePortrait}>
                <Image src={portrait.src} alt={portrait.alt} fill loading="eager" sizes="(min-width: 640px) 110px, 22vw" />
              </div>)}
            </div>
          </div>
        </div>}
      </div>

      <div className={styles.composerArea}>
        {workspaceNotice ? <div className={`${styles.notice} ${styles.dismissibleNotice}`}>
          <span role="status">{workspaceNotice.message}</span>
          <button type="button" className={styles.noticeClose} aria-label="Dismiss notification" onClick={() => setWorkspaceNotice(null)}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div> : null}
        {unresolvedReferences ? <div className={styles.notice} role="status">{builder.characters.isPending ? "Loading your saved references…" : "Some saved references could not be loaded. Choose them again in My influencers, or clear references before generating."}</div> : null}
        {selectedReferenceIds.length ? <div className={styles.referenceSummary}><span>{selectedReferenceIds.length} reference{selectedReferenceIds.length === 1 ? "" : "s"} in your prompt</span><Button type="button" variant="ghost" size="sm" disabled={referencesLocked} onClick={() => builder.chooseCharacters([])}>Clear references</Button></div> : null}
        {builder.jobs.isError ? <div className={styles.notice} role="alert">{builder.jobs.error.message} <Button variant="ghost" size="sm" onClick={() => void builder.jobs.refetch()}>Check again</Button></div> : null}
        {error ? <div className={styles.notice} role="alert">{error.message}</div> : null}
        {pending && !builder.generate.isPending ? <div className={styles.notice}>
          <p>Your previous request hasn’t been confirmed. Retry it to recover the same generation.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={referencePending} onClick={() => builder.generate.mutate(pending)}>Retry request</Button>
            <Button size="sm" variant="ghost" onClick={builder.discardPendingRequest}>Start a new request</Button>
          </div>
        </div> : null}
        <AiStudioComposer active ariaLabel="Describe your AI influencer" name="character-prompt" layout="unified" inlineReferences quiet showPromptHint={false}
          prompt={prompt} onPromptChange={(value) => { builder.touchSession(); setPrompt(value); }} placeholder={selected ? "Describe a new outfit, setting or pose for your influencer…" : "Describe the influencer you want to create…"}
          generateLabel={references.length > 1 ? "Generate" : selected ? "Create variation" : "Generate"}
          generateDisabled={busy || unresolvedReferences || Boolean(referenceError) || manualLocked || Boolean(pending) || promptTooLong || !prompt.trim()}
          hasAttachments={Boolean(imageReference) || selectedReferenceIds.length > 0 || referencePending || Boolean(referenceError)}
          leadingControl={<ReferenceMediaUpload key={referenceControlVersion} allowedKinds={REFERENCE_IMAGE_KINDS} inline
            expectedUserId={userId ?? undefined} selection={imageReference}
            referencePreview={references.length > 1 ? <div className={styles.referenceThumbnails}>{references.map((reference, index) => <ReferenceUploadPreview key={reference.id} kind="image" url={reference.url} name={`influencer reference ${index + 1}`} label={`Ref ${index + 1}`}
              disabled={referencesLocked} onRemove={() => builder.chooseCharacters(references.filter((candidate) => candidate.id !== reference.id).map((candidate) => candidate.id))} />)}</div> : selected ? <ReferenceUploadPreview kind="image" url={selected.url} name="influencer reference" label="Identity"
              disabled={busy || Boolean(pending)} onRemove={() => builder.chooseCharacter(null)} /> : undefined}
            disabled={authLoading || !userId || generationBusy || Boolean(pending) || builder.select.isPending}
            onChange={(reference) => { builder.touchSession(); setImageReference(reference); if (reference) builder.chooseCharacter(null); }}
            onPendingChange={updateReferencePending} onErrorChange={updateReferenceError} />}
          maxLength={promptLimit}
          generationLocked={manualLocked} isGenerating={builder.generate.isPending || builder.inProgress}
          onSubmit={submitPrompt} onTextareaKeyDown={handleTextareaKeyDown} accessMessage={referencePending ? "Uploading your reference image…" : usageLabel}
          settings={<>
            <AiStudioSettingSelect<CharacterImageModel> ariaLabel="Image model" icon={<ImageIcon className="size-3.5" aria-hidden="true" />} options={CHARACTER_IMAGE_MODEL_OPTIONS} value={model} onChange={(value) => { builder.touchSession(); setModel(value); }} disabled={busy || Boolean(pending)} />
            <AiStudioSetting icon={<RectangleVertical className="size-3.5" aria-hidden="true" />} label="9:16 portrait" />
            <AiStudioSettingSelect ariaLabel="Number of images" icon={<Images className="size-3.5" aria-hidden="true" />}
              options={countOptions} value={String(count)} onChange={(value) => { builder.touchSession(); setCount(Number(value) as CharacterImageCount); }}
              disabled={busy || Boolean(pending)} />
          </>}
          secondaryActions={<><p role="status" className={styles.usage}>{referencePending ? "Uploading reference…" : usageLabel}</p>{userId ? builder.access.isError ? <Button size="sm" variant="ghost" onClick={() => void builder.access.refetch()}>Retry access</Button>
            : !accessLoading && access && (!access.isPaid || !quantityAffordable) ? <Link href="/pricing" className="px-2 py-1 text-xs text-primary hover:underline">Get more credits</Link> : undefined
            : <Link href="/sign-in" className="px-2 py-1 text-xs text-primary hover:underline">Sign in</Link>}</>}
        />
      </div>

      <CharacterHistory open={historyOpen} onOpenChange={setHistoryOpen} images={builder.historyImages}
        selectedJobId={builder.historyImage?.jobId ?? null} onSelect={(image) => { builder.openHistoryImage(image); setHistoryOpen(false); }}
        loading={Boolean(userId) && builder.history.isPending} error={builder.history.error} onRetry={() => void builder.history.refetch()}
        hasMore={builder.history.hasNextPage} loadingMore={builder.history.isFetchingNextPage} onLoadMore={() => void builder.history.fetchNextPage()}
        signedIn={Boolean(userId)} busy={busy || Boolean(pending) || builder.select.isPending} />

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className={styles.libraryDialog}>
          <DialogHeader><DialogTitle>My influencers</DialogTitle><DialogDescription>Every generated image is saved here. Select up to {MAX_CHARACTER_REFERENCES} images, then use them as references in your prompt.</DialogDescription></DialogHeader>
          <div className={styles.library}>
            {builder.characters.data?.characters.map((character, index) => <div key={character.id} className={styles.savedCharacterCard}>
              <button type="button" aria-label={`Select saved image ${index + 1}: ${character.name}`} aria-pressed={librarySelection.includes(character.id)} disabled={referencesLocked || !librarySelection.includes(character.id) && librarySelection.length >= MAX_CHARACTER_REFERENCES} className={`${styles.savedCharacter} outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => { builder.touchSession(); setLibrarySelection((current) => current.includes(character.id) ? current.filter((id) => id !== character.id) : [...current, character.id]); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.url} alt={character.name} loading="lazy" decoding="async" />
              <span className={styles.savedCharacterName}>{character.name}<span className={styles.librarySelectionMark} aria-hidden="true">{librarySelection.includes(character.id) ? <Check className="size-3.5 shrink-0 text-primary" /> : null}</span></span>
              </button>
              <ImageDownloadButton assetId={character.id} userId={userId} name={`saved image ${index + 1}`} className={styles.downloadImage} />
            </div>)}
            {!userId ? <div className={styles.libraryNotice}><p className="text-sm text-muted">Sign in to see your saved influencers.</p><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>Sign in</Button></div> : builder.characters.isPending ? <p className={styles.libraryNotice} role="status">Loading influencers…</p> : builder.characters.isError ? <div className={styles.libraryNotice}><p className="text-sm text-destructive" role="alert">{builder.characters.error.message}</p><Button size="sm" variant="outline" onClick={() => void builder.characters.refetch()}>Try again</Button></div> : !builder.characters.data?.characters.length ? <p className={styles.libraryNotice}>Generate your first influencer image. Every completed image will appear here automatically.</p> : null}
            {busy && builder.characters.data?.characters.length ? <p className={styles.libraryNotice}>Wait for the current generation to finish before switching influencers.</p> : null}
          </div>
          <div className={styles.libraryActions}>
            <p role="status" className="text-sm text-muted">{librarySelection.length} of {MAX_CHARACTER_REFERENCES} selected</p>
            <Button type="button" disabled={referencesLocked || !librarySelection.length} onClick={() => {
              resetImageReference(); builder.chooseCharacters(librarySelection); setLibraryOpen(false);
            }}>Use {librarySelection.length || "selected"} image{librarySelection.length === 1 ? "" : "s"} as references</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
