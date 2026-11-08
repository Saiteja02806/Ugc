"use client";

import { Check, FolderOpen, Info, Play, Upload, Video } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { WorkflowBackgroundAudioPicker } from "./workflow-background-audio-picker";
import type { WorkflowBackgroundMusic } from "./use-workflow-background-music";

import { RemoveMediaButton, WorkflowFilePicker, WorkflowMediaPlayer, formatMediaSeconds, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import studio from "@/components/explore/workflow-studio.module.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EXPLORE_SUBTITLE_SCOPE_LABEL } from "@/worker/src/subtitles/explore-policy";
import { planExploreBackgroundAudio, type ExploreBackgroundPlayback } from "@/worker/src/lib/explore-background-audio";
import type { FinishingOptions } from "@/components/explore/use-workflow-finishing";
import { WorkflowSavedAudioPicker } from "@/components/explore/workflow-saved-audio-picker";
import { SUBTITLE_STYLE_REGISTRY, subtitlePreview, type SubtitleStyle } from "@/worker/src/subtitles/styles";
import { WorkflowSubtitlePreview } from "@/components/explore/workflow-subtitle-preview";
import { WorkflowDemoControls } from "@/components/explore/workflow-demo-controls";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";
import { WorkflowCaptionEditor, type WorkflowCaptions } from "./workflow-caption-editor";

const SUBTITLE_STYLES = SUBTITLE_STYLE_REGISTRY;

/** Editing is separate from creation and scheduling; attachment ownership stays above. */
export function WorkflowCompositionPanel({ videoLabel, demo, demoAudio, demoSourceActions, demoAudioPlayback, onDemoAudioPlaybackChange, connected = false, options, onOptionsChange, ownerId, demoFramingEnabled = false, demoFraming = null, onDemoFramingChange, outputAspect = 9 / 16, editingBusy = false, demoFramingError = null, onDemoControlsOpen, captions, demoInPreview = false, backgroundMusic, demoSourceTiles = false, onChooseSavedDemo, demoSoundDetails = false }: {
  videoLabel: "Hook" | "Phone video" | "Talking head";
  demo: WorkflowAttachment;
  demoAudio: WorkflowAttachment;
  demoSourceActions?: ReactNode;
  demoAudioPlayback: ExploreBackgroundPlayback;
  onDemoAudioPlaybackChange: (playback: ExploreBackgroundPlayback) => void;
  connected?: boolean;
  ownerId?: string | null;
  options?: FinishingOptions;
  onOptionsChange?: (value: FinishingOptions) => void;
  demoFramingEnabled?: boolean;
  demoFraming?: DemoFraming | null;
  onDemoFramingChange?: (value: DemoFraming | null) => void;
  outputAspect?: number;
  editingBusy?: boolean;
  demoFramingError?: string | null;
  onDemoControlsOpen?: () => void;
  captions?: WorkflowCaptions;
  demoInPreview?: boolean;
  backgroundMusic?: WorkflowBackgroundMusic;
  demoSourceTiles?: boolean;
  onChooseSavedDemo?: () => void;
  demoSoundDetails?: boolean;
}) {
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("clean");
  const [subtitlePlacement, setSubtitlePlacement] = useState<"bottom" | "middle" | "top">("bottom");
  const subtitleAppearance = useRef<HTMLDetailsElement>(null);
  const demoInput = useRef<HTMLInputElement>(null);
  const selectedStyle = options?.style ?? subtitleStyle;
  const selectedPlacement = options?.placement ?? subtitlePlacement;
  const kind = videoLabel === "Hook" ? "hook" : "phone";
  const demoAudioName = demoSoundDetails ? "Demo voiceover" : "Demo audio";
  const demoAudioWord = demoSoundDetails ? "voiceover" : "audio";
  const unavailableId = `${kind}-finishing-unavailable`;
  const subtitleHelpId = `${kind}-subtitle-style-help`;
  const timingHelpId = `${kind}-demo-audio-timing`;
  const timing = demoAudioTiming(demo.asset?.duration, demoAudio.asset?.duration, demoAudioPlayback, demoSoundDetails);
  const demoSoundBody = <>
    <div className="flex flex-wrap gap-2">
      <WorkflowFilePicker attachment={demoAudio} kind="audio" label={demoSoundDetails ? "Upload demo voiceover" : "Upload demo audio"} buttonLabel={demoAudio.asset ? demoSoundDetails ? "Replace voiceover" : "Replace audio" : demoSoundDetails ? "Upload voiceover" : "Upload audio"} icon={<Upload className="size-4" aria-hidden="true" />} disabled={!demo.asset} />
      {connected && ownerId ? <WorkflowSavedAudioPicker ownerId={ownerId} attachment={demoAudio} disabled={!demo.asset} buttonLabel={demoSoundDetails ? "Choose saved voiceover" : "Choose saved audio"} voiceoverOnly={demoSoundDetails} icon={<FolderOpen className="size-4" aria-hidden="true" />} /> : null}
    </div>
    {demoAudio.asset ? <p className="truncate text-xs text-muted" title={demoAudio.asset.name}>{demoAudio.asset.name}</p> : null}
    {!demo.asset ? <p id={`${kind}-demo-audio-help`} className="text-xs leading-5 text-muted">Add a demo to choose its {demoAudioWord}.</p> : null}
  </>;

  return <section aria-label="Video finishing settings" className={creation.composition}>
    <h2 className="sr-only">Edit &amp; add demo</h2>
    <p className="sr-only">Keep your video on its own, or add a demo after it.</p>
    <div className={creation.editMediaGrid}>
      <section hidden={demoInPreview} aria-label="Demo upload" className={creation.uploadCard} data-selected={!!demo.asset} aria-busy={demo.loading} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void demo.choose(file);
      }}>
        <div className={creation.finishRow}>
          <h3 className="text-sm font-medium">Demo upload</h3>
          {demo.asset ? <RemoveMediaButton label="demo" onClick={demo.remove} /> : null}
        </div>
        {demoSourceTiles ? <>
          {demo.asset ? <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 flex-[1_1_12rem] truncate text-xs text-muted" title={demo.asset.name}>{demo.asset.name}</p>
            {demoSourceActions}
          </div> : <div className={creation.demoSourceTiles}>
            <button type="button" className={creation.demoSourceTile} disabled={demo.loading || editingBusy} onClick={() => demoInput.current?.click()}>
              <span className={creation.demoSourceTileIcon} aria-hidden="true"><Upload className="size-5" /></span>
              <span>Upload demo</span>
            </button>
            <button type="button" className={creation.demoSourceTile} disabled={demo.loading || editingBusy} onClick={onChooseSavedDemo}>
              <span className={creation.demoSourceTileIcon} aria-hidden="true"><FolderOpen className="size-5" /></span>
              <span>Saved demos</span>
            </button>
            <input ref={demoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" aria-label="Upload demo video" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file && !editingBusy) void demo.choose(file); }} />
          </div>}
          {demo.asset && demoFraming && onDemoFramingChange ? <div className="space-y-2"><p className="text-xs leading-5 text-muted">This saved demo uses legacy framing.</p><Button type="button" variant="ghost" size="sm" disabled={editingBusy} onClick={() => onDemoFramingChange(null)}>Reset demo framing</Button></div> : null}
        </> : demoSourceActions ?? (demo.asset ? <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" className={creation.demoPreviewAction} aria-label="Preview demo" title={demo.asset.name} />}>
            <Play className="size-3.5" aria-hidden="true" />
            <span>Preview demo</span>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
            <PopoverTitle>Demo preview</PopoverTitle>
            <WorkflowMediaPlayer asset={demo.asset} kind="video" label="Demo preview" className="mx-auto aspect-auto h-auto max-h-[50dvh] w-auto max-w-full bg-transparent" />
            <p className="text-sm text-muted">{formatMediaSeconds(demo.asset.duration)} · Original sound preserved</p>
            <WorkflowFilePicker attachment={demo} kind="video" label="Replace demo" className="h-9 text-sm" />
          </PopoverContent>
        </Popover> : <WorkflowFilePicker attachment={demo} kind="video" label="Upload demo video" buttonLabel="Upload demo" className={creation.editUploadButton} icon={<span className={creation.iconWell}><Video className="size-5" aria-hidden="true" /></span>} />)}
        {!demoSourceTiles ? (demo.asset ? <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="min-w-0 flex-[1_1_12rem] truncate text-xs text-muted" title={demo.asset.name}>{demo.asset.name}</p>
          {!demoSourceActions ? <WorkflowFilePicker attachment={demo} kind="video" label="Replace demo video" buttonLabel="Replace demo" disabled={editingBusy} className="h-9 text-xs" /> : null}
          {demoFramingEnabled && onDemoFramingChange ? <WorkflowDemoControls key={`${demo.asset.url}:${outputAspect}`} asset={demo.asset} value={demoFraming} onChange={onDemoFramingChange} outputAspect={outputAspect} disabled={editingBusy} onOpen={onDemoControlsOpen} /> : null}
        </div> : <p className="sr-only">Add or drop a walkthrough to play after your {videoLabel.toLowerCase()}.</p>) : null}
        {!demoSourceTiles && demoFramingEnabled && demo.asset && onDemoFramingChange && demoFramingError ? <p role="alert" className="text-xs text-destructive">{demoFramingError} <button type="button" className="underline" disabled={editingBusy} onClick={() => onDemoFramingChange(null)}>Reset framing</button></p> : null}
        {demo.error ? <p role="alert" className="text-sm text-destructive">{demo.error}</p> : null}
      </section>
      {demoInPreview ? <><div><h2 className={creation.sectionTitle}>Final video settings</h2><p className={creation.sectionHelp}>Edit your clips in the preview. Choose audio and subtitles here.</p></div>{demoFramingEnabled && demo.asset && onDemoFramingChange ? <WorkflowDemoControls key={`${demo.asset.url}:${outputAspect}`} asset={demo.asset} value={demoFraming} onChange={onDemoFramingChange} outputAspect={outputAspect} disabled={editingBusy} onOpen={onDemoControlsOpen} /> : null}{demoFramingError ? <p role="alert" className="text-xs text-destructive">{demoFramingError}</p> : null}</> : null}
      <section aria-label={`${demoAudioName} attachment`} className={creation.uploadCard} data-selected={!!demoAudio.asset} aria-busy={demoAudio.loading} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (demo.asset && event.dataTransfer.files[0]) void demoAudio.choose(event.dataTransfer.files[0]); }}>
        {demoSoundDetails ? <details className={creation.demoSoundDetails} open aria-label="Demo voiceover">
          <summary>Demo voiceover <span>{demoAudio.asset ? "Voiceover added" : "Optional"}</span></summary>
          <div className="mt-3 space-y-3">
            {demoSoundBody}
          </div>
        </details> : <>
          <div className={creation.finishRow}>
            <h3 className="text-sm font-medium">Demo sound <span className="ml-1 text-xs font-normal text-muted">Optional</span></h3>
            {demoAudio.asset ? <RemoveMediaButton label="demo audio" onClick={demoAudio.remove} /> : null}
          </div>
          {demoSoundBody}
        </>}
      </section>
    </div>
    <section aria-label={`${demoAudioName} details`} className={demo.asset ? creation.demoAudioDetails : "sr-only"}>
      <h3 className="sr-only">{demoAudioName}</h3>
      {demoAudio.asset ? <WorkflowMediaPlayer asset={demoAudio.asset} kind="audio" label={`${demoAudioName} preview`} /> : null}
      {demo.asset ? <>
        {demoAudio.error ? <p role="alert" className="text-sm text-destructive">{demoAudio.error}</p> : null}
        {demoAudio.asset ? <>
          <div role="group" aria-label={connected ? `${demoAudioName} playback` : `${demoAudioName} playback (local draft only)`} aria-describedby={timingHelpId} className="flex flex-wrap gap-2">
            {(["once", "repeat"] as const).map((playback) => <Button key={playback} type="button" variant={demoAudioPlayback === playback ? "muted" : "outline"} className="h-8 text-xs" aria-pressed={demoAudioPlayback === playback}
              disabled={demoAudio.loading} onClick={() => onDemoAudioPlaybackChange(playback)} title={connected ? "Apply edits to save this playback setting" : "Local draft preference; not applied to a video yet"}>{playback === "once" ? "Play once" : demoSoundDetails ? "Repeat voiceover" : "Repeat music"}</Button>)}
          </div>
          <p id={timingHelpId} className="text-xs leading-5 text-muted" role={timing.error ? "alert" : undefined}>{timing.message}{!connected && " Timing preference only; combined playback is not connected yet."}</p>
        </> : null}
        <div className={creation.finishRow}>
          <p className={creation.sectionHelp}>{demoSoundDetails ? "The demo voiceover plays during the demo only." : "Added audio plays during the demo only."}</p>
          <Popover>
            <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`${demoAudioName} details`} className={creation.helpButton} />}><Info className="size-4" aria-hidden="true" /></PopoverTrigger>
            <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
              <PopoverTitle>{demoAudioName}</PopoverTitle>
              {demoSoundDetails ? <>
                <p className="text-sm leading-6 text-muted">The demo voiceover belongs to the demo only—not your {videoLabel.toLowerCase()} or its generation voice reference.</p>
                <p className="text-sm leading-6 text-muted">The demo voiceover is optional. Your demo’s original sound is kept. The voiceover is mixed underneath it during the demo only.</p>
                <p className="text-sm leading-6 text-muted">Longer voiceover fades out at the demo’s end. Shorter voiceover plays once unless you select Repeat voiceover. Use Repeat voiceover for loopable audio, not spoken recordings. Only the added voiceover is fitted; your video and source files are unchanged.</p>
                <p className="text-sm leading-6 text-muted">Replacing or removing the demo also clears its selected voiceover. {connected ? "Apply edits to save the combined playback; review it in your finished video." : "These local audio/video previews are separate; combined playback is not connected yet."}</p>
              </> : <>
                <p className="text-sm leading-6 text-muted">Added audio belongs to the demo only—not your {videoLabel.toLowerCase()} or its generation voice reference.</p>
                <p className="text-sm leading-6 text-muted">Demo audio is optional. Your demo’s original sound is kept. Uploaded audio is mixed underneath it as background audio during the demo only.</p>
                <p className="text-sm leading-6 text-muted">Longer audio fades out at the demo’s end. Shorter audio plays once unless you select Repeat music. Use Repeat music for loopable music, not spoken recordings. Only the added audio is fitted; your video and source files are unchanged.</p>
                <p className="text-sm leading-6 text-muted">Replacing or removing the demo also clears its selected audio. {connected ? "Apply edits to save the combined playback; review it in your finished video." : "These local audio/video previews are separate; combined playback is not connected yet."}</p>
              </>}
            </PopoverContent>
          </Popover>
        </div>
      </> : <p id={`${kind}-demo-audio-help`}>Add a demo to choose its {demoAudioWord}.</p>}
    </section>
    <section aria-label="Background music" className={creation.editGroup}>
      {connected && options && onOptionsChange ? <div className={creation.finishRow}>
        <span className="text-sm font-medium">Background music</span>
        <button type="button" role="switch" aria-label="Background music" aria-checked={options.backgroundMusic} aria-describedby={unavailableId} disabled={editingBusy || backgroundMusic?.attachment.loading} className={creation.backgroundAudioSwitch} onClick={() => onOptionsChange({ ...options, backgroundMusic: !options.backgroundMusic })}>
          <span className={creation.backgroundAudioTrack} aria-hidden="true"><span className={creation.backgroundAudioThumb} /></span>
        </button>
      </div> : <UnavailableToggle label="Background music" descriptionId={unavailableId} />}
      {backgroundMusic ? <div className="mt-2 space-y-2">
        <p className="text-xs text-muted">Plays across your video. Turn on to use the default track, or choose your own music.</p>
        <div className="flex flex-wrap gap-2">
          <WorkflowFilePicker attachment={backgroundMusic.attachment} kind="audio" label="Upload whole-video background music" buttonLabel={backgroundMusic.source ? "Replace music" : "Upload music"} icon={<Upload className="size-4" aria-hidden="true" />} disabled={!connected || editingBusy} />
          <WorkflowBackgroundAudioPicker ownerId={ownerId ?? null} attachment={backgroundMusic.attachment} onChoose={backgroundMusic.choose} disabled={editingBusy} localPreview={!connected} />
        </div>
        {backgroundMusic.source ? <>
          <p className="truncate text-xs text-muted" title={backgroundMusic.source.title}>{backgroundMusic.source.title}</p>
          <audio src={backgroundMusic.source.url} controls preload="metadata" className="h-8 w-full" aria-label="Whole-video music preview" />
          <div className="flex flex-wrap items-center justify-between gap-2"><label className="text-xs text-muted">Playback <select aria-label="Whole-video music playback" disabled={editingBusy || backgroundMusic.attachment.loading} value={backgroundMusic.playback} onChange={event => backgroundMusic.setPlayback(event.target.value as "once" | "repeat")} className="h-8 rounded-lg border border-border bg-card px-2 text-xs"><option value="repeat">Repeat to fit</option><option value="once">Play once</option></select></label><Button type="button" variant="ghost" size="sm" disabled={editingBusy} onClick={backgroundMusic.attachment.remove}>Remove music</Button></div>
        </> : options?.backgroundAssetId ? <Button type="button" variant="ghost" size="sm" disabled={editingBusy} onClick={backgroundMusic.attachment.remove}>Remove unavailable music</Button> : options?.backgroundMusic ? <p className="text-xs text-muted">Default music selected</p> : null}
        {backgroundMusic.attachment.error ? <p role="alert" className="text-xs text-destructive">{backgroundMusic.attachment.error}</p> : null}
        {backgroundMusic.attachment.loading ? <p role="status" className="text-xs text-muted">Loading background music…</p> : null}
      </div> : null}
    </section>

    <section aria-label="Subtitles" className={creation.editGroup}>
      <div className={creation.finishRow}>
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-medium">Subtitles</h3>
          <Popover>
            <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Subtitle scope" className={creation.helpButton} />}><Info className="size-4" aria-hidden="true" /></PopoverTrigger>
            <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
              <PopoverTitle>Auto subtitles</PopoverTitle>
              <p className="text-sm leading-6 text-muted">{EXPLORE_SUBTITLE_SCOPE_LABEL}. This includes your {videoLabel.toLowerCase()} and demo together. Nothing is trimmed automatically.</p>
              <p className="text-sm leading-6 text-muted">{connected ? "Turn on subtitles, generate captions and correct their words before preparing your final video." : "Choose a style and play its example. Rendering is not connected in this preview."}</p>
            </PopoverContent>
          </Popover>
        </div>
        {connected && options && onOptionsChange ? <Button type="button" role="switch" aria-label="Auto subtitles" aria-checked={options.subtitles} variant="muted" className="h-7 px-3 text-xs" onClick={() => onOptionsChange({ ...options, subtitles: !options.subtitles })}>{options.subtitles ? "On" : "Off"}</Button> : <UnavailableToggle label="Auto subtitles" descriptionId={unavailableId} hideLabel />}
      </div>
      <details ref={subtitleAppearance} className={cn(sections.optionalGroup, sections.subtitleAppearance)}>
        <summary>Subtitle appearance <span className={sections.groupSummary}>{SUBTITLE_STYLES.find(style => style.id === selectedStyle)?.label}</span></summary>
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={connected ? "Subtitle style samples" : "Subtitle style samples (local preview only)"} aria-describedby={subtitleHelpId} className={creation.subtitleChoices}>
            {SUBTITLE_STYLES.map((style) => <button key={style.id} type="button" aria-label={`${style.label} subtitle style`} aria-pressed={selectedStyle === style.id} aria-describedby={subtitleHelpId}
              title={style.description} className={creation.subtitleChoice} data-style={style.id} onClick={() => { setSubtitleStyle(style.id); if (options && onOptionsChange) onOptionsChange({ ...options, style: style.id }); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={subtitlePreview(style.id).poster} alt="" loading="lazy" className="aspect-[9/8] w-full rounded-md bg-black object-cover object-bottom" />
              <span className={creation.subtitleChoiceLabel}>{style.label}{selectedStyle === style.id ? <Check className="size-3.5" aria-hidden="true" /> : null}</span>
            </button>)}
          </div>
          <WorkflowSubtitlePreview style={selectedStyle} onCollapse={() => {
            if (subtitleAppearance.current) {
              subtitleAppearance.current.open = false;
              subtitleAppearance.current.querySelector("summary")?.focus();
            }
          }} />
        </div>
      </details>
      {options?.subtitles && captions ? <WorkflowCaptionEditor captions={captions} disabled={editingBusy} /> : null}
      {options?.subtitles || !connected ? <div className={creation.captionPosition}>
        <span className="text-xs font-medium">Caption position</span>
        <div role="group" aria-label="Caption position" className={creation.captionPositionChoices}>
          {(["bottom", "middle", "top"] as const).map(placement => <Button key={placement} type="button" variant="ghost"
            disabled={editingBusy} aria-pressed={selectedPlacement === placement} onClick={() => {
              setSubtitlePlacement(placement);
              if (options && onOptionsChange) onOptionsChange({ ...options, placement });
            }}>{placement === "bottom" ? "Bottom" : placement === "middle" ? "Middle" : "Top"}</Button>)}
        </div>
      </div> : null}
      <p id={subtitleHelpId} className="sr-only">Selecting a style changes your draft only. These rendered examples use the same clip and transcript at Bottom position. Apply edits saves subtitles from your final audio. {EXPLORE_SUBTITLE_SCOPE_LABEL}, including both segments; nothing is trimmed automatically.</p>
    </section>
    <p id={unavailableId} className="sr-only">{connected ? backgroundMusic ? "Background music plays underneath the entire video and keeps the original speech. Choose a library track or upload music. With no custom selection, On uses the approved default track. Off retains your selection; Remove music clears it. Separately selected demo voiceover plays during the demo only." : "Off keeps original sound without adding the default track. On adds the approved default track underneath the original hook and demo sound when you Apply edits. Separately selected demo voiceover plays during the demo only. If no approved default is configured, Apply edits will explain this; it never chooses unreviewed music." : "Music and subtitle rendering are not connected in this local preview."}</p>
  </section>;
}

function demoAudioTiming(demoSeconds: number | null | undefined, audioSeconds: number | null | undefined, playback: ExploreBackgroundPlayback, voiceover = false) {
  if (demoSeconds == null || audioSeconds == null) return { error: false, message: `${voiceover ? "Demo voiceover" : "Audio"} timing will use the measured demo duration.` };
  try {
    const timing = planExploreBackgroundAudio(audioSeconds * 1000, demoSeconds * 1000, playback);
    const added = voiceover ? "The demo voiceover" : "Added audio";
    return { error: false, message: timing.fit === "trim" ? `${added} will fade out at the demo’s end.`
      : timing.fit === "loop" ? `${voiceover ? "The demo voiceover" : "Music"} will repeat to cover the demo, then fade out.`
      : timing.fit === "pad" ? `${added} will play once and fade out; original demo sound continues.`
      : `${added} will cover the demo and fade out.` };
  } catch (error) {
    return { error: true, message: error instanceof Error ? error.message : "Choose playable audio and a valid demo." };
  }
}

/** Disabled controls cannot imply output changes before rendering is connected. */
function UnavailableToggle({ label, descriptionId, hideLabel = false }: { label: string; descriptionId: string; hideLabel?: boolean }) {
  return <div className={creation.finishRow}>
    <span className={hideLabel ? "sr-only" : "text-sm font-medium"}>{label}</span>
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" role="switch" aria-label={label} aria-checked={false} aria-describedby={descriptionId} disabled variant="muted" className="h-6 w-10 rounded-full bg-muted/30 p-0.5">
        <span className="mr-auto size-5 rounded-full bg-foreground/70" aria-hidden="true" />
      </Button>
      <span className="text-xs text-muted">Off</span>
    </div>
  </div>;
}
