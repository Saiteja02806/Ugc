import type { Metadata } from "next";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";

export const metadata: Metadata = { title: "Talking Head + Demo", description: "Create a talking-head video and add your demo.", robots: { index: false, follow: false } };

export default async function CreateHookPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const query = await searchParams;
  return <HookWorkflowPreview
    generationEnabled={process.env.EXPLORE_GENERATION_ENABLED === "true" && query.preview !== "1"}
    demoFramingEnabled={process.env.EXPLORE_DEMO_FRAMING_ENABLED === "true"}
  />;
}
