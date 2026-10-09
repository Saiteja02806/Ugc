"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReferenceUploadPreview } from "@/components/generation/reference-upload-preview";
import { Button } from "@/components/ui/button";
import { getReferenceFileKind, REFERENCE_FILE_ACCEPT, validateReferenceFileBatch } from "@/lib/ai-studio/reference-files";
import { uploadAIStudioReferenceMedia, type AIStudioReferenceKind, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";

type PendingReference = { file: File; kind: AIStudioReferenceKind; url?: string; index: number };

export function ReferenceFilesUpload({ active, allowedKinds, disabled, maxFiles, onChange, onPendingChange, selections }: {
  active: boolean;
  allowedKinds: AIStudioReferenceKind[];
  disabled: boolean;
  maxFiles: number;
  onChange: (selections: AIStudioReferenceMedia[]) => void;
  onPendingChange: (pending: boolean) => void;
  selections: AIStudioReferenceMedia[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionsRef = useRef(selections);
  const busyRef = useRef(false);
  const previewUrlsRef = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingReference[]>([]);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { selectionsRef.current = selections; }, [selections]);
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (disabled || busyRef.current || !files.length) return;
    const batchError = validateReferenceFileBatch(files.map((file) => file.type), selectionsRef.current.map((item) => item.kind), allowedKinds, maxFiles);
    setError(batchError);
    if (batchError) return;
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
        const uploaded = await uploadAIStudioReferenceMedia(preview.file, preview.kind, 30);
        selectionsRef.current = [...selectionsRef.current, uploaded];
        onChange(selectionsRef.current);
        setPending((items) => items.filter((item) => item.index !== preview.index));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this reference file.");
    } finally {
      for (const preview of previews) {
        if (preview.url) { URL.revokeObjectURL(preview.url); previewUrlsRef.current.delete(preview.url); }
      }
      busyRef.current = false;
      setPending([]);
      setBusy(false);
      onPendingChange(false);
    }
  }, [allowedKinds, disabled, maxFiles, onChange, onPendingChange]);

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
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain px-1 py-1.5">
        <input ref={inputRef} type="file" multiple accept={allowedKinds.map((kind) => REFERENCE_FILE_ACCEPT[kind]).join(",")} aria-label="Add reference files" className="hidden" onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void addFiles(files);
        }} />
        <Button type="button" variant="muted" size="icon-sm" className="size-9 shrink-0 rounded-lg border border-dashed border-border text-muted" aria-label={busy ? "Uploading reference files" : "Add reference files"} disabled={disabled || busy || selections.length >= maxFiles} title={`Choose, drop, or paste ${allowedKinds.join(", ")} files`} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        </Button>
        {selections.map((selection, index) => (
          <div key={selection.asset.id} className="flex shrink-0 items-center gap-2">
            <ReferenceUploadPreview kind={selection.kind} url={selection.asset.url} name={selection.asset.fileName || selection.asset.title} label={`${selection.kind === "image" ? "Image" : selection.kind === "video" ? "Video" : "Audio"} ${index + 1}`} disabled={disabled || busy} onRemove={() => {
              const next = selections.filter((item) => item.asset.id !== selection.asset.id);
              selectionsRef.current = next;
              onChange(next);
            }} />
            {selection.kind === "audio" ? <audio src={selection.asset.url} controls preload="none" aria-label={`Preview ${selection.asset.fileName || selection.asset.title}`} className="h-8 w-40" /> : null}
          </div>
        ))}
        {pending.map((preview) => <ReferenceUploadPreview key={preview.index} kind={preview.kind} url={preview.url} name={preview.file.name} label="Reference" pending queued={preview.index > uploadIndex} />)}
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
