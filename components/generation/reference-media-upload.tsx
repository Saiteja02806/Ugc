"use client";

import { ImagePlus, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ReferenceUploadPreview } from "@/components/generation/reference-upload-preview";
import { Button } from "@/components/ui/button";
import { uploadAIStudioReferenceMedia, type AIStudioReferenceKind, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getReferenceImageFileError } from "@/lib/generation/reference-image";

export function ReferenceMediaUpload({ active = true, allowedKinds, disabled = false, expectedUserId, maxVideoDurationSeconds = 3, selection, onChange, onPendingChange, onErrorChange, inline = false, referencePreview }: {
  active?: boolean;
  allowedKinds: readonly AIStudioReferenceKind[];
  disabled?: boolean;
  expectedUserId?: string;
  maxVideoDurationSeconds?: number;
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange?: (pending: boolean) => void;
  onErrorChange?: (message: string | null) => void;
  inline?: boolean;
  referencePreview?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const [pending, setPending] = useState<{ file: File; kind: AIStudioReferenceKind; url?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busy = pending !== null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const setUploadError = useCallback((message: string | null) => {
    setErrorMessage(message);
    onErrorChange?.(message);
  }, [onErrorChange]);

  const selectFile = useCallback(async (file: File) => {
    if (disabled || busyRef.current) return;
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
    setUploadError(null);
    if (!allowedKinds.includes(kind)) {
      setUploadError(`Choose a reference ${allowedKinds.join(" or ")}.`);
      return;
    }
    const imageError = kind === "image" ? getReferenceImageFileError(file) : null;
    if (imageError) { setUploadError(imageError); return; }
    busyRef.current = true;
    const url = kind === "image" ? URL.createObjectURL(file) : undefined;
    previewUrlRef.current = url ?? null;
    setPending({ file, kind, url });
    onPendingChange?.(true);
    try {
      const uploaded = await uploadAIStudioReferenceMedia(file, kind, maxVideoDurationSeconds, expectedUserId);
      if (mountedRef.current) onChange(uploaded);
    } catch (error) {
      if (mountedRef.current) setUploadError(error instanceof Error && error.message ? error.message : `Could not upload this reference ${kind}.`);
    } finally {
      if (url) URL.revokeObjectURL(url);
      previewUrlRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) {
        setPending(null);
        onPendingChange?.(false);
      }
    }
  }, [allowedKinds, disabled, expectedUserId, maxVideoDurationSeconds, onChange, onPendingChange, setUploadError]);

  useEffect(() => {
    if (!active) return;
    const form = inputRef.current?.closest("form");
    if (!form) return;
    function handlePaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((candidate) => candidate.type.startsWith("image/")) ?? Array.from(event.clipboardData?.items ?? []).find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void selectFile(file);
    }
    function handleDragOver(event: DragEvent) {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    }
    function handleDrop(event: DragEvent) {
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      event.preventDefault();
      void selectFile(file);
    }
    form.addEventListener("paste", handlePaste);
    form.addEventListener("dragover", handleDragOver);
    form.addEventListener("drop", handleDrop);
    return () => {
      form.removeEventListener("paste", handlePaste);
      form.removeEventListener("dragover", handleDragOver);
      form.removeEventListener("drop", handleDrop);
    };
  }, [active, selectFile]);

  const allowedLabel = allowedKinds.join(" or ");
  const buttonLabel = selection ? `Replace reference ${selection.kind}` : `Add reference ${allowedLabel}`;
  const preview = pending ? <ReferenceUploadPreview kind={pending.kind} url={pending.url} name={pending.file.name} label="Reference" pending />
    : selection ? <ReferenceUploadPreview kind={selection.kind} url={selection.asset.url} name={`reference ${selection.kind}`} label="Reference" disabled={disabled || busy} onRemove={() => { setUploadError(null); onChange(null); }} />
    : referencePreview;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain px-1 py-1.5">
        <input ref={inputRef} type="file" disabled={disabled || busy} accept={allowedKinds.flatMap((kind) => REFERENCE_ACCEPTS[kind]).join(",")} className="hidden" aria-label={buttonLabel} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void selectFile(file);
        }} />
        {inline ? preview : null}
        <Button type="button" variant="muted" size="icon-sm" className="size-9 shrink-0 rounded-lg border border-dashed border-border text-muted" aria-label={buttonLabel} title={`${buttonLabel}. Choose, drop, or paste a file.`} disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : inline ? <Plus className="size-4" aria-hidden="true" /> : selection ? <RefreshCw className="size-4" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
        </Button>
        {!inline ? preview : null}
      </div>
      {errorMessage ? <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs font-medium text-destructive">{errorMessage}</p>{onErrorChange ? <Button type="button" variant="ghost" size="sm" onClick={() => setUploadError(null)}>Remove failed reference</Button> : null}</div> : null}
    </div>
  );
}

const REFERENCE_ACCEPTS: Record<AIStudioReferenceKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-wav"],
};
