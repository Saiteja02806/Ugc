"use client";

import { WorkflowSequencePreview } from "@/components/explore/workflow-sequence-preview";
import { Button } from "@/components/ui/button";
import type { FormatOpeningPreview } from "@/components/explore/format-video-editor";

export function WallSchedulePreview({ preview, error, onBackToEdit }: {
  preview: FormatOpeningPreview | null;
  error: string | null;
  onBackToEdit: () => void;
}) {
  return <section aria-label="Wall of text post preview" className="flex min-w-0 flex-col items-center gap-4 p-5">
    <h2 className="text-base font-semibold">Post preview</h2>
    {preview ? <WorkflowSequencePreview key={JSON.stringify(preview)}
      segments={[{ ...preview.segment, referenceAudio: preview.referenceAudio }]}
      playbackDisabledReason={preview.disabledReason} playbackWarning={preview.warning ?? error} showDescription={false} className="w-full max-w-[520px]" /> :
      <p role="status" className="text-sm text-muted">Loading your selected video preview…</p>}
    <p role={error ? "alert" : undefined} className="max-w-md text-sm leading-6 text-muted">
      {error ?? "You can confirm your schedule now. The final video prepares in the background."}
    </p>
    <Button type="button" variant="outline" onClick={onBackToEdit}>Return to Edit</Button>
  </section>;
}
