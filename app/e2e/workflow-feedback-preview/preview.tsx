"use client";

import { useState } from "react";
import { WorkflowFeedback } from "@/components/explore/workflow-feedback";
import { Button } from "@/components/ui/button";

export function FeedbackPreview({ state }: { state: string }) {
  const [refreshed, setRefreshed] = useState(false);
  const [scenario, setScenario] = useState(state);
  return <>
    {/* Replace the normal preview-access notice only in this synthetic scenario. */}
    <style>{'body:has(#local-feedback-preview) [data-workflow-feedback]:not([data-feedback-id="local-feedback-preview"]) { display: none; }'}</style>
    <details data-feedback-test-controls className="fixed bottom-2 left-12 z-40 rounded-lg border border-border bg-card px-2 py-1 text-xs"><summary>Layout checks</summary><div className="flex gap-2 py-2">{["ready", "error", "long"].map(value => <Button key={value} size="sm" variant="outline" type="button" onClick={() => { setScenario(value); setRefreshed(false); }}>{value}</Button>)}</div></details>
    <WorkflowFeedback id="local-feedback-preview" active={scenario !== "ready"}>
    <p className="text-xs leading-5 text-muted">{refreshed ? "Local layout check complete. No request was submitted." : "The previous request must be confirmed before another generation."}</p>
    <p role="alert" className="text-xs leading-5 text-destructive">{scenario === "long" ? "The saved request could not be confirmed. ".repeat(200) : "This prompt is too long for the selected model. Shorten it and try again."}</p>
    <Button type="button" variant="outline" size="sm" onClick={() => setRefreshed(true)}>Refresh status</Button>
    </WorkflowFeedback>
  </>;
}
