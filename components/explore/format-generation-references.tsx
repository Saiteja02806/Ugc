"use client";

import { AudioLines, Check, Loader2, Plus, RefreshCw, UserRound, Video } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useLocalWorkflowMedia, type LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { cn } from "@/lib/utils";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { CATALOG_REFERENCE_IMAGE_PROJECT, USER_REFERENCE_IMAGE_PROJECT, fetchFormatReferenceImage, fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import type { MediaAsset } from "@/lib/media/types";
import { imagePickerThumbnailUrl, REFERENCE_IMAGE_PAGE_SIZE, REFERENCE_IMAGE_STALE_MS } from "@/lib/media/image-picker";
import { prepareReferenceImageBatch, validateReferenceImageFiles } from "@/lib/explore/reference-image-batch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { ReferenceVideoThumbnail } from "@/components/explore/workflow-creation-form";
import { WorkflowReferencePreview } from "@/components/explore/workflow-reference-preview";
import imagePreview from "@/components/explore/workflow-reference-preview.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import presentation from "@/components/explore/workflow-video-layout.module.css";
import studio from "@/components/explore/workflow-studio.module.css";

type Kind = "image" | "video" | "audio";

/** Optional generation guidance; imported editor footage uses the separate source picker. */
export function FormatGenerationReferences({ selection, imageSelection, imageSelections, videoSelection, audioSelection, onImagesChange, maxImages = 6, onChange, onPendingChange, onErrorChange, disabled, preview, ownerId, styleVideo, onStyleVideoDurationChange, onClearStyle, active = true, videoInputEnabled = true, audioInputEnabled = false, maxImageBytes = 20 * 1024 ** 2, maxVideoDuration = 10, maxAudioDuration = 30, maxVideoBytes = 32 * 1024 ** 2, maxAudioBytes = 25 * 1024 ** 2, preserveVideoTiming = true, description }: {
  selection: AIStudioReferenceMedia | null;
  imageSelection?: AIStudioReferenceMedia | null;
  imageSelections?: AIStudioReferenceMedia[];
  onImagesChange?: (selections: AIStudioReferenceMedia[]) => void;
  maxImages?: number;
  videoSelection?: AIStudioReferenceMedia | null;
  audioSelection?: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null, kind?: Kind) => void;
  onPendingChange: (pending: boolean) => void;
  onErrorChange?: (error: string | null) => void;
  disabled: boolean;
  preview: boolean;
  ownerId?: string;
  styleVideo?: LocalWorkflowMedia & { id?: string; selectionRevision?: number };
  onStyleVideoDurationChange?: (url: string, duration: number) => void;
  onClearStyle?: () => void;
  active?: boolean;
  videoInputEnabled?: boolean;
  audioInputEnabled?: boolean;
  maxImageBytes?: number;
  maxVideoDuration?: number;
  maxAudioDuration?: number;
  maxVideoBytes?: number;
  maxAudioBytes?: number;
  preserveVideoTiming?: boolean;
  description?: string;
}) {
  const selectedImage = imageSelection === undefined ? selection?.kind === "image" ? selection : null : imageSelection;
  const selectedImages = imageSelections ?? (selectedImage ? [selectedImage] : []);
  const imageLimitReached = selectedImages.length >= maxImages;
  const selectedVideo = videoSelection === undefined ? selection?.kind === "video" ? selection : null : videoSelection;
  const selectedAudio = audioSelection === undefined ? selection?.kind === "audio" ? selection : null : audioSelection;
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  const working = useRef(false);
  const batchLocalUrls = useRef(new Set<string>());
  const localImage = useLocalWorkflowMedia("image");
  const localVideo = useLocalWorkflowMedia("video");
  const localAudio = useLocalWorkflowMedia("audio");
  const [pending, setPending] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [imagePages, setImagePages] = useState(1);
  const galleryKey = styleVideo ? `${styleVideo.id ?? styleVideo.url}:${styleVideo.selectionRevision ?? 0}` : null;
  const [previousGalleryKey, setPreviousGalleryKey] = useState(galleryKey);
  if (previousGalleryKey !== galleryKey) {
    setPreviousGalleryKey(galleryKey);
    if (galleryKey) setError(null);
  }
  const [openKind, setOpenKind] = useState<Kind | null>(null);
  const [imageTab, setImageTab] = useState<"user" | "catalog" | null>(null);
  const queryClient = useQueryClient();
  const imagesKey = ["explore-reference-images", ownerId ?? "signed-out"] as const;
  const imagesQuery = useQuery({
    queryKey: imagesKey,
    queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal),
    enabled: active && openKind === "image" && !preview && Boolean(ownerId),
    staleTime: REFERENCE_IMAGE_STALE_MS,
  });
  const activeImageTab = imageTab ?? (!preview && ownerId && (imagesQuery.isPending || imagesQuery.data?.length) ? "user" : "catalog");
  const [wasActive, setWasActive] = useState(active);
  const pendingCallback = useRef(onPendingChange);
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => {
    const urls = batchLocalUrls.current;
    return () => { revision.current += 1; working.current = false; pendingCallback.current(false); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, [ownerId]);
  if (wasActive !== active) { setWasActive(active); setOpenKind(null); }

  async function choose(kind: Kind, input: File | (() => Promise<File>), onAccepted?: () => void, source: "upload" | "catalog" = "upload") {
    if (disabled || pending || working.current || kind === "video" && !videoInputEnabled || kind === "audio" && !audioInputEnabled) return;
    if (kind === "image" && imageLimitReached) { setError(`Use up to ${maxImages} image references with these inputs.`); return; }
    const request = ++revision.current;
    setError(null); onErrorChange?.(null); setPending(kind); onPendingChange(true);
    try {
      const file = typeof input === "function" ? await input() : input;
      if (request !== revision.current) return;
      const maxBytes = kind === "video" ? maxVideoBytes : kind === "audio" ? maxAudioBytes : maxImageBytes;
      if (file.size > maxBytes) throw new Error(`Use a reference ${kind} up to ${maxBytes / 1024 ** 2} MB.`);
      if (preview) {
        const metadata = await readAIStudioReferenceMetadata(file, kind, maxVideoDuration, { maxAudioDurationSeconds: maxAudioDuration, requireVideoReferenceRatio: preserveVideoTiming });
        if (request !== revision.current) return;
        const local = kind === "image" ? localImage : kind === "video" ? localVideo : localAudio;
        if (await local.choose(file, { maxDuration: kind === "video" ? maxVideoDuration : kind === "audio" ? maxAudioDuration : undefined, onRead: asset => {
          if (request !== revision.current) return;
          // The generator is always locked in preview. This local attachment
          // mirrors the controls without creating an owned upload record.
          onChange({ kind, asset: {
            collection: kind, createdAt: "", updatedAt: "", durationSeconds: asset.duration,
            fileName: file.name, fileSizeBytes: file.size, height: metadata.height, width: metadata.width,
            id: `local:${asset.url}`, metadata: { preview: true }, mimeType: file.type,
            parentAssetId: null, projectId: kind === "image" ? source === "catalog" ? CATALOG_REFERENCE_IMAGE_PROJECT : USER_REFERENCE_IMAGE_PROJECT : null, ratio: metadata.ratio, sourceRecordId: null,
            sourceType: "upload", status: "ready", thumbnailUrl: null, title: file.name, url: asset.url,
          } }, kind);
          onAccepted?.();
        } })) {
          if (request !== revision.current) return;
        } else if (request === revision.current) {
          const message = "This reference could not be previewed. Choose another file or remove it before generating.";
          setError(message); onErrorChange?.(message);
        }
      } else {
        if (!ownerId) throw new Error("Sign in before adding a reference.");
        const uploaded = kind === "image"
          ? await uploadAIStudioReferenceMedia(file, kind, 10, ownerId, { purpose: source === "catalog" ? CATALOG_REFERENCE_IMAGE_PROJECT : USER_REFERENCE_IMAGE_PROJECT })
          : await uploadAIStudioReferenceMedia(file, kind, maxVideoDuration, ownerId,
            { maxAudioDurationSeconds: maxAudioDuration, requireVideoReferenceRatio: preserveVideoTiming });
        if (request !== revision.current) return;
        if (kind === "image" && source === "upload") {
          await queryClient.cancelQueries({ queryKey: imagesKey });
          if (request !== revision.current) return;
          queryClient.setQueryData<MediaAsset[]>(imagesKey, previous => [uploaded.asset, ...(previous ?? []).filter(item => item.id !== uploaded.asset.id)]);
          setImageTab("user");
        }
        if (request === revision.current) { onChange(uploaded, kind); onAccepted?.(); }
      }
    } catch (cause) {
      if (request === revision.current) {
        const message = cause instanceof Error ? cause.message : "Could not add this reference.";
        setError(message); onErrorChange?.(message);
      }
    } finally {
      if (request === revision.current) { setPending(null); onPendingChange(false); }
    }
  }
  async function chooseImageFiles(files: File[]) {
    if (!files.length || disabled || pending || working.current) return;
    try { validateReferenceImageFiles(files, onImagesChange ? maxImages - selectedImages.length : 1, maxImageBytes); }
    catch (cause) { const message = (cause as Error).message; setError(message); onErrorChange?.(message); return; }
    const request = ++revision.current;
    working.current = true; setPending("image"); onPendingChange(true); setError(null); onErrorChange?.(null);
    setUploadProgress(`Adding 0 of ${files.length} images…`);
    try {
      const results = await prepareReferenceImageBatch(files, async file => {
        if (!preview) {
          if (!ownerId) throw new Error("Sign in before adding images.");
          return uploadAIStudioReferenceMedia(file, "image", 10, ownerId, { purpose: USER_REFERENCE_IMAGE_PROJECT });
        }
        const metadata = await readAIStudioReferenceMetadata(file, "image");
        if (request !== revision.current) throw new Error("Image selection was cancelled.");
        const url = URL.createObjectURL(file); batchLocalUrls.current.add(url);
        return { kind: "image", asset: { collection: "image", createdAt: "", updatedAt: "", durationSeconds: null,
          fileName: file.name, fileSizeBytes: file.size, height: metadata.height, width: metadata.width,
          id: `local:${url}`, metadata: { preview: true }, mimeType: file.type, parentAssetId: null,
          projectId: USER_REFERENCE_IMAGE_PROJECT, ratio: metadata.ratio, sourceRecordId: null,
          sourceType: "upload", status: "ready", thumbnailUrl: null, title: file.name, url } } satisfies AIStudioReferenceMedia;
      }, () => request === revision.current, (done, total) => setUploadProgress(`Adding ${done} of ${total} images…`));
      if (request !== revision.current) return;
      const accepted = results.flatMap(result => result?.value ? [result.value] : []);
      if (!preview && accepted.length) {
        await queryClient.cancelQueries({ queryKey: imagesKey });
        if (request !== revision.current) return;
        queryClient.setQueryData<MediaAsset[]>(imagesKey, previous => [...accepted.map(image => image.asset), ...(previous ?? []).filter(asset => !accepted.some(image => image.asset.id === asset.id))]);
        setImageTab("user");
      }
      if (accepted.length) { if (onImagesChange) onImagesChange([...selectedImages, ...accepted]); else onChange(accepted[0], "image"); }
      const failures = results.flatMap(result => result?.error ? [result.error] : []);
      if (failures.length) { const message = `${accepted.length} added. ${failures.join(" ")}`; setError(message); onErrorChange?.(message); }
    } catch (cause) {
      if (request === revision.current) { const message = cause instanceof Error ? cause.message : "Could not add these images."; setError(message); onErrorChange?.(message); }
    } finally {
      if (request === revision.current) { working.current = false; setPending(null); setUploadProgress(null); onPendingChange(false); }
    }
  }
  async function chooseSavedImage(saved: MediaAsset) {
    if (disabled || pending || working.current || preview || !ownerId) return;
    const existing = selectedImages.find(image => image.asset.id === saved.id);
    if (existing) { if (onImagesChange) removeImage(existing); return; }
    if (imageLimitReached) { setError(`Use up to ${maxImages} image references with these inputs.`); return; }
    const request = ++revision.current;
    setError(null); onErrorChange?.(null); setPending("image"); onPendingChange(true);
    try {
      const asset = await fetchFormatReferenceImage(saved.id, ownerId);
      if (request !== revision.current) return;
      if (asset.fileSizeBytes != null && asset.fileSizeBytes > maxImageBytes) throw new Error(`Use a reference image up to ${maxImageBytes / 1024 ** 2} MB.`);
      onChange({ kind: "image", asset }, "image");
      localImage.remove(); if (!onImagesChange) setOpenKind(null);
    } catch (cause) {
      if (request === revision.current) {
        const message = cause instanceof Error ? cause.message : "Could not use this image.";
        setError(message); onErrorChange?.(message);
      }
    } finally {
      if (request === revision.current) { setPending(null); onPendingChange(false); }
    }
  }
  function remove(kind: Kind) {
    if (disabled || pending) return;
    if (kind === "image") { for (const url of batchLocalUrls.current) URL.revokeObjectURL(url); batchLocalUrls.current.clear(); }
    (kind === "image" ? localImage : kind === "video" ? localVideo : localAudio).remove(); setError(null); onErrorChange?.(null); onChange(null, kind); setOpenKind(null);
  }
  function removeImage(image: AIStudioReferenceMedia) {
    if (disabled || pending) return;
    if (!onImagesChange) { remove("image"); return; }
    onImagesChange(selectedImages.filter(item => item.asset.id !== image.asset.id));
    if (batchLocalUrls.current.delete(image.asset.url)) URL.revokeObjectURL(image.asset.url);
    setError(null); onErrorChange?.(null);
  }
  function removeStyleVideo() {
    if (disabled || pending) return;
    onClearStyle?.(); setError(null); onErrorChange?.(null); setOpenKind(null);
  }
  const catalogImages = selectedImages.filter(image => image.asset.projectId === CATALOG_REFERENCE_IMAGE_PROJECT || image.asset.projectId === "ai-studio");
  const catalogSelections = catalogImages.map(image => image.asset.fileName);
  const referenceKinds = (["image", "video", "audio"] as const).filter(kind => kind === "image" || kind === "video" && (videoInputEnabled || Boolean(styleVideo) || Boolean(selectedVideo)) || kind === "audio" && (audioInputEnabled || Boolean(selectedAudio)));

  return <section aria-label="Optional generation references" className={cn(presentation.referenceGroup, presentation.classicReferences)}>
    <div className={presentation.referenceHeading}><h3>Optional references</h3></div>
    <div className={creation.referenceGrid} data-workflow-reference-grid data-reference-columns={referenceKinds.length}>
      {referenceKinds.map(kind => {
        const selected = kind === "image" ? selectedImages[0] ?? null : kind === "video" ? selectedVideo : selectedAudio;
        const isStyle = kind === "video" && !selectedVideo && Boolean(styleVideo);
        const asset = selected ? { name: selected.asset.fileName ?? selected.asset.title, url: selected.asset.url, duration: selected.asset.durationSeconds } : isStyle ? styleVideo : null;
        const input = kind === "image" ? imageInput : kind === "video" ? videoInput : audioInput;
        const inputEnabled = kind === "image" || kind === "video" && videoInputEnabled || kind === "audio" && audioInputEnabled;
        const uploadActions = <div className="flex flex-wrap items-center gap-2">{inputEnabled ? <Button type="button" variant="outline" size="sm" disabled={disabled || Boolean(pending) || kind === "image" && imageLimitReached} onClick={() => input.current?.click()} className={kind === "image" ? "h-8 gap-1.5 rounded-xl px-3 text-xs" : "h-9 rounded-lg text-sm"}>{kind === "image" ? <><Plus className="size-3.5" aria-hidden="true" />{onImagesChange ? "Add images" : "Add image"}</> : isStyle ? "Upload video reference" : asset ? `Replace ${kind}` : `Attach ${kind}`}</Button> : null}
          {asset ? <Button type="button" variant="ghost" aria-label={isStyle ? "Remove gallery video reference" : `Remove ${kind} reference`} disabled={disabled || Boolean(pending)} onClick={isStyle ? removeStyleVideo : () => remove(kind)} className="h-9 rounded-lg text-sm">{kind === "image" ? "None" : `Remove ${kind}`}</Button> : null}
          {kind === "image" && activeImageTab === "user" && !preview && ownerId ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh your images" title="Refresh your images" disabled={Boolean(pending) || imagesQuery.isFetching} onClick={() => void imagesQuery.refetch()}><RefreshCw className={cn("size-3.5", imagesQuery.isFetching && "animate-spin motion-reduce:animate-none")} aria-hidden="true" /></Button> : null}
        </div>;
        return <div key={kind} data-reference-state={asset ? "selected" : "empty"} className={cn("relative min-w-0", presentation.referenceCard)}>
          <input ref={input} type="file" multiple={kind === "image" && Boolean(onImagesChange)} className="hidden" aria-label={`Choose optional ${kind} reference`} accept={kind === "image" ? "image/png,image/jpeg,image/webp" : kind === "video" ? "video/mp4,video/quicktime,video/webm" : "audio/mpeg,audio/wav,audio/x-wav"} disabled={disabled || Boolean(pending) || !inputEnabled} onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = "";
            if (kind === "image") void chooseImageFiles(files); else if (files[0]) void choose(kind, files[0]);
          }} />
          <div className={imagePreview.picker}>
          {kind === "image" && selectedImages.length ? <><div className={imagePreview.images} data-count={selectedImages.length}>{selectedImages.map(image => <WorkflowReferencePreview key={image.asset.id} url={image.asset.url} name={image.asset.fileName ?? image.asset.title} disabled={disabled || Boolean(pending)} onRemove={() => removeImage(image)} />)}</div>{selectedImages.length > 1 ? <span className={imagePreview.count}>{selectedImages.length} images</span> : null}</> : asset ? <WorkflowReferencePreview key={asset.url} kind={kind === "audio" ? "voice" : kind} url={asset.url} name={asset.name ?? "Selected reference"} disabled={disabled || Boolean(pending)} onRemove={isStyle ? onClearStyle ? removeStyleVideo : undefined : () => remove(kind)} media={kind === "video" ? <ReferenceVideoThumbnail url={asset.url} onDurationChange={isStyle ? duration => onStyleVideoDurationChange?.(asset.url, duration) : undefined} /> : undefined} /> : null}
          <Popover open={active && openKind === kind} onOpenChange={open => { if (open && kind === "image") setImageTab(null); setImagePages(1); setOpenKind(open ? kind : null); }}>
            <PopoverTrigger render={<Button type="button" variant="outline" data-workflow-tile="reference" aria-label={isStyle ? "Choose gallery video reference" : `${asset ? "Replace" : "Add"} ${kind} reference`} aria-busy={pending === kind} title={asset?.name ?? `Choose an optional ${kind} reference`} disabled={disabled || Boolean(pending)} data-state={pending === kind ? "loading" : asset ? "selected" : "empty"} className={cn(creation.referenceButton, imagePreview.action)} />}>
              {pending === kind ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : !asset ? kind === "image" ? <UserRound aria-hidden="true" /> : kind === "video" ? <Video aria-hidden="true" /> : <AudioLines aria-hidden="true" /> : null}
              {pending === kind || !asset ? <span className={creation.referenceLabel}>{pending === kind ? "Preparing…" : `Choose ${kind}`}</span> : null}<Plus className={imagePreview.add} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent ref={popup} initialFocus={popup} tabIndex={-1} side="bottom" align="center" className={cn(studio.floating, creation.floating)} style={{ maxHeight: "min(calc(100dvh - 2rem), var(--available-height))", maxWidth: "min(calc(100vw - 2rem), var(--available-width))" }}>
              <PopoverTitle>{kind === "image" ? "Choose image" : kind === "video" ? "Video reference" : "Audio reference"}</PopoverTitle>
              <p className="text-sm leading-6 text-muted">{isStyle ? `This gallery clip is sent to generation. Add images for appearance and describe the changes. Clips over ${maxVideoDuration} seconds must be trimmed and uploaded first.` : kind === "image" ? `Add up to ${maxImages} appearance or product images. Describe how to use each image in your instructions.` : kind === "audio" ? `Audio reference up to ${maxAudioDuration} seconds and ${maxAudioBytes / 1024 ** 2} MB. Describe how it should guide the generated sound.` : `Video reference up to ${maxVideoDuration} seconds and ${maxVideoBytes / 1024 ** 2} MB. ${preserveVideoTiming ? "The edit follows the source clip's actions and timing." : "It guides the new video; choose its output duration below."}`}</p>
              {asset && (kind !== "image" || !onImagesChange) ? <>{kind === "image" ? <ReferenceImagePreview asset={asset} /> : <WorkflowMediaPlayer asset={asset} kind={kind} label={`${kind === "audio" ? "Audio" : "Video"} reference preview`} className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" />}<p className="break-all text-xs text-muted">{asset.name}</p></> : null}
              {uploadActions}
              {kind === "image" && onImagesChange ? <div className="flex items-center justify-between gap-3"><p role="status" className="text-xs text-muted">{selectedImages.length} of {maxImages} images selected</p><Button type="button" variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => setOpenKind(null)}>Done</Button></div> : null}
              {kind === "image" ? <Tabs.Root value={activeImageTab} onValueChange={value => { if (value === "user" || value === "catalog") setImageTab(value); }} className="space-y-3">
                <Tabs.List aria-label="Image sources" className="flex gap-2">
                  <Tabs.Tab value="user" type="button" className="min-w-0 flex-1 rounded-xl border border-border px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-2 focus-visible:outline-focus data-[active]:border-primary/50 data-[active]:bg-card-muted data-[active]:text-foreground-strong">Your images</Tabs.Tab>
                  <Tabs.Tab value="catalog" type="button" className="min-w-0 flex-1 rounded-xl border border-border px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-2 focus-visible:outline-focus data-[active]:border-primary/50 data-[active]:bg-card-muted data-[active]:text-foreground-strong">UGC Pilot images</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="user" keepMounted aria-label="Your images" className="max-h-72 space-y-2 overflow-y-auto p-1">
                  {preview ? <p className="text-xs leading-5 text-muted">Sign in to save and reuse your uploaded images. Preview uploads are temporary.</p>
                    : !ownerId ? <p className="text-xs leading-5 text-muted">Sign in to see your saved images.</p>
                    : imagesQuery.isPending ? <p role="status" className="text-xs text-muted">Loading your images…</p>
                    : imagesQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not load your images. Use Refresh to try again.</p>
                    : imagesQuery.data?.length ? <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{imagesQuery.data.slice(0, imagePages * REFERENCE_IMAGE_PAGE_SIZE).map(saved => <Button key={saved.id} type="button" variant="ghost" aria-label={`Use your image ${saved.fileName ?? saved.title}`} title={saved.fileName ?? saved.title} aria-pressed={selectedImages.some(image => image.asset.id === saved.id)} disabled={disabled || Boolean(pending) || imageLimitReached && !selectedImages.some(image => image.asset.id === saved.id)} className="relative h-auto overflow-hidden rounded-2xl p-0" onClick={() => void chooseSavedImage(saved)}>
                      <ReferenceCreatorImage url={activeImageTab === "user" ? saved.thumbnailUrl ?? saved.url : undefined} /><span aria-hidden="true" className={cn("pointer-events-none absolute right-1 top-1 flex size-5 items-center justify-center rounded-md border-2 shadow-sm", selectedImages.some(image => image.asset.id === saved.id) ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/60")}>{selectedImages.some(image => image.asset.id === saved.id) ? <Check className="size-3.5" /> : null}</span>
                    </Button>)}</div> : <p className="text-xs leading-5 text-muted">Upload an image to keep it here for next time.</p>}
                  {imagesQuery.data && imagesQuery.data.length > imagePages * REFERENCE_IMAGE_PAGE_SIZE ? <Button type="button" variant="outline" size="sm" onClick={() => setImagePages(value => value + 1)}>Load more images</Button> : null}
                </Tabs.Panel>
                <Tabs.Panel value="catalog" keepMounted aria-label="UGC Pilot images" className="max-h-72 overflow-y-auto p-1">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{CREATOR_REFERENCES.map((reference, index) => <Button key={reference.id} type="button" variant="ghost" aria-label={`Use creator ${index + 1}`} aria-pressed={catalogSelections.includes(reference.fileName)} disabled={disabled || Boolean(pending) || imageLimitReached && !catalogSelections.includes(reference.fileName)} className="relative h-auto overflow-hidden rounded-2xl p-0" onClick={() => { const existing = catalogImages.find(image => image.asset.fileName === reference.fileName); if (existing) { if (onImagesChange) removeImage(existing); return; } void choose("image", async () => {
                const response = await fetch(reference.src); if (!response.ok) throw new Error("Could not load this creator image.");
                const blob = await response.blob(); return new File([blob], reference.fileName, { type: blob.type || "image/png" });
              }, () => { if (!onImagesChange) setOpenKind(null); }, "catalog"); }}><ReferenceCreatorImage url={activeImageTab === "catalog" ? reference.src : undefined} /><span aria-hidden="true" className={cn("pointer-events-none absolute right-1 top-1 flex size-5 items-center justify-center rounded-md border-2 shadow-sm", catalogSelections.includes(reference.fileName) ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/60")}>{catalogSelections.includes(reference.fileName) ? <Check className="size-3.5" /> : null}</span></Button>)}</div>
                </Tabs.Panel>
              </Tabs.Root> : null}
              {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
            </PopoverContent>
          </Popover>
          </div>
        </div>;
      })}
    </div>
    {description ? <p className={creation.sectionHelp} aria-live="polite">{description}</p> : null}
    {pending ? <p role="status" className={creation.sectionHelp}>{uploadProgress ?? "Reading your reference…"}</p> : null}
    {error ? <div className="space-y-2"><p role="alert" className="text-xs leading-5 text-destructive">{error}</p><Button type="button" variant="ghost" size="sm" disabled={disabled || Boolean(pending)} onClick={() => { setError(null); onErrorChange?.(null); }}>Cancel reference change</Button></div> : null}
  </section>;
}

function ReferenceImagePreview({ asset }: { asset: LocalWorkflowMedia }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.url} alt="Selected image reference" className="mx-auto max-h-56 max-w-full rounded-2xl object-contain" />;
}
function ReferenceCreatorImage({ url }: { url?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imagePickerThumbnailUrl(url)} alt="" width={56} height={74} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" />;
}
