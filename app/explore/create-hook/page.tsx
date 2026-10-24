import type { Metadata } from "next";
import { Suspense } from "react";
import { HookWorkflowEntry } from "@/components/explore/hook-workflow-entry";
import { WorkspaceContentLoading } from "@/components/layout/workspace-content-loading";

export const metadata: Metadata = { title: "Talking Head + Demo", description: "Create a talking-head video and add your demo.", robots: { index: false, follow: false } };

export default function CreateHookPage() {
  return <Suspense fallback={<WorkspaceContentLoading label="Opening Talking Head + Demo" />}><HookWorkflowEntry
    generationEnabled={process.env.EXPLORE_GENERATION_ENABLED === "true"}
    startingFrameEnabled={process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION === "true"}
    demoFramingEnabled={process.env.EXPLORE_DEMO_FRAMING_ENABLED === "true"}
  /></Suspense>;
}
