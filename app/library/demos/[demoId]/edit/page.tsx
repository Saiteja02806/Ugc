import type { Metadata } from "next";

import { DemoEditorShell } from "@/components/demos/demo-editor-shell";
import { AppShell } from "@/components/layout/app-shell";
import { CONTENT_REELS_HREF } from "@/lib/edit/routes";

export const metadata: Metadata = {
  title: "Edit content",
  description: "Edit an uploaded demo without leaving Content.",
};

type ContentDemoEditorPageProps = {
  params: Promise<{
    demoId: string;
  }>;
};

export default async function ContentDemoEditorPage({
  params,
}: ContentDemoEditorPageProps) {
  const { demoId } = await params;

  return (
    <AppShell activeKey="library" defaultSidebarCollapsed>
      <DemoEditorShell
        demoId={demoId}
        returnHref={CONTENT_REELS_HREF}
        returnLabel="Back to Content"
      />
    </AppShell>
  );
}
