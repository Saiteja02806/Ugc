"use client";

import { FileImage, FileVideo, Loader2, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  uploadAIStudioReferenceMedia,
  type AIStudioReferenceKind,
  type AIStudioReferenceMedia,
} from "@/lib/ai-studio/reference-media-upload";

export function ReferenceMediaUpload({
  allowedKinds,
  disabled = false,
  selection,
  onChange,
}: {
  allowedKinds: readonly AIStudioReferenceKind[];
  disabled?: boolean;
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingKind, setUploadingKind] = useState<AIStudioReferenceKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function selectFile(kind: AIStudioReferenceKind, file: File) {
    setErrorMessage(null);
    setUploadingKind(kind);

    try {
      onChange(await uploadAIStudioReferenceMedia(file, kind));
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : `Could not upload this reference ${kind}.`,
      );
    } finally {
      setUploadingKind(null);
    }
  }

  function handleInputChange(
    kind: AIStudioReferenceKind,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (file) {
      void selectFile(kind, file);
    }
  }

  const busy = uploadingKind !== null;

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {allowedKinds.includes("image") ? (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label="Upload reference image"
              onChange={(event) => handleInputChange("image", event)}
            />
            <Button
              type="button"
              variant="muted"
              size="lg"
              disabled={disabled || busy}
              onClick={() => imageInputRef.current?.click()}
            >
              {uploadingKind === "image" ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <FileImage aria-hidden="true" />
              )}
              Upload image
            </Button>
          </>
        ) : null}

        {allowedKinds.includes("video") ? (
          <>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              aria-label="Upload reference video"
              onChange={(event) => handleInputChange("video", event)}
            />
            <Button
              type="button"
              variant="muted"
              size="lg"
              disabled={disabled || busy}
              onClick={() => videoInputRef.current?.click()}
            >
              {uploadingKind === "video" ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <FileVideo aria-hidden="true" />
              )}
              Upload video
            </Button>
          </>
        ) : null}
      </div>

      {selection ? (
        <div className="flex max-w-80 items-center gap-2 rounded-lg border border-border bg-card-muted px-2.5 py-1.5 text-xs">
          {selection.kind === "image" ? (
            <FileImage className="size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <FileVideo className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {selection.asset.fileName || selection.asset.title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove reference ${selection.kind}`}
            disabled={disabled || busy}
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Optional — generate without a reference if you prefer.</p>
      )}

      {errorMessage ? (
        <p role="alert" className="max-w-80 text-xs font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
