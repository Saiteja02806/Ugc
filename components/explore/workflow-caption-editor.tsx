"use client";

import { Button } from "@/components/ui/button";
import type { WorkflowAction } from "./use-workflow-finishing";
import type { SubtitleTranscript } from "@/worker/src/subtitles/contracts";
import type { SubtitleCorrection } from "@/worker/src/subtitles/corrections";

export type WorkflowCaptions = { action: WorkflowAction; transcript: SubtitleTranscript | null; corrections: SubtitleCorrection[]; onCorrectionsChange: (value: SubtitleCorrection[]) => void; onPreview?: () => void };

export function WorkflowCaptionEditor({ captions, disabled = false }: { captions: WorkflowCaptions; disabled?: boolean }) {
  const { transcript, corrections, action } = captions;
  const replacements = new Map(corrections.map(word => [word.index, word.text]));
  return <section aria-label="Caption word correction" className="space-y-3 rounded-xl border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Review caption words</h3>
      {!transcript ? <Button type="button" variant="outline" size="sm" disabled={disabled || action.disabled} onClick={action.onAction}>{action.busy ? "Generating captions…" : "Generate captions"}</Button>
        : corrections.length ? <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => captions.onCorrectionsChange([])}>Reset corrections</Button> : null}</div>
    <p className="text-xs leading-5 text-muted">Generate captions to preview and correct the words before preparing your final video. Corrections keep the spoken audio and timing.</p>
    {transcript ? <div className="flex max-h-56 flex-wrap gap-2 overflow-auto" aria-label="Editable caption words">
      {transcript.words.map((word, index) => <label key={index} className="flex flex-col gap-1">
        <span className="text-[10px] tabular-nums text-muted">{(word.startMs / 1000).toFixed(1)}s</span>
        <input aria-label={`Caption word ${index + 1}`} title={`Original: ${word.text}`} className="h-8 rounded-md border border-border bg-surface px-2 text-xs" style={{ width: `${Math.max(7, Math.min(24, (replacements.get(index) ?? word.text).length + 2))}ch` }}
          disabled={disabled} maxLength={120} defaultValue={replacements.get(index) ?? word.text} key={`${index}:${replacements.get(index) ?? word.text}`}
          onBlur={event => {
            const text = event.target.value.normalize("NFC").trim();
            if (!text || /[\u0000-\u001f\u007f]/u.test(text)) { event.target.value = replacements.get(index) ?? word.text; return; }
            const next = corrections.filter(entry => entry.index !== index);
            if (text !== word.text) next.push({ index, text });
            captions.onCorrectionsChange(next.sort((a, b) => a.index - b.index));
          }} />
      </label>)}
    </div> : <p role="status" className="text-xs text-muted">{action.message}</p>}
    {transcript && captions.onPreview ? <Button type="button" variant="outline" size="sm" onClick={captions.onPreview}>Preview captions</Button> : null}
    {action.error ? <p role="alert" className="text-xs text-destructive">{action.error}</p> : null}
    {action.error || action.recoveryAvailable ? <Button type="button" size="sm" variant="ghost" disabled={action.busy} onClick={action.refresh}>Check caption status</Button> : null}
    {action.cancel ? <Button type="button" size="sm" variant="ghost" onClick={action.cancel}>Cancel caption generation</Button> : null}
  </section>;
}
