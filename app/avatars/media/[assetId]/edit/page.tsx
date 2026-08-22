import type { Metadata } from "next";

import { FocusedVideoEditorShell } from "@/components/edit/focused-video-editor-shell";
import { CREATIVE_ASSETS_VIDEOS_HREF } from "@/lib/edit/routes";

export const metadata: Metadata = {
  title: "Edit creative asset",
  description: "Edit a video without leaving Creative Assets.",
};

type CreativeAssetEditorPageProps = {
  params: Promise<{
    assetId: string;
  }>;
};

export default async function CreativeAssetEditorPage({
  params,
}: CreativeAssetEditorPageProps) {
  const { assetId } = await params;

  return (
    <FocusedVideoEditorShell
      returnHref={CREATIVE_ASSETS_VIDEOS_HREF}
      returnLabel="Back to Creative Assets"
      videoId={assetId}
    />
  );
}
