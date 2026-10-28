"use client";

import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, History, ImageIcon, Images, Loader2, Maximize2, RectangleVertical, Sparkles, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AiStudioComposer, AiStudioSetting, AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { CharacterImageCount, CharacterImageModel } from "@/lib/characters/types";
import { CHARACTER_IMAGE_MODEL_OPTIONS, MAX_CHARACTER_REFERENCES, getCharacterImageModelLabel, getCharacterPromptLimit } from "@/lib/characters/image-models";
import { characterResultGroups } from "@/lib/characters/result-groups";
import { CHARACTER_PROMPT_SKILLS, composeCharacterPrompt, resolveCharacterPromptSkills } from "@/lib/characters/prompt-skills";
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
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<string[]>([]);
  const [workspaceNotice, setWorkspaceNotice] = useState<{ message: string } | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [libraryCopyError, setLibraryCopyError] = useState<string | null>(null);
  const [enlargedJobId, setEnlargedJobId] = useState<string | null>(null);
  useEffect(() => {
    if (!copiedPromptId) return;
    const timer = window.setTimeout(() => setCopiedPromptId(null), 2_000);
    return () => window.clearTimeout(timer);
  }, [copiedPromptId]);
  useEffect(() => {
    if (!workspaceNotice) return;
    const timer = window.setTimeout(() => setWorkspaceNotice(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [workspaceNotice]);
  const [imageReferences, setImageReferences] = useState<AIStudioReferenceMedia[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
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
  const selectedSkills = resolveCharacterPromptSkills(skillIds);
  const promptTooLong = composeCharacterPrompt(prompt, selectedSkills).length > promptLimit;
  const accessLoading = Boolean(userId) && builder.access.isPending;
  const quantityAffordable = Boolean(access && count <= access.affordableImageCount);
  const manualLocked = authLoading || !userId || !quantityAffordable || accessLoading || builder.access.isError;
  const error = builder.generate.error || builder.select.error;
  const completedImages = builder.visibleJobs.flatMap((receipt, index) => {
    const output = builder.visibleStatuses?.find(job => job.id === receipt.jobId)?.output;
    return output ? [{ jobId: receipt.jobId, url: output.url, index }] : [];
  });
  const enlargedIndex = completedImages.findIndex(image => image.jobId === enlargedJobId);
  const enlargedImage = completedImages[enlargedIndex];
  function moveEnlargedImage(direction: number) {
    const image = completedImages[(enlargedIndex + direction + completedImages.length) % completedImages.length];
    if (image) { builder.touchSession(); setEnlargedJobId(image.jobId); }
  }
  const selected = builder.selected;
  const references = builder.selectedCharacters;
  const selectedReferenceIds = builder.session.selectedCharacterIds?.length ? builder.session.selectedCharacterIds
    : builder.session.selectedCharacterId ? [builder.session.selectedCharacterId] : references.map((reference) => reference.id);
  const unresolvedReferences = selectedReferenceIds.length !== references.length;
  const totalReferences = selectedReferenceIds.length + imageReferences.length;
  const referencesLocked = busy || Boolean(pending);
  function toggleSkill(id: string) {
    if (referencesLocked) return;
    builder.touchSession();
    setSkillIds(current => current.includes(id) ? current.filter(candidate => candidate !== id) : [...current, id]);
  }
  const countOptions = access
    ? COUNT_OPTIONS.filter((option) => Number(option.value) <= access.affordableImageCount || Number(option.value) === count)
    : COUNT_OPTIONS;

  function submitPrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || unresolvedReferences || totalReferences > MAX_CHARACTER_REFERENCES || referencePendingRef.current || referenceErrorRef.current || manualLocked || pending || promptTooLong || !prompt.trim()) return;
    builder.generate.mutate({
      mode: "custom", prompt: prompt.trim(), model, imageCount: count,
      ...(skillIds.length ? { skillIds: [...skillIds] } : {}),
      ...(imageReferences.length > 1 ? { referenceImageAssetIds: imageReferences.map(reference => reference.asset.id) }
        : imageReferences.length ? { referenceImageAssetId: imageReferences[0].asset.id } : {}),
      ...(references.length > 1
        ? { referenceCharacterIds: references.map((reference) => reference.id) } : selected ? { referenceCharacterId: selected.id } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
  }
  function openLibrary() {
    setLibraryCopyError(null);
    builder.touchSession();
    setLibrarySelection(references.map((reference) => reference.id));
    setLibraryOpen(true);
    if (userId) void builder.characters.refetch();
  }
  async function copyPrompt(id: string, text: string) {
    if (id.startsWith("library:")) setLibraryCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptId(id);
    } catch {
      setCopiedPromptId(null);
      if (id.startsWith("library:")) setLibraryCopyError("Could not copy the prompt. Allow clipboard access and try again.");
      else setWorkspaceNotice({ message: "Could not copy the prompt. Select the text and copy it manually." });
    }
  }
  function toggleReference(id: string) {
    if (referencesLocked) return;
    const ids = references.map((reference) => reference.id);
    if (!ids.includes(id) && totalReferences >= MAX_CHARACTER_REFERENCES) {
      setWorkspaceNotice({ message: `Use up to ${MAX_CHARACTER_REFERENCES} reference images at a time.` });
      return;
    }
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
          {builder.historyImage ? <div className={styles.resultsToolbar}>
            <p className={styles.resultsHeading}>Image from your character history.</p>
            <Button variant="ghost" size="sm" onClick={builder.returnToSession}>Back to session</Button>
          </div> : null}
          <div className={styles.resultsRail} role="region" aria-label="Generated influencer images" tabIndex={0}>
          {characterResultGroups(builder.visibleJobs, builder.visibleStatuses).map(group => <div key={group.id} className={styles.resultGroup}>
            <div className={styles.resultPrompt}>
            <div className={styles.submittedPrompt} title={group.displayPrompt ?? group.prompt ?? undefined}>
              {group.prompt ? <><p className={styles.promptText}>{group.displayPrompt ?? group.prompt}</p>
              <button type="button" className={styles.copyPrompt} aria-label="Copy prompt" title={copiedPromptId === group.id ? "Copied" : "Copy prompt"} onClick={() => void copyPrompt(group.id, group.prompt!)}>
                {copiedPromptId === group.id ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              </button>
              {copiedPromptId === group.id ? <span role="status" className="sr-only">Prompt copied</span> : null}</> : null}
            </div>
            {group.skills?.length ? <div className={styles.resultSkills} aria-label="Applied skills">{group.skills.map(skill => <span key={skill.id} className={styles.skillBadge}>{skill.name}</span>)}</div> : null}
            </div>
            <div className={styles.results}>
            {group.items.map(({ receipt, index }) => {
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
                {output ? <button type="button" className={styles.enlargeImage} aria-label={`Enlarge influencer image ${index + 1}`} title="Enlarge image"
                  onClick={() => { builder.touchSession(); setEnlargedJobId(receipt.jobId); }}>
                  <Maximize2 className="size-4" aria-hidden="true" />
                </button> : null}
                <div className={styles.candidateFooter}>
                  <span className="text-xs text-muted">Image {index + 1}{job?.model ? ` · ${getCharacterImageModelLabel(job.model)}` : ""}</span>
                  {saving ? <span className={styles.saveStatus}><Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />Selecting…</span>
                    : saved || active ? <span className={styles.saveStatus}><Check className="size-3" aria-hidden="true" />Saved</span> : null}
                </div>
                <div className={styles.candidateActions}>
                  {output ? <>
                  <span className="text-xs text-muted">{active ? `Reference ${references.findIndex((reference) => reference.id === output.mediaAssetId) + 1}` : "Select as reference"}</span>
                  <ImageDownloadButton assetId={output.mediaAssetId} userId={userId} name={`image ${index + 1}`} className={styles.downloadImage} />
                  </> : null}
                </div>
              </article>;
            })}
            </div>
          </div>)}
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
        {totalReferences ? <div className={styles.referenceSummary}><span>{totalReferences} reference{totalReferences === 1 ? "" : "s"} in your prompt</span><Button type="button" variant="ghost" size="sm" disabled={referencesLocked} onClick={() => { builder.chooseCharacters([]); setImageReferences([]); }}>Clear references</Button></div> : null}
        {builder.jobs.isError ? <div className={styles.notice} role="alert">{builder.jobs.error.message} <Button variant="ghost" size="sm" onClick={() => void builder.jobs.refetch()}>Check again</Button></div> : null}
        {error ? <div className={styles.notice} role="alert">{error.message}</div> : null}
        {pending && !builder.generate.isPending ? <div className={styles.notice}>
          <p>Your previous request hasn’t been confirmed. Retry it to recover the same generation.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={referencePending} onClick={() => builder.generate.mutate(pending)}>Retry request</Button>
            <Button size="sm" variant="ghost" onClick={builder.discardPendingRequest}>Start a new request</Button>
          </div>
        </div> : null}
        {selectedSkills.length > 0 && promptTooLong ? <div className={styles.notice} role="alert">Your description and selected skills exceed this model’s prompt limit. Shorten the description or remove a skill.</div> : null}
        <AiStudioComposer active ariaLabel="Describe your AI influencer" name="character-prompt" layout="unified" inlineReferences quiet showPromptHint={false}
          contextBanner={selectedSkills.length ? <div className={styles.skillChips} aria-label="Selected skills">{selectedSkills.map(skill => <button key={skill.id} type="button" className={styles.skillChip}
            aria-label={`Remove ${skill.name} skill`} disabled={referencesLocked} onClick={() => toggleSkill(skill.id)}><X className="size-3" aria-hidden="true" />{skill.name}</button>)}</div> : undefined}
          prompt={prompt} onPromptChange={(value) => { builder.touchSession(); setPrompt(value); }} placeholder={selected ? "Describe a new outfit, setting or pose for your influencer…" : "Describe the influencer you want to create…"}
          generateLabel={totalReferences > 1 ? "Generate" : selected ? "Create variation" : "Generate"}
          generateDisabled={busy || unresolvedReferences || totalReferences > MAX_CHARACTER_REFERENCES || Boolean(referenceError) || manualLocked || Boolean(pending) || promptTooLong || !prompt.trim()}
          hasAttachments={imageReferences.length > 0 || selectedReferenceIds.length > 0 || referencePending || Boolean(referenceError)}
          leadingControl={<ReferenceMediaUpload allowedKinds={REFERENCE_IMAGE_KINDS} inline
            append referenceCount={totalReferences} maxReferences={MAX_CHARACTER_REFERENCES}
            expectedUserId={userId ?? undefined} selection={null}
            referencePreview={totalReferences > 1 || imageReferences.length ? <div className={styles.referenceThumbnails}>
              {references.map((reference, index) => <ReferenceUploadPreview key={reference.id} kind="image" url={reference.url} name={`influencer reference ${index + 1}`} label={`Ref ${index + 1}`}
                disabled={referencesLocked} onRemove={() => builder.chooseCharacters(references.filter((candidate) => candidate.id !== reference.id).map((candidate) => candidate.id))} />)}
              {imageReferences.map((reference, index) => <ReferenceUploadPreview key={reference.asset.id} kind="image" url={reference.asset.url} name={`reference image ${index + 1}`} label={`Ref ${references.length + index + 1}`}
                disabled={referencesLocked} onRemove={() => { builder.touchSession(); setImageReferences(current => current.filter(candidate => candidate.asset.id !== reference.asset.id)); }} />)}
              </div> : selected ? <ReferenceUploadPreview kind="image" url={selected.url} name="influencer reference" label="Identity"
              disabled={busy || Boolean(pending)} onRemove={() => builder.chooseCharacter(null)} /> : undefined}
            disabled={authLoading || !userId || generationBusy || Boolean(pending) || builder.select.isPending}
            onChange={(reference) => { builder.touchSession(); setImageReferences(current => reference ? current.some(candidate => candidate.asset.id === reference.asset.id) ? current : [...current, reference] : []); }}
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
            <Popover>
              <PopoverTrigger disabled={referencesLocked} render={<button type="button" className={styles.skillsButton} aria-label={skillIds.length ? `Skills (${skillIds.length})` : "Skills"} />}>
                <Sparkles className="size-3.5" aria-hidden="true" /><span>Skills{skillIds.length ? ` (${skillIds.length})` : ""}</span><ChevronDown className="size-3" aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className={styles.skillsPopover}>
                <PopoverTitle>Skills</PopoverTitle>
                {CHARACTER_PROMPT_SKILLS.map(skill => <button key={skill.id} type="button" role="checkbox" aria-checked={skillIds.includes(skill.id)} aria-label={skill.name}
                  disabled={referencesLocked} className={styles.skillOption} onClick={() => toggleSkill(skill.id)}>
                  <span className={styles.skillCheck} aria-hidden="true">{skillIds.includes(skill.id) ? <Check className="size-3" /> : null}</span>
                  <span className="min-w-0"><span className="block text-xs font-medium">{skill.name}</span><span className={styles.skillDescription} title={skill.description}>{skill.description}</span></span>
                </button>)}
              </PopoverContent>
            </Popover>
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

      <Dialog open={Boolean(enlargedImage)} onOpenChange={open => { if (!open) setEnlargedJobId(null); }}>
        <DialogContent className={styles.imageDialog} onKeyDown={event => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault(); moveEnlargedImage(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}>
          <DialogTitle className="sr-only">Influencer image {(enlargedImage?.index ?? 0) + 1}</DialogTitle>
          <DialogDescription className="sr-only">Full resolution generated image. Use the arrow buttons or left and right arrow keys to browse images.</DialogDescription>
          {enlargedImage ? <>
            {/* Use the original owned output URL without thumbnail resizing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.fullImage} src={enlargedImage.url} alt={`Generated influencer candidate ${enlargedImage.index + 1}`} />
            {completedImages.length > 1 ? <div className={styles.imageNavigation}>
              <Button variant="outline" size="icon" aria-label="Previous image" onClick={() => moveEnlargedImage(-1)}><ChevronLeft className="size-5" aria-hidden="true" /></Button>
              <span className="text-xs text-muted" aria-live="polite">{enlargedIndex + 1} / {completedImages.length}</span>
              <Button variant="outline" size="icon" aria-label="Next image" onClick={() => moveEnlargedImage(1)}><ChevronRight className="size-5" aria-hidden="true" /></Button>
            </div> : null}
          </> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className={styles.libraryDialog}>
          <DialogHeader><DialogTitle>My influencers</DialogTitle><DialogDescription>Every generated image is saved here. Select up to {MAX_CHARACTER_REFERENCES} images, then use them as references in your prompt.</DialogDescription></DialogHeader>
          {libraryCopyError ? <p role="alert" className="text-xs text-destructive">{libraryCopyError}</p> : null}
          <div className={styles.library}>
            {builder.characters.data?.characters.map((character, index) => <div key={character.id} className={styles.savedCharacterCard} data-selected={librarySelection.includes(character.id)}>
              <button type="button" aria-label={`Select saved image ${index + 1}: ${character.name}`} aria-pressed={librarySelection.includes(character.id)} disabled={referencesLocked || !librarySelection.includes(character.id) && librarySelection.length + imageReferences.length >= MAX_CHARACTER_REFERENCES} className={`${styles.savedCharacter} outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => { builder.touchSession(); setLibrarySelection((current) => current.includes(character.id) ? current.filter((id) => id !== character.id) : [...current, character.id]); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.url} alt={character.name} loading="lazy" decoding="async" />
              <span className={styles.librarySelectionMark} aria-hidden="true">{librarySelection.includes(character.id) ? <Check className="size-3.5 shrink-0" /> : null}</span>
              </button>
              <div className={styles.savedCardActions}>
                <ImageDownloadButton assetId={character.id} userId={userId} name={`saved image ${index + 1}`} label="Download" className={styles.savedCardAction} />
                {character.prompt?.trim() ? <button type="button" className={styles.savedCardAction} aria-label={`Copy prompt for saved image ${index + 1}`}
                  title={copiedPromptId === `library:${character.id}` ? "Copied" : "Copy prompt"} onClick={() => void copyPrompt(`library:${character.id}`, character.prompt!)}>
                  {copiedPromptId === `library:${character.id}` ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  <span>{copiedPromptId === `library:${character.id}` ? "Copied" : "Copy Prompt"}</span>
                </button> : null}
                {copiedPromptId === `library:${character.id}` ? <span role="status" className="sr-only">Prompt copied</span> : null}
              </div>
            </div>)}
            {!userId ? <div className={styles.libraryNotice}><p className="text-sm text-muted">Sign in to see your saved influencers.</p><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>Sign in</Button></div> : builder.characters.isPending ? <p className={styles.libraryNotice} role="status">Loading influencers…</p> : builder.characters.isError ? <div className={styles.libraryNotice}><p className="text-sm text-destructive" role="alert">{builder.characters.error.message}</p><Button size="sm" variant="outline" onClick={() => void builder.characters.refetch()}>Try again</Button></div> : !builder.characters.data?.characters.length ? <p className={styles.libraryNotice}>Generate your first influencer image. Every completed image will appear here automatically.</p> : null}
            {busy && builder.characters.data?.characters.length ? <p className={styles.libraryNotice}>Wait for the current generation to finish before switching influencers.</p> : null}
          </div>
          <div className={styles.libraryActions}>
            <p role="status" className="text-sm text-muted">{librarySelection.length + imageReferences.length} of {MAX_CHARACTER_REFERENCES} references selected{imageReferences.length ? ` · ${imageReferences.length} uploaded` : ""}</p>
            <Button type="button" disabled={referencesLocked || !librarySelection.length || librarySelection.length + imageReferences.length > MAX_CHARACTER_REFERENCES} onClick={() => {
              builder.chooseCharacters(librarySelection); setLibraryOpen(false);
            }}>Use {librarySelection.length || "selected"} image{librarySelection.length === 1 ? "" : "s"} as references</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
