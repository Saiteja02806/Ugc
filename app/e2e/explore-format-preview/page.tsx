import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
import { getReferenceText } from "@/lib/explore/reference-text-store";
import type { MediaAsset } from "@/lib/media/types";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";
import { PhoneWorkflowPreview } from "@/components/explore/phone-workflow-preview";
import { MusicChoicePreview } from "./music-choice-preview";

/** A read-only fixture: actual editor UI, local media, no generation or saving. */
export default async function ExploreFormatPreview({ searchParams }: { searchParams: Promise<{ format?: string; sources?: string; legacy?: string; generated?: string; refId?: string; ratio?: string; finished?: string; music?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  if (query.legacy === "hook" || query.legacy === "phone") return <AppShell activeKey="explore" focusNavigation={query.legacy === "hook"}>{query.legacy === "hook" ? <HookWorkflowPreview /> : <PhoneWorkflowPreview />}</AppShell>;
  const format = query.format === "slideshow" ? "slideshow" : query.format === "wall_text" ? "wall_text" : "hook";
  // Use real portrait footage to review the usual 9:16 editor, including the
  // browser's intrinsic dimensions. The default remains the landscape fixture.
  const portrait = query.ratio === "9:16";
  const clip = portrait
    ? { url: "/marketing/showcase-part2/demo-preview.mp4", width: 720, height: 1280, ratio: "9:16" as const, duration: 7.567 }
    : { url: "/explore/covers/hook-video-v1.mp4", width: 960, height: 540, ratio: "16:9" as const, duration: 8 };
  const references = getLocalRecreateReferences();
  const sampleReference = references.find(item => item.format === format && (!query.refId || item.id === query.refId) && (format !== "slideshow" || item.slides.length >= 2));
  const previewText = sampleReference ? getReferenceText(sampleReference.id, format === "slideshow" ? sampleReference.slides[0]?.id ?? null : null) : null;
  const sample = format === "slideshow" && query.generated === "1" ? sampleReference : undefined;
  // Catalogue pixels stand in for two generated results only in this gated
  // development fixture. They never become production outputs or owned assets.
  const previewSlideshow = sample ? { referenceId: sample.id, images: sample.slides.slice(0, 2).map((slide, index) => ({
    id: `00000000-0000-4000-8000-00000000001${index}`, aspectRatio: "4:5" as const,
    createdAt: "2026-10-09T00:00:00Z", title: `Sample output ${index + 1}`, url: slide.url,
  })) } : undefined;
  const previewAssets: MediaAsset[] = ["video", "influencer"].map((collection, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + (portrait ? 5 : 1)}`, collection: collection as "video" | "influencer", status: "ready", sourceType: "upload",
    createdAt: "2026-10-08T00:00:00Z", updatedAt: "2026-10-08T00:00:00Z", title: index ? "Saved creator clip" : "Existing video preview",
    mimeType: "video/mp4", fileName: "preview.mp4", fileSizeBytes: 2000, durationSeconds: clip.duration, width: clip.width, height: clip.height, ratio: clip.ratio,
    metadata: {}, parentAssetId: null, projectId: null, sourceRecordId: null, thumbnailUrl: null, url: clip.url,
  }));
  previewAssets.push({ ...previewAssets[0], id: "00000000-0000-4000-8000-000000000020", sourceType: "demo_upload", title: "Saved demo footage" });
  const previewFinalVideo = query.finished === "1" && format !== "slideshow" && portrait ? { id: "prepared-local-sample",
    url: format === "hook" ? "/e2e/explore-format-preview/final-video" : clip.url,
    title: format === "hook" ? "Prepared hook and demo sample" : "Wall of text sample footage" } : undefined;
  const previewFinalSlideshow = query.finished === "1" && sample ? { id: "local-slideshow-sample", title: "Slideshow sample images", slides: sample.slides.slice(0, 2).map(slide => slide.url) } : undefined;
  const openingClip = previewFinalVideo && format === "hook" ? { ...clip, url: "/marketing/showcase-part2/hook2-preview.mp4", duration: 2.837 } : clip;
  return <AppShell activeKey="explore" focusNavigation><FormatWorkspace format={format} previewContextBanner={query.music === "1" && format === "hook" ? <MusicChoicePreview referenceTitle={sampleReference?.title ?? "Hook 61"} /> : undefined} previewFinalVideo={previewFinalVideo} previewFinalSlideshow={previewFinalSlideshow} previewText={previewText} previewReferences={references} previewSlideshow={previewSlideshow} previewAssets={previewAssets} previewVideo={format === "slideshow" || query.sources === "1" ? undefined : {
    id: previewFinalVideo ? "00000000-0000-4000-8000-000000000016" : portrait ? "00000000-0000-4000-8000-000000000009" : "00000000-0000-4000-8000-000000000008", mediaAssetId: null, createdAt: "2026-10-08T00:00:00Z", durationSeconds: openingClip.duration,
    modelLabel: null, resolution: null, thumbnailUrl: null, ratio: openingClip.ratio, status: "Ready", title: "Editor preview", prompt: "Local cover footage for reviewing edits", url: openingClip.url,
  }} /></AppShell>;
}
