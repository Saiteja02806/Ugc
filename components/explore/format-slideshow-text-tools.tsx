"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { EMPTY_SLIDE_TEXT, type SlideTextDesign } from "@/lib/explore/slideshow-text";
import styles from "./slideshow-editor.module.css";

/** Manual text remains editable independently of AI-generated image pixels. */
export function FormatSlideshowTextTools({ design, disabled, onChange }: {
  design: SlideTextDesign; disabled: boolean; onChange: (patch: Partial<SlideTextDesign>) => void;
}) {
  const id = useId();
  return <section aria-label="Slide text tools" className="space-y-3">
    <div className={styles.field}><label htmlFor={`${id}-heading`}>Heading</label><textarea id={`${id}-heading`} rows={2} value={design.heading} maxLength={180} disabled={disabled} placeholder="Add a heading…" onChange={event => onChange({ heading: event.target.value })} /></div>
    <div className={styles.field}><label htmlFor={`${id}-body`}>Body text</label><textarea id={`${id}-body`} rows={3} value={design.body} maxLength={600} disabled={disabled} placeholder="Add your message…" onChange={event => onChange({ body: event.target.value })} /></div>
    <div className={styles.settings}>
      <div className={styles.field}><label htmlFor={`${id}-font`}>Font</label><select id={`${id}-font`} value={design.font} disabled={disabled} onChange={event => onChange({ font: event.target.value as SlideTextDesign["font"] })}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></div>
      <div className={styles.field}><label htmlFor={`${id}-size`}>Text size</label><select id={`${id}-size`} value={design.size} disabled={disabled} onChange={event => onChange({ size: Number(event.target.value) })}>{[28, 36, 48, 64, 80].map((size, index) => <option key={size} value={size}>{["Small", "Medium", "Large", "Extra large", "Display"][index]}</option>)}</select></div>
      <div className={styles.field}><label htmlFor={`${id}-alignment`}>Alignment</label><select id={`${id}-alignment`} value={design.align} disabled={disabled} onChange={event => onChange({ align: event.target.value as SlideTextDesign["align"] })}>{["left", "center", "right"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>
      <div className={styles.field}><label htmlFor={`${id}-position`}>Position</label><select id={`${id}-position`} value={design.position} disabled={disabled} onChange={event => onChange({ position: event.target.value as SlideTextDesign["position"] })}>{["top", "middle", "bottom"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>
      <div className={styles.field}><label htmlFor={`${id}-color`}>Text color</label><input id={`${id}-color`} type="color" value={design.color} disabled={disabled} onChange={event => onChange({ color: event.target.value })} /></div>
      <div className={styles.field}><label htmlFor={`${id}-background`}>Background shape</label><select id={`${id}-background`} value={design.background} disabled={disabled} onChange={event => onChange({ background: event.target.value as SlideTextDesign["background"] })}><option value="none">None</option><option value="solid">Rectangle</option><option value="rounded">Rounded box</option><option value="pill">Pill</option></select></div>
      {design.background !== "none" ? <><div className={styles.field}><label htmlFor={`${id}-background-color`}>Background color</label><input id={`${id}-background-color`} type="color" value={design.backgroundColor} disabled={disabled} onChange={event => onChange({ backgroundColor: event.target.value })} /></div><div className={styles.field}><label htmlFor={`${id}-opacity`}>Opacity · {Math.round(design.opacity * 100)}%</label><input id={`${id}-opacity`} type="range" min={0} max={100} value={Math.round(design.opacity * 100)} disabled={disabled} onChange={event => onChange({ opacity: Number(event.target.value) / 100 })} /></div></> : null}
    </div>
    <p className="text-xs leading-5 text-muted">Added text stays editable. Text already inside the image is part of its pixels.</p>
    <Button type="button" variant="ghost" size="sm" disabled={disabled || !design.heading.trim() && !design.body.trim()} onClick={() => onChange(EMPTY_SLIDE_TEXT)}>Clear added text</Button>
  </section>;
}
