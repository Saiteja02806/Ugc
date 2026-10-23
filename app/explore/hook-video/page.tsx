import type { Metadata } from "next";
import { Suspense } from "react";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { WorkspaceContentLoading } from "@/components/layout/workspace-content-loading";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
export const metadata: Metadata = { title: "Hook video", description: "Recreate a hook with video generation." };
type PageProps = { searchParams: Promise<{ preview?: string }> };
const finishingEnabled = process.env.EXPLORE_FINISHING_ENABLED === "true" && process.env.EXPLORE_FORMAT_EDITING_ENABLED === "true";
const hookStartingFramePreparationEnabled = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION === "true";

export default function HookVideoPage({ searchParams }: PageProps) {
  // Request query parameters are only needed for local fixtures. Keep the
  // production workflow static so its complete route can be prefetched.
  return <Suspense fallback={<WorkspaceContentLoading label="Opening Hook video" />}>
    {process.env.NODE_ENV === "development" ? <HookVideoPreview searchParams={searchParams} /> : <FormatWorkspace format="hook" finishingEnabled={finishingEnabled} hookStartingFramePreparationEnabled={hookStartingFramePreparationEnabled} />}
  </Suspense>;
}

async function HookVideoPreview({ searchParams }: PageProps) {
  const query = await searchParams;
  return <FormatWorkspace format="hook" previewReferences={query.preview === "1" ? getLocalRecreateReferences() : undefined} finishingEnabled={finishingEnabled} hookStartingFramePreparationEnabled={query.preview === "1" || hookStartingFramePreparationEnabled} />;
}
