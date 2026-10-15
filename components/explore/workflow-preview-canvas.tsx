import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowVideoMode } from "@/lib/explore/workflow-source-video";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import type { WorkflowGenerationView } from "@/components/explore/workflow-generation-boundary";
import { Button } from "@/components/ui/button";
import creation from "@/components/explore/workflow-creation.module.css";
import { VideoGenerationPlaceholder } from "@/components/video/video-generation-placeholder";

/** Honest empty workspace: no fake player, media or generation output. */
export function WorkflowPreviewCanvas({ kind, generation, source, mode = "generate", onContinue }: { kind: "hook" | "phone"; generation?: WorkflowGenerationView; source?: LocalWorkflowMedia | null; mode?: WorkflowVideoMode; onContinue?: () => void }) {
  const phone = kind === "phone";
  if (mode !== "generate" && source) return <section aria-label="Selected video preview" className={creation.editWorkspace}><h2 className={creation.sectionTitle}>Your selected video</h2><WorkflowMediaPlayer asset={source} kind="video" label="Selected source video preview" className={creation.sourcePlayer} /><p className={creation.sectionHelp}>{source.name}</p>{onContinue ? <Button type="button" className={creation.previewAction} onClick={onContinue}>{phone ? "Continue to edit" : "Continue"}</Button> : null}</section>;
  if (generation && (generation.results.length || generation.busy || generation.error)) return <section aria-label={phone ? "Generated phone video preview" : "Generated talking-head preview"} className={creation.editWorkspace} aria-busy={generation.busy}>
    <h2 className={creation.sectionTitle}>Your generated videos</h2>
    {generation.busy ? <p role="status" className={creation.sectionHelp}>{generation.message}</p> : null}
    {generation.busy ? <div className="flex min-w-0 flex-wrap items-start gap-5" aria-label="Videos being prepared">
      {Array.from({ length: generation.pendingCount ?? 1 }, (_, index) => <article key={index} aria-label={`Pending video ${index + 1}`} className={generation.pendingPreview?.aspectRatio === "16:9" ? "w-full max-w-[420px]" : "w-full max-w-[220px]"}>
        <VideoGenerationPlaceholder aspectRatio={generation.pendingPreview?.aspectRatio} referenceImageUrl={generation.pendingPreview?.referenceImageUrl} label={generation.pendingPreview?.label} />
      </article>)}
    </div> : null}
    {generation.results.map((asset, index) => <section key={asset.id} className={creation.segment} aria-label={`Generated video ${index + 1}`}>
      <WorkflowMediaPlayer asset={{ name: asset.title, url: asset.url, duration: asset.durationSeconds }} kind="video" label={`Generated video ${index + 1} preview`} className="mx-auto h-auto max-h-[50dvh] w-auto max-w-full rounded-lg" />
      <Button type="button" variant={generation.selected?.id === asset.id ? "default" : "outline"} aria-pressed={generation.selected?.id === asset.id} onClick={() => generation.selectResult(asset.id)}>Use video {index + 1}</Button>
    </section>)}
    {generation.error ? <p role="alert" className="text-sm leading-6 text-destructive">{generation.error}</p> : null}
  </section>;
  return <section aria-label={phone ? "Generated phone video preview" : "Generated talking-head preview"} className={creation.preview}>
    <h2 className={creation.previewLabel}>Workspace</h2>
    <div className={creation.emptyCopy}>
      <h3>{mode !== "generate" ? "Add your existing video." : phone ? "Create your first phone video." : "Create your talking-head video."}</h3>
      <p>{mode !== "generate" ? "Upload a video or choose one from Creative Assets in Create. Your selected video will appear here." : phone ? "Add your app screen and instructions in Create. Your generated video will appear here." : "Add your instructions in Create. Publish the video on its own, or add an optional demo in Edit."}</p>
    </div>
  </section>;
}
