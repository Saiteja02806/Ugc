import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
import type { MediaAsset } from "@/lib/media/types";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";
import { PhoneWorkflowPreview } from "@/components/explore/phone-workflow-preview";
import { VideoEditorComparison } from "./video-editor-comparison";

/** A read-only fixture: actual editor UI, local media, no generation or saving. */
export default async function ExploreFormatPreview({ searchParams }: { searchParams: Promise<{ format?: string; sources?: string; legacy?: string; compare?: string; editorLayout?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  if (query.legacy === "hook" || query.legacy === "phone") return <AppShell activeKey="explore">{query.legacy === "hook" ? <HookWorkflowPreview /> : <PhoneWorkflowPreview />}</AppShell>;
  const format = query.format === "slideshow" ? "slideshow" : query.format === "wall_text" ? "wall_text" : "hook";
  const previewAssets: MediaAsset[] = ["video", "influencer"].map((collection, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`, collection: collection as "video" | "influencer", status: "ready", sourceType: "upload",
    createdAt: "2026-10-08T00:00:00Z", updatedAt: "2026-10-08T00:00:00Z", title: index ? "Saved creator clip" : "Existing video preview",
    mimeType: "video/mp4", fileName: "preview.mp4", fileSizeBytes: 2000, durationSeconds: 8, width: 1280, height: 720, ratio: "16:9",
    metadata: {}, parentAssetId: null, projectId: null, sourceRecordId: null, thumbnailUrl: null, url: "/explore/covers/hook-video-v1.mp4",
  }));
  const compare = format !== "slideshow" && query.compare === "1";
  const workspace: ComponentProps<typeof FormatWorkspace> = { format, previewReferences: getLocalRecreateReferences(), previewAssets, previewVideo: query.sources === "1" ? undefined : {
    id: compare ? previewAssets[0].id : "00000000-0000-4000-8000-000000000008", mediaAssetId: compare ? previewAssets[0].id : null, createdAt: "2026-10-08T00:00:00Z", durationSeconds: 8,
    ratio: "16:9", status: "Ready", title: "Editor preview", prompt: "Local cover footage for reviewing edits", url: "/explore/covers/hook-video-v1.mp4",
  }};
  return <AppShell activeKey="explore">{compare ? <VideoEditorComparison {...workspace} initialLayout={query.editorLayout === "preview" ? "preview" : "controls"} /> : <FormatWorkspace {...workspace} />}</AppShell>;
}
