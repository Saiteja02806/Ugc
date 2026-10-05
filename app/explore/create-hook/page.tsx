import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";
import { parseWorkflowDuration } from "@/lib/explore/launch-presets";
import { getWorkflowGenerationMode } from "@/lib/explore/workflow-generation-rollout";

export const metadata: Metadata = { title: "Create a Hook", robots: { index: false, follow: false } };

export default async function CreateHookPage({ searchParams }: { searchParams: Promise<{ preview?: string; mode?: string; duration?: string | string[] }> }) {
  const query = await searchParams;
  const mode = getWorkflowGenerationMode({ environment: process.env.NODE_ENV, generationEnabled: process.env.EXPLORE_GENERATION_ENABLED ?? (process.env.NODE_ENV === "development" ? process.env.EXPLORE_GENERATION_DEVELOPMENT_ENABLED : undefined), preview: query.preview, mode: query.mode });
  if (mode === "hidden") notFound();
  const duration = parseWorkflowDuration(query.duration);
  return <HookWorkflowPreview key={duration} initialDuration={duration} generationEnabled={mode === "generation"} />;
}
