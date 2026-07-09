import type { Metadata } from "next";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { UgcChatWorkspace } from "@/components/workspace/ugc-chat-workspace";

export const metadata: Metadata = {
  title: "Image Gen",
  description: "Generate UGC image assets.",
};

export default function ImageGenPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="img-gen" />
      <UgcChatWorkspace />
    </main>
  );
}
