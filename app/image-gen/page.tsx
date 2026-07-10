import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { UgcChatWorkspace } from "@/components/workspace/ugc-chat-workspace";

export const metadata: Metadata = {
  title: "Image Gen",
  description: "Generate UGC image assets.",
};

export default function ImageGenPage() {
  return (
    <AppShell activeKey="img-gen">
      <UgcChatWorkspace />
    </AppShell>
  );
}
