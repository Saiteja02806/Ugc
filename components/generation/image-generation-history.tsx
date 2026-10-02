"use client";

import Link from "next/link";
import { ArrowUpRight, History, Search } from "lucide-react";

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
      <DialogContent className="inset-y-0 left-auto right-0 top-0 flex h-dvh w-full max-w-[420px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-l bg-background p-0 sm:max-w-[420px]">
        <header className="shrink-0 border-b border-border px-5 py-5 pr-12">
          <DialogTitle>Image history</DialogTitle>
          <DialogDescription className="mt-2 text-xs">Open a generation to view or download it.</DialogDescription>
        </header>

        <div className="shrink-0 px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search images…"
              aria-label="Search image history"
              className="h-9 rounded-xl pl-9"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
          {hasImages ? (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="mb-2 px-2 text-[11px] font-medium text-muted">{group.label}</h2>
                  <div className="space-y-1">
                    {group.images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => onSelectImage(image.id)}
                        aria-pressed={selectedImageId === image.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
                          selectedImageId === image.id && "border-primary/40 bg-primary/[0.06]",
                        )}
                      >
                        <div className="flex h-20 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.url} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-xs font-medium leading-5 text-foreground">{image.prompt || image.title}</span>
                          <span className="mt-1.5 block text-[11px] text-muted">{image.aspectRatio} · {formatHistoryTime(image.createdAt)}</span>
                        </span>
                        <ArrowUpRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
              <History className="size-5 text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">{query.trim() ? "No matching images" : "Your images will be saved here"}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{query.trim() ? "Try another search term." : "Create your first image using the prompt below."}</p>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-4">
          <Link href="/avatars" className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            Open Creative Assets
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Saved image"
    : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}
