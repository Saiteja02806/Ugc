import creation from "@/components/explore/workflow-creation.module.css";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowVideoMode } from "@/lib/explore/workflow-source-video";

/** Honest empty workspace: no fake player, media or generation output. */
export function WorkflowPreviewCanvas({ kind, source, mode = "generate" }: { kind: "hook" | "phone"; source?: LocalWorkflowMedia | null; mode?: WorkflowVideoMode }) {
  const phone = kind === "phone";
  return <section aria-label={phone ? "Phone video preview" : "Hook video preview"} className={creation.preview}>
    <h2 className={creation.previewLabel}>Workspace</h2>
    {source ? <div className={creation.sourcePreview}><WorkflowMediaPlayer asset={source} kind="video" label={phone ? "Selected phone video preview" : "Selected hook video preview"} className={creation.sourcePlayer} /><p className="truncate text-sm text-muted" title={source.name}>{source.name}</p><p className={creation.sectionHelp}>Continue to edit to add a demo, subtitles or music.</p></div> : <div className={creation.emptyCopy}>
      <h3>{mode !== "generate" ? phone ? "Choose your phone video." : "Choose your hook video." : phone ? "Create your first phone video." : "Create your first hook."}</h3>
      <p>{mode === "upload" ? "Upload your existing video in Create. Preview it here, then continue to edit." : mode === "assets" ? "Choose a video from Creative Assets in Create. Preview it here, then continue to edit." : phone ? "Add your app screen and instructions in Create. Your generated video will appear here." : "Add your instructions in Create. Your generated hook will appear here."}</p>
    </div>}
  </section>;
}
