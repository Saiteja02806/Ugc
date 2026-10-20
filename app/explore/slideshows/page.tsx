import type { Metadata } from "next";
import { Suspense } from "react";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { WorkspaceContentLoading } from "@/components/layout/workspace-content-loading";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
export const metadata: Metadata = { title: "Slideshows", description: "Recreate an ordered slideshow with image generation." };
type PageProps = { searchParams: Promise<{ preview?: string }> };
const slideshowSavingEnabled = process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED === "true";

export default function SlideshowsPage({ searchParams }: PageProps) {
  return <Suspense fallback={<WorkspaceContentLoading label="Opening Slideshows" />}>
    {process.env.NODE_ENV === "development" ? <SlideshowsPreview searchParams={searchParams} /> : <FormatWorkspace format="slideshow" slideshowSavingEnabled={slideshowSavingEnabled} />}
  </Suspense>;
}

async function SlideshowsPreview({ searchParams }: PageProps) {
  const query = await searchParams;
  return <FormatWorkspace format="slideshow" previewReferences={query.preview === "1" ? getLocalRecreateReferences() : undefined} slideshowSavingEnabled={slideshowSavingEnabled} />;
}
