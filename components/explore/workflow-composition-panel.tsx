"use client";

import { AudioLines, Check, Info, Play, Video } from "lucide-react";
import { useState } from "react";

import { RemoveMediaButton, WorkflowFilePicker, WorkflowMediaPlayer, formatMediaSeconds, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import creation from "@/components/explore/workflow-creation.module.css";
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

const SUBTITLE_STYLES = SUBTITLE_STYLE_REGISTRY;

/** Editing is separate from creation and scheduling; attachment ownership stays above. */
export function WorkflowCompositionPanel({ videoLabel, demo, demoAudio, demoAudioPlayback, onDemoAudioPlaybackChange, connected = false, options, onOptionsChange, ownerId, demoFramingEnabled = false, demoFraming = null, onDemoFramingChange, outputAspect = 9 / 16, editingBusy = false, demoFramingError = null, onDemoControlsOpen }: {
  videoLabel: "Hook" | "Phone video";
  demo: WorkflowAttachment;
  demoAudio: WorkflowAttachment;
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
}) {
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("clean");
  const [subtitlePlacement, setSubtitlePlacement] = useState<"bottom" | "middle" | "top">("bottom");
  const selectedStyle = options?.style ?? subtitleStyle;
  const selectedPlacement = options?.placement ?? subtitlePlacement;
  const kind = videoLabel === "Hook" ? "hook" : "phone";
  const unavailableId = `${kind}-finishing-unavailable`;
  const subtitleHelpId = `${kind}-subtitle-style-help`;
  const timingHelpId = `${kind}-demo-audio-timing`;
  const timing = demoAudioTiming(demo.asset?.duration, demoAudio.asset?.duration, demoAudioPlayback);

  return <section aria-label="Video finishing settings" className={creation.composition}>
    <h2 className="sr-only">Edited demo</h2>
    <p className="sr-only">Keep your video on its own, or add a demo after it.</p>
    <div className={creation.editMediaGrid}>
      <section aria-label="Optional demo" className={creation.uploadCard} data-selected={!!demo.asset} aria-busy={demo.loading} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void demo.choose(file);
      }}>
        <div className={creation.finishRow}>
          <h3 className="text-sm font-medium">Demo <span className="ml-1 text-xs font-normal text-muted">Optional</span></h3>
          {demo.asset ? <RemoveMediaButton label="demo" onClick={demo.remove} /> : null}
        </div>
        {demo.asset ? <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" className={creation.editUploadButton} aria-label="Preview demo" title={demo.asset.name} />}>
            <span className={creation.iconWell}><Play className="size-5" aria-hidden="true" /></span>
            <span>Preview demo</span><Check className={creation.referenceCheck} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
            <PopoverTitle>Demo preview</PopoverTitle>
            <WorkflowMediaPlayer asset={demo.asset} kind="video" label="Demo preview" className="mx-auto aspect-auto h-auto max-h-[50dvh] w-auto max-w-full bg-transparent" />
            <p className="text-sm text-muted">{formatMediaSeconds(demo.asset.duration)} · Original sound preserved</p>
            <WorkflowFilePicker attachment={demo} kind="video" label="Replace demo" className="h-9 text-sm" />
          </PopoverContent>
        </Popover> : <WorkflowFilePicker attachment={demo} kind="video" label="Add demo" className={creation.editUploadButton} icon={<span className={creation.iconWell}><Video className="size-5" aria-hidden="true" /></span>} />}
        {demo.asset ? <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="min-w-0 flex-[1_1_12rem] truncate text-xs text-muted" title={demo.asset.name}>{demo.asset.name}</p>
          {demoFramingEnabled && onDemoFramingChange ? <WorkflowDemoControls key={`${demo.asset.url}:${outputAspect}`} asset={demo.asset} value={demoFraming} onChange={onDemoFramingChange} outputAspect={outputAspect} disabled={editingBusy} onOpen={onDemoControlsOpen} /> : null}
        </div> : <p className="sr-only">Add or drop a walkthrough to play after your {videoLabel.toLowerCase()}.</p>}
        {demoFramingEnabled && demo.asset && onDemoFramingChange && demoFramingError ? <p role="alert" className="text-xs text-destructive">{demoFramingError} <button type="button" className="underline" disabled={editingBusy} onClick={() => onDemoFramingChange(null)}>Reset framing</button></p> : null}
        {demo.error ? <p role="alert" className="text-sm text-destructive">{demo.error}</p> : null}
      </section>
      <section aria-label="Demo audio attachment" className={creation.uploadCard} data-selected={!!demoAudio.asset} aria-busy={demoAudio.loading} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (demo.asset && event.dataTransfer.files[0]) void demoAudio.choose(event.dataTransfer.files[0]); }}>
        <div className={creation.finishRow}>
          <h3 className="text-sm font-medium">Demo audio <span className="ml-1 text-xs font-normal text-muted">Optional</span></h3>
          {demoAudio.asset ? <RemoveMediaButton label="demo audio" onClick={demoAudio.remove} /> : null}
        </div>
        {demo.asset ? <WorkflowFilePicker attachment={demoAudio} kind="audio" label={demoAudio.asset ? "Replace demo audio" : "Select demo audio"} buttonLabel={demoAudio.asset ? "Replace audio" : "Select audio"} className={cn(creation.editUploadButton, creation.editAudioButton)} icon={<><AudioLines className="size-5" aria-hidden="true" />{demoAudio.asset ? <Check className={creation.referenceCheck} aria-hidden="true" /> : null}</>} />
          : <Button type="button" variant="outline" disabled aria-label="Select demo audio" aria-describedby={`${kind}-demo-audio-help`} className={cn(creation.editUploadButton, creation.editAudioButton)}><AudioLines className="size-5" aria-hidden="true" />Select audio</Button>}
        {demoAudio.asset ? <p className="truncate text-xs text-muted" title={demoAudio.asset.name}>{demoAudio.asset.name}</p> : null}
        {connected && ownerId ? <WorkflowSavedAudioPicker ownerId={ownerId} attachment={demoAudio} disabled={!demo.asset} /> : null}
      </section>
    </div>
    <section aria-label="Demo audio details" className={demo.asset ? creation.demoAudioDetails : "sr-only"}>
      <h3 className="sr-only">Demo audio</h3>
      {demoAudio.asset ? <WorkflowMediaPlayer asset={demoAudio.asset} kind="audio" label="Demo audio preview" /> : null}
      {demo.asset ? <>
        {demoAudio.error ? <p role="alert" className="text-sm text-destructive">{demoAudio.error}</p> : null}
        {demoAudio.asset ? <>
          <div role="group" aria-label={connected ? "Demo audio playback" : "Demo audio playback (local draft only)"} aria-describedby={timingHelpId} className="flex flex-wrap gap-2">
            {(["once", "repeat"] as const).map((playback) => <Button key={playback} type="button" variant={demoAudioPlayback === playback ? "muted" : "outline"} className="h-8 text-xs" aria-pressed={demoAudioPlayback === playback}
              disabled={demoAudio.loading} onClick={() => onDemoAudioPlaybackChange(playback)} title={connected ? "Apply edits to save this playback setting" : "Local draft preference; not applied to a video yet"}>{playback === "once" ? "Play once" : "Repeat music"}</Button>)}
          </div>
          <p id={timingHelpId} className="text-xs leading-5 text-muted" role={timing.error ? "alert" : undefined}>{timing.message}{!connected && " Timing preference only; combined playback is not connected yet."}</p>
        </> : null}
        <div className={creation.finishRow}>
          <p className={creation.sectionHelp}>Added audio plays during the demo only.</p>
          <Popover>
            <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Demo audio details" className={creation.helpButton} />}><Info className="size-4" aria-hidden="true" /></PopoverTrigger>
            <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
              <PopoverTitle>Demo audio</PopoverTitle>
              <p className="text-sm leading-6 text-muted">Added audio belongs to the demo only—not your {videoLabel.toLowerCase()} or its generation voice reference.</p>
              <p className="text-sm leading-6 text-muted">Demo audio is optional. Your demo’s original sound is kept. Uploaded audio is mixed underneath it as background audio during the demo only.</p>
              <p className="text-sm leading-6 text-muted">Longer audio fades out at the demo’s end. Shorter audio plays once unless you select Repeat music. Use Repeat music for loopable music, not spoken recordings. Only the added audio is fitted; your video and source files are unchanged.</p>
              <p className="text-sm leading-6 text-muted">Replacing or removing the demo also clears its selected audio. {connected ? "Apply edits to save the combined playback; review it in your finished video." : "These local audio/video previews are separate; combined playback is not connected yet."}</p>
            </PopoverContent>
          </Popover>
        </div>
      </> : <p id={`${kind}-demo-audio-help`}>Add a demo to choose its audio.</p>}
    </section>
    <section aria-label="Background music" className={creation.editGroup}>
      {connected && options && onOptionsChange ? <div className={creation.finishRow}>
        <span className="text-sm font-medium">Background music</span>
        <Button type="button" role="switch" aria-label="Background music" aria-checked={options.backgroundMusic} aria-describedby={unavailableId} variant="muted" className="h-7 rounded-full px-3 text-xs" onClick={() => onOptionsChange({ ...options, backgroundMusic: !options.backgroundMusic })}>{options.backgroundMusic ? "On" : "Off"}</Button>
      </div> : <UnavailableToggle label="Background music" descriptionId={unavailableId} />}
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
              <p className="text-sm leading-6 text-muted">Choose a style and play its example. Turn on subtitles and Apply edits to save captions on your video.</p>
            </PopoverContent>
          </Popover>
        </div>
        {connected && options && onOptionsChange ? <Button type="button" role="switch" aria-label="Auto subtitles" aria-checked={options.subtitles} variant="muted" className="h-7 rounded-full px-3 text-xs" onClick={() => onOptionsChange({ ...options, subtitles: !options.subtitles })}>{options.subtitles ? "On" : "Off"}</Button> : <UnavailableToggle label="Auto subtitles" descriptionId={unavailableId} hideLabel />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium">Position</span>
        <div role="group" aria-label="Subtitle position" className="flex gap-1">
          {(["bottom", "middle", "top"] as const).map(placement => <Button key={placement} type="button"
            variant={selectedPlacement === placement ? "muted" : "outline"} className="h-8 px-3 text-xs"
            aria-pressed={selectedPlacement === placement} onClick={() => {
              setSubtitlePlacement(placement);
              if (options && onOptionsChange) onOptionsChange({ ...options, placement });
            }}>{placement === "bottom" ? "Bottom" : placement === "middle" ? "Middle" : "Top"}</Button>)}
        </div>
      </div>
      <div role="group" aria-label={connected ? "Subtitle style samples" : "Subtitle style samples (local preview only)"} aria-describedby={subtitleHelpId} className={creation.subtitleChoices}>
        {SUBTITLE_STYLES.map((style) => <button key={style.id} type="button" aria-label={`${style.label} subtitle style`} aria-pressed={selectedStyle === style.id} aria-describedby={subtitleHelpId}
          title={style.description} className={creation.subtitleChoice} data-style={style.id} onClick={() => { setSubtitleStyle(style.id); if (options && onOptionsChange) onOptionsChange({ ...options, style: style.id }); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={subtitlePreview(style.id).poster} alt="" loading="lazy" className="aspect-[9/8] w-full rounded-md bg-black object-cover object-bottom" />
          <span className={creation.subtitleChoiceLabel}>{style.label}{selectedStyle === style.id ? <Check className="size-3.5" aria-hidden="true" /> : null}</span>
        </button>)}
      </div>
      <WorkflowSubtitlePreview style={selectedStyle} />
      <p id={subtitleHelpId} className="sr-only">Selecting a style changes your draft only. These rendered examples use the same clip and transcript at Bottom position. Apply edits saves subtitles from your final audio. {EXPLORE_SUBTITLE_SCOPE_LABEL}, including both segments; nothing is trimmed automatically.</p>
    </section>
    <p id={unavailableId} className="sr-only">{connected ? "Off keeps original sound without adding default music. On adds the approved default track underneath the original hook and demo sound when you Apply edits. Separately selected demo audio plays during the demo only. If no approved default is configured, Apply edits will explain this; it never chooses unreviewed music." : "Music and subtitle rendering are not connected in this local preview."}</p>
  </section>;
}

function demoAudioTiming(demoSeconds: number | null | undefined, audioSeconds: number | null | undefined, playback: ExploreBackgroundPlayback) {
  if (demoSeconds == null || audioSeconds == null) return { error: false, message: "Audio timing will use the measured demo duration." };
  try {
    const timing = planExploreBackgroundAudio(audioSeconds * 1000, demoSeconds * 1000, playback);
    return { error: false, message: timing.fit === "trim" ? "Added audio will fade out at the demo’s end."
      : timing.fit === "loop" ? "Music will repeat to cover the demo, then fade out."
      : timing.fit === "pad" ? "Added audio will play once and fade out; original demo sound continues."
      : "Added audio will cover the demo and fade out." };
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
