import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "Avatars",
  description: "Choose and trim avatar videos for UGC generation.",
};

export default function AvatarsPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="avatars" />
      <AvatarsWorkspace />
    </main>
  );
}
