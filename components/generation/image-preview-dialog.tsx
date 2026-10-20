"use client";

import { AiStudioResultActions } from "@/components/generation/ai-studio-result-actions";
import { AiStudioCopyButton } from "@/components/generation/ai-studio-copy-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AIStudioImageResult } from "@/lib/ai-studio/media-results";

export function ImagePreviewDialog({
  image,
  onClose,
}: {
  image: AIStudioImageResult | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(image)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl flex-col gap-3 sm:max-w-4xl">
        <DialogTitle className="pr-8">Image preview</DialogTitle>
        <DialogDescription className="sr-only">View the full generated image and its prompt.</DialogDescription>
        {image ? (
          <>
            <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-card-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.title} className="max-h-[65dvh] max-w-full object-contain" />
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <p className="max-h-24 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{image.prompt || image.title}</p>
              {image.prompt ? <AiStudioCopyButton kind="prompt" value={image.prompt} /> : null}
            </div>
            <AiStudioResultActions kind="image" title={image.title} url={image.url} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
