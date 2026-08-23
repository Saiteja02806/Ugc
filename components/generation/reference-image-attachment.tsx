"use client";

import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  REFERENCE_IMAGE_ACCEPT,
  formatReferenceImageBytes,
  getReferenceImageDimensionsError,
  getReferenceImageFileError,
} from "@/lib/generation/reference-image";

type ReferenceImageSelection = {
  file: File;
  height: number;
  previewUrl: string;
  width: number;
};

export function ReferenceImageAttachment({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const [selection, setSelection] =
    useState<ReferenceImageSelection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const replaceSelection = useCallback(
    (nextSelection: ReferenceImageSelection | null) => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      previewUrlRef.current = nextSelection?.previewUrl ?? null;
      setSelection(nextSelection);
    },
    [],
  );

  const removeSelection = useCallback(() => {
    requestIdRef.current += 1;
    setIsReading(false);
    setErrorMessage(null);
    replaceSelection(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [replaceSelection]);

  const selectFile = useCallback(
    async (file: File) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const fileError = getReferenceImageFileError(file);

      if (fileError) {
        setIsReading(false);
        setErrorMessage(fileError);
        return;
      }

      setErrorMessage(null);
      setIsReading(true);

      const previewUrl = URL.createObjectURL(file);

      try {
        const dimensions = await readImageDimensions(previewUrl);
        const dimensionsError = getReferenceImageDimensionsError(
          dimensions.width,
          dimensions.height,
        );

        if (dimensionsError) {
          throw new Error(dimensionsError);
        }

        if (requestId !== requestIdRef.current) {
          URL.revokeObjectURL(previewUrl);
          return;
        }

        replaceSelection({
          file,
          height: dimensions.height,
          previewUrl,
          width: dimensions.width,
        });
      } catch (error) {
        URL.revokeObjectURL(previewUrl);

        if (requestId === requestIdRef.current) {
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : "This image could not be read. Choose another file.",
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsReading(false);
        }
      }
    },
    [replaceSelection],
  );

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";

      if (file) {
        void selectFile(file);
      }
    },
    [selectFile],
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const label = selection ? "Replace reference image" : "Attach reference image";
  const hasStatus = Boolean(errorMessage || isReading || selection);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        name="referenceImage"
        aria-label="Reference image"
        accept={REFERENCE_IMAGE_ACCEPT}
        onChange={onInputChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="muted"
        size="icon-lg"
        className="col-start-1 row-start-1 size-9 rounded-full border border-border/80 bg-card-muted/80 text-muted shadow-xs transition-all duration-150 hover:border-border hover:bg-card hover:text-foreground-strong active:scale-95"
        aria-label={label}
        title={label}
        disabled={disabled || isReading}
        onClick={openFilePicker}
      >
        {isReading ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : selection ? (
          <RefreshCw className="size-4" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
      </Button>

      {hasStatus ? (
        <div
          className="col-span-full col-start-1 row-start-2 mt-1 flex flex-col gap-2"
          aria-live="polite"
        >
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Reference image not added</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isReading && !selection ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg bg-card-muted px-3 py-2 text-sm font-medium text-muted"
            >
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Checking reference image…
            </div>
          ) : null}

          {selection ? (
            <div className="flex min-w-0 items-center gap-3 rounded-lg bg-card-muted px-2.5 py-2 ring-1 ring-border">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-background">
                <Image
                  src={selection.previewUrl}
                  alt=""
                  fill
                  sizes="48px"
                  unoptimized
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Reference image</p>
                <p className="truncate text-xs text-muted">
                  {selection.file.name} · {selection.width}×{selection.height} ·{" "}
                  {formatReferenceImageBytes(selection.file.size)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="muted"
                  size="sm"
                  disabled={disabled || isReading}
                  aria-label="Replace reference image"
                  title="Replace reference image"
                  onClick={openFilePicker}
                >
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden sm:inline">Replace</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || isReading}
                  aria-label={`Remove ${selection.file.name}`}
                  title="Remove reference image"
                  onClick={removeSelection}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

async function readImageDimensions(previewUrl: string) {
  const image = new window.Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("This image could not be read. Choose another file."));
    image.src = previewUrl;
  });

  return {
    height: image.naturalHeight,
    width: image.naturalWidth,
  };
}
