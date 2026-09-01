"use client";

import Image from "next/image";
import { Check, ChevronDown, ImagePlus, Loader2, UserRound, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { CREATOR_REFERENCES, type CreatorReference } from "@/lib/ai-studio/creator-references";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function CreatorReferencePicker({
  active = true,
  disabled = false,
  onChange,
  onPendingChange,
  onSelectedCreatorChange,
  required = false,
  selectedCreatorId,
  selection,
}: {
  active?: boolean;
  disabled?: boolean;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange: (pending: boolean) => void;
  onSelectedCreatorChange: (creatorId: string | null) => void;
  required?: boolean;
  selectedCreatorId: string | null;
  selection: AIStudioReferenceMedia | null;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingReferenceId, setPendingReferenceId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const hasImageReference = selection?.kind === "image";
  const hasCustomImageReference = hasImageReference && !selectedCreatorId;
  const isPending = pendingReferenceId !== null;
  const selectedCreatorIndex = CREATOR_REFERENCES.findIndex(
    (reference) => reference.id === selectedCreatorId,
  );
  const selectedCreator =
    selectedCreatorIndex === -1
      ? null
      : CREATOR_REFERENCES[selectedCreatorIndex];
  const triggerLabel = selectedCreator
    ? `Creator ${selectedCreatorIndex + 1}`
    : hasCustomImageReference
      ? "Custom"
      : required
        ? "Reference image"
        : "Creators";

  async function uploadReference(
    file: File,
    selectedCreator: CreatorReference | null,
  ): Promise<boolean> {
    setErrorMessage(null);
    setPendingReferenceId(selectedCreator?.id ?? "custom");
    onPendingChange(true);

    try {
      const nextSelection = await uploadAIStudioReferenceMedia(file, "image");
      onChange(nextSelection);
      onSelectedCreatorChange(selectedCreator?.id ?? null);
      setOpen(false);
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not prepare this creator reference.",
      );
      return false;
    } finally {
      setPendingReferenceId(null);
      onPendingChange(false);
    }
  }

  async function handleCreatorSelect(reference: CreatorReference) {
    if (disabled || isPending) {
      return;
    }

    try {
      const response = await fetch(reference.src);

      if (!response.ok) {
        throw new Error("Could not load this creator reference.");
      }

      const image = await response.blob();
      const file = new File([image], reference.fileName, {
        type: image.type || "image/png",
      });

      await uploadReference(file, reference);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not load this creator reference.",
      );
    }
  }

  function handleCustomUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (file) {
      void uploadReference(file, null);
    }
  }

  function clearImageReference() {
    if (disabled || isPending || !active || !hasImageReference) {
      return;
    }

    onChange(null);
    onSelectedCreatorChange(null);
    setErrorMessage(null);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Upload your own creator reference image"
        disabled={disabled || isPending || !active}
        onChange={handleCustomUpload}
      />
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled || isPending || !active}
            aria-label={`Creator reference, currently ${triggerLabel}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="inline-flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-card-muted/80 px-3 text-xs font-medium text-foreground ring-1 ring-inset ring-border/70 transition-all hover:bg-card hover:ring-border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        }
      >
        {selectedCreator ? (
          <Image
            src={selectedCreator.src}
            alt=""
            width={16}
            height={16}
            sizes="16px"
            className="size-4 shrink-0 rounded-full object-cover"
          />
        ) : (
          <UserRound className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        )}
        <span className="truncate">{isPending ? "Preparing" : triggerLabel}</span>
        {isPending ? (
          <Loader2
            className="size-3 shrink-0 animate-spin text-muted motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        )}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-[min(22rem,calc(100vw-1rem))] p-2.5"
      >
        <div className="flex items-start justify-between gap-3 px-0.5 pb-2">
          <div>
            <h2 className="text-xs font-semibold text-foreground">
              Creator reference
            </h2>
            <p className="mt-0.5 text-[11px] leading-4 text-muted">
              {required
                ? "Required for this Explore recreation. Choose a look or upload your own image."
                : "Optional. Choose a look or upload your own image."}
            </p>
          </div>
          {isPending ? (
            <Loader2
              className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted motion-reduce:animate-none"
              aria-label="Preparing creator reference"
            />
          ) : null}
        </div>

        <div className="grid max-h-[19rem] grid-cols-5 gap-2 overflow-y-auto pr-0.5">
          <button
            type="button"
            disabled={disabled || isPending || !active}
            aria-pressed={!hasImageReference}
            onClick={() => {
              if (hasImageReference) {
                clearImageReference();
              } else {
                setOpen(false);
              }
            }}
            className={cn(
              "flex aspect-[3/4] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
              !hasImageReference
                ? "border-primary/45 bg-primary/8 text-primary"
                : "border-border/80 bg-card-muted/70 text-muted hover:border-border hover:bg-card",
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>None</span>
          </button>

          <button
            type="button"
            disabled={disabled || isPending || !active}
            aria-pressed={hasCustomImageReference}
            onClick={() => uploadInputRef.current?.click()}
            className={cn(
              "relative flex aspect-[3/4] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
              hasCustomImageReference
                ? "border-primary/45 bg-primary/8 text-primary"
                : "border-border/80 bg-card-muted/55 text-muted hover:border-primary/35 hover:bg-primary/5 hover:text-primary",
            )}
          >
            <ImagePlus className="size-3.5" aria-hidden="true" />
            <span>Upload</span>
            {hasCustomImageReference ? (
              <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Check className="size-2.5" aria-hidden="true" />
              </span>
            ) : null}
          </button>

          {CREATOR_REFERENCES.map((reference, index) => {
            const selected = selectedCreatorId === reference.id;
            const loading = pendingReferenceId === reference.id;

            return (
              <button
                key={reference.id}
                type="button"
                disabled={disabled || isPending || !active}
                aria-pressed={selected}
                aria-label={`Use creator reference ${index + 1}`}
                title={`Use creator reference ${index + 1}`}
                onClick={() => void handleCreatorSelect(reference)}
                className={cn(
                  "group relative aspect-[3/4] min-w-0 overflow-hidden rounded-lg border bg-card-muted/70 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "border-primary ring-2 ring-primary/35"
                    : "border-border/80 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm",
                )}
              >
                <Image
                  src={reference.src}
                  alt=""
                  fill
                  sizes="(max-width: 360px) 18vw, 60px"
                  className="object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1 pb-1 pt-3 text-center text-[9px] font-semibold text-white">
                  {index + 1}
                </span>
                {loading ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  </span>
                ) : null}
                {selected ? (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="size-2.5" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {errorMessage ? (
          <p role="alert" className="mt-2 text-xs font-medium text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
