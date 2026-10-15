"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import tools from "./format-video-editor.module.css";
import { Button } from "@/components/ui/button";
import styles from "@/components/explore/format-workspace.module.css";
import { applyFormatTextPreset, MAX_FORMAT_TEXT_OVERLAYS, type ExploreFormatText, type FormatTextPreset } from "@/worker/src/lib/explore-format-edit";

const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";

export function FormatTextOverlaysEditor({ overlays, durationMs, onChange, wallText = false, timeMs = 0, onSeek, styleTarget, showStyleControls = true }: {
  overlays: ExploreFormatText[]; durationMs: number; onChange: (value: ExploreFormatText[]) => void;
  wallText?: boolean; timeMs?: number; onSeek: (timeMs: number) => void; styleTarget?: HTMLElement | null; showStyleControls?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const editable = overlays.length ? overlays : [{ value: "", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: durationMs }];
  const index = Math.min(selected, editable.length - 1);
  const text = editable[index];
  function update(patch: Partial<ExploreFormatText>) {
    const next = { ...text, ...patch, ...(wallText ? { startMs: 0, endMs: durationMs } : {}) };
    onChange(editable.map((overlay, i) => i === index ? next : overlay));
    // Keep the selected text visible while editing, including paused playback.
    if (timeMs < next.startMs || timeMs >= next.endMs) onSeek(Math.max(0, Math.min(next.startMs, next.endMs - 1, durationMs - 1)));
  }
  function add() {
    const previousEnd = editable.at(-1)?.endMs ?? 0;
    const startMs = wallText ? 0 : Math.min(Math.max(0, Math.round(timeMs), previousEnd), Math.max(0, durationMs - 1000));
    onChange([...editable, { value: "", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs, endMs: durationMs }]);
    setSelected(editable.length); onSeek(startMs);
  }
  const styleControls = <details className={`${styles.clipTextStyle} ${tools.stylePanel}`} open><summary className="cursor-pointer text-sm font-medium">Text style</summary><div className={`mt-3 ${styles.clipTextStyleFields}`}>
        <label className="block space-y-2 text-xs text-muted">Text preset<select aria-label="Text preset" value={text.preset ?? "bold"} onChange={event => update(applyFormatTextPreset(text, event.target.value as FormatTextPreset))} className={field}><option value="bold">Bold white</option><option value="snapchat-classic">Snapchat Classic</option></select></label>
        {text.preset === "snapchat-classic" ? <label className="block space-y-2 text-xs text-muted">Background opacity · {Math.round((text.backgroundOpacity ?? .58) * 100)}%<input aria-label="Caption background opacity" type="range" min={0} max={100} value={(text.backgroundOpacity ?? .58) * 100} onChange={event => update({ backgroundOpacity: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label> : null}
        <div className={tools.positionColor}><label className="space-y-2 text-xs text-muted">Position<select aria-label="Text position" value={text.y} onChange={event => update({ y: Number(event.target.value) })} className={field}><option value={text.preset === "snapchat-classic" ? .075 : .1}>Top</option><option value={.3}>Middle</option><option value={.55}>Bottom</option>{![text.preset === "snapchat-classic" ? .075 : .1,.3,.55].includes(text.y) ? <option value={text.y}>Custom · {Math.round(text.y * 100)}%</option> : null}</select></label><label className="space-y-2 text-xs text-muted">Color<input type="color" aria-label="Text color" value={text.color} onChange={event => update({ color: event.target.value })} className={field} /></label></div>
        <label className="block space-y-2 text-xs text-muted">Vertical position · {Math.round(text.y * 1000) / 10}%<input type="range" aria-label="Text vertical position" min={3} max={90} step={.5} value={text.y * 100} onChange={event => update({ y: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label>
        <label className="block space-y-2 text-xs text-muted">Width · {Math.round(text.width * 100)}%<input type="range" aria-label="Text width" min={40} max={94} value={text.width * 100} onChange={event => update({ width: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label>
        <label className="block space-y-2 text-xs text-muted">Text size · {text.fontSize}<input type="range" aria-label="Text size" min={24} max={84} value={text.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} className="w-full accent-primary" /></label>
      </div></details>;
  return <section className="space-y-3" aria-label="Text overlays">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{wallText ? "Your wall of text" : "Text overlays"}</h2>
      <Button type="button" size="sm" variant="outline" disabled={editable.length >= MAX_FORMAT_TEXT_OVERLAYS || durationMs < 1} onClick={add}>Add text</Button></div>
    {!wallText ? <p className="text-xs leading-5 text-muted">Each text block has its own timing within the trimmed clip.</p> : null}
    {editable.length > 1 || text.value ? <div className="space-y-2" role="group" aria-label="Text blocks">
      {editable.map((overlay, i) => <div key={i} className="flex items-center gap-2">
        <Button type="button" size="sm" variant={i === index ? "secondary" : "ghost"} className="min-w-0 flex-1 justify-start" aria-pressed={i === index} aria-label={`Edit text block ${i + 1}`} onClick={() => { setSelected(i); onSeek(overlay.startMs); }}>
          <span className="truncate">{i + 1} · {overlay.value || "Empty text"}</span>{!wallText ? <span className="ml-auto shrink-0 text-xs text-muted">{overlay.startMs / 1000}–{overlay.endMs / 1000}s</span> : null}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove text block ${i + 1}`} onClick={() => { onChange(editable.filter((_, n) => n !== i)); setSelected(Math.max(0, i - 1)); }}>×</Button>
      </div>)}
    </div> : null}
    {text ? <>
      <label className="block space-y-2 text-xs text-muted">Text block {index + 1}<textarea aria-label={wallText ? "Wall of text" : "Overlay text"} placeholder="Type text to show on this clip…" value={text.value} onChange={event => update({ value: event.target.value })} rows={3} maxLength={600} className={field} /></label>
      {!wallText ? <div className={tools.textTiming}><label className="space-y-2 text-xs text-muted">Show from (s)<input type="number" aria-label="Text start time" min={0} max={durationMs / 1000} step={.1} value={text.startMs / 1000} onChange={event => update({ startMs: Math.round(Number(event.target.value) * 1000) })} className={field} /></label><label className="space-y-2 text-xs text-muted">Until (s)<input type="number" aria-label="Text end time" min={.1} max={durationMs / 1000} step={.1} value={text.endMs / 1000} onChange={event => update({ endMs: Math.round(Number(event.target.value) * 1000) })} className={field} /></label></div> : null}
      {showStyleControls ? styleTarget ? createPortal(styleControls, styleTarget) : styleControls : null}
    </> : <p className="text-xs text-muted">Add text to show a message at a specific time.</p>}
    <p className="text-xs leading-5 text-muted">Text already inside the original video is part of the footage.</p>
  </section>;
}
