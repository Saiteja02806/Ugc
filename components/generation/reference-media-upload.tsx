"use client";

import { ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReferenceUploadPreview } from "@/components/generation/reference-upload-preview";
import { Button } from "@/components/ui/button";
import { uploadAIStudioReferenceMedia, type AIStudioReferenceKind, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";

export function ReferenceMediaUpload({ active = true, allowedKinds, disabled = false, maxVideoDurationSeconds = 3, selection, onChange, onPendingChange }: {
  active?: boolean;
  allowedKinds: readonly AIStudioReferenceKind[];
  disabled?: boolean;
  maxVideoDurationSeconds?: number;
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const [pending, setPending] = useState<{ file: File; kind: AIStudioReferenceKind; url?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busy = pending !== null;

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const selectFile = useCallback(async (file: File) => {
    if (disabled || busyRef.current) return;
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
    setErrorMessage(null);
    if (!allowedKinds.includes(kind)) {
      setErrorMessage(`Choose a reference ${allowedKinds.join(" or ")}.`);
      return;
    }
    busyRef.current = true;
    const url = kind === "image" ? URL.createObjectURL(file) : undefined;
    previewUrlRef.current = url ?? null;
    setPending({ file, kind, url });
    onPendingChange?.(true);
    try {
      onChange(await uploadAIStudioReferenceMedia(file, kind, maxVideoDurationSeconds));
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message ? error.message : `Could not upload this reference ${kind}.`);
    } finally {
      if (url) URL.revokeObjectURL(url);
      previewUrlRef.current = null;
      busyRef.current = false;
      setPending(null);
      onPendingChange?.(false);
    }
  }, [allowedKinds, disabled, maxVideoDurationSeconds, onChange, onPendingChange]);

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
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain px-1 py-1.5">
        <input ref={inputRef} type="file" accept={allowedKinds.flatMap((kind) => REFERENCE_ACCEPTS[kind]).join(",")} className="hidden" aria-label={buttonLabel} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void selectFile(file);
        }} />
        <Button type="button" variant="muted" size="icon-sm" className="size-9 shrink-0 rounded-lg border border-dashed border-border text-muted" aria-label={buttonLabel} title={`${buttonLabel}. Choose, drop, or paste a file.`} disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : selection ? <RefreshCw className="size-4" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
        </Button>
        {pending ? <ReferenceUploadPreview kind={pending.kind} url={pending.url} name={pending.file.name} label="Reference" pending /> : selection ? <ReferenceUploadPreview kind={selection.kind} url={selection.asset.url} name={`reference ${selection.kind}`} label="Reference" disabled={disabled || busy} onRemove={() => onChange(null)} /> : null}
      </div>
      {errorMessage ? <p role="alert" className="text-xs font-medium text-destructive">{errorMessage}</p> : null}
    </div>
  );
}

const REFERENCE_ACCEPTS: Record<AIStudioReferenceKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-wav"],
};
