"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, UserRound, Video, AudioLines, Volume2, VolumeX, Play, Pause, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VoiceOrb } from "@/components/audio/voice-orb";
import { CURATED_FAST_VOICES } from "./workflow-saved-audio-choices";
import { cn } from "@/lib/utils";
import { AiStudioRatioPicker, AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import {
  AI_STUDIO_GENERATION_QUANTITIES, AI_STUDIO_VIDEO_ASPECT_RATIOS, DEFAULT_SLIDESHOW_IMAGE_MODEL,
  SLIDESHOW_IMAGE_MODELS, getAIStudioImageModelLabel, getAIStudioVideoResolutions,
  parseAIStudioGenerationQuantity, parseAIStudioVideoResolution,
  type AIStudioImageAspectRatio, type AIStudioImageModel,
} from "@/lib/ai-studio/generation-settings";
import { WorkflowDurationControl } from "./workflow-duration-control";
import { createWorkflowGenerationSettings, getWorkflowVideoModels, normalizeWorkflowGenerationSettings, type WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import type { PublicReferenceWorkflow } from "@/lib/explore/public-reference-preview";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "./workflow-scheduling-panel";
import { WorkflowCompositionPanel } from "./workflow-composition-panel";
import { HOOK_BACKGROUND_AUDIO_SOURCES } from "./workflow-background-audio-picker";
import { DEFAULT_FINISHING_OPTIONS } from "./use-workflow-finishing";
import type { WorkflowAttachment } from "./hook-workflow-media-controls";
import creation from "./workflow-creation.module.css";
import styles from "./talking-head-references.module.css";

function SignInAction({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return <Link href="/sign-in" className={primary ? styles.guestPrimary : styles.guestAction}>{children}</Link>;
}

function Setting({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void;
}) {
  return <AiStudioSettingSelect fieldLayout="classic" fieldLabel={label} ariaLabel={label} value={value}
    options={options.map(option => ({ value: option, label: option }))} onChange={onChange} />;
}

function VideoSettings() {
  const [settings, setSettings] = useState(() => createWorkflowGenerationSettings());
  function change(patch: Partial<WorkflowGenerationSettings>) {
    setSettings(current => normalizeWorkflowGenerationSettings({ ...current, ...patch }));
  }
  return <div className={creation.settingsGrid} role="group" aria-label="Video generation settings">
    <AiStudioSettingSelect fieldLayout="classic" fieldLabel="Model" ariaLabel="Video model" value={settings.model}
      options={getWorkflowVideoModels()} onChange={model => change({ model })} />
    <SettingField label="Duration"><WorkflowDurationControl fieldLayout="classic" ariaLabel="Video duration" model={settings.model}
      value={settings.duration} onChange={duration => change({ duration })} /></SettingField>
    <AiStudioSettingSelect fieldLayout="classic" fieldLabel="Quality" ariaLabel="Quality" value={settings.resolution}
      options={getAIStudioVideoResolutions(settings.model).map(value => ({ value, label: value }))} onChange={resolution => change({ resolution: parseAIStudioVideoResolution(resolution) })} />
    <Setting label="Videos" value={String(settings.quantity)} options={AI_STUDIO_GENERATION_QUANTITIES.map(String)}
      onChange={value => change({ quantity: parseAIStudioGenerationQuantity(Number(value)) })} />
    <AiStudioRatioPicker fieldLayout="classic" fieldLabel="Ratio" allowedRatios={[...AI_STUDIO_VIDEO_ASPECT_RATIOS]}
      value={settings.aspectRatio} onChange={ratio => { if (ratio === "9:16" || ratio === "16:9") change({ aspectRatio: ratio }); }} />
  </div>;
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return <div className={creation.settingField}><span className="text-sm font-medium">{label}</span>{children}</div>;
}

function SlideSettings() {
  const [model, setModel] = useState<AIStudioImageModel>(DEFAULT_SLIDESHOW_IMAGE_MODEL);
  const [ratio, setRatio] = useState<AIStudioImageAspectRatio>("4:5");
  const [versions, setVersions] = useState("1");
  return <div className={creation.settingsGrid + " " + creation.imageSettings} role="group" aria-label="Image generation settings">
    <AiStudioSettingSelect fieldLayout="classic" fieldLabel="Model" ariaLabel="Image model" value={model} onChange={setModel}
      options={SLIDESHOW_IMAGE_MODELS.map(value => ({ value, label: getAIStudioImageModelLabel(value) }))} />
    <AiStudioRatioPicker fieldLayout="classic" fieldLabel="Ratio" value={ratio} onChange={setRatio} />
    <Setting label="Versions" value={versions} options={AI_STUDIO_GENERATION_QUANTITIES.map(String)} onChange={setVersions} />
  </div>;
}

/** Guest tiles reuse the real sidebar's reference-tile classes; every tile routes to sign-in. */
function GuestTile({ label, icon: Icon }: { label: string; icon: typeof ImagePlus }) {
  return <Link href="/sign-in" aria-label={`Sign in to choose ${label.toLowerCase()}`} className={cn(creation.referenceButton, styles.guestTile)}>
    <Icon aria-hidden="true" /><span className={creation.referenceLabel}>{label}</span>
  </Link>;
}

type GuestVoice = { name: string; previewUrl?: string; own?: boolean };

/** Guests pick from the same premade voices the audio screen offers, preview each sample, or add their own. */
function GuestAudioTile({ voice, onSelect }: { voice: GuestVoice | null; onSelect: (voice: GuestVoice | null) => void }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [ownUrl, setOwnUrl] = useState<string | null>(null);
  useEffect(() => () => {
    playerRef.current?.pause();
    if (ownUrl) URL.revokeObjectURL(ownUrl);
  }, [ownUrl]);
  function preview(sample: GuestVoice) {
    if (!sample.previewUrl) return;
    const previous = playerRef.current; playerRef.current = null; previous?.pause();
    if (playing === sample.name) { setPlaying(null); return; }
    const next = new Audio(sample.previewUrl); playerRef.current = next; setPlaying(sample.name);
    next.onended = () => { setPlaying(null); };
    void next.play().catch(() => { setPlaying(null); });
  }
  function chooseOwn(file: File) {
    if (ownUrl) URL.revokeObjectURL(ownUrl);
    const url = URL.createObjectURL(file);
    setOwnUrl(url);
    onSelect({ name: file.name.replace(/\.[^.]+$/, ""), previewUrl: url, own: true });
    setOpen(false);
  }
  return <>
    <button type="button" data-state={voice ? "selected" : "empty"} aria-label={voice ? `Change voice, selected: ${voice.name}` : "Choose audio: sample voices or add your own"}
      className={cn(creation.referenceButton, styles.guestTile)} onClick={() => setOpen(true)}>
      {voice ? null : <AudioLines aria-hidden="true" />}
      <span className={creation.referenceLabel}>{voice ? voice.name : "Choose audio"}</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a voice</DialogTitle>
          <DialogDescription>Listen to a sample voice or add your own. Sign in to generate with your selection.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2" aria-label="Sample voices">
          {CURATED_FAST_VOICES.map(sample => {
            const selected = voice?.name === sample.name && !voice?.own;
            return <li key={sample.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2" data-selected={selected || undefined}>
              <button type="button" aria-label={`${playing === sample.name ? "Pause" : "Play"} ${sample.name} sample`} onClick={() => preview({ name: sample.name, previewUrl: sample.previewUrl ?? undefined })}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus">
                {playing === sample.name ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><VoiceOrb id={sample.id} /><strong className="truncate text-sm">{sample.name}</strong></div>
                <p className="text-xs text-muted">{[sample.labels.gender, sample.labels.accent].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" className="min-h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-medium hover:bg-card-muted focus-visible:outline-2 focus-visible:outline-focus"
                aria-label={selected ? `Change sample voice, ${sample.name} selected` : `Use ${sample.name} sample voice`} onClick={() => { onSelect(selected ? null : { name: sample.name, previewUrl: sample.previewUrl ?? undefined }); setOpen(false); }}>
                {selected ? "Selected" : "Use voice"}
              </button>
            </li>;
          })}
        </ul>
        <input ref={inputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/webm" className="hidden" aria-label="Add your own voice"
          onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) chooseOwn(file); }} />
        <button type="button" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-card-muted focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" aria-hidden="true" />Add your own voice
        </button>
      </DialogContent>
    </Dialog>
  </>;
}

export function PublicCreateSection({ workflow }: { workflow: PublicReferenceWorkflow }) {
  const slides = workflow === "slideshow";
  const hookComposer = workflow === "hook" || workflow === "talking_head";
  const [soundOn, setSoundOn] = useState(false);
  const [voice, setVoice] = useState<GuestVoice | null>(null);
  const [source, setSource] = useState("Generate");
  const placeholder = slides ? "Describe the slides you want to create." : "Describe the video you want to create.";
  return <div className={creation.composer}>
    {!slides && <div className={creation.sourceModes} role="group" aria-label="Video source">
      {["Generate", "Upload", "Creative Assets"].map(mode => <button key={mode} type="button" aria-pressed={source === mode} onClick={() => setSource(mode)}>{mode}</button>)}
    </div>}
    <div hidden={source !== "Generate"} className={creation.generationFields}>
      <section aria-label="Optional references" className={creation.classicReferences}>
        <h3>Optional references</h3>
        <div className={creation.referenceGrid}>
          {slides
            ? <><GuestTile label="Reference images" icon={ImagePlus} /><GuestTile label="Face swap" icon={UserRound} /></>
            : <><GuestTile label="Choose image" icon={UserRound} /><GuestTile label="Choose video" icon={Video} /><GuestAudioTile voice={voice} onSelect={setVoice} /></>}
        </div>
      </section>
      <div className={creation.instructionsField}>
        <label className="block text-sm font-medium">Your instructions</label>
        {hookComposer ? <div data-prompt-editor className={cn("relative", creation.promptWithAction)}>
          <textarea className={cn(creation.prompt, creation.promptWithAttachments)} rows={4} placeholder={placeholder} />
          <div className="absolute right-3 bottom-3">
            <button type="button" role="switch" aria-label="Generate sound" aria-checked={soundOn} onClick={() => setSoundOn(value => !value)}
              className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-xs focus-visible:outline-2 focus-visible:outline-focus", soundOn ? "text-primary" : "text-muted")}>
              {soundOn ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}Sound {soundOn ? "on" : "off"}
            </button>
          </div>
        </div> : <textarea className={creation.prompt} rows={4} placeholder={placeholder} />}
      </div>
      <section aria-label="Video settings" className="space-y-3">
        {slides ? <SlideSettings /> : <VideoSettings />}
      </section>
    </div>
    {source === "Upload" && <p className={creation.sectionHelp}>Sign in to upload a video.</p>}
    {source === "Creative Assets" && <p className={creation.sectionHelp}>Sign in to choose a saved video.</p>}
  </div>;
}

const ignoreChange = () => {};
const declineSelection = async () => false;
const guestAttachment: WorkflowAttachment = {
  asset: null, loading: false, error: null, choose: declineSelection, chooseRemote: declineSelection,
  chooseLibraryImage: ignoreChange, remove: ignoreChange, clearError: ignoreChange,
};

function GuestTalkingHeadDemo() {
  return <fieldset disabled aria-label="Demo settings preview" className="min-w-0"
    onClickCapture={event => event.preventDefault()} onDropCapture={event => { event.preventDefault(); event.stopPropagation(); }}>
    <WorkflowCompositionPanel videoLabel="Talking head" editingBusy demoSourceTiles demoSoundDetails
      demo={guestAttachment} demoAudio={guestAttachment} demoAudioPlayback="once" onDemoAudioPlaybackChange={ignoreChange}
      options={DEFAULT_FINISHING_OPTIONS} onOptionsChange={ignoreChange} backgroundAudioSources={HOOK_BACKGROUND_AUDIO_SOURCES}
      backgroundMusic={{ attachment: guestAttachment, source: null, playback: "repeat", choose: declineSelection,
        setPlayback: ignoreChange, selectionError: null }} />
  </fieldset>;
}

export function PublicEditSection({ workflow }: { workflow: PublicReferenceWorkflow }) {
  const [music, setMusic] = useState(false);
  if (workflow === "talking_head") return <GuestTalkingHeadDemo />;
  if (workflow === "slideshow") return <div className={styles.guestFields}>
    <h2 className="font-semibold">Edit your slides</h2>
    <p className="text-sm text-muted">Add slides to arrange them and edit their text and appearance.</p>
  </div>;
  if (workflow === "wall_text") return <div className={styles.guestFields}>
    <h2 className="font-semibold">Edit video</h2>
    <label className={styles.guestField}>Text on screen<textarea className={creation.prompt} rows={3} /></label>
    <section><h3 className="text-sm font-medium">Trim</h3><p className="text-sm text-muted">Choose a video to set its start and end time.</p></section>
    <section><h3 className="mb-2 text-sm font-medium">Sound</h3><SignInAction>Choose background audio</SignInAction></section>
  </div>;
  return <div className={styles.guestFields}>
    <section><h2 className="mb-2 font-semibold">Demo upload</h2><div className={styles.guestActions}>
      <SignInAction>Upload demo</SignInAction><SignInAction>Saved demos</SignInAction>
    </div></section>
    <section><label><input type="checkbox" checked={music} onChange={event => setMusic(event.target.checked)} /> Background music</label>
      {music && <div className={styles.guestFields}><SignInAction>Choose background music</SignInAction><label className={styles.guestField}>Music volume<input type="range" defaultValue="20" /></label></div>}
    </section>
  </div>;
}

export function PublicScheduleSection({ workflow }: { workflow: PublicReferenceWorkflow }) {
  const [draft, setDraft] = useState(EMPTY_SCHEDULE_DRAFT);
  return <WorkflowSchedulingPanel draft={draft} onChange={setDraft} imageOnly={workflow === "slideshow"}
    accountsControl={<SignInAction>Sign in to choose accounts</SignInAction>} />;
}
