"use client";

import { ArrowLeft, Check, ImageIcon, Loader2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AiStudioComposer, AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CharacterGender, CharacterImageModel } from "@/lib/characters/types";
import { useCharacterBuilder } from "./use-character-builder";
import { useCharacterPreference } from "./use-character-preference";
import styles from "./character-workspace.module.css";

const MODEL_OPTIONS = [
  { value: "gpt_image", label: "GPT Image" },
  { value: "nano_banana_2", label: "Nano Banana 2" },
] as const;

export function CharacterWorkspace({ localPreview = false }: { localPreview?: boolean }) {
  const { user, loading } = useAuth();
  return <CharacterScreen key={user?.uid ?? "signed-out"} userId={user?.uid ?? null} authLoading={loading} localPreview={localPreview} />;
}

function CharacterScreen({ userId, authLoading, localPreview }: { userId: string | null; authLoading: boolean; localPreview: boolean }) {
  const builder = useCharacterBuilder(userId);
  const onboarding = useCharacterPreference(userId, !authLoading);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<CharacterImageModel>("gpt_image");
  const [genderChoice, setGenderChoice] = useState<CharacterGender | null>(null);
  const [genderDismissed, setGenderDismissed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const access = builder.access.data?.access;
  const busy = builder.generate.isPending || builder.inProgress || builder.restoring;
  const pending = builder.session.pendingRequest;
  const hasHistory = Boolean(builder.session.jobs.length || builder.session.selectedCharacterId || pending || builder.characters.data?.characters.length);
  const gender = genderChoice ?? onboarding.preference.gender ?? pending?.gender ?? builder.selected?.gender ?? builder.characters.data?.characters[0]?.gender ?? null;
  const genderOpen = onboarding.ready && !genderDismissed && !onboarding.preference.seen && !hasHistory && !builder.restoring && (!userId || !builder.characters.isPending);
  const accessLoading = Boolean(userId) && builder.access.isPending;
  const manualLocked = !userId || !access?.isPaid || !access.canGenerate;
  const assistedLocked = !userId || !gender || !access?.canGenerate || accessLoading;
  const error = builder.generate.error || builder.select.error;
  const selected = builder.selected;
  const count = access?.requestedCount ?? 3;

  function submitPrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || manualLocked || pending || !prompt.trim()) return;
    builder.generate.mutate({
      mode: "custom", prompt: prompt.trim(), model,
      ...(selected ? { referenceCharacterId: selected.id } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
  }
  function submitAssisted() {
    if (!userId || !gender || busy || assistedLocked || pending) return;
    builder.generate.reset();
    onboarding.remember(gender);
    builder.generate.mutate({ mode: "assisted", gender, model, idempotencyKey: crypto.randomUUID() });
  }
  function finishGenderChoice() {
    onboarding.remember(gender);
    setGenderDismissed(true);
  }
  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); submitPrompt();
    }
  }
  const usageLabel = !userId ? "Sign in to generate your influencer."
    : accessLoading ? "Checking generation access…"
    : builder.access.isError ? "Could not load generation access. Try again."
    : access?.isPaid ? `${count} candidates · ${access.creditsRequired} credits`
    : access?.freeGenerationAvailable ? "Your first influencer image is free. Use Create it for me."
    : access?.message ?? "Upgrade to create more influencers.";

  return (
    <section className={styles.workspace} aria-label="Build AI character workspace">
      <header className={styles.header}>
        <div className={styles.heading}>
          <Link href={localPreview ? "/explore?preview=1" : "/explore"} aria-label="Back to Explore"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground-strong sm:text-2xl">Build AI character</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)} aria-label="My influencers" title="My influencers" className="size-9 shrink-0 px-0 sm:w-auto sm:px-3">
          <UserRound className="size-4 sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">My influencers</span>
        </Button>
      </header>

      <div className={styles.stage} aria-live="polite" aria-busy={busy}>
        {builder.session.jobs.length ? <>
          <p className="mb-5 text-center text-sm text-muted">{builder.inProgress ? "Creating your influencer…" : "Choose the creator you want to keep."}</p>
          <div className={styles.results} data-count={builder.session.jobs.length}>
            {builder.session.jobs.map((receipt, index) => {
              const job = builder.jobs.data?.find((candidate) => candidate.id === receipt.jobId);
              const output = job?.output;
              const saved = Boolean(output && builder.characters.data?.characters.some((character) => character.id === output.mediaAssetId));
              const active = Boolean(output && selected?.id === output.mediaAssetId);
              return <article key={receipt.jobId} className={styles.candidate} aria-label={`Influencer candidate ${index + 1}`}>
                <div className={styles.portrait}>
                  {output ? <>
                    {/* Generated provider URLs are validated by the owned status endpoint. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={output.url} alt={`Generated influencer candidate ${index + 1}`} />
                  </> : job?.isTerminal ? <p className="px-5 text-center text-sm text-muted">{job.error || "This candidate could not be created."}</p>
                    : builder.jobs.isError || job?.checkError ? <p className="px-5 text-center text-sm text-muted">{job?.checkError || "Could not check this image. Retry below."}</p>
                    : <div className="flex flex-col items-center gap-3 text-muted"><Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="text-xs">Creating candidate {index + 1}</span></div>}
                </div>
                <div className={styles.candidateFooter}>
                  <span className="text-xs text-muted">Candidate {index + 1}</span>
                  <Button size="sm" variant={saved ? "outline" : "default"} disabled={!output || builder.select.isPending || active}
                    onClick={() => builder.select.mutate(receipt.jobId)}>
                    {active ? <><Check className="size-3.5" aria-hidden="true" /> Saved</> : builder.select.isPending && builder.select.variables === receipt.jobId ? "Saving…" : saved ? "Use saved influencer" : "Use this influencer"}
                  </Button>
                </div>
              </article>;
            })}
          </div>
        </> : <div className={styles.empty}>
          <div className={styles.emptyIcon}><UserRound className="size-6" strokeWidth={1.5} aria-hidden="true" /></div>
          <p className="text-lg font-medium tracking-tight text-foreground-strong">Your creator starts here</p>
          <p className="mt-2 text-sm leading-6">Describe your influencer, or let UGCpilot create your first one.</p>
        </div>}
      </div>

      <div className={styles.composerArea}>
        {onboarding.save.isError ? <div className={styles.notice} role="alert">Your choice is remembered on this browser, but couldn’t be saved to your account. <Button variant="ghost" size="sm" onClick={() => onboarding.remember(gender)}>Retry saving</Button></div> : null}
        {builder.jobs.isError ? <div className={styles.notice} role="alert">{builder.jobs.error.message} <Button variant="ghost" size="sm" onClick={() => void builder.jobs.refetch()}>Check again</Button></div> : null}
        {error ? <div className={styles.notice} role="alert">{error.message}</div> : null}
        {pending && !builder.generate.isPending ? <div className={styles.notice}>
          <p>Your previous request hasn’t been confirmed. Retry it to recover the same generation.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => builder.generate.mutate(pending)}>Retry request</Button>
            <Button size="sm" variant="ghost" onClick={builder.discardPendingRequest}>Start a new request</Button>
          </div>
        </div> : null}
        {!suggestionDismissed && !selected && !builder.session.jobs.length ? <div className={styles.suggestion}>
          <p className="text-sm font-medium text-foreground-strong">Let UGCpilot create your first influencer</p>
          <Button size="sm" disabled={busy || assistedLocked || Boolean(pending)} onClick={submitAssisted}>Create it for me</Button>
          <Button variant="ghost" size="icon-sm" className={styles.dismiss} aria-label="Dismiss first influencer suggestion" onClick={() => setSuggestionDismissed(true)}><X className="size-3.5" aria-hidden="true" /></Button>
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
            <span className="px-2 text-xs text-muted">9:16 portrait</span>
            {onboarding.ready && !gender && !genderOpen ? <div className="flex items-center gap-3 px-2 text-xs" role="radiogroup" aria-label="Influencer gender">
              {(["male", "female"] as const).map((value) => <label key={value} className="flex cursor-pointer items-center gap-1.5"><input type="radio" name="character-gender-inline" value={value} disabled={busy} onChange={() => { setGenderChoice(value); onboarding.remember(value); }} className="accent-primary" />{value === "male" ? "Male" : "Female"}</label>)}
            </div> : null}
            {suggestionDismissed && !selected && !builder.session.jobs.length ? <Button size="sm" variant="ghost" disabled={busy || assistedLocked || Boolean(pending)} onClick={submitAssisted}>Create it for me</Button> : null}
          </>}
          secondaryActions={userId ? builder.access.isError ? <Button size="sm" variant="ghost" onClick={() => void builder.access.refetch()}>Retry access</Button>
            : !accessLoading && !access?.isPaid ? <Link href="/pricing" className="px-2 py-1 text-xs text-primary hover:underline">Upgrade for custom prompts</Link> : undefined
            : <Link href="/sign-in" className="px-2 py-1 text-xs text-primary hover:underline">Sign in</Link>}
        />
      </div>

      <Dialog open={genderOpen} onOpenChange={(open) => { if (!open) finishGenderChoice(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create your influencer</DialogTitle>
            <DialogDescription>Would you like a male or female creator? We’ll remember your choice.</DialogDescription>
          </DialogHeader>
          <div className={styles.genderChoices} role="radiogroup" aria-label="Influencer gender">
            {(["male", "female"] as const).map((value) => <label key={value} className={styles.genderChoice}>
              <input type="radio" name="character-gender" value={value} checked={gender === value} disabled={busy} onChange={() => setGenderChoice(value)} className="accent-primary" />
              <span className="text-sm font-medium">{value === "male" ? "Male" : "Female"}</span>
            </label>)}
          </div>
          <p className="text-xs text-muted">You can describe a different creator in your prompt whenever you like.</p>
          <DialogFooter>
            <Button disabled={!gender} onClick={finishGenderChoice}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>My influencers</DialogTitle><DialogDescription>Choose a saved influencer to keep their identity in your next image.</DialogDescription></DialogHeader>
          <div className={styles.library}>
            {builder.characters.data?.characters.map((character) => <button key={character.id} type="button" className={`${styles.savedCharacter} outline-none focus-visible:ring-2 focus-visible:ring-focus`} onClick={() => { builder.chooseCharacter(character.id); setLibraryOpen(false); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.url} alt={character.name} />
              <span className="text-sm font-medium">{character.name}</span>
              {selected?.id === character.id ? <Check className="ml-auto size-4 text-primary" aria-hidden="true" /> : null}
            </button>)}
            {!userId ? <p className="text-sm text-muted">Sign in to see your saved influencers.</p> : builder.characters.isPending ? <p className="text-sm text-muted">Loading influencers…</p> : builder.characters.isError ? <><p className="text-sm text-destructive" role="alert">{builder.characters.error.message}</p><Button size="sm" variant="outline" onClick={() => void builder.characters.refetch()}>Try again</Button></> : !builder.characters.data?.characters.length ? <p className="text-sm leading-6 text-muted">Your saved influencers will appear here. Generate an image, then choose “Use this influencer.”</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
