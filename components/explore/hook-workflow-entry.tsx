"use client";

import { useSearchParams } from "next/navigation";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";
import { WorkflowDraftEntryBoundary } from "@/components/explore/workflow-draft-entry";

/** Keep the preview guard while allowing the route shell to be prerendered. */
export function HookWorkflowEntry({ generationEnabled, demoFramingEnabled, startingFrameEnabled = false }: {
  generationEnabled: boolean; demoFramingEnabled: boolean; startingFrameEnabled?: boolean;
}) {
  const searchParams = useSearchParams();
  const connected = generationEnabled && searchParams.get("preview") !== "1";
  return connected ? <WorkflowDraftEntryBoundary>{entry => <HookWorkflowPreview key={entry.id} generationEnabled demoFramingEnabled={demoFramingEnabled} startingFrameEnabled={startingFrameEnabled} draftEntry={entry} />}</WorkflowDraftEntryBoundary>
    : <HookWorkflowPreview generationEnabled={false} demoFramingEnabled={demoFramingEnabled} />;
}
