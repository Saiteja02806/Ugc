import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCreativeAssetEditorHref } from "@/lib/edit/routes";

export const metadata: Metadata = {
  title: "Edit video",
  description: "Preview edits for a selected video.",
};

type EditVideoPageProps = {
  params: Promise<{
    videoId: string;
  }>;
};

export default async function EditVideoPage({ params }: EditVideoPageProps) {
  const { videoId } = await params;
  redirect(getCreativeAssetEditorHref(videoId));
}
