"use client";

import { useId, useRef, useState } from "react";
import { FolderOpen, Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowVideoAssetPicker } from "@/components/explore/workflow-video-asset-picker";
import type { WorkflowVideoSelection } from "@/components/explore/use-workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";
import creation from "@/components/explore/workflow-creation.module.css";

export function WorkflowVideoSourceSection({ kind, selection, disabled = false, label: customLabel, description, previewAssets, uploadHint = "MP4, MOV or WebM · Up to 250 MB" }: { kind: "hook" | "phone"; selection: WorkflowVideoSelection; disabled?: boolean; label?: string; description?: string; previewAssets?: MediaAsset[]; uploadHint?: string }) {
  const heading = useId(), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const label = customLabel ?? (kind === "hook" ? "Hook video" : "Creator / phone video");
  const video = selection.preview;
  return <section className={creation.sourceSection} aria-labelledby={heading}>
    <h2 id={heading} className="text-sm font-medium">{label}</h2>
    <div className={creation.sourceModes} role="group" aria-label={`${label} source`}>
      {([ ["generate", "Generate"], ["upload", "Upload"], ["assets", "Creative Assets"] ] as const).map(([mode, text]) =>
        <Button key={mode} type="button" variant="ghost" disabled={disabled || selection.busy} aria-pressed={selection.mode === mode} onClick={() => selection.setMode(mode)}>{text}</Button>)}
    </div>
    <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" aria-label={`Upload ${label.toLowerCase()}`} hidden onChange={event => {
      const file = event.target.files?.[0]; if (file) void selection.chooseUpload(file); event.target.value = "";
    }} />
    {selection.mode === "upload" && !video ? <Button type="button" variant="outline" data-workflow-tile="upload" className={creation.sourceUpload} disabled={disabled || selection.busy} onClick={() => input.current?.click()}>
      <Upload className="size-5" aria-hidden="true" /><span>Upload video</span><span className="text-xs font-normal text-muted">{uploadHint}</span>
    </Button> : null}
    {selection.mode === "assets" && !video ? <Button type="button" variant="outline" data-workflow-tile="upload" className={creation.sourceUpload} disabled={disabled} onClick={() => setOpen(true)}>
      <FolderOpen className="size-5" aria-hidden="true" /><span>Choose from Creative Assets</span>
    </Button> : null}
    {selection.mode !== "generate" && video ? <div className={creation.sourceSummary}>
      <Video className="size-4 shrink-0 text-muted" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={video.name}>{video.name}</p><p className="text-xs text-muted">{video.duration === null ? "Video" : `${Math.round(video.duration * 10) / 10} sec`} · {selection.mode === "upload" ? "Uploaded video" : "Creative Assets"}</p></div>
      <Button type="button" variant="ghost" className="h-9 px-2 text-xs" disabled={disabled || selection.busy} onClick={() => selection.mode === "upload" ? input.current?.click() : setOpen(true)}>Replace</Button>
      {selection.mode === "upload" ? <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label="Remove uploaded video" onClick={selection.removeUpload}><X className="size-3.5" aria-hidden="true" /></Button> : null}
    </div> : null}
    {selection.busy ? <p role="status" className={creation.sectionHelp}>{selection.enabled ? "Uploading your video…" : "Reading your video…"}</p> : null}
    {selection.error ? <p role="alert" className="text-xs text-destructive">{selection.error}</p> : null}
    {selection.mode === "upload" && selection.error && selection.canKeepUpload ? <Button type="button" variant="outline" size="sm" onClick={selection.clearUploadError}>Keep previous video</Button> : null}
    <WorkflowVideoAssetPicker open={open} onOpenChange={setOpen} ownerId={selection.ownerId} selectedId={selection.source?.id} onSelect={selection.selectAsset} description={description} previewAssets={!selection.enabled ? previewAssets : undefined} />
  </section>;
}
