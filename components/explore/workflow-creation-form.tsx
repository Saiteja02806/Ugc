"use client";

import Image from "next/image";
import { Check, Plus } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowAudioReference, type WorkflowAudioReferenceProps } from "@/components/explore/workflow-audio-reference";
import { AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { WorkflowDurationControl } from "@/components/explore/workflow-duration-control";
import { WorkflowReferencePreview } from "@/components/explore/workflow-reference-preview";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { AI_STUDIO_GENERATION_QUANTITIES, AI_STUDIO_VIDEO_ASPECT_RATIOS, getAIStudioVideoResolutions, parseAIStudioGenerationQuantity, parseAIStudioVideoAspectRatio, parseAIStudioVideoModel, parseAIStudioVideoResolution } from "@/lib/ai-studio/generation-settings";
import { getWorkflowVideoModels, type WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import { cn } from "@/lib/utils";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import imagePreview from "@/components/explore/workflow-reference-preview.module.css";
import focused from "@/components/explore/workflow-focused-composer.module.css";

const OUTPUTS = AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({ value: String(count), label: `${count} video${count > 1 ? "s" : ""}` }));
const RATIOS = AI_STUDIO_VIDEO_ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }));

export type WorkflowCreationFormProps = WorkflowAudioReferenceProps & {
  instructions: string;
  onInstructionsChange: (value: string) => void;
  creator: WorkflowAttachment;
  videoReference: WorkflowAttachment;
  generationSettings: WorkflowGenerationSettings;
  onGenerationSettingsChange: (patch: Partial<WorkflowGenerationSettings>) => void;
};

