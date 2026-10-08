import type { Metadata } from "next";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
export const metadata: Metadata = { title: "Slideshows", description: "Recreate an ordered slideshow with image generation." };
export default async function SlideshowsPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const query = await searchParams;
  const preview = process.env.NODE_ENV === "development" && query.preview === "1";
  return <FormatWorkspace format="slideshow" previewReferences={preview ? getLocalRecreateReferences() : undefined} slideshowSavingEnabled={process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED === "true"} />;
}
