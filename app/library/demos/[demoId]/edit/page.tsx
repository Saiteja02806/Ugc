import type { Metadata } from "next";

import { DemoEditorShell } from "@/components/demos/demo-editor-shell";
import { CONTENT_REELS_HREF } from "@/lib/edit/routes";

export const metadata: Metadata = {
  title: "Edit demo",
  description: "Edit uploaded footage from your Demo screen.",
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
    <DemoEditorShell
      demoId={demoId}
      returnHref={CONTENT_REELS_HREF}
      returnLabel="Back to Demo"
    />
  );
}
