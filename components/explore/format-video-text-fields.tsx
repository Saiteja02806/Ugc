"use client";

import type { ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
import styles from "@/components/explore/format-workspace.module.css";

const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";

/** Text controls shared by the opening and Demo preview editors. */
export function FormatVideoTextFields({ editing, onChange }: { editing: ExploreFormatEdit; onChange: (next: ExploreFormatEdit) => void }) {
  const wall = editing.format === "wall_text";
  const text = editing.text;
  function updateText(value: string) {
    onChange({ ...editing, text: value ? { ...(text ?? { width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: editing.trimEndMs - editing.trimStartMs }), value } : null });
  }
  return <section className="space-y-3" aria-label="Text"><h2 className="text-sm font-semibold">{wall ? "Your wall of text" : "Text overlay"}</h2>
    <textarea aria-label={wall ? "Wall of text" : "Overlay text"} value={text?.value ?? ""} onChange={event => updateText(event.target.value)} rows={6} maxLength={600} placeholder={wall ? "Write your message. Keep your line breaks and paragraphs…" : "Add an optional heading…"} className={field} />
    {text ? <details className={styles.demoOptions}><summary>Text style & timing</summary><div className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Position<select aria-label="Text position" value={text.y} onChange={event => onChange({ ...editing, text: { ...text, y: Number(event.target.value) } })} className={field}><option value={.1}>Top</option><option value={.3}>Middle</option><option value={.55}>Lower</option><option value={.18}>Default</option></select></label><label className="space-y-2 text-xs text-muted">Color<input type="color" aria-label="Text color" value={text.color} onChange={event => onChange({ ...editing, text: { ...text, color: event.target.value } })} className={field} /></label></div>
    <label className="block space-y-2 text-xs text-muted">Width · {Math.round(text.width * 100)}%<input type="range" aria-label="Text width" min={40} max={94} value={text.width * 100} onChange={event => onChange({ ...editing, text: { ...text, width: Number(event.target.value) / 100 } })} className="w-full accent-primary" /></label>
    <label className="block space-y-2 text-xs text-muted">Text size · {text.fontSize}<input type="range" aria-label="Text size" min={24} max={84} value={text.fontSize} onChange={event => onChange({ ...editing, text: { ...text, fontSize: Number(event.target.value) } })} className="w-full accent-primary" /></label>
    <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Show from (s)<input type="number" aria-label="Text start time" min={0} step={.1} value={text.startMs / 1000} onChange={event => onChange({ ...editing, text: { ...text, startMs: Math.round(Number(event.target.value) * 1000) } })} className={field} /></label><label className="space-y-2 text-xs text-muted">Until (s)<input type="number" aria-label="Text end time" min={.1} max={(editing.trimEndMs - editing.trimStartMs) / 1000} step={.1} value={text.endMs / 1000} onChange={event => onChange({ ...editing, text: { ...text, endMs: Math.round(Number(event.target.value) * 1000) } })} className={field} /></label></div></div></details> : null}
    <p className="text-xs leading-5 text-muted">This overlay stays editable. Text already inside the original video is part of the footage.</p>
  </section>;
}

export function trimFormatVideoEdit(editing: ExploreFormatEdit, startMs: number, endMs: number): ExploreFormatEdit {
  const length = endMs - startMs;
  return { ...editing, trimStartMs: startMs, trimEndMs: endMs, text: editing.text ? { ...editing.text, startMs: Math.min(editing.text.startMs, Math.max(0, length - 1)), endMs: Math.min(editing.text.endMs, length) } : null };
}
