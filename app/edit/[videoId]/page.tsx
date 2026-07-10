import type { Metadata } from "next";

import { FocusedVideoEditorShell } from "@/components/edit/focused-video-editor-shell";
import { AppShell } from "@/components/layout/app-shell";

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

  return (
    <AppShell activeKey="edit" defaultSidebarCollapsed>
      <FocusedVideoEditorShell videoId={videoId} />
    </AppShell>
  );
}
