"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_FORMAT_TEXT_OVERLAYS, type ExploreFormatText } from "@/worker/src/lib/explore-format-edit";

const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";

export function FormatTextOverlaysEditor({ overlays, durationMs, onChange, wallText = false, timeMs = 0, onSeek }: {
  overlays: ExploreFormatText[]; durationMs: number; onChange: (value: ExploreFormatText[]) => void;
  wallText?: boolean; timeMs?: number; onSeek: (timeMs: number) => void;
}) {
  const [selected, setSelected] = useState(0);
  const editable = overlays.length ? overlays : [{ value: "", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: durationMs }];
  const index = Math.min(selected, editable.length - 1);
  const text = editable[index];
  function update(patch: Partial<ExploreFormatText>) {
    onChange(editable.map((overlay, i) => i === index ? { ...overlay, ...patch } : overlay));
  }
  function add() {
    const previousEnd = editable.at(-1)?.endMs ?? 0;
    const startMs = Math.min(Math.max(0, Math.round(timeMs), previousEnd), Math.max(0, durationMs - 1000));
    onChange([...editable, { value: "", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs, endMs: durationMs }]);
    setSelected(editable.length); onSeek(startMs);
  }
  return <section className="space-y-3" aria-label="Text overlays">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{wallText ? "Your wall of text" : "Text overlays"}</h2>
      <Button type="button" size="sm" variant="outline" disabled={editable.length >= MAX_FORMAT_TEXT_OVERLAYS || durationMs < 1} onClick={add}>Add text</Button></div>
    <p className="text-xs leading-5 text-muted">Each text block has its own timing within the trimmed clip.</p>
    {editable.length > 1 || text.value ? <div className="space-y-2" role="group" aria-label="Text blocks">
      {editable.map((overlay, i) => <div key={i} className="flex items-center gap-2">
        <Button type="button" size="sm" variant={i === index ? "secondary" : "ghost"} className="min-w-0 flex-1 justify-start" aria-pressed={i === index} aria-label={`Edit text block ${i + 1}`} onClick={() => { setSelected(i); onSeek(overlay.startMs); }}>
          <span className="truncate">{i + 1} · {overlay.value || "Empty text"}</span><span className="ml-auto shrink-0 text-xs text-muted">{overlay.startMs / 1000}–{overlay.endMs / 1000}s</span>
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove text block ${i + 1}`} onClick={() => { onChange(editable.filter((_, n) => n !== i)); setSelected(Math.max(0, i - 1)); }}>×</Button>
      </div>)}
    </div> : null}
    {text ? <>
      <label className="block space-y-2 text-xs text-muted">Text block {index + 1}<textarea aria-label={wallText ? "Wall of text" : "Overlay text"} placeholder="Type text to show on this clip…" value={text.value} onChange={event => update({ value: event.target.value })} rows={4} maxLength={600} className={field} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Show from (s)<input type="number" aria-label="Text start time" min={0} max={durationMs / 1000} step={.1} value={text.startMs / 1000} onChange={event => update({ startMs: Math.round(Number(event.target.value) * 1000) })} className={field} /></label><label className="space-y-2 text-xs text-muted">Until (s)<input type="number" aria-label="Text end time" min={.1} max={durationMs / 1000} step={.1} value={text.endMs / 1000} onChange={event => update({ endMs: Math.round(Number(event.target.value) * 1000) })} className={field} /></label></div>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Text style</summary><div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Position<select aria-label="Text position" value={text.y} onChange={event => update({ y: Number(event.target.value) })} className={field}><option value={.1}>Top</option><option value={.3}>Middle</option><option value={.55}>Lower</option><option value={.18}>Default</option></select></label><label className="space-y-2 text-xs text-muted">Color<input type="color" aria-label="Text color" value={text.color} onChange={event => update({ color: event.target.value })} className={field} /></label></div>
        <label className="block space-y-2 text-xs text-muted">Width · {Math.round(text.width * 100)}%<input type="range" aria-label="Text width" min={40} max={94} value={text.width * 100} onChange={event => update({ width: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label>
        <label className="block space-y-2 text-xs text-muted">Text size · {text.fontSize}<input type="range" aria-label="Text size" min={24} max={84} value={text.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} className="w-full accent-primary" /></label>
      </div></details>
    </> : <p className="text-xs text-muted">Add text to show a message at a specific time.</p>}
    <p className="text-xs leading-5 text-muted">Text already inside the original video is part of the footage.</p>
  </section>;
}
