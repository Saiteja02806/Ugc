"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  uploadAIStudioReferenceMedia,
  type AIStudioReferenceMedia,
} from "@/lib/ai-studio/reference-media-upload";

export function ReferenceImageListUpload({
  active,
  disabled,
  maxImages,
  onChange,
  selections,
}: {
  active: boolean;
  disabled: boolean;
  maxImages: number;
  onChange: (selections: AIStudioReferenceMedia[]) => void;
  selections: AIStudioReferenceMedia[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectionsRef = useRef(selections);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  const addFiles = useCallback(async (files: File[]) => {
    if (busy || disabled || !files.length) return;
    setError(null);
    const remaining = maxImages - selectionsRef.current.length;
    if (files.length > remaining) {
      setError(`You can add up to ${maxImages} reference images for this model.`);
      return;
    }
    setBusy(true);
    const next = [...selectionsRef.current];
    try {
      for (const file of files) {
        next.push(await uploadAIStudioReferenceMedia(file, "image"));
        selectionsRef.current = [...next];
        onChange([...next]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload the image reference.");
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, maxImages, onChange]);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void addFiles(files);
  }

  useEffect(() => {
    if (!active || disabled) return;
    const form = inputRef.current?.closest("form");
    if (!form) return;
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (files.length) void addFiles(files);
    }
    form.addEventListener("paste", handlePaste);
    return () => form.removeEventListener("paste", handlePaste);
  }, [active, addFiles, disabled]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Add reference images"
        className="hidden"
        onChange={handleInputChange}
      />
      <Button
        type="button"
        variant="muted"
        size="icon-lg"
        className="size-9 min-w-9 rounded-full border border-border/80 bg-card-muted/80 text-muted"
        aria-label={`Add reference images (${selections.length} of ${maxImages})`}
        title={`Add reference images (${selections.length} of ${maxImages})`}
        disabled={disabled || busy || selections.length >= maxImages}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
      </Button>
      <span className="shrink-0 text-xs text-muted">{selections.length}/{maxImages} images</span>
      {selections.map((selection, index) => (
        <div key={selection.asset.id} className="flex max-w-[min(100%,15rem)] min-w-0 items-center gap-1.5 rounded-xl border border-border bg-card-muted/80 p-1 pr-1.5 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selection.asset.url} alt="" width={28} height={28} className="size-7 shrink-0 rounded-md object-cover" />
          <span className="min-w-0 truncate">{selection.asset.fileName || `Image ${index + 1}`}</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove reference image ${index + 1}`} disabled={disabled || busy} onClick={() => onChange(selections.filter((_, itemIndex) => itemIndex !== index))}>
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}
      {error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
