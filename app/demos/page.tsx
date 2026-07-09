import type { Metadata } from "next";

import { DemosWorkspace } from "@/components/demos/demos-workspace";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "Demos",
  description: "Upload and manage product demo videos.",
};

export default function DemosPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="demos" />
      <DemosWorkspace />
    </main>
  );
}
