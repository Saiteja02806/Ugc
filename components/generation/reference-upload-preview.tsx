"use client";

import { FileAudio, FileVideo, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AIStudioReferenceKind } from "@/lib/ai-studio/reference-media-upload";

export function ReferenceUploadPreview({
  disabled = false,
  kind,
  label,
  name,
  onRemove,
  pending = false,
  queued = false,
  url,
}: {
  disabled?: boolean;
  kind: AIStudioReferenceKind;
  label: string;
  name: string;
  onRemove?: () => void;
  pending?: boolean;
  queued?: boolean;
  url?: string;
}) {
  const tileClassName =
    "relative flex size-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-card-muted";
  const tileContent = (
    <>
      {kind === "image" && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={48} height={48} className="size-full object-cover" />
      ) : kind === "audio" ? (
        <FileAudio className="size-5 text-muted" aria-hidden="true" />
      ) : (
        <FileVideo className="size-5 text-muted" aria-hidden="true" />
      )}
      {pending ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white" role="status">
          {queued ? null : <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          <span className="text-[9px] font-medium">{queued ? "Queued" : "Uploading"}</span>
        </div>
      ) : (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[9px] font-medium text-white">{label}</span>
      )}
    </>
  );

  return (
    <div className="relative shrink-0" title={name}>
      {kind === "image" && url && !pending ? (
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`Preview ${label}: ${name}`}
                className={`${tileClassName} cursor-pointer transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
              />
            }
          >
            {tileContent}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={10}
            className="w-[min(22rem,calc(100vw-2rem))] gap-2 p-2"
          >
            <PopoverTitle className="px-1 text-xs font-medium">{label} preview</PopoverTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={name}
              width={640}
              height={640}
              className="h-auto max-h-[min(26rem,calc(100dvh-9rem))] w-full rounded-md bg-card-muted object-contain"
            />
          </PopoverContent>
        </Popover>
      ) : (
        <div
          className={tileClassName}
          role="group"
          aria-label={`${label}: ${name}${pending ? queued ? ", queued for upload" : ", uploading" : ""}`}
          aria-busy={pending}
        >
          {tileContent}
        </div>
      )}
      {onRemove ? (
        <Button type="button" variant="muted" size="icon-sm" className="absolute -right-1 -top-1 size-5 rounded-full border border-border bg-card shadow-sm [&_svg]:size-3" aria-label={`Remove ${name}`} disabled={disabled} onClick={onRemove}>
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
