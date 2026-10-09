"use client";

import Link from "next/link";
import { History, Search } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ImageHistoryGroup } from "@/lib/ai-studio/image-history";
import { cn } from "@/lib/utils";

export function ImageGenerationHistory({
  groups,
  onOpenChange,
  onQueryChange,
  onSelectImage,
  open,
  query,
  selectedImageId,
}: {
  groups: ImageHistoryGroup[];
  onOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  onSelectImage: (imageId: string) => void;
  open: boolean;
  query: string;
  selectedImageId: string | null;
}) {
  const hasImages = groups.some((group) => group.images.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-y-0 left-auto right-0 top-0 flex h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-l bg-background p-0 sm:max-w-[460px]">
        <header className="shrink-0 border-b border-border px-5 py-5 pr-12">
          <DialogTitle>Generation History</DialogTitle>
          <DialogDescription className="mt-1 text-xs">Your completed AI Studio images</DialogDescription>
        </header>

        <div className="shrink-0 border-b border-border px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search your generations…"
              aria-label="Search your generations"
              className="h-10 rounded-full pl-9"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {hasImages ? (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{group.label}</h2>
                  <div className="space-y-2">
                    {group.images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => onSelectImage(image.id)}
                        aria-pressed={selectedImageId === image.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[16px] border border-transparent p-2 text-left transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                          selectedImageId === image.id && "border-primary/60 bg-primary/[0.06]",
                        )}
                      >
                        <div className="w-[76px] shrink-0 overflow-hidden rounded-xl bg-card-muted" style={{ aspectRatio: image.aspectRatio.replace(":", " / ") }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-sm font-semibold leading-5 text-foreground">{image.title}</span>
                          <span className="mt-1.5 block text-[11px] font-medium text-muted">{image.aspectRatio}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
              <History className="size-6 text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-foreground">{query.trim() ? "No matching images" : "No images yet"}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{query.trim() ? "Try another search term." : "Create an image from this workspace to start your history."}</p>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-4">
          <Link href="/avatars" className="flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            Open Creative Assets
          </Link>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
