"use client";

import {
  FileVideo,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  uploadAIStudioReferenceMedia,
  type AIStudioReferenceKind,
  type AIStudioReferenceMedia,
} from "@/lib/ai-studio/reference-media-upload";

export function ReferenceMediaUpload({
  active = true,
  allowedKinds,
  disabled = false,
  selection,
  onChange,
}: {
  active?: boolean;
  allowedKinds: readonly AIStudioReferenceKind[];
  disabled?: boolean;
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingKind, setUploadingKind] = useState<AIStudioReferenceKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectFile = useCallback(async (kind: AIStudioReferenceKind, file: File) => {
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
  }, [onChange]);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (file) {
      const kind = getReferenceKind(file);

      if (!allowedKinds.includes(kind)) {
        setErrorMessage(`Choose a reference ${allowedKinds.join(" or ")}.`);
        return;
      }

      void selectFile(kind, file);
    }
  }

  const busy = uploadingKind !== null;
  const accepts = allowedKinds.flatMap((kind) => REFERENCE_ACCEPTS[kind]).join(",");
  const allowedLabel = allowedKinds.length > 1 ? "image or video" : allowedKinds[0];
  const buttonLabel = selection
    ? `Replace reference ${selection.kind} or paste an image`
    : `Add reference ${allowedLabel} or paste an image`;

  useEffect(() => {
    if (!active || disabled || busy) {
      return;
    }

    const composerForm = inputRef.current?.closest("form");

    if (!composerForm) {
      return;
    }

    function handlePaste(event: ClipboardEvent) {
      const clipboardData = event.clipboardData;
      const itemFile = Array.from(clipboardData?.items ?? [])
        .find(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        )
        ?.getAsFile();
      const file =
        itemFile ??
        Array.from(clipboardData?.files ?? []).find((candidate) =>
          candidate.type.startsWith("image/"),
        );

      if (!file) {
        return;
      }

      if (!allowedKinds.includes("image")) {
        setErrorMessage(`Choose a reference ${allowedKinds.join(" or ")}.`);
        return;
      }

      void selectFile("image", file);
    }

    composerForm.addEventListener("paste", handlePaste);

    return () => composerForm.removeEventListener("paste", handlePaste);
  }, [active, allowedKinds, busy, disabled, selectFile]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accepts}
        className="hidden"
        aria-label={buttonLabel}
        onChange={handleInputChange}
      />
      <Button
        type="button"
        variant="muted"
        size="icon-lg"
        className="col-start-1 row-start-1 size-9 min-w-9 max-w-9 rounded-full border border-border/80 bg-card-muted/80 text-muted shadow-xs transition-all duration-150 hover:border-border hover:bg-card hover:text-foreground-strong active:scale-95"
        aria-label={buttonLabel}
        title={buttonLabel}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : selection ? (
          <RefreshCw className="size-4" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
      </Button>

      {selection || errorMessage ? (
        <div
          className="col-span-full col-start-1 row-start-2 mt-1 flex min-w-0 flex-col items-start gap-1.5"
          aria-live="polite"
        >
          {selection ? (
            <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card-muted/80 p-1.5 pr-2.5 text-xs shadow-xs">
              {selection.kind === "image" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selection.asset.url}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-border/80"
                  />
                  <span className="shrink-0 font-medium text-muted">Image reference</span>
                </>
              ) : (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                    <FileVideo className="size-4" aria-hidden="true" />
                  </span>
                  <span className="shrink-0 font-medium text-muted">Video reference</span>
                </>
              )}
              <span className="min-w-0 truncate font-medium text-foreground">
                {selection.asset.fileName || selection.asset.title}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-my-1 -mr-1"
                aria-label={`Remove reference ${selection.kind}`}
                disabled={disabled || busy}
                onClick={() => onChange(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          {errorMessage ? (
            <p role="alert" className="max-w-80 text-xs font-medium text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const REFERENCE_ACCEPTS: Record<AIStudioReferenceKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
};

function getReferenceKind(file: File): AIStudioReferenceKind {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)
    ? "video"
    : "image";
}
