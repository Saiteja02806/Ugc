import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { VideoGenerationWorkspace } from "@/components/video/video-generation-workspace";

export const metadata: Metadata = {
  title: "Video Gen",
  description: "Generate avatar-led UGC hook videos.",
};

export default function VideoGenPage() {
  return (
    <AppShell activeKey="video-gen">
      <VideoGenerationWorkspace />
    </AppShell>
  );
}
