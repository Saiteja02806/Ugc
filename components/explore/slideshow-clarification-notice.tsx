import { CircleHelp } from "lucide-react";
import { slideshowClarificationMatches, slideshowClarificationMessages, type SlideshowClarification } from "@/lib/explore/slideshow-generation-recovery";

/** Presentation only: questions never submit or change the user's draft. */
export function SlideshowClarificationNotice({ feedback, scope, imageIds, prompt }: { feedback: SlideshowClarification; scope: string; imageIds: readonly string[]; prompt?: string }) {
  const current = slideshowClarificationMatches(feedback, scope, imageIds) && (prompt === undefined || feedback.prompt === prompt);
  if (!current) return null;
  return <section role="status" aria-label="Slideshow clarification" className="rounded-2xl border border-border bg-card-muted/40 p-4 text-sm leading-6">
    <div className="flex items-start gap-2"><CircleHelp aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" /><div className="min-w-0">
      <p className="font-semibold text-foreground-strong">A little more detail is needed</p>
      <p className="mt-1 text-xs leading-5 text-muted">No images were generated for that request.</p>
    </div></div>
    <ul className="mt-3 list-disc space-y-2 break-words pl-5 text-muted">{slideshowClarificationMessages(feedback.items).map(question => <li key={question}>{question}</li>)}</ul><p className="mt-3 text-xs leading-5 text-foreground">Update your instructions above, then select Generate again.</p>
  </section>;
}
