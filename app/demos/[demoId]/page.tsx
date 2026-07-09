import type { Metadata } from "next";

import { DemoEditorShell } from "@/components/demos/demo-editor-shell";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "Edit demo",
  description: "Trim a demo video and save text overlay draft settings.",
};

type DemoEditorPageProps = {
  params: Promise<{
    demoId: string;
  }>;
};

export default async function DemoEditorPage({ params }: DemoEditorPageProps) {
  const { demoId } = await params;

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="demos" />
      <DemoEditorShell demoId={demoId} />
    </main>
  );
}
