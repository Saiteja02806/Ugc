import type { Metadata } from "next";

import {
  AIStudioWorkspace,
  type AIStudioMode,
} from "@/components/generation/ai-studio-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "AI Studio",
  description:
    "Configure images and short-form videos in one focused workspace.",
};

export default async function AIStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const initialMode: AIStudioMode = mode === "videos" ? "videos" : "images";

  return (
    <AppShell activeKey="ai-studio">
      <AIStudioWorkspace initialMode={initialMode} />
    </AppShell>
  );
}
