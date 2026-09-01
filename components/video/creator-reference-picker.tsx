"use client";

import Image from "next/image";
import { Check, ImagePlus, Loader2, UserRound, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { CREATOR_REFERENCES, type CreatorReference } from "@/lib/ai-studio/creator-references";
import { cn } from "@/lib/utils";

export function CreatorReferencePicker({
  active = true,
  disabled = false,
  onChange,
  onPendingChange,
  onSelectedCreatorChange,
  selectedCreatorId,
  selection,
}: {
  active?: boolean;
  disabled?: boolean;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange: (pending: boolean) => void;
  onSelectedCreatorChange: (creatorId: string | null) => void;
  selectedCreatorId: string | null;
  selection: AIStudioReferenceMedia | null;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingReferenceId, setPendingReferenceId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasImageReference = selection?.kind === "image";
  const hasCustomImageReference = hasImageReference && !selectedCreatorId;
  const isPending = pendingReferenceId !== null;

  async function uploadReference(
    file: File,
    selectedCreator: CreatorReference | null,
  ) {
    setErrorMessage(null);
    setPendingReferenceId(selectedCreator?.id ?? "custom");
    onPendingChange(true);

    try {
      const nextSelection = await uploadAIStudioReferenceMedia(file, "image");
      onChange(nextSelection);
      onSelectedCreatorChange(selectedCreator?.id ?? null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not prepare this creator reference.",
      );
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
    if (disabled || isPending || !hasImageReference) {
      return;
    }

    onChange(null);
    onSelectedCreatorChange(null);
    setErrorMessage(null);
  }

  return (
    <section
      aria-labelledby="creator-references-heading"
      className="border-t border-border/70 px-4 py-3 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/15">
            <UserRound className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id="creator-references-heading"
                className="text-xs font-semibold text-foreground"
              >
                Creators
              </h2>
              <span className="rounded-full bg-card-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Pick a creator reference or upload your own image.
            </p>
          </div>
        </div>
        {isPending ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted">
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            Preparing
          </span>
        ) : null}
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Upload your own creator reference image"
        disabled={disabled || isPending || !active}
        onChange={handleCustomUpload}
      />

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          disabled={disabled || isPending || !hasImageReference}
          aria-pressed={!hasImageReference}
          onClick={clearImageReference}
          className={cn(
            "group relative flex h-[68px] w-[50px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
            !hasImageReference
              ? "border-primary/45 bg-primary/8 text-primary shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.02)]"
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
            "group relative flex h-[68px] w-[50px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
            hasCustomImageReference
              ? "border-primary/45 bg-primary/8 text-primary"
              : "border-border/80 bg-card-muted/55 text-muted hover:border-primary/35 hover:bg-primary/5 hover:text-primary",
          )}
        >
          {pendingReferenceId === "custom" ? (
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ImagePlus className="size-3.5" aria-hidden="true" />
          )}
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
                "group relative h-[68px] w-[50px] shrink-0 overflow-hidden rounded-xl border bg-card-muted/70 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-primary ring-2 ring-primary/35"
                  : "border-border/80 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm",
              )}
            >
              <Image
                src={reference.src}
                alt=""
                width={50}
                height={68}
                sizes="50px"
                className="size-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
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
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
