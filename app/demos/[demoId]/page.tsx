import type { Metadata } from "next";

import { DemoEditorShell } from "@/components/demos/demo-editor-shell";
import { AppShell } from "@/components/layout/app-shell";

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
    <AppShell activeKey="demos">
      <DemoEditorShell demoId={demoId} />
    </AppShell>
  );
}
