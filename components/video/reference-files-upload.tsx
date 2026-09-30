"use client";

import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getReferenceFileKind, REFERENCE_FILE_ACCEPT, validateReferenceFileBatch } from "@/lib/ai-studio/reference-files";
import { uploadAIStudioReferenceMedia, type AIStudioReferenceKind, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { selectionsRef.current = selections; }, [selections]);

  const addFiles = useCallback(async (files: File[]) => {
    if (disabled || busyRef.current || !files.length) return;
    const batchError = validateReferenceFileBatch(files.map((file) => file.type), selectionsRef.current.map((item) => item.kind), allowedKinds, maxFiles);
    setError(batchError);
    if (batchError) return;
    busyRef.current = true;
    setBusy(true);
    onPendingChange(true);
    try {
      for (const file of files) {
        const uploaded = await uploadAIStudioReferenceMedia(file, getReferenceFileKind(file.type)!, 30);
        selectionsRef.current = [...selectionsRef.current, uploaded];
        onChange(selectionsRef.current);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this reference file.");
    } finally {
      busyRef.current = false;
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
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" multiple accept={allowedKinds.map((kind) => REFERENCE_FILE_ACCEPT[kind]).join(",")} aria-label="Add reference files" className="hidden" onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        void addFiles(files);
      }} />
      <Button type="button" variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs text-muted" disabled={disabled || busy || selections.length >= maxFiles} title={`Choose, drop, or paste ${allowedKinds.join(", ")} files`} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
        {busy ? "Uploading…" : "Add files"}
      </Button>
      {selections.map((selection) => (
        <div key={selection.asset.id} className="flex max-w-full min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card-muted/80 p-1 pr-1.5 text-xs">
          {selection.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selection.asset.url} alt="" width={28} height={28} className="size-7 shrink-0 rounded-md object-cover" />
          ) : selection.kind === "video" ? (
            <video src={selection.asset.url} preload="metadata" muted playsInline aria-label="Reference video preview" className="size-7 shrink-0 rounded-md object-cover" />
          ) : null}
          <span className="max-w-40 truncate" title={selection.asset.fileName || selection.asset.title}>{selection.asset.fileName || selection.asset.title}</span>
          {selection.kind === "audio" ? <audio src={selection.asset.url} controls preload="metadata" aria-label={`Preview ${selection.asset.fileName || selection.asset.title}`} className="h-7 w-44 max-w-full" /> : null}
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${selection.asset.fileName || selection.asset.title}`} disabled={disabled || busy} onClick={() => {
            const next = selections.filter((item) => item.asset.id !== selection.asset.id);
            selectionsRef.current = next;
            onChange(next);
          }}><X aria-hidden="true" /></Button>
        </div>
      ))}
      {error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
