"use client";

import Image from "next/image";
import { Check, Plus, UserRound, Video } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowAudioReference, type WorkflowAudioReferenceProps } from "@/components/explore/workflow-audio-reference";
import { AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { WorkflowDurationControl } from "@/components/explore/workflow-duration-control";
import { WorkflowReferencePreview } from "@/components/explore/workflow-reference-preview";
import { WorkflowImageLibrary } from "@/components/explore/workflow-image-library";
import type { WorkflowImageAttachment } from "@/components/explore/use-local-workflow-images";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { AI_STUDIO_GENERATION_QUANTITIES, AI_STUDIO_VIDEO_ASPECT_RATIOS, getAIStudioVideoResolutions, parseAIStudioGenerationQuantity, parseAIStudioVideoAspectRatio, parseAIStudioVideoModel, parseAIStudioVideoResolution } from "@/lib/ai-studio/generation-settings";
import { getWorkflowVideoModels, type WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import { getVideoReferencePolicy } from "@/lib/ai-studio/video-reference-policy";
import { cn } from "@/lib/utils";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import imagePreview from "@/components/explore/workflow-reference-preview.module.css";

const OUTPUTS = AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({ value: String(count), label: `${count} video${count > 1 ? "s" : ""}` }));
const RATIOS = AI_STUDIO_VIDEO_ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }));

export type WorkflowCreationFormProps = WorkflowAudioReferenceProps & {
  referenceInstructions?: { value: string; onChange: (value: string) => void };
  instructions: string;
  onInstructionsChange: (value: string) => void;
  creator: WorkflowAttachment;
  imageReferences?: WorkflowImageAttachment;
  videoReference: WorkflowAttachment;
  generationSettings: WorkflowGenerationSettings;
  onGenerationSettingsChange: (patch: Partial<WorkflowGenerationSettings>) => void;
};

