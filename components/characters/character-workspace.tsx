"use client";

import { ArrowLeft, Check, History, ImageIcon, Images, Loader2, RectangleVertical, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AiStudioComposer, AiStudioSetting, AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CharacterImageCount, CharacterImageModel } from "@/lib/characters/types";
import { useCharacterBuilder } from "./use-character-builder";
import { CharacterHistory } from "./character-history";
import styles from "./character-workspace.module.css";

const MODEL_OPTIONS = [
  { value: "gpt_image", label: "GPT Image" },
  { value: "gemini_3_pro", label: "Gemini 3 Pro" },
  { value: "nano_banana_2", label: "Nano Banana 2.1" },
] as const satisfies readonly { value: CharacterImageModel; label: string }[];

const COUNT_OPTIONS = [1, 2, 3].map((count) => ({ value: String(count), label: String(count) }));

const EXAMPLE_PORTRAITS = [
  { src: "/explore/characters/creator-bedroom.webp", alt: "Example AI influencer holding a small microphone" },
  { src: "/explore/characters/creator-selfie.webp", alt: "Example AI influencer in a casual selfie portrait" },
  { src: "/explore/characters/creator-window.webp", alt: "Example AI influencer recording at home" },
  { src: "/explore/characters/creator-office-v2.webp", alt: "Example AI influencer in a home office" },
] as const;

export function CharacterWorkspace({ localPreview = false }: { localPreview?: boolean }) {
  const { user, loading } = useAuth();
  return <CharacterScreen key={user?.uid ?? "signed-out"} userId={user?.uid ?? null} authLoading={loading} localPreview={localPreview} />;
}

