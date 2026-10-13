"use client";

import { useSearchParams } from "next/navigation";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";

/** Keep the preview guard while allowing the route shell to be prerendered. */
export function HookWorkflowEntry({ generationEnabled, demoFramingEnabled }: {
  generationEnabled: boolean; demoFramingEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  return <HookWorkflowPreview generationEnabled={generationEnabled && searchParams.get("preview") !== "1"}
    demoFramingEnabled={demoFramingEnabled} />;
}
