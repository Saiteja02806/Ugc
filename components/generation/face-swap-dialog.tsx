"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, ChevronRight, Loader2, Plus, RefreshCw, Sparkles, Upload, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AIStudioImageResult } from "@/lib/ai-studio/media-results";
import type { MediaAsset } from "@/lib/media/types";
import { fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import { fetchInfluencerPhotoLibrary } from "@/lib/characters/photo-library-client";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { cn } from "@/lib/utils";

export interface FaceSwapInfluencerCandidate {
  id: string;
  url: string;
  title: string;
  source: "influencer" | "upload";
}

export function FaceSwapDialog({
  open,
  onOpenChange,
  targetAsset,
  ownerId,
  activeInfluencer,
  onConfirmSwap,
  isSubmitting = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetAsset: AIStudioImageResult | null;
  ownerId?: string | null;
  activeInfluencer?: { id: string; url: string; title?: string } | null;
  onConfirmSwap: (influencer: FaceSwapInfluencerCandidate, remember: boolean) => Promise<void>;
  isSubmitting?: boolean;
}) {
  const [selectedCandidate, setSelectedCandidate] = useState<FaceSwapInfluencerCandidate | null>(null);
  const [rememberForSession, setRememberForSession] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected candidate with active influencer when dialog opens
  useEffect(() => {
    if (open) {
      if (activeInfluencer) {
        setSelectedCandidate({
          id: activeInfluencer.id,
          url: activeInfluencer.url,
          title: activeInfluencer.title || "Selected influencer",
          source: "influencer",
        });
      }
      setUploadError(null);
    }
  }, [open, activeInfluencer]);

  const influencersQuery = useInfiniteQuery({
    queryKey: ["hook-influencer-history", ownerId ?? "signed-out"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchInfluencerPhotoLibrary(ownerId!, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(ownerId) && open,
    staleTime: 60_000,
  });

  const uploadsQuery = useQuery({
    queryKey: ["explore-reference-images", ownerId ?? "signed-out", "explore-only-v2"],
    queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal),
    enabled: Boolean(ownerId) && open,
    staleTime: 60_000,
  });

  const influencerImages = mergeCharacterHistoryPages(influencersQuery.data?.pages ?? []);
  const uploadedAssets = uploadsQuery.data ?? [];

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !ownerId) return;

    setUploading(true);
    setUploadError(null);
    try {
      const media = await uploadAIStudioReferenceMedia(file, "image", 3, ownerId, {
        purpose: "explore-reference",
      });
      const newCandidate: FaceSwapInfluencerCandidate = {
        id: media.asset.id,
        url: media.asset.url,
        title: media.asset.fileName || "Uploaded photo",
        source: "upload",
      };
      setSelectedCandidate(newCandidate);
      void uploadsQuery.refetch();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload photo. Try another.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const slideLabel = targetAsset?.slideshowGeneration
    ? `Slide ${targetAsset.slideshowGeneration.slideIndex}`
    : "This image";

  const totalCandidates = influencerImages.length + uploadedAssets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 p-0 overflow-hidden sm:max-w-lg bg-card border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </span>
            <DialogTitle className="text-base font-semibold">
              Swap face on {slideLabel}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted mt-1 leading-relaxed">
            Apply your AI influencer or portrait identity to this scene photograph. Uses single-pass Biometric Face Lock (1 credit).
          </DialogDescription>
        </DialogHeader>

        {/* Comparison Visualizer */}
        <div className="bg-card-muted/40 border-b border-border/30 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-12 rounded-lg border border-border overflow-hidden bg-black/40 shrink-0">
              {targetAsset?.url ? (
                <img src={targetAsset.url} alt="Target slide" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-[10px] text-muted">Slide</div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/90">{slideLabel}</p>
              <p className="text-[11px] text-muted">Original scene & pose</p>
            </div>
          </div>

          <div className="flex items-center text-muted">
            <ChevronRight className="size-4" aria-hidden="true" />
            <RefreshCw className="size-3.5 text-amber-400 -ml-1" aria-hidden="true" />
            <ChevronRight className="size-4 -ml-1" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-12 rounded-lg border border-dashed border-white/50 overflow-hidden bg-primary/5 flex items-center justify-center shrink-0">
              {selectedCandidate ? (
                <img src={selectedCandidate.url} alt="Face to apply" className="size-full object-cover" />
              ) : (
                <UserRound className="size-5 text-muted" aria-hidden="true" />
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground/90">
                {selectedCandidate ? "Target Face" : "Pick a Face"}
              </p>
              <p className="text-[11px] text-muted line-clamp-1">
                {selectedCandidate ? selectedCandidate.title : "Select below"}
              </p>
            </div>
          </div>
        </div>

        {/* Influencer Library Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Choose Identity Photo
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || isSubmitting}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs gap-1.5"
            >
              {uploading ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-3" aria-hidden="true" />
              )}
              <span>Upload photo</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void handleFileUpload(e)}
            />
          </div>

          {uploadError ? (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
              {uploadError}
            </p>
          ) : null}

          {influencersQuery.isLoading || uploadsQuery.isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              <p className="text-xs">Loading your saved influencers…</p>
            </div>
          ) : totalCandidates === 0 ? (
            <div className="py-10 text-center border border-dashed border-border/80 rounded-xl p-6 bg-card/30">
              <UserRound className="size-8 mx-auto text-muted mb-2" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground">No influencer photos yet</p>
              <p className="text-[11px] text-muted mt-1 max-w-xs mx-auto">
                Upload a clear portrait of your creator, or build one in AI Influencer Studio.
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="mt-4 gap-1.5"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Upload creator photo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-4">
              {/* AI Influencer Studio images */}
              {influencerImages.map((img, index) => {
                const isSelected = selectedCandidate?.id === img.mediaAssetId;
                return (
                  <button
                    key={img.jobId || img.mediaAssetId}
                    type="button"
                    onClick={() =>
                      setSelectedCandidate({
                        id: img.mediaAssetId,
                        url: img.url,
                        title: `AI Influencer ${index + 1}`,
                        source: "influencer",
                      })
                    }
                    className={cn(
                      "group relative aspect-[3/4] overflow-hidden rounded-xl border bg-black/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                      isSelected
                        ? "border-amber-400 ring-2 ring-amber-400/40 shadow-md"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <img
                      src={img.url}
                      alt={`AI Influencer ${index + 1}`}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 text-left">
                      <span className="text-[10px] font-medium text-white/90 line-clamp-1">
                        Influencer {index + 1}
                      </span>
                    </div>
                    {isSelected ? (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-black shadow-sm">
                        <Check className="size-3 stroke-[3]" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {/* Uploaded Photos */}
              {uploadedAssets.map((asset) => {
                const isSelected = selectedCandidate?.id === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() =>
                      setSelectedCandidate({
                        id: asset.id,
                        url: asset.url,
                        title: asset.fileName || asset.title || "Uploaded portrait",
                        source: "upload",
                      })
                    }
                    className={cn(
                      "group relative aspect-[3/4] overflow-hidden rounded-xl border bg-black/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                      isSelected
                        ? "border-amber-400 ring-2 ring-amber-400/40 shadow-md"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <img
                      src={asset.thumbnailUrl ?? asset.url}
                      alt={asset.fileName || "Uploaded photo"}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 text-left">
                      <span className="text-[10px] font-medium text-white/90 line-clamp-1">
                        {asset.fileName || "Upload"}
                      </span>
                    </div>
                    {isSelected ? (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-black shadow-sm">
                        <Check className="size-3 stroke-[3]" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Preferences and Action */}
        <DialogFooter className="p-4 bg-card-muted/40 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted select-none self-start sm:self-auto">
            <input
              type="checkbox"
              checked={rememberForSession}
              onChange={(e) => setRememberForSession(e.target.checked)}
              className="size-3.5 rounded border-border bg-card accent-primary"
            />
            <span>Remember for 1-click swap on other slides</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={!selectedCandidate || isSubmitting || uploading}
              onClick={() => {
                if (!selectedCandidate) return;
                void onConfirmSwap(selectedCandidate, rememberForSession);
              }}
              className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Starting swap…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  <span>Swap Face · 1 Credit</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
