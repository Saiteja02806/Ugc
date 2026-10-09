import type { Metadata } from "next";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
export const metadata: Metadata = { title: "Wall of text", description: "Generate a video background and add your own text." };
export default async function WallOfTextPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const query = await searchParams;
  const preview = process.env.NODE_ENV === "development" && query.preview === "1";
  return <FormatWorkspace format="wall_text" previewReferences={preview ? getLocalRecreateReferences() : undefined} finishingEnabled={process.env.EXPLORE_FINISHING_ENABLED === "true" && process.env.EXPLORE_FORMAT_EDITING_ENABLED === "true"} />;
}
