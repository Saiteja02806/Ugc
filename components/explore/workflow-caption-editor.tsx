"use client";

import { useState, type ReactNode } from "react";
import { Captions, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WorkflowAction } from "./use-workflow-finishing";
import type { SubtitleTranscript } from "@/worker/src/subtitles/contracts";
import type { SubtitleCorrection } from "@/worker/src/subtitles/corrections";
import styles from "./workflow-caption-editor.module.css";

export type WorkflowCaptions = {
  action: WorkflowAction;
  transcript: SubtitleTranscript | null;
  corrections: SubtitleCorrection[];
  onCorrectionsChange: (value: SubtitleCorrection[]) => void;
  generating?: boolean;
  preview?: ReactNode;
  onOpen?: () => void;
};

const timestamp = (ms: number) => `${Math.floor(ms / 60000)}:${(ms / 1000 % 60).toFixed(1).padStart(4, "0")}`;

function CaptionWordInput({ index, original, value, startMs, disabled, onChange }: { index: number; original: string; value: string; startMs: number; disabled: boolean; onChange: (text: string) => void }) {
  const [draft, setDraft] = useState<{ saved: string; text: string } | null>(null);
  const displayed = draft?.saved === value ? draft.text : value;
  return <input aria-label={`Caption word ${index + 1}`} title={`Original: ${original} · ${timestamp(startMs)}`} className={styles.word}
    data-corrected={value !== original} style={{ width: `${Math.max(3, Math.min(26, displayed.length + 1))}ch` }} disabled={disabled} maxLength={120} value={displayed}
    onChange={event => {
      const raw = event.target.value, text = raw.normalize("NFC").trim();
      // Valid changes reach the draft immediately, including an Escape/close.
      // A temporarily empty field stays local until a valid word is entered.
      if (text && !/[\u0000-\u001f\u007f]/u.test(text)) { onChange(text); setDraft({ saved: text, text: raw }); }
      else setDraft({ saved: value, text: raw });
    }} onBlur={() => setDraft(null)} />;
}

/** Speech stays in its original timed words; rows only make the transcript easier to read. */
function transcriptRows(transcript: SubtitleTranscript) {
  const rows: { start: number; end: number }[] = [];
  let start = 0;
  for (let index = 0; index < transcript.words.length; index++) {
    const word = transcript.words[index], next = transcript.words[index + 1];
    if (!next || index - start >= 8 || /[.!?]$/u.test(word.text) || next.startMs - word.endMs >= 600 || next.endMs - transcript.words[start].startMs > 5000) {
      rows.push({ start, end: index + 1 });
      start = index + 1;
    }
  }
  return rows;
}

export function WorkflowCaptionEditor({ captions, disabled = false }: { captions: WorkflowCaptions; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { transcript, corrections, action } = captions;
  const generating = !transcript && (captions.generating || action.busy);
  const replacements = new Map(corrections.map(word => [word.index, word.text]));
  const generate = () => { if (!transcript && !generating && !disabled && !action.disabled) action.onAction(); };
  return <section aria-label="Caption word correction" className={styles.launcher}>
    <div className={styles.launcherRow}>
      <h3 className="text-sm font-medium">Captions</h3>
      <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) captions.onOpen?.(); }}>
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" className={styles.launcherButton} disabled={!transcript && !generating && (disabled || action.disabled)} onClick={generate} />}>
          {generating ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <Captions aria-hidden="true" />}
          {transcript ? "Review captions" : generating ? "Generating…" : "Generate captions"}
        </DialogTrigger>
        <DialogContent className={styles.dialog}>
          <header className={styles.header}>
            <DialogTitle>Review captions</DialogTitle>
            <DialogDescription className="sr-only">Edit caption words while previewing your video.</DialogDescription>
          </header>
          <div className={styles.body} data-has-preview={Boolean(captions.preview)}>
            {captions.preview ? <div className={styles.preview}>{open ? captions.preview : null}</div> : null}
            <div className={styles.transcript}>
              <div className={styles.toolbar}>
                <h3 className="text-sm font-medium">Transcript</h3>
                {transcript ? <span className="text-xs tabular-nums text-muted">{transcript.words.length} words · {timestamp(transcript.durationMs)}</span> : null}
              </div>
              {transcript ? <div className={styles.words} aria-label="Editable caption words">
                {transcriptRows(transcript).map(row => <div key={row.start} className={styles.row}>
                  <span className={styles.timestamp}>{timestamp(transcript.words[row.start].startMs)}</span>
                  <div className={styles.phrase}>{transcript.words.slice(row.start, row.end).map((word, offset) => {
                    const index = row.start + offset, value = replacements.get(index) ?? word.text;
                    return <CaptionWordInput key={`${index}:${word.text}`} index={index} original={word.text} value={value} startMs={word.startMs} disabled={disabled}
                      onChange={text => {
                        const next = corrections.filter(entry => entry.index !== index);
                        if (text !== word.text) next.push({ index, text });
                        captions.onCorrectionsChange(next.sort((a, b) => a.index - b.index));
                      }} />;
                  })}</div>
                </div>)}
              </div> : <div className={styles.empty} role="status" aria-live="polite">
                {generating ? <LoaderCircle className="size-7 text-primary motion-safe:animate-spin" aria-hidden="true" /> : <Captions className="size-7 text-muted" aria-hidden="true" />}
                <h3 className="text-base font-medium">{generating ? "Generating captions…" : "Generate captions to begin"}</h3>
                {!generating ? <Button type="button" variant="outline" disabled={disabled || action.disabled} onClick={generate}>Generate captions</Button> : null}
              </div>}
              {action.error ? <p role="alert" className="px-5 py-3 text-sm text-destructive">{action.error}</p> : null}
            </div>
          </div>
          <footer className={styles.footer}>
            <div className="flex flex-wrap items-center gap-2">
              {transcript && corrections.length ? <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => captions.onCorrectionsChange([])}>Reset corrections</Button> : null}
              {action.error || action.recoveryAvailable ? <Button type="button" size="sm" variant="ghost" disabled={action.busy} onClick={action.refresh}>Check caption status</Button> : null}
              {action.cancel ? <Button type="button" size="sm" variant="ghost" onClick={action.cancel}>Cancel generation</Button> : null}
              {transcript && corrections.length ? <span role="status" className="text-xs text-muted">{`${corrections.length} word${corrections.length === 1 ? "" : "s"} corrected`}</span> : null}
            </div>
            <Button type="button" onClick={() => setOpen(false)}>{transcript ? "Done" : "Close"}</Button>
          </footer>
        </DialogContent>
      </Dialog>
    </div>
    {action.error && !open ? <p role="alert" className="text-xs text-destructive">{action.error}</p> : null}
  </section>;
}
