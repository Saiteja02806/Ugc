import type { Metadata } from "next";

import { FocusedVideoEditorShell } from "@/components/edit/focused-video-editor-shell";
import { AppSidebar } from "@/components/layout/app-sidebar";

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
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="edit" />
      <FocusedVideoEditorShell videoId={videoId} />
    </main>
  );
}