/** One mounted form at every size. Only the user can change instructions. */
export function WorkflowCreationForm({ kind, referenceInstructions, instructions, onInstructionsChange, creator, imageReferences, videoReference, audio, audioLabel, audioMode, onAudioModeChange, ownerId, appScreenControl, generationSettings, onGenerationSettingsChange }: WorkflowCreationFormProps & {
  kind: "hook" | "phone";
  appScreenControl?: ReactNode;
}) {
  const promptId = useId();
  const helperId = useId();
  const { model, duration, quantity, resolution, aspectRatio } = generationSettings;
  const referencePolicy = getVideoReferencePolicy(model);
  const models = getWorkflowVideoModels();
  const qualities = getAIStudioVideoResolutions(model).map((value) => ({ value, label: value }));
  const prefix = kind === "hook" ? "Hook" : "Phone video";
  const referenceCount = (imageReferences?.assets.length ?? Number(Boolean(creator.asset))) + [videoReference.asset, audio.asset].filter(Boolean).length;
  const qualityField = <SettingField label="Quality"><AiStudioSettingSelect fieldLayout="classic" ariaLabel={`${prefix} quality`} value={resolution} onChange={(value) => onGenerationSettingsChange({ resolution: parseAIStudioVideoResolution(value) })} options={qualities} /></SettingField>;
  const quantityField = <SettingField label="Videos"><AiStudioSettingSelect fieldLayout="classic" ariaLabel={kind === "hook" ? "Number of hook videos" : "Number of phone videos"} value={String(quantity)} onChange={(value) => onGenerationSettingsChange({ quantity: parseAIStudioGenerationQuantity(Number(value)) })} options={OUTPUTS} /></SettingField>;
  const ratioField = <SettingField label="Ratio"><AiStudioSettingSelect fieldLayout="classic" ariaLabel={`${prefix} aspect ratio`} value={aspectRatio} onChange={(value) => onGenerationSettingsChange({ aspectRatio: parseAIStudioVideoAspectRatio(value) })} options={RATIOS} /></SettingField>;

  return <section aria-label={kind === "hook" ? "Hook composer" : "Phone video composer"} className={creation.composer}>
    <h2 className="sr-only">Create</h2>
    {appScreenControl ? <section aria-label="App screen input" className={creation.finishRow}>
      <h3 className="text-sm font-medium">Inside the phone</h3>
      {appScreenControl}
    </section> : null}
    <section aria-label="Optional references" className={kind === "hook" ? creation.classicReferences : sections.references}>
      <div className={sections.referencesHeading}><h3>{kind === "hook" ? "Optional references" : "Generation references"}</h3>{kind !== "hook" ? <span>Optional</span> : null}{referenceCount ? <span>{referenceCount} attached</span> : null}</div>
      <div className={creation.referenceGrid}>
        <div className={kind === "hook" ? creation.classicReference : sections.referenceCard}><h4 className={kind === "hook" ? "sr-only" : undefined}>Image reference</h4>{kind !== "hook" ? <p>Appearance</p> : null}
        <CreatorPicker creator={creator} imageReferences={imageReferences} ownerId={ownerId} tile={kind === "hook"} />
        </div>
        <div className={kind === "hook" ? creation.classicReference : sections.referenceCard}><h4 className={kind === "hook" ? "sr-only" : undefined}>Video reference</h4>{kind !== "hook" ? <p>Scene & motion</p> : null}
        <div className={imagePreview.picker}>
        {videoReference.asset ? <WorkflowReferencePreview key={videoReference.asset.url} kind="video" url={videoReference.asset.url} name={videoReference.asset.name} disabled={videoReference.loading} onRemove={videoReference.remove} media={<ReferenceVideoThumbnail url={videoReference.asset.url} />} /> : null}
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" aria-label="Choose video reference" aria-busy={videoReference.loading} data-state={videoReference.loading ? "loading" : videoReference.error ? "error" : videoReference.asset ? "selected" : "empty"} title={videoReference.asset?.name ?? "Choose an optional video reference"} className={cn(creation.referenceButton, imagePreview.action)} />}>
            {!videoReference.asset ? <>{kind === "hook" ? <Video aria-hidden="true" /> : null}<span className={creation.referenceLabel}>{kind === "hook" ? "Video reference" : "Choose video"}</span></> : null}<Plus className={imagePreview.add} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
            <PopoverTitle>Video reference</PopoverTitle>
            <p className="text-sm leading-6 text-muted">Guide the scene and motion. WAN 3.0: up to 15 seconds and 32 MB · Seedance 2.5: up to 30 seconds and 250 MB.</p>
            {videoReference.asset ? <><WorkflowMediaPlayer asset={videoReference.asset} kind="video" label="Video reference preview" className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" /><p className="break-all text-xs text-muted">{videoReference.asset.name}</p></> : null}
            <WorkflowFilePicker attachment={{ ...videoReference, choose: file => videoReference.choose(file, { maxDuration: referencePolicy.maxVideoDuration, maxBytes: referencePolicy.maxVideoBytes }) }} kind="video" label={videoReference.asset ? "Replace video reference" : "Attach video reference"} className="h-9 text-sm" />
            {videoReference.asset || videoReference.error ? <Button type="button" variant="ghost" aria-label="Remove video reference" className="h-9 rounded-lg text-sm" onClick={videoReference.remove}>Remove video</Button> : null}
            {videoReference.error ? <p role="alert" className="text-sm text-destructive">{videoReference.error}</p> : null}
          </PopoverContent>
        </Popover>
        </div>
        </div>
        <div className={kind === "hook" ? creation.classicReference : sections.referenceCard}><h4 className={kind === "hook" ? "sr-only" : undefined}>Audio reference</h4>{kind !== "hook" ? <p>Vocal delivery</p> : null}
        <WorkflowAudioReference audio={audio} audioLabel={audioLabel} audioMode={audioMode} onAudioModeChange={onAudioModeChange} ownerId={ownerId} tile={kind === "hook"} model={model} />
        </div>
      </div>
      <p className={kind === "hook" ? "sr-only" : creation.sectionHelp}>References are optional. Use WAN 3.0 or Seedance 2.5 for video and audio guidance.</p>
    </section>
    {creator.loading || videoReference.loading || audio.loading ? <p role="status" className={creation.sectionHelp}>Reading your reference…</p> : null}
    {creator.error || videoReference.error || audio.error ? <p role="alert" className="text-xs leading-5 text-destructive">{creator.error || videoReference.error || audio.error}</p> : null}

    {referenceInstructions ? <section className="space-y-2 rounded-xl border border-border p-3" aria-label="Reference instructions">
      <label htmlFor={`${promptId}-reference`} className="text-sm font-medium">Reference instructions</label>
      <p className="text-xs leading-5 text-muted">These directions are sent together with your instructions. Edit them to guide your version.</p>
      <textarea id={`${promptId}-reference`} rows={4} maxLength={8000} value={referenceInstructions.value} onChange={event => referenceInstructions.onChange(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-5" />
    </section> : null}
    <div className={creation.instructionsField}>
      <label htmlFor={promptId} className="block text-sm font-medium">Your instructions</label>
      {kind === "hook" ? <p id={helperId} className="sr-only">Describe the words, delivery and setting. Text-only prompts are supported; reference images are optional.</p> : null}
      <textarea id={promptId} name={`${kind}Instructions`} autoComplete="off" rows={4} value={instructions}
        onChange={(event) => onInstructionsChange(event.target.value)}
        placeholder={kind === "hook" ? "Example: A creator looks into the camera and says, “Still planning your day in five apps? Try this instead.” Use natural lighting, a close-up shot, and a casual, friendly tone." : "Example: A creator holds a phone toward the camera and says, “This app keeps my day in one place.” Show the attached app screen inside the phone. Use natural lighting and a casual, friendly delivery."} aria-describedby={helperId}
        className={creation.prompt} />
    </div>
    {kind === "phone" ? <p id={helperId} className="sr-only">Nothing is prefilled or rewritten. Your instructions stay unchanged. Text-only prompts are supported; reference images are optional.</p> : null}

    <section aria-label="Video settings" className={kind === "hook" ? "space-y-3" : "mt-4 border-t border-border pt-4"}>
    <div role="group" aria-label={`${prefix} generation settings`} className={creation.settingsGrid}>
      <SettingField label="Model"><AiStudioSettingSelect fieldLayout="classic" ariaLabel={`${prefix} model`} value={model} onChange={(value) => onGenerationSettingsChange({ model: parseAIStudioVideoModel(value) })} options={models} /></SettingField>
      <SettingField label="Duration"><WorkflowDurationControl fieldLayout="classic" key={model} ariaLabel={`${prefix} duration`} model={model} value={duration} onChange={(duration) => onGenerationSettingsChange({ duration })} /></SettingField>
      {qualityField}{quantityField}
      {ratioField}
    </div>
    </section>
  </section>;
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return <div className={creation.settingField}><span className="text-sm font-medium">{label}</span>{children}</div>;
}

function CreatorPicker({ creator, imageReferences, ownerId, tile = false }: { creator: WorkflowAttachment; imageReferences?: WorkflowImageAttachment; ownerId?: string | null; tile?: boolean }) {
  const [open, setOpen] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const images = imageReferences?.assets ?? (creator.asset ? [creator.asset] : []);
  const full = Boolean(imageReferences && images.length >= imageReferences.maxImages);
  const selected = CREATOR_REFERENCES.find((reference) => reference.src === creator.asset?.url);
  const label = selected ? `Creator ${CREATOR_REFERENCES.indexOf(selected) + 1}` : creator.asset ? "Custom creator" : "Creator";
  return <div className={imagePreview.picker}>
    {images.length ? <><div className={imagePreview.images} data-count={images.length}>{images.map(image => <WorkflowReferencePreview key={image.url} url={image.url} name={image.name} disabled={creator.loading} onRemove={imageReferences ? () => imageReferences.removeImage(image.url) : creator.remove} />)}</div>{images.length > 1 ? <span className={imagePreview.count}>{images.length} images</span> : null}</> : null}
    {imageReferences ? <input ref={uploadInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Add reference images" disabled={creator.loading || full} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void imageReferences.chooseFiles(files); }} /> : null}
    <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className={cn(creation.referenceButton, imagePreview.action)} aria-busy={creator.loading} data-state={creator.loading ? "loading" : creator.error ? "error" : creator.asset ? "selected" : "available"} title={creator.asset?.name ?? "Choose an optional creator image"} aria-label={`Choose image, currently ${creator.asset ? label : "none selected"}`} />}>
      {!creator.asset ? <>{tile ? <UserRound aria-hidden="true" /> : null}<span className={creation.referenceLabel}>Choose image</span></> : null}<Plus className={imagePreview.add} aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent side="bottom" align="center" className={cn(studio.floating, creation.floating)} style={{ maxHeight: "min(calc(100dvh - 2rem), var(--available-height))", maxWidth: "min(calc(100vw - 2rem), var(--available-width))" }}>
      <PopoverTitle>Choose image</PopoverTitle>
      <p className="text-sm leading-6 text-muted">{imageReferences ? `Add up to ${imageReferences.maxImages} appearance or product images. Describe how to use them in your instructions.` : "Optional creator image. Your instructions decide how the creator appears."}</p>
      <div className="flex flex-wrap items-center gap-2">{imageReferences ? <Button type="button" variant="outline" className="h-9 gap-2 rounded-xl text-sm" disabled={creator.loading || full} onClick={() => uploadInput.current?.click()}><Plus className="size-4" aria-hidden="true" />Add images</Button> : <WorkflowFilePicker attachment={creator} kind="image" label="Upload creator" className="h-9 rounded-xl text-sm" />}<Button type="button" variant="ghost" aria-label="Remove creator" className="h-9 rounded-lg text-sm" onClick={() => { creator.remove(); setOpen(false); }}>None</Button></div>
      {imageReferences && images.length ? <div className="grid grid-cols-3 gap-2" aria-label="Selected reference images">{images.map(image => <div key={image.url} className="relative overflow-hidden rounded-lg"><Image src={image.url} alt={image.name} width={96} height={96} unoptimized className="aspect-square w-full object-cover" /><Button type="button" size="sm" variant="outline" disabled={creator.loading} aria-label={`Remove image ${image.name}`} className="w-full" onClick={() => imageReferences.removeImage(image.url)}>Remove</Button></div>)}</div> : null}
      <WorkflowImageLibrary ownerId={ownerId} open={open} disabled={creator.loading || full} selectedIds={images.map(image => image.assetId)} onSelect={async asset => {
        if (!ownerId) return false;
        const accepted = await imageReferences?.chooseSavedImage?.(asset, ownerId) ?? false;
        if (accepted) setOpen(false); return accepted;
      }}>
      <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto py-1 sm:grid-cols-5">
        {CREATOR_REFERENCES.map((reference, index) => <Button key={reference.id} type="button" variant="ghost" aria-label={`Use creator ${index + 1}`} aria-pressed={images.some(image => image.url === reference.src)}
          disabled={creator.loading || full && !images.some(image => image.url === reference.src)} className="relative h-auto overflow-hidden rounded-2xl p-0" onClick={() => { creator.chooseLibraryImage({ name: reference.fileName, url: reference.src }); setOpen(false); }}>
          <Image src={reference.src} alt="" width={56} height={74} sizes="56px" className="aspect-[3/4] w-full object-cover" />
          {images.some(image => image.url === reference.src) ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}
        </Button>)}
      </div>
      </WorkflowImageLibrary>
      {creator.error ? <p role="alert" className="text-sm text-destructive">{creator.error}</p> : null}
    </PopoverContent>
  </Popover></div>;
}

/** No playback or crop controls inside a tile; detach before the blob is released. */
export function ReferenceVideoThumbnail({ url, onDurationChange }: { url: string; onDurationChange?: (duration: number) => void }) {
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
  return <video key={url} ref={playerRef} src={url} muted playsInline preload="metadata" aria-hidden="true" className={creation.referenceMedia}
    onLoadedMetadata={event => {
      const duration = event.currentTarget.duration;
      if (Number.isFinite(duration) && duration > 0) onDurationChange?.(duration);
    }} />;
}
