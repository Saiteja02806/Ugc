"use client";

import { Check, Loader2, RefreshCw, UserRound, Video } from "lucide-react";
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
import creation from "@/components/explore/workflow-creation.module.css";
import studio from "@/components/explore/workflow-studio.module.css";

type Kind = "image" | "video";

/** Optional generation guidance; imported editor footage uses the separate source picker. */
export function FormatGenerationReferences({ selection, onChange, onPendingChange, disabled, preview, ownerId, defaultImage, onClearDefault, active = true }: {
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange: (pending: boolean) => void;
  disabled: boolean;
  preview: boolean;
  ownerId?: string;
  defaultImage?: LocalWorkflowMedia;
  onClearDefault?: () => void;
  active?: boolean;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const localImage = useLocalWorkflowMedia("image");
  const localVideo = useLocalWorkflowMedia("video");
  const [pending, setPending] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    if (disabled || pending) return;
    const request = ++revision.current;
    setError(null); setPending(kind); onPendingChange(true);
    try {
      const file = typeof input === "function" ? await input() : input;
      if (request !== revision.current) return;
      if (preview) {
        const metadata = await readAIStudioReferenceMetadata(file, kind, 3);
        if (request !== revision.current) return;
        const local = kind === "image" ? localImage : localVideo;
        if (await local.choose(file, { maxDuration: kind === "video" ? 3 : undefined, onRead: asset => {
          if (request !== revision.current) return;
          // The generator is always locked in preview. This local attachment
          // mirrors the controls without creating an owned upload record.
          onChange({ kind, asset: {
            collection: kind, createdAt: "", updatedAt: "", durationSeconds: asset.duration,
            fileName: file.name, fileSizeBytes: file.size, height: metadata.height, width: metadata.width,
            id: `local:${asset.url}`, metadata: { preview: true }, mimeType: file.type,
            parentAssetId: null, projectId: kind === "image" ? source === "catalog" ? CATALOG_REFERENCE_IMAGE_PROJECT : USER_REFERENCE_IMAGE_PROJECT : null, ratio: metadata.ratio, sourceRecordId: null,
            sourceType: "upload", status: "ready", thumbnailUrl: null, title: file.name, url: asset.url,
          } });
          onAccepted?.();
        } })) {
          if (request !== revision.current) return;
          if (kind === "image") localVideo.remove(); else localImage.remove();
        }
      } else {
        if (!ownerId) throw new Error("Sign in before adding a reference.");
        const uploaded = kind === "image"
          ? await uploadAIStudioReferenceMedia(file, kind, 3, ownerId, { purpose: source === "catalog" ? CATALOG_REFERENCE_IMAGE_PROJECT : USER_REFERENCE_IMAGE_PROJECT })
          : await uploadAIStudioReferenceMedia(file, kind, 3, ownerId);
        if (request !== revision.current) return;
        if (kind === "image" && source === "upload") {
          await queryClient.cancelQueries({ queryKey: imagesKey });
          if (request !== revision.current) return;
          queryClient.setQueryData<MediaAsset[]>(imagesKey, previous => [uploaded.asset, ...(previous ?? []).filter(item => item.id !== uploaded.asset.id)]);
          setImageTab("user");
        }
        if (request === revision.current) { onChange(uploaded); onAccepted?.(); }
      }
    } catch (cause) {
      if (request === revision.current) setError(cause instanceof Error ? cause.message : "Could not add this reference.");
    } finally {
      if (request === revision.current) { setPending(null); onPendingChange(false); }
    }
  }
  async function chooseSavedImage(saved: MediaAsset) {
    if (disabled || pending || preview || !ownerId) return;
    const request = ++revision.current;
    setError(null); setPending("image"); onPendingChange(true);
    try {
      const asset = await fetchFormatReferenceImage(saved.id, ownerId);
      if (request !== revision.current) return;
      onChange({ kind: "image", asset });
      localImage.remove(); localVideo.remove(); setOpenKind(null);
    } catch (cause) {
      if (request === revision.current) setError(cause instanceof Error ? cause.message : "Could not use this image.");
    } finally {
      if (request === revision.current) { setPending(null); onPendingChange(false); }
    }
  }
  function remove() { localImage.remove(); localVideo.remove(); setError(null); onChange(null); onClearDefault?.(); setOpenKind(null); }
  const localError = localImage.error ?? localVideo.error;
  const catalogSelection = selection?.kind === "image" && (selection.asset.projectId === CATALOG_REFERENCE_IMAGE_PROJECT || selection.asset.projectId === "ai-studio") ? selection.asset.fileName : null;

  return <section aria-label="Optional generation references" className="space-y-2">
    <p className="text-xs text-muted">Optional references</p>
    <div className={creation.referenceGrid}>
      {(["image", "video"] as const).map(kind => {
        const local = kind === "image" ? localImage.asset : localVideo.asset;
        const asset = selection?.kind === kind ? { name: selection.asset.fileName ?? selection.asset.title, url: selection.asset.url, duration: selection.asset.durationSeconds } : !selection && kind === "image" && defaultImage ? defaultImage : preview && !selection ? local : null;
        const input = kind === "image" ? imageInput : videoInput;
        const uploadActions = <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={disabled || Boolean(pending)} onClick={() => input.current?.click()} className="h-9 rounded-lg text-sm">{kind === "image" ? "Upload image" : asset ? "Replace video" : "Attach video"}</Button>
          {asset ? <Button type="button" variant="ghost" aria-label={`Remove ${kind} reference`} disabled={disabled || Boolean(pending)} onClick={remove} className="h-9 rounded-lg text-sm">{kind === "image" ? "None" : "Remove video"}</Button> : null}
          {kind === "image" && activeImageTab === "user" && !preview && ownerId ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh your images" title="Refresh your images" disabled={Boolean(pending) || imagesQuery.isFetching} onClick={() => void imagesQuery.refetch()}><RefreshCw className={cn("size-3.5", imagesQuery.isFetching && "animate-spin motion-reduce:animate-none")} aria-hidden="true" /></Button> : null}
        </div>;
        return <div key={kind} className="relative min-w-0">
          <input ref={input} type="file" className="hidden" aria-label={`Choose optional ${kind} reference`} accept={kind === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4,video/quicktime,video/webm"} disabled={disabled || Boolean(pending)} onChange={event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void choose(kind, file);
          }} />
          <Popover open={active && openKind === kind} onOpenChange={open => { if (open && kind === "image") setImageTab(null); setOpenKind(open ? kind : null); }}>
            <PopoverTrigger render={<Button type="button" variant="outline" aria-label={`${asset ? "Replace" : "Add"} ${kind} reference`} aria-busy={pending === kind} title={asset?.name ?? `Choose an optional ${kind} reference`} disabled={disabled || Boolean(pending)} data-state={pending === kind ? "loading" : asset ? "selected" : "empty"} className={creation.referenceButton} />}>
              {pending === kind ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : asset ? <ReferenceThumbnail kind={kind} asset={asset} /> : kind === "image" ? <>
                {CREATOR_REFERENCES[0] ? <ReferenceThumbnail kind="image" asset={{ name: "", url: CREATOR_REFERENCES[0].src, duration: null }} available /> : null}<UserRound className="relative size-5" aria-hidden="true" />
              </> : <Video className="size-5" aria-hidden="true" />}
              <span className={creation.referenceLabel}>{pending === kind ? "Preparing…" : kind === "image" ? "Choose image" : "Video reference"}</span>
              {asset ? <Check className={creation.referenceCheck} aria-label={`${kind} attached`} /> : null}
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
              <PopoverTitle>{kind === "image" ? "Choose image" : "Video reference"}</PopoverTitle>
              {kind === "image" ? uploadActions : <p className="text-sm leading-6 text-muted">Optional video up to 3 seconds, in 9:16 or 16:9. Output follows the clip’s length. Add narration in Edit video.</p>}
              {asset ? <>{kind === "image" ? <ReferenceImagePreview asset={asset} /> : <WorkflowMediaPlayer asset={asset} kind="video" label="Video reference preview" className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" />}<p className="break-all text-xs text-muted">{asset.name}</p></> : null}
              {kind === "video" ? uploadActions : null}
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
                    : imagesQuery.data?.length ? <div className="grid grid-cols-5 gap-2">{imagesQuery.data.map(saved => <Button key={saved.id} type="button" variant="ghost" aria-label={`Use your image ${saved.fileName ?? saved.title}`} title={saved.fileName ?? saved.title} aria-pressed={selection?.kind === "image" && selection.asset.id === saved.id} disabled={disabled || Boolean(pending)} className="relative h-auto overflow-hidden rounded-xl p-0" onClick={() => void chooseSavedImage(saved)}>
                      <ReferenceCreatorImage url={saved.thumbnailUrl ?? saved.url} />{selection?.kind === "image" && selection.asset.id === saved.id ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}
                    </Button>)}</div> : <p className="text-xs leading-5 text-muted">Upload an image to keep it here for next time.</p>}
                </Tabs.Panel>
                <Tabs.Panel value="catalog" keepMounted aria-label="UGC Pilot images" className="max-h-72 overflow-y-auto p-1">
                  <div className="grid grid-cols-5 gap-2">{CREATOR_REFERENCES.map((reference, index) => <Button key={reference.id} type="button" variant="ghost" aria-label={`Use creator ${index + 1}`} aria-pressed={catalogSelection === reference.fileName} disabled={disabled || Boolean(pending)} className="relative h-auto overflow-hidden rounded-xl p-0" onClick={() => void choose("image", async () => {
                const response = await fetch(reference.src); if (!response.ok) throw new Error("Could not load this creator image.");
                const blob = await response.blob(); return new File([blob], reference.fileName, { type: blob.type || "image/png" });
              }, () => setOpenKind(null), "catalog")}><ReferenceCreatorImage url={reference.src} />{catalogSelection === reference.fileName ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}</Button>)}</div>
                </Tabs.Panel>
              </Tabs.Root> : null}
              {error || localError ? <p role="alert" className="text-xs leading-5 text-destructive">{error ?? localError}</p> : null}
            </PopoverContent>
          </Popover>
        </div>;
      })}
    </div>
    {pending ? <p role="status" className={creation.sectionHelp}>Reading your reference…</p> : null}
    {error || localError ? <p role="alert" className="text-xs leading-5 text-destructive">{error ?? localError}</p> : null}
  </section>;
}

function ReferenceThumbnail({ kind, asset, available = false }: { kind: Kind; asset: LocalWorkflowMedia; available?: boolean }) {
  return kind === "image"
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={asset.url} alt="" className={available ? creation.referenceAvailable : creation.referenceMedia} />
    : <ReferenceVideoThumbnail url={asset.url} />;
}

function ReferenceImagePreview({ asset }: { asset: LocalWorkflowMedia }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.url} alt="Selected image reference" className="mx-auto max-h-56 max-w-full rounded-lg object-contain" />;
}
function ReferenceCreatorImage({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={56} height={74} loading="lazy" className="aspect-[3/4] w-full object-cover" />;
}
