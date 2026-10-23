import type { Metadata } from "next";
import { Suspense } from "react";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { WorkspaceContentLoading } from "@/components/layout/workspace-content-loading";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
export const metadata: Metadata = { title: "Wall of text", description: "Generate a video background and add your own text." };
type PageProps = { searchParams: Promise<{ preview?: string }> };
const finishingEnabled = process.env.EXPLORE_FINISHING_ENABLED === "true" && process.env.EXPLORE_FORMAT_EDITING_ENABLED === "true";
const startingFrameEnabled = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION === "true";

export default function WallOfTextPage({ searchParams }: PageProps) {
  return <Suspense fallback={<WorkspaceContentLoading label="Opening Wall of text" />}>
    {process.env.NODE_ENV === "development" ? <WallOfTextPreview searchParams={searchParams} /> : <FormatWorkspace format="wall_text" finishingEnabled={finishingEnabled} hookStartingFramePreparationEnabled={startingFrameEnabled} />}
  </Suspense>;
}

async function WallOfTextPreview({ searchParams }: PageProps) {
  const query = await searchParams;
  return <FormatWorkspace format="wall_text" previewReferences={query.preview === "1" ? getLocalRecreateReferences() : undefined} finishingEnabled={finishingEnabled} hookStartingFramePreparationEnabled={query.preview === "1" || startingFrameEnabled} />;
}
