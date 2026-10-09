"use client";

import Image from "next/image";
import { Check, UserRound, Video } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowAudioReference, type WorkflowAudioReferenceProps } from "@/components/explore/workflow-audio-reference";
import { AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { cn } from "@/lib/utils";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";

// Existing local-preview choices, not a verified provider capability matrix.
const MODELS = [{ value: "seedance_2_5", label: "Seedance 2.5" }, { value: "google_omni", label: "Google Omni" }] as const;
const DURATIONS = [4, 5, 6, 7, 8, 9, 10].map((seconds) => ({ value: String(seconds), label: `${seconds} sec` }));
const OUTPUTS = [1, 2, 4].map((count) => ({ value: String(count), label: `${count} video${count > 1 ? "s" : ""}` }));
const QUALITIES = [{ value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }];
const RATIOS = [{ value: "9:16", label: "9:16" }, { value: "16:9", label: "16:9" }];

export type WorkflowCreationFormProps = WorkflowAudioReferenceProps & {
  instructions: string;
  onInstructionsChange: (value: string) => void;
  creator: WorkflowAttachment;
  videoReference: WorkflowAttachment;
  initialDuration?: number;
};

/** One mounted form at every size. Only the user can change instructions. */
export function WorkflowCreationForm({ kind, instructions, onInstructionsChange, creator, videoReference, audio, audioLabel, audioMode, onAudioModeChange, appScreenControl, initialDuration = 5 }: WorkflowCreationFormProps & {
  kind: "hook" | "phone";
  appScreenControl?: ReactNode;
}) {
  const promptId = useId();
  const helperId = useId();
  const [model, setModel] = useState("seedance_2_5");
  const [duration, setDuration] = useState(String(initialDuration));
  const [outputs, setOutputs] = useState("1");
  const [quality, setQuality] = useState("720p");
  const [ratio, setRatio] = useState("9:16");
  const prefix = kind === "hook" ? "Hook" : "Phone video";

  return <section aria-label={kind === "hook" ? "Hook composer" : "Phone video composer"} className={creation.composer}>
    <h2 className="sr-only">Create</h2>
    {appScreenControl ? <section aria-label="App screen input" className={creation.finishRow}>
      <h3 className="text-sm font-medium">Inside the phone</h3>
      {appScreenControl}
    </section> : null}
    <section aria-label="Optional references" className="space-y-2">
      <p className="text-xs text-muted">Optional references</p>
      <div className={creation.referenceGrid}>
        <CreatorPicker creator={creator} />
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" aria-label="Choose video reference" aria-busy={videoReference.loading} data-state={videoReference.loading ? "loading" : videoReference.error ? "error" : videoReference.asset ? "selected" : "empty"} title={videoReference.asset?.name ?? "Choose an optional video reference"} className={creation.referenceButton} />}>
            {videoReference.asset ? <ReferenceVideoThumbnail url={videoReference.asset.url} /> : <Video className="size-5" aria-hidden="true" />}
            <span className={creation.referenceLabel}>Video reference</span>{videoReference.asset ? <Check className={creation.referenceCheck} aria-label="Video attached" /> : null}
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
            <PopoverTitle>Video reference</PopoverTitle>
            <p className="text-sm leading-6 text-muted">Optional. Your instructions decide how this video is used.</p>
            {videoReference.asset ? <><WorkflowMediaPlayer asset={videoReference.asset} kind="video" label="Video reference preview" className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" /><p className="break-all text-xs text-muted">{videoReference.asset.name}</p></> : null}
            <WorkflowFilePicker attachment={videoReference} kind="video" label={videoReference.asset ? "Replace video reference" : "Attach video reference"} className="h-9 text-sm" />
            {videoReference.asset ? <Button type="button" variant="ghost" aria-label="Remove video reference" className="h-9 rounded-lg text-sm" onClick={videoReference.remove}>Remove video</Button> : null}
            {videoReference.error ? <p role="alert" className="text-sm text-destructive">{videoReference.error}</p> : null}
          </PopoverContent>
        </Popover>
        <WorkflowAudioReference audio={audio} audioLabel={audioLabel} audioMode={audioMode} onAudioModeChange={onAudioModeChange} />
      </div>
      {creator.loading || videoReference.loading || audio.loading ? <p role="status" className={creation.sectionHelp}>Reading your reference…</p> : null}
      {creator.error || videoReference.error || audio.error ? <p role="alert" className="text-xs leading-5 text-destructive">{creator.error || videoReference.error || audio.error}</p> : null}
    </section>

    <div className={creation.instructionsField}>
      <label htmlFor={promptId} className="block text-sm font-medium">Your instructions</label>
      <textarea id={promptId} name={`${kind}Instructions`} autoComplete="off" rows={4} value={instructions}
        onChange={(event) => onInstructionsChange(event.target.value)}
        placeholder={kind === "hook" ? "Example: A creator looks into the camera and says, “Still planning your day in five apps? Try this instead.” Use natural lighting, a close-up shot, and a casual, friendly tone." : "Example: A creator holds a phone toward the camera and says, “This app keeps my day in one place.” Show the attached app screen inside the phone. Use natural lighting and a casual, friendly delivery."} aria-describedby={helperId}
        className={creation.prompt} />
    </div>
    <p id={helperId} className="sr-only">Nothing is prefilled or rewritten. Your instructions stay unchanged.</p>

    <div role="group" aria-label={`${prefix} generation settings`} className={creation.settingsGrid}>
      <SettingField label="Model"><AiStudioSettingSelect ariaLabel={`${prefix} model`} value={model} onChange={setModel} options={MODELS} /></SettingField>
      <SettingField label="Duration"><AiStudioSettingSelect ariaLabel={`${prefix} duration`} value={duration} onChange={setDuration} options={DURATIONS} /></SettingField>
      <SettingField label="Quality"><AiStudioSettingSelect ariaLabel={`${prefix} quality`} value={quality} onChange={setQuality} options={QUALITIES} /></SettingField>
      <SettingField label="Videos"><AiStudioSettingSelect ariaLabel={kind === "hook" ? "Number of hook videos" : "Number of phone videos"} value={outputs} onChange={setOutputs} options={OUTPUTS} /></SettingField>
      <SettingField label="Ratio"><AiStudioSettingSelect ariaLabel={`${prefix} aspect ratio`} value={ratio} onChange={setRatio} options={RATIOS} /></SettingField>
    </div>
  </section>;
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return <div className={creation.settingField}><span className="text-sm font-medium">{label}</span>{children}</div>;
}

function CreatorPicker({ creator }: { creator: WorkflowAttachment }) {
  const [open, setOpen] = useState(false);
  const selected = CREATOR_REFERENCES.find((reference) => reference.src === creator.asset?.url);
  const label = selected ? `Creator ${CREATOR_REFERENCES.indexOf(selected) + 1}` : creator.asset ? "Custom creator" : "Creator";
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className={creation.referenceButton} aria-busy={creator.loading} data-state={creator.loading ? "loading" : creator.error ? "error" : creator.asset ? "selected" : "available"} title={creator.asset?.name ?? "Choose an optional creator image"} aria-label={`Choose image, currently ${creator.asset ? label : "none selected"}`} />}>
      {creator.asset ? <Image src={creator.asset.url} alt="" fill unoptimized sizes="110px" className={creation.referenceMedia} /> : <>
        {CREATOR_REFERENCES[0] ? <Image src={CREATOR_REFERENCES[0].src} alt="" fill sizes="110px" aria-hidden="true" className={creation.referenceAvailable} /> : null}
        <UserRound className="relative size-5" aria-hidden="true" />
      </>}
      <span className={creation.referenceLabel}>Choose image</span>{creator.asset ? <Check className={creation.referenceCheck} aria-label="Creator attached" /> : null}
    </PopoverTrigger>
    <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
      <PopoverTitle>Choose image</PopoverTitle>
      <p className="text-sm leading-6 text-muted">Optional creator image. Your instructions decide how the creator appears.</p>
      <div className="flex flex-wrap items-center gap-2"><WorkflowFilePicker attachment={creator} kind="image" label="Upload creator" className="h-9 text-sm" /><Button type="button" variant="ghost" aria-label="Remove creator" className="h-9 rounded-lg text-sm" onClick={() => { creator.remove(); setOpen(false); }}>None</Button></div>
      <div className="grid max-h-60 grid-cols-5 gap-2 overflow-y-auto py-1">
        {CREATOR_REFERENCES.map((reference, index) => <Button key={reference.id} type="button" variant="ghost" aria-label={`Use creator ${index + 1}`} aria-pressed={reference.src === creator.asset?.url}
          className="relative h-auto overflow-hidden rounded-xl p-0" onClick={() => { creator.chooseLibraryImage({ name: reference.fileName, url: reference.src }); setOpen(false); }}>
          <Image src={reference.src} alt="" width={56} height={74} sizes="56px" className="aspect-[3/4] w-full object-cover" />
          {reference.src === creator.asset?.url ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}
        </Button>)}
      </div>
      {creator.error ? <p role="alert" className="text-sm text-destructive">{creator.error}</p> : null}
    </PopoverContent>
  </Popover>;
}

/** No playback or crop controls inside a tile; detach before the blob is released. */
export function ReferenceVideoThumbnail({ url }: { url: string }) {
  const current = useRef<HTMLVideoElement | null>(null);
  const playerRef = useCallback((player: HTMLVideoElement | null) => {
    if (current.current && current.current !== player) {
      current.current.pause();
      current.current.removeAttribute("src");
      current.current.load();
    }
    current.current = player;
    if (player && player.getAttribute("src") !== url) player.setAttribute("src", url);
  }, [url]);
  return <video key={url} ref={playerRef} src={url} muted playsInline preload="metadata" aria-hidden="true" className={creation.referenceMedia} />;
}
