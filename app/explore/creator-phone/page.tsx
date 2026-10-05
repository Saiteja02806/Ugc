import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhoneWorkflowPreview } from "@/components/explore/phone-workflow-preview";
import { getWorkflowGenerationMode } from "@/lib/explore/workflow-generation-rollout";

export const metadata: Metadata = {
  title: "Creator Shows App on Phone",
  robots: { index: false, follow: false },
};

export default async function CreatorPhonePage({ searchParams }: { searchParams: Promise<{ preview?: string; mode?: string }> }) {
  const query = await searchParams;
  const mode = getWorkflowGenerationMode({ environment: process.env.NODE_ENV, generationEnabled: process.env.EXPLORE_GENERATION_ENABLED ?? (process.env.NODE_ENV === "development" ? process.env.EXPLORE_GENERATION_DEVELOPMENT_ENABLED : undefined), preview: query.preview, mode: query.mode });
  if (mode === "hidden") notFound();
  return <PhoneWorkflowPreview generationEnabled={mode === "generation"} />;
}
