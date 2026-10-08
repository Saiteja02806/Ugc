"use client";

import { Check, Loader2, UserRound, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLocalWorkflowMedia, type LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { cn } from "@/lib/utils";
import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { ReferenceVideoThumbnail } from "@/components/explore/workflow-creation-form";
import creation from "@/components/explore/workflow-creation.module.css";
import studio from "@/components/explore/workflow-studio.module.css";

type Kind = "image" | "video";

/** Optional generation guidance; imported editor footage uses the separate source picker. */
export function FormatGenerationReferences({ selection, onChange, onPendingChange, disabled, preview, ownerId, styleVideo, onClearStyle, active = true }: {
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange: (pending: boolean) => void;
  disabled: boolean;
  preview: boolean;
  ownerId?: string;
  styleVideo?: LocalWorkflowMedia;
  onClearStyle?: () => void;
  active?: boolean;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  const localImage = useLocalWorkflowMedia("image");
  const localVideo = useLocalWorkflowMedia("video");
  const [pending, setPending] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKind, setOpenKind] = useState<Kind | null>(null);
  const [wasActive, setWasActive] = useState(active);
  const pendingCallback = useRef(onPendingChange);
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => () => { revision.current += 1; pendingCallback.current(false); }, [ownerId]);
  if (wasActive !== active) { setWasActive(active); setOpenKind(null); }

  async function choose(kind: Kind, input: File | (() => Promise<File>), onAccepted?: () => void) {
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
            parentAssetId: null, projectId: null, ratio: metadata.ratio, sourceRecordId: null,
            sourceType: "upload", status: "ready", thumbnailUrl: null, title: file.name, url: asset.url,
          } });
          onAccepted?.();
        } })) {
          if (request !== revision.current) return;
          if (kind === "image") localVideo.remove(); else localImage.remove();
        }
      } else {
        if (!ownerId) throw new Error("Sign in before adding a reference.");
        const uploaded = await uploadAIStudioReferenceMedia(file, kind, 3, ownerId);
        if (request === revision.current) { onChange(uploaded); onAccepted?.(); }
      }
    } catch (cause) {
      if (request === revision.current) setError(cause instanceof Error ? cause.message : "Could not add this reference.");
    } finally {
      if (request === revision.current) { setPending(null); onPendingChange(false); }
    }
  }
  function remove() { localImage.remove(); localVideo.remove(); setError(null); onChange(null); setOpenKind(null); }
  const localError = localImage.error ?? localVideo.error;

  return <section aria-label="Optional generation references" className="space-y-2">
    <p className="text-xs text-muted">Optional references</p>
    <div className={creation.referenceGrid} data-workflow-reference-grid>
      {(["image", "video"] as const).map(kind => {
        const local = kind === "image" ? localImage.asset : localVideo.asset;
        const isStyle = kind === "video" && selection?.kind !== "video" && Boolean(styleVideo);
        const asset = selection?.kind === kind ? { name: selection.asset.fileName ?? selection.asset.title, url: selection.asset.url, duration: selection.asset.durationSeconds } : isStyle ? styleVideo : preview && !selection ? local : null;
        const input = kind === "image" ? imageInput : videoInput;
        return <div key={kind} className="relative min-w-0">
          <input ref={input} type="file" className="hidden" aria-label={`Choose optional ${kind} reference`} accept={kind === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4,video/quicktime,video/webm"} disabled={disabled || Boolean(pending)} onChange={event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void choose(kind, file);
          }} />
          <Popover open={active && openKind === kind} onOpenChange={open => setOpenKind(open ? kind : null)}>
            <PopoverTrigger render={<Button type="button" variant="outline" data-workflow-tile="reference" aria-label={isStyle ? "Preview video style reference" : `${asset ? "Replace" : "Add"} ${kind} reference`} aria-busy={pending === kind} title={asset?.name ?? `Choose an optional ${kind} reference`} disabled={disabled || Boolean(pending)} data-state={pending === kind ? "loading" : asset ? "selected" : "empty"} className={creation.referenceButton} />}>
              {pending === kind ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : asset ? <ReferenceThumbnail kind={kind} asset={asset} /> : kind === "image" ? <>
                {CREATOR_REFERENCES[0] ? <ReferenceThumbnail kind="image" asset={{ name: "", url: CREATOR_REFERENCES[0].src, duration: null }} available /> : null}<UserRound className="relative size-5" aria-hidden="true" />
              </> : <Video className="size-5" aria-hidden="true" />}
              <span className={creation.referenceLabel}>{pending === kind ? "Preparing…" : isStyle ? "Style video" : kind === "image" ? "Choose image" : "Choose video"}</span>
              {asset ? <Check className={creation.referenceCheck} aria-label={isStyle ? "Video style selected" : `${kind} attached`} /> : null}
            </PopoverTrigger>
            <PopoverContent ref={popup} initialFocus={popup} tabIndex={-1} side="bottom" align="center" className={cn(studio.floating, creation.floating)} style={{ maxHeight: "min(calc(100dvh - 2rem), var(--available-height))", maxWidth: "min(calc(100vw - 2rem), var(--available-width))" }}>
              <PopoverTitle>{isStyle ? "Selected style video" : kind === "image" ? "Choose image" : "Video reference"}</PopoverTitle>
              <p className="text-sm leading-6 text-muted">{isStyle ? "Watch your selected gallery example. Describe the style you want in your instructions, or upload a video to use as generation input." : kind === "image" ? "Optional image. Your instructions decide how it appears. Choose an image or a video reference." : "Optional video up to 3 seconds, in 9:16 or 16:9. Output follows the clip’s length. Choose Edit below your preview to add narration."}</p>
              {asset ? <>{kind === "image" ? <ReferenceImagePreview asset={asset} /> : <WorkflowMediaPlayer asset={asset} kind="video" label={isStyle ? "Selected style video preview" : "Video reference preview"} className="mx-auto aspect-auto h-auto max-h-[40dvh] w-auto max-w-full bg-transparent" />}<p className="break-all text-xs text-muted">{asset.name}</p></> : null}
              <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={disabled || Boolean(pending)} onClick={() => input.current?.click()} className="h-9 rounded-lg text-sm">{kind === "image" ? "Upload image" : isStyle ? "Upload video reference" : asset ? "Replace video" : "Attach video"}</Button>
                {asset ? <Button type="button" variant="ghost" aria-label={isStyle ? "Clear style example" : `Remove ${kind} reference`} disabled={disabled || Boolean(pending)} onClick={isStyle ? () => { onClearStyle?.(); setOpenKind(null); } : remove} className="h-9 rounded-lg text-sm">{isStyle ? "Clear example" : kind === "image" ? "None" : "Remove video"}</Button> : null}</div>
              {kind === "image" ? <div className="grid max-h-60 grid-cols-5 gap-2 overflow-y-auto py-1">{CREATOR_REFERENCES.map((reference, index) => <Button key={reference.id} type="button" variant="ghost" aria-label={`Use creator ${index + 1}`} aria-pressed={asset?.name === reference.fileName} disabled={disabled || Boolean(pending)} className="relative h-auto overflow-hidden rounded-xl p-0" onClick={() => void choose("image", async () => {
                const response = await fetch(reference.src); if (!response.ok) throw new Error("Could not load this creator image.");
                const blob = await response.blob(); return new File([blob], reference.fileName, { type: blob.type || "image/png" });
              }, () => setOpenKind(null))}><ReferenceCreatorImage url={reference.src} />{asset?.name === reference.fileName ? <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" aria-hidden="true" /></span> : null}</Button>)}</div> : null}
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
  return <img src={url} alt="" width={56} height={74} className="aspect-[3/4] w-full object-cover" />;
}
