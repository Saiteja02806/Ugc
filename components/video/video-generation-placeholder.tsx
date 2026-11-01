import { Loader2 } from "lucide-react";
import type { AIStudioVideoAspectRatio } from "@/lib/ai-studio/generation-settings";
import { LidarPointCloudCanvas } from "@/components/video/lidar-point-cloud-canvas";

/** Shared waiting visual for AI Studio and connected Explore video workflows. */
export function VideoGenerationPlaceholder({ aspectRatio = "9:16", referenceImageUrl, referenceImageLabel, label = "Creating your video" }: {
  aspectRatio?: AIStudioVideoAspectRatio;
  referenceImageUrl?: string | null;
  referenceImageLabel?: string | null;
  label?: string;
}) {
  return <div data-video-generation-placeholder className="relative overflow-hidden rounded-[16px] bg-card-muted ring-1 ring-primary/20 select-none" style={{ aspectRatio: aspectRatio.replace(":", " / ") }}>
    {referenceImageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={referenceImageUrl} alt={referenceImageLabel ?? "Video reference"} className="absolute inset-0 size-full object-cover opacity-25 blur-[1px]" />
    ) : null}
    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/75" />
    <LidarPointCloudCanvas className="absolute inset-0 size-full pointer-events-none" />
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 text-center pointer-events-none" role="status" aria-live="polite">
      <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/45 backdrop-blur-sm text-amber-400 shadow-lg">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-white drop-shadow-sm">{label}</p>
        <p className="text-[11px] leading-4 text-white/70">Your result will appear here.</p>
      </div>
    </div>
  </div>;
}
