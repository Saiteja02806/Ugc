import type { Metadata } from "next";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { VideoGenerationWorkspace } from "@/components/video/video-generation-workspace";

export const metadata: Metadata = {
  title: "Video Gen",
  description: "Generate avatar-led UGC hook videos.",
};

export default function VideoGenPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="video-gen" />
      <VideoGenerationWorkspace />
    </main>
  );
}
