"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReferenceUploadPreview } from "@/components/generation/reference-upload-preview";
import { Button } from "@/components/ui/button";
import { getReferenceFileKind, REFERENCE_FILE_ACCEPT, validateReferenceFileBatch } from "@/lib/ai-studio/reference-files";
import { uploadAIStudioReferenceMedia, type AIStudioReferenceKind, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";

type PendingReference = { file: File; kind: AIStudioReferenceKind; url?: string; index: number };

export function ReferenceFilesUpload({ active, allowedKinds, disabled, expectedUserId, maxFiles, maxImageBytes = 20 * 1024 ** 2, maxTimedImageBytes = maxImageBytes, maxVideoDurationSeconds = 30, maxAudioDurationSeconds = 30, maxVideoBytes = 250 * 1024 ** 2, maxAudioBytes = 25 * 1024 ** 2, onChange, onPendingChange, onErrorChange, selections }: {
  active: boolean;
  allowedKinds: AIStudioReferenceKind[];
  disabled: boolean;
  expectedUserId?: string;
  maxFiles: number;
  maxImageBytes?: number;
  maxTimedImageBytes?: number;
  maxVideoDurationSeconds?: number;
  maxAudioDurationSeconds?: number;
  maxVideoBytes?: number;
  maxAudioBytes?: number;
  onChange: (selections: AIStudioReferenceMedia[]) => void;
  onPendingChange: (pending: boolean) => void;
  onErrorChange?: (error: string | null) => void;
  selections: AIStudioReferenceMedia[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionsRef = useRef(selections);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const previewUrlsRef = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingReference[]>([]);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const reportError = useCallback((message: string | null) => { setError(message); onErrorChange?.(message); }, [onErrorChange]);
  useEffect(() => { selectionsRef.current = selections; }, [selections]);
  useEffect(() => {
    mountedRef.current = true;
    const urls = previewUrlsRef.current;
    return () => { mountedRef.current = false; for (const url of urls) URL.revokeObjectURL(url); urls.clear(); onPendingChange(false); };
  }, [onPendingChange]);

  const addFiles = useCallback(async (files: File[]) => {
    if (disabled || busyRef.current || !files.length) return;
    const batchError = validateReferenceFileBatch(files.map((file) => file.type), selectionsRef.current.map((item) => item.kind), allowedKinds, maxFiles);
    reportError(batchError);
    if (batchError) return;
    if (!expectedUserId) { reportError("Sign in before uploading reference files."); return; }
    const hasTimedReferences = selectionsRef.current.some(item => item.kind !== "image") || files.some(file => getReferenceFileKind(file.type) !== "image");
    for (const file of files) {
      const kind = getReferenceFileKind(file.type);
      const limit = kind === "video" ? maxVideoBytes : kind === "audio" ? maxAudioBytes : hasTimedReferences ? maxTimedImageBytes : maxImageBytes;
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > limit) {
        reportError(`Choose a non-empty ${kind} file up to ${limit / 1024 ** 2} MB.`); return;
      }
    }
    busyRef.current = true;
    const previews = files.map((file, index) => {
      const kind = getReferenceFileKind(file.type)!;
      const url = kind === "image" ? URL.createObjectURL(file) : undefined;
      if (url) previewUrlsRef.current.add(url);
      return { file, kind, url, index };
    });
    setPending(previews);
    setUploadIndex(0);
    setBusy(true);
    onPendingChange(true);
    try {
      for (const preview of previews) {
        setUploadIndex(preview.index);
        const uploaded = await uploadAIStudioReferenceMedia(preview.file, preview.kind, maxVideoDurationSeconds, expectedUserId,
          { maxAudioDurationSeconds, requireVideoReferenceRatio: false });
        if (!mountedRef.current) return;
        selectionsRef.current = [...selectionsRef.current, uploaded];
        onChange(selectionsRef.current);
        setPending((items) => items.filter((item) => item.index !== preview.index));
      }
    } catch (cause) {
      if (mountedRef.current) reportError(cause instanceof Error ? cause.message : "Could not upload this reference file.");
    } finally {
      for (const preview of previews) {
        if (preview.url) { URL.revokeObjectURL(preview.url); previewUrlsRef.current.delete(preview.url); }
      }
      busyRef.current = false;
      if (mountedRef.current) { setPending([]); setBusy(false); onPendingChange(false); }
    }
  }, [allowedKinds, disabled, expectedUserId, maxFiles, maxImageBytes, maxTimedImageBytes, maxVideoDurationSeconds, maxAudioDurationSeconds, maxVideoBytes, maxAudioBytes, onChange, onPendingChange, reportError]);

  useEffect(() => {
    if (!active) return;
    const form = inputRef.current?.closest("form");
    if (!form) return;
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      void addFiles(files);
    }
    function handleDragOver(event: DragEvent) {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    }
    function handleDrop(event: DragEvent) {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      void addFiles(files);
    }
    form.addEventListener("paste", handlePaste);
    form.addEventListener("dragover", handleDragOver);
    form.addEventListener("drop", handleDrop);
    return () => {
      form.removeEventListener("paste", handlePaste);
      form.removeEventListener("dragover", handleDragOver);
      form.removeEventListener("drop", handleDrop);
    };
  }, [active, addFiles]);

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-1 py-1.5">
        <input ref={inputRef} type="file" multiple accept={allowedKinds.map((kind) => REFERENCE_FILE_ACCEPT[kind]).join(",")} aria-label="Add reference files" className="hidden" onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void addFiles(files);
        }} />
        <div data-reference-tile className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-border bg-card-muted">
        <div className={`absolute inset-0 grid gap-0.5 ${selections.length + pending.length > 4 ? "grid-cols-3" : selections.length + pending.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {selections.map((selection, index) => <ReferenceUploadPreview key={selection.asset.id} fillContainer kind={selection.kind} url={selection.asset.url} name={selection.asset.fileName || selection.asset.title} label={`${selection.kind === "image" ? "Image" : selection.kind === "video" ? "Video" : "Audio"} ${index + 1}`} disabled={disabled || busy} onRemove={() => { const next = selections.filter(item => item.asset.id !== selection.asset.id); selectionsRef.current = next; onChange(next); reportError(null); }} />)}
        {pending.map(preview => <ReferenceUploadPreview key={preview.index} fillContainer kind={preview.kind} url={preview.url} name={preview.file.name} label="Reference" pending queued={preview.index > uploadIndex} />)}
        </div>
        <Button type="button" variant="muted" size="icon-sm" className={selections.length || pending.length ? "absolute right-1.5 bottom-1.5 z-10 size-6 rounded-full border border-white/20 bg-black/75 text-white" : "absolute inset-0 size-full border-0 bg-transparent text-muted"} aria-label={busy ? "Uploading reference files" : "Add reference files"} disabled={disabled || busy || selections.length >= maxFiles} title={`Choose, drop, or paste ${allowedKinds.join(", ")} files`} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        </Button>
        </div>
        {selections.filter(selection => selection.kind === "audio").map(selection => <audio key={selection.asset.id} src={selection.asset.url} controls preload="none" aria-label={`Preview ${selection.asset.fileName || selection.asset.title}`} className="h-8 w-40" />)}
      </div>
      {error ? <div className="space-y-1"><p role="alert" className="text-xs text-destructive">{error}</p><Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={() => reportError(null)}>Cancel reference change</Button></div> : null}
    </div>
  );
}