function CharacterScreen({ userId, authLoading, localPreview }: { userId: string | null; authLoading: boolean; localPreview: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const builder = useCharacterBuilder(userId, historyOpen);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<CharacterImageModel>("gpt_image");
  const [count, setCount] = useState<CharacterImageCount>(1);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const access = builder.access.data?.access;
  const busy = builder.generate.isPending || builder.inProgress || builder.restoring;
  const pending = builder.session.pendingRequest;
  const accessLoading = Boolean(userId) && builder.access.isPending;
  const quantityAffordable = Boolean(access && count <= access.affordableImageCount);
  const manualLocked = authLoading || !userId || !quantityAffordable || accessLoading || builder.access.isError;
  const error = builder.generate.error || builder.select.error;
  const selected = builder.selected;
  const countOptions = access
    ? COUNT_OPTIONS.filter((option) => Number(option.value) <= access.affordableImageCount || Number(option.value) === count)
    : COUNT_OPTIONS;

  function submitPrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || manualLocked || pending || !prompt.trim()) return;
    builder.generate.mutate({
      mode: "custom", prompt: prompt.trim(), model, imageCount: count,
      ...(selected ? { referenceCharacterId: selected.id } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
  }
  function openLibrary() {
    setLibraryOpen(true);
    if (userId) void builder.characters.refetch();
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
        <div className={styles.headerActions}>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} aria-label="Character history" title="Character history" className={styles.historyButton}>
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
            <p className={styles.resultsHeading}>{builder.inProgress ? "Creating your influencer…" : "Select an image to save it to My influencers."}</p>
            <div className="flex shrink-0 gap-1">
              {builder.historyImage ? <Button variant="ghost" size="sm" onClick={builder.returnToSession}>Back to session</Button> : null}
              <Button variant="outline" size="sm" disabled={busy || Boolean(pending) || builder.select.isPending} onClick={() => { builder.startNewSession(); setPrompt(""); }}>New session</Button>
            </div>
          </div>
          <div className={styles.results}>
            {builder.visibleJobs.map((receipt, index) => {
              const job = builder.visibleStatuses?.find((candidate) => candidate.id === receipt.jobId);
              const output = job?.output;
              const saved = Boolean(output && (builder.characters.data?.characters.some((character) => character.id === output.mediaAssetId) || builder.historyImage?.jobId === receipt.jobId && builder.historyImage.saved));
              const active = Boolean(output && selected?.id === output.mediaAssetId);
              const saving = builder.select.isPending && builder.select.variables === receipt.jobId;
              return <article key={receipt.jobId} className={styles.candidate} data-selected={active} aria-label={`Influencer candidate ${index + 1}`}>
                <button type="button" className={styles.portrait} aria-label={`Select influencer image ${index + 1}`} aria-pressed={active}
                  disabled={!output || builder.select.isPending || active} onClick={() => builder.select.mutate(receipt.jobId)}>
                  {output ? <>
                    {/* Generated provider URLs are validated by the owned status endpoint. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={output.url} alt={`Generated influencer candidate ${index + 1}`} />
                  </> : job?.isTerminal ? <p className="px-5 text-center text-sm text-muted">{job.error || "This candidate could not be created."}</p>
                    : builder.jobs.isError || job?.checkError ? <p className="px-5 text-center text-sm text-muted">{job?.checkError || "Could not check this image. Retry below."}</p>
                    : <div className="flex flex-col items-center gap-3 text-muted"><Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="text-xs">Creating candidate {index + 1}</span></div>}
                </button>
                <div className={styles.candidateFooter}>
                  <span className="text-xs text-muted">Image {index + 1}</span>
                  {saving ? <span className={styles.saveStatus}><Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />Saving…</span>
                    : saved || active ? <span className={styles.saveStatus}><Check className="size-3" aria-hidden="true" />Saved</span> : null}
                </div>
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
        {builder.jobs.isError ? <div className={styles.notice} role="alert">{builder.jobs.error.message} <Button variant="ghost" size="sm" onClick={() => void builder.jobs.refetch()}>Check again</Button></div> : null}
        {error ? <div className={styles.notice} role="alert">{error.message}</div> : null}
        {pending && !builder.generate.isPending ? <div className={styles.notice}>
          <p>Your previous request hasn’t been confirmed. Retry it to recover the same generation.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => builder.generate.mutate(pending)}>Retry request</Button>
            <Button size="sm" variant="ghost" onClick={builder.discardPendingRequest}>Start a new request</Button>
          </div>
        </div> : null}
        <AiStudioComposer active ariaLabel="Describe your AI influencer" name="character-prompt" layout="unified"
          prompt={prompt} onPromptChange={setPrompt} placeholder={selected ? "Describe a new outfit, setting or pose for your influencer…" : "Describe the influencer you want to create…"}
          generateLabel={selected ? "Create variation" : "Generate"}
          generateDisabled={busy || manualLocked || Boolean(pending) || !prompt.trim()}
          generationLocked={manualLocked} isGenerating={builder.generate.isPending || builder.inProgress}
          onSubmit={submitPrompt} onTextareaKeyDown={handleTextareaKeyDown} accessMessage={usageLabel}
          contextBanner={selected ? <div className={styles.reference}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt="Saved influencer reference" />
            <span><span className="font-medium">{selected.name}</span> · Keeping this identity</span>
            <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Remove influencer reference" onClick={() => builder.chooseCharacter(null)}><X className="size-3.5" aria-hidden="true" /></Button>
          </div> : undefined}
          settings={<>
            <AiStudioSettingSelect<CharacterImageModel> ariaLabel="Image model" icon={<ImageIcon className="size-3.5" aria-hidden="true" />} options={MODEL_OPTIONS} value={model} onChange={setModel} disabled={busy || Boolean(pending)} />
            <AiStudioSetting icon={<RectangleVertical className="size-3.5" aria-hidden="true" />} label="9:16 portrait" />
            <AiStudioSettingSelect ariaLabel="Number of images" icon={<Images className="size-3.5" aria-hidden="true" />}
              options={countOptions} value={String(count)} onChange={(value) => setCount(Number(value) as CharacterImageCount)}
              disabled={busy || Boolean(pending)} />
          </>}
          secondaryActions={userId ? builder.access.isError ? <Button size="sm" variant="ghost" onClick={() => void builder.access.refetch()}>Retry access</Button>
            : !accessLoading && access && (!access.isPaid || !quantityAffordable) ? <Link href="/pricing" className="px-2 py-1 text-xs text-primary hover:underline">Get more credits</Link> : undefined
            : <Link href="/sign-in" className="px-2 py-1 text-xs text-primary hover:underline">Sign in</Link>}
        />
      </div>

      <CharacterHistory open={historyOpen} onOpenChange={setHistoryOpen} images={builder.historyImages}
        selectedJobId={builder.historyImage?.jobId ?? null} onSelect={(image) => { builder.openHistoryImage(image); setHistoryOpen(false); }}
        loading={Boolean(userId) && builder.history.isPending} error={builder.history.error} onRetry={() => void builder.history.refetch()}
        hasMore={builder.history.hasNextPage} loadingMore={builder.history.isFetchingNextPage} onLoadMore={() => void builder.history.fetchNextPage()}
        signedIn={Boolean(userId)} busy={busy || Boolean(pending) || builder.select.isPending} />

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>My influencers</DialogTitle><DialogDescription>Choose a saved influencer to keep their identity in your next image.</DialogDescription></DialogHeader>
          <div className={styles.library}>
            {builder.characters.data?.characters.map((character) => <button key={character.id} type="button" disabled={busy} className={`${styles.savedCharacter} outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => { builder.chooseCharacter(character.id); setLibraryOpen(false); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.url} alt={character.name} />
              <span className="text-sm font-medium">{character.name}</span>
              {selected?.id === character.id ? <Check className="ml-auto size-4 text-primary" aria-hidden="true" /> : null}
            </button>)}
            {!userId ? <div className="space-y-3"><p className="text-sm text-muted">Sign in to see your saved influencers.</p><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>Sign in</Button></div> : builder.characters.isPending ? <p className="text-sm text-muted">Loading influencers…</p> : builder.characters.isError ? <><p className="text-sm text-destructive" role="alert">{builder.characters.error.message}</p><Button size="sm" variant="outline" onClick={() => void builder.characters.refetch()}>Try again</Button></> : !builder.characters.data?.characters.length ? <p className="text-sm leading-6 text-muted">Your saved influencers will appear here. Generate an image, then select it to save your influencer.</p> : null}
            {busy && builder.characters.data?.characters.length ? <p className="text-xs text-muted">Wait for the current generation to finish before switching influencers.</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
