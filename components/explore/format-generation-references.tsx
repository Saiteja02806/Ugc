"use client";

import { Check, Loader2, Plus, RefreshCw, UserRound, Video } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useLocalWorkflowMedia, type LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { cn } from "@/lib/utils";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { CATALOG_REFERENCE_IMAGE_PROJECT, USER_REFERENCE_IMAGE_PROJECT, fetchFormatReferenceImage, fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import type { MediaAsset } from "@/lib/media/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { ReferenceVideoThumbnail } from "@/components/explore/workflow-creation-form";
import { WorkflowReferencePreview } from "@/components/explore/workflow-reference-preview";
import imagePreview from "@/components/explore/workflow-reference-preview.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import presentation from "@/components/explore/workflow-video-layout.module.css";
import studio from "@/components/explore/workflow-studio.module.css";

type Kind = "image" | "video";

/** Optional generation guidance; imported editor footage uses the separate source picker. */
export function FormatGenerationReferences({ selection, imageSelection, imageSelections, videoSelection, onImagesChange, maxImages = 6, onChange, onPendingChange, onErrorChange, disabled, preview, ownerId, styleVideo, onStyleVideoDurationChange, onClearStyle, active = true, videoInputEnabled = true }: {
  selection: AIStudioReferenceMedia | null;
  imageSelection?: AIStudioReferenceMedia | null;
  imageSelections?: AIStudioReferenceMedia[];
  onImagesChange?: (selections: AIStudioReferenceMedia[]) => void;
  maxImages?: number;
  videoSelection?: AIStudioReferenceMedia | null;
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
}) {
  const selectedImage = imageSelection === undefined ? selection?.kind === "image" ? selection : null : imageSelection;
  const selectedImages = imageSelections ?? (selectedImage ? [selectedImage] : []);
  const imageLimitReached = selectedImages.length >= maxImages;
  const selectedVideo = videoSelection === undefined ? selection?.kind === "video" ? selection : null : videoSelection;
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  const localImage = useLocalWorkflowMedia("image");
  const localVideo = useLocalWorkflowMedia("video");
  const [pending, setPending] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    staleTime: 0,
  });
  const activeImageTab = imageTab ?? (!preview && ownerId && imagesQuery.data?.length ? "user" : "catalog");
  const [wasActive, setWasActive] = useState(active);
  const pendingCallback = useRef(onPendingChange);
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => () => { revision.current += 1; pendingCallback.current(false); }, [ownerId]);
  if (wasActive !== active) { setWasActive(active); setOpenKind(null); }

  async function choose(kind: Kind, input: File | (() => Promise<File>), onAccepted?: () => void, source: "upload" | "catalog" = "upload") {
    if (disabled || pending || kind === "video" && !videoInputEnabled) return;
    if (kind === "image" && imageLimitReached) { setError(`Use up to ${maxImages} image references with these inputs.`); return; }
    const request = ++revision.current;
    setError(null); onErrorChange?.(null); setPending(kind); onPendingChange(true);
    try {
      const file = typeof input === "function" ? await input() : input;
      if (request !== revision.current) return;
      if (kind === "video" && file.size > 32 * 1024 ** 2) throw new Error("Use a reference video up to 32 MB.");
      if (preview) {
        const metadata = await readAIStudioReferenceMetadata(file, kind, 10);
        if (request !== revision.current) return;
        const local = kind === "image" ? localImage : localVideo;
        if (await local.choose(file, { maxDuration: kind === "video" ? 10 : undefined, onRead: asset => {
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
          : await uploadAIStudioReferenceMedia(file, kind, 10, ownerId);
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
  async function chooseSavedImage(saved: MediaAsset) {
    if (disabled || pending || preview || !ownerId) return;
    if (selectedImages.some(image => image.asset.id === saved.id)) return;
    if (imageLimitReached) { setError(`Use up to ${maxImages} image references with these inputs.`); return; }
    const request = ++revision.current;
    setError(null); onErrorChange?.(null); setPending("image"); onPendingChange(true);
    try {
      const asset = await fetchFormatReferenceImage(saved.id, ownerId);
      if (request !== revision.current) return;
      onChange({ kind: "image", asset }, "image");
      localImage.remove(); setOpenKind(null);
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
    (kind === "image" ? localImage : localVideo).remove(); setError(null); onErrorChange?.(null); onChange(null, kind); setOpenKind(null);
  }
  function removeImage(image: AIStudioReferenceMedia) {
    if (disabled || pending) return;
    if (!onImagesChange) { remove("image"); return; }
    onImagesChange(selectedImages.filter(item => item.asset.id !== image.asset.id));
    setError(null); onErrorChange?.(null);
  }
  function removeStyleVideo() {
    if (disabled || pending) return;
    onClearStyle?.(); setError(null); onErrorChange?.(null); setOpenKind(null);
  }
  const catalogSelections = selectedImages.filter(image => image.asset.projectId === CATALOG_REFERENCE_IMAGE_PROJECT || image.asset.projectId === "ai-studio").map(image => image.asset.fileName);

  return <section aria-label="Optional generation references" className={cn(presentation.referenceGroup, presentation.classicReferences)}>
    <div className={presentation.referenceHeading}><h3>Optional references</h3></div>
    <div className={creation.referenceGrid} data-workflow-reference-grid>
      {(["image", "video"] as const).filter(kind => kind === "image" || videoInputEnabled || Boolean(styleVideo) || Boolean(selectedVideo)).map(kind => {
        const selected = kind === "image" ? selectedImages[0] ?? null : selectedVideo;
        const isStyle = kind === "video" && !selectedVideo && Boolean(styleVideo);
        const asset = selected ? { name: selected.asset.fileName ?? selected.asset.title, url: selected.asset.url, duration: selected.asset.durationSeconds } : isStyle ? styleVideo : null;
        const input = kind === "image" ? imageInput : videoInput;
        const uploadActions = <div className="flex flex-wrap items-center gap-2">{kind === "image" || videoInputEnabled ? <Button type="button" variant="outline" disabled={disabled || Boolean(pending) || kind === "image" && imageLimitReached} onClick={() => input.current?.click()} className="h-9 rounded-lg text-sm">{kind === "image" ? "Add image" : isStyle ? "Upload video reference" : asset ? "Replace video" : "Attach video"}</Button> : null}
          {asset ? <Button type="button" variant="ghost" aria-label={isStyle ? "Remove gallery video reference" : `Remove ${kind} reference`} disabled={disabled || Boolean(pending)} onClick={isStyle ? removeStyleVideo : () => remove(kind)} className="h-9 rounded-lg text-sm">{kind === "image" ? "None" : "Remove video"}</Button> : null}
          {kind === "image" && activeImageTab === "user" && !preview && ownerId ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh your images" title="Refresh your images" disabled={Boolean(pending) || imagesQuery.isFetching} onClick={() => void imagesQuery.refetch()}><RefreshCw className={cn("size-3.5", imagesQuery.isFetching && "animate-spin motion-reduce:animate-none")} aria-hidden="true" /></Button> : null}
        </div>;
        return <div key={kind} data-reference-state={asset ? "selected" : "empty"} className={cn("relative min-w-0", presentation.referenceCard)}>
          <input ref={input} type="file" className="hidden" aria-label={`Choose optional ${kind} reference`} accept={kind === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4,video/quicktime,video/webm"} disabled={disabled || Boolean(pending) || kind === "video" && !videoInputEnabled} onChange={event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void choose(kind, file);
          }} />
          <div className={imagePreview.picker}>
          {kind === "image" && selectedImages.length ? <><div className={imagePreview.images} data-count={selectedImages.length}>{selectedImages.map(image => <WorkflowReferencePreview key={image.asset.id} url={image.asset.url} name={image.asset.fileName ?? image.asset.title} disabled={disabled || Boolean(pending)} onRemove={() => removeImage(image)} />)}</div>{selectedImages.length > 1 ? <span className={imagePreview.count}>{selectedImages.length} images</span> : null}</> : asset ? <WorkflowReferencePreview key={asset.url} kind={kind} url={asset.url} name={asset.name ?? "Selected reference"} disabled={disabled || Boolean(pending)} onRemove={isStyle ? onClearStyle ? removeStyleVideo : undefined : () => remove(kind)} media={kind === "video" ? <ReferenceVideoThumbnail url={asset.url} onDurationChange={isStyle ? duration => onStyleVideoDurationChange?.(asset.url, duration) : undefined} /> : undefined} /> : null}
          <Popover open={active && openKind === kind} onOpenChange={open => { if (open && kind === "image") setImageTab(null); setOpenKind(open ? kind : null); }}>
            <PopoverTrigger render={<Button type="button" variant="outline" data-workflow-tile="reference" aria-label={isStyle ? "Choose gallery video reference" : `${asset ? "Replace" : "Add"} ${kind} reference`} aria-busy={pending === kind} title={asset?.name ?? `Choose an optional ${kind} reference`} disabled={disabled || Boolean(pending)} data-state={pending === kind ? "loading" : asset ? "selected" : "empty"} className={cn(creation.referenceButton, imagePreview.action)} />}>
              {pending === kind ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : !asset ? kind === "image" ? <UserRound aria-hidden="true" /> : <Video aria-hidden="true" /> : null}
              {pending === kind || !asset ? <span className={creation.referenceLabel}>{pending === kind ? "Preparing…" : kind === "image" ? "Choose image" : "Choose video"}</span> : null}<Plus className={imagePreview.add} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent ref={popup} initialFocus={popup} tabIndex={-1} side="bottom" align="center" className={cn(studio.floating, creation.floating)} style={{ maxHeight: "min(calc(100dvh - 2rem), var(--available-height))", maxWidth: "min(calc(100vw - 2rem), var(--available-width))" }}>
              <PopoverTitle>{kind === "image" ? "Choose image" : "Video reference"}</PopoverTitle>
              <p className="text-sm leading-6 text-muted">{isStyle ? "This gallery clip will be sent to generation as the source video. Add images for appearance and describe the changes you want. Clips over 10 seconds must be trimmed and uploaded first." : kind === "image" ? `Add up to ${maxImages} appearance or product images. Describe how to use each image in your instructions.` : "Source video up to 10 seconds and 32 MB. Keep images alongside it for appearance. The edit follows the source clip's actions and timing."}</p>
              {asset ? <>{kind === "image" ? <ReferenceImagePreview asset={asset} /> : <WorkflowMediaPlayer asset={asset} kind="video" label="Video reference preview" className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" />}<p className="break-all text-xs text-muted">{asset.name}</p></> : null}
              {uploadActions}
              {kind === "image" && onImagesChange && selectedImages.length ? <div className="grid grid-cols-3 gap-2" aria-label="Selected image references">{selectedImages.map(image => <div key={image.asset.id} className="overflow-hidden rounded-lg"><ReferenceCreatorImage url={image.asset.url} /><Button type="button" variant="ghost" size="sm" disabled={disabled || Boolean(pending)} aria-label={`Remove image ${image.asset.fileName ?? image.asset.title}`} className="w-full" onClick={() => removeImage(image)}>Remove</Button></div>)}</div> : null}
              {kind === "image" ? <Tabs.Root value={activeImageTab} onValueChange={value => { if (value === "user" || value === "catalog") setImageTab(value); }} className="space-y-3">
                <Tabs.List aria-label="Image sources" className="flex gap-1 rounded-lg border border-border bg-card-muted p-1">
                  <Tabs.Tab value="user" type="button" className="flex-1 rounded-md px-2 py-2 text-xs font-medium text-muted hover:text-foreground-strong data-[active]:bg-card data-[active]:text-foreground-strong">Your images</Tabs.Tab>
                  <Tabs.Tab value="catalog" type="button" className="flex-1 rounded-md px-2 py-2 text-xs font-medium text-muted hover:text-foreground-strong data-[active]:bg-card data-[active]:text-foreground-strong">UGC Pilot images</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="user" keepMounted aria-label="Your images" className="max-h-72 space-y-2 overflow-y-auto p-1">
                  {preview ? <p className="text-xs leading-5 text-muted">Sign in to save and reuse your uploaded images. Preview uploads are temporary.</p>
                    : !ownerId ? <p className="text-xs leading-5 text-muted">Sign in to see your saved images.</p>
                    : imagesQuery.isPending ? <p role="status" className="text-xs text-muted">Loading your images…</p>
                    : imagesQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not load your images. Use Refresh to try again.</p>
                    : imagesQuery.data?.length ? <div className="grid grid-cols-5 gap-2">{imagesQuery.data.map(saved => <Button key={saved.id} type="button" variant="ghost" aria-label={`Use your image ${saved.fileName ?? saved.title}`} title={saved.fileName ?? saved.title} aria-pressed={selectedImages.some(image => image.asset.id === saved.id)} disabled={disabled || Boolean(pending) || imageLimitReached && !selectedImages.some(image => image.asset.id === saved.id)} className="relative h-auto overflow-hidden rounded-xl p-0" onClick={() => void chooseSavedImage(saved)}>
                      <ReferenceCreatorImage url={saved.thumbnailUrl ?? saved.url} />{selectedImages.some(image => image.asset.id === saved.id) ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}
                    </Button>)}</div> : <p className="text-xs leading-5 text-muted">Upload an image to keep it here for next time.</p>}
                </Tabs.Panel>
                <Tabs.Panel value="catalog" keepMounted aria-label="UGC Pilot images" className="max-h-72 overflow-y-auto p-1">
                  <div className="grid grid-cols-5 gap-2">{CREATOR_REFERENCES.map((reference, index) => <Button key={reference.id} type="button" variant="ghost" aria-label={`Use creator ${index + 1}`} aria-pressed={catalogSelections.includes(reference.fileName)} disabled={disabled || Boolean(pending)} className="relative h-auto overflow-hidden rounded-xl p-0" onClick={() => { if (catalogSelections.includes(reference.fileName)) return; void choose("image", async () => {
                const response = await fetch(reference.src); if (!response.ok) throw new Error("Could not load this creator image.");
                const blob = await response.blob(); return new File([blob], reference.fileName, { type: blob.type || "image/png" });
              }, () => setOpenKind(null), "catalog"); }}><ReferenceCreatorImage url={reference.src} />{catalogSelections.includes(reference.fileName) ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}</Button>)}</div>
                </Tabs.Panel>
              </Tabs.Root> : null}
              {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
            </PopoverContent>
          </Popover>
          </div>
        </div>;
      })}
    </div>
    {pending ? <p role="status" className={creation.sectionHelp}>Reading your reference…</p> : null}
    {error ? <div className="space-y-2"><p role="alert" className="text-xs leading-5 text-destructive">{error}</p><Button type="button" variant="ghost" size="sm" disabled={disabled || Boolean(pending)} onClick={() => { setError(null); onErrorChange?.(null); }}>Cancel reference change</Button></div> : null}
  </section>;
}

function ReferenceImagePreview({ asset }: { asset: LocalWorkflowMedia }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.url} alt="Selected image reference" className="mx-auto max-h-56 max-w-full rounded-lg object-contain" />;
}
function ReferenceCreatorImage({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={56} height={74} loading="lazy" className="aspect-[3/4] w-full object-cover" />;
}