/** One mounted form at every size. Only the user can change instructions. */
export function WorkflowCreationForm({ kind, instructions, onInstructionsChange, creator, videoReference, audio, audioLabel, audioMode, onAudioModeChange, ownerId, appScreenControl, generationSettings, onGenerationSettingsChange }: WorkflowCreationFormProps & {
  kind: "hook" | "phone";
  appScreenControl?: ReactNode;
}) {
  const promptId = useId();
  const helperId = useId();
  const { model, duration, quantity, resolution, aspectRatio } = generationSettings;
  const models = getWorkflowVideoModels();
  const qualities = getAIStudioVideoResolutions(model).map((value) => ({ value, label: value }));
  const prefix = kind === "hook" ? "Hook" : "Phone video";
  const referenceCount = [creator.asset, videoReference.asset, audio.asset].filter(Boolean).length;
  const qualityField = <SettingField label="Quality"><AiStudioSettingSelect ariaLabel={`${prefix} quality`} value={resolution} onChange={(value) => onGenerationSettingsChange({ resolution: parseAIStudioVideoResolution(value) })} options={qualities} /></SettingField>;
  const quantityField = <SettingField label="Videos"><AiStudioSettingSelect ariaLabel={kind === "hook" ? "Number of hook videos" : "Number of phone videos"} value={String(quantity)} onChange={(value) => onGenerationSettingsChange({ quantity: parseAIStudioGenerationQuantity(Number(value)) })} options={OUTPUTS} /></SettingField>;
  const ratioField = <SettingField label="Ratio"><AiStudioSettingSelect ariaLabel={`${prefix} aspect ratio`} value={aspectRatio} onChange={(value) => onGenerationSettingsChange({ aspectRatio: parseAIStudioVideoAspectRatio(value) })} options={RATIOS} /></SettingField>;

  return <section aria-label={kind === "hook" ? "Hook composer" : "Phone video composer"} className={kind === "hook" ? focused.composer : creation.composer}>
    <h2 className="sr-only">Create</h2>
    {appScreenControl ? <section aria-label="App screen input" className={creation.finishRow}>
      <h3 className="text-sm font-medium">Inside the phone</h3>
      {appScreenControl}
    </section> : null}
    <section aria-label="Optional references" className={sections.references}>
      <div className={sections.referencesHeading}><h3>Generation references</h3><span>Optional{referenceCount ? ` · ${referenceCount} attached` : ""}</span>{referenceCount ? <span className={imagePreview.previewHelp}>Hover or tap to preview</span> : null}</div>
      <div className={creation.referenceGrid}>
        <div className={sections.referenceCard}><h4>Image reference</h4><p>Appearance</p>
        <CreatorPicker creator={creator} />
        </div>
        <div className={sections.referenceCard}><h4>Video reference</h4><p>Scene & motion</p>
        <div className={imagePreview.picker}>
        {videoReference.asset ? <WorkflowReferencePreview key={videoReference.asset.url} kind="video" url={videoReference.asset.url} name={videoReference.asset.name} media={<ReferenceVideoThumbnail url={videoReference.asset.url} />} /> : null}
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" aria-label="Choose video reference" aria-busy={videoReference.loading} data-state={videoReference.loading ? "loading" : videoReference.error ? "error" : videoReference.asset ? "selected" : "empty"} title={videoReference.asset?.name ?? "Choose an optional video reference"} className={cn(creation.referenceButton, imagePreview.action)} />}>
            {!videoReference.asset ? <span className={creation.referenceLabel}>Choose video</span> : null}<Plus className={imagePreview.add} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
            <PopoverTitle>Video reference</PopoverTitle>
            <p className="text-sm leading-6 text-muted">Use Seedance 2.5 for a video reference up to 30 seconds to guide the scene and motion. Add demo footage separately in Edit. Files upload when you Generate.</p>
            {videoReference.asset ? <><WorkflowMediaPlayer asset={videoReference.asset} kind="video" label="Video reference preview" className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" /><p className="break-all text-xs text-muted">{videoReference.asset.name}</p></> : null}
            <WorkflowFilePicker attachment={videoReference} kind="video" label={videoReference.asset ? "Replace video reference" : "Attach video reference"} className="h-9 text-sm" />
            {videoReference.asset ? <Button type="button" variant="ghost" aria-label="Remove video reference" className="h-9 rounded-lg text-sm" onClick={videoReference.remove}>Remove video</Button> : null}
            {videoReference.error ? <p role="alert" className="text-sm text-destructive">{videoReference.error}</p> : null}
          </PopoverContent>
        </Popover>
        </div>
        </div>
        <div className={sections.referenceCard}><h4>Voice reference</h4><p>Vocal delivery</p>
        <WorkflowAudioReference audio={audio} audioLabel={audioLabel} audioMode={audioMode} onAudioModeChange={onAudioModeChange} ownerId={ownerId} />
        </div>
      </div>
      <p className={creation.sectionHelp}>References are optional. Video and voice guidance require Seedance 2.5.</p>
    </section>
    {creator.loading || videoReference.loading || audio.loading ? <p role="status" className={creation.sectionHelp}>Reading your reference…</p> : null}
    {creator.error || videoReference.error || audio.error ? <p role="alert" className="text-xs leading-5 text-destructive">{creator.error || videoReference.error || audio.error}</p> : null}

    <div className={kind === "hook" ? focused.brief : creation.instructionsField}>
      <label htmlFor={promptId} className="block text-sm font-medium">{kind === "hook" ? "What should the creator say and do?" : "Your instructions"}</label>
      {kind === "hook" ? <p id={helperId}>Describe the words, delivery and setting.<span className="sr-only"> Text-only prompts are supported; reference images are optional.</span></p> : null}
      <textarea id={promptId} name={`${kind}Instructions`} autoComplete="off" rows={4} value={instructions}
        onChange={(event) => onInstructionsChange(event.target.value)}
        placeholder={kind === "hook" ? "Example: A creator looks into the camera and says, “Still planning your day in five apps? Try this instead.” Use natural lighting, a close-up shot, and a casual, friendly tone." : "Example: A creator holds a phone toward the camera and says, “This app keeps my day in one place.” Show the attached app screen inside the phone. Use natural lighting and a casual, friendly delivery."} aria-describedby={helperId}
        className={kind === "hook" ? focused.prompt : creation.prompt} />
    </div>
    {kind === "phone" ? <p id={helperId} className="sr-only">Nothing is prefilled or rewritten. Your instructions stay unchanged. Text-only prompts are supported; reference images are optional.</p> : null}

    <section aria-label="Video settings" className={kind === "hook" ? "space-y-3" : "mt-4 border-t border-border pt-4"}>
    <div role="group" aria-label={`${prefix} generation settings`} className={kind === "hook" ? focused.primarySettings : creation.settingsGrid}>
      <SettingField label="Model"><AiStudioSettingSelect ariaLabel={`${prefix} model`} value={model} onChange={(value) => onGenerationSettingsChange({ model: parseAIStudioVideoModel(value) })} options={models} /></SettingField>
      <SettingField label="Duration"><WorkflowDurationControl key={model} ariaLabel={`${prefix} duration`} model={model} value={duration} onChange={(duration) => onGenerationSettingsChange({ duration })} /></SettingField>
      {kind === "phone" ? <>{qualityField}{quantityField}</> : null}
      {ratioField}
    </div>
    {kind === "hook" ? <details className={focused.output}><summary>Output settings<span>{resolution} · {quantity} video{quantity === 1 ? "" : "s"}</span></summary><div role="group" aria-label="Output settings" className={focused.outputFields}>{qualityField}{quantityField}</div></details> : null}
    </section>
  </section>;
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return <div className={creation.settingField}><span className="text-sm font-medium">{label}</span>{children}</div>;
}

function CreatorPicker({ creator }: { creator: WorkflowAttachment }) {
  const [open, setOpen] = useState(false);
  const selected = CREATOR_REFERENCES.find((reference) => reference.src === creator.asset?.url);
  const label = selected ? `Creator ${CREATOR_REFERENCES.indexOf(selected) + 1}` : creator.asset ? "Custom creator" : "Creator";
  return <div className={imagePreview.picker}>
    {creator.asset ? <WorkflowReferencePreview key={creator.asset.url} url={creator.asset.url} name={creator.asset.name} /> : null}
    <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className={cn(creation.referenceButton, imagePreview.action)} aria-busy={creator.loading} data-state={creator.loading ? "loading" : creator.error ? "error" : creator.asset ? "selected" : "available"} title={creator.asset?.name ?? "Choose an optional creator image"} aria-label={`Choose image, currently ${creator.asset ? label : "none selected"}`} />}>
      {!creator.asset ? <span className={creation.referenceLabel}>Choose image</span> : null}<Plus className={imagePreview.add} aria-hidden="true" />
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
  </Popover></div>;
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
