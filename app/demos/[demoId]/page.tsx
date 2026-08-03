import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getContentDemoEditorHref } from "@/lib/edit/routes";

export const metadata: Metadata = {
  title: "Edit demo",
  description: "Trim a demo video and save text overlays.",
};

type DemoEditorPageProps = {
  params: Promise<{
    demoId: string;
  }>;
};

export default async function DemoEditorPage({ params }: DemoEditorPageProps) {
  const { demoId } = await params;
  redirect(getContentDemoEditorHref(demoId));
}
