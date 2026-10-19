"use client";

import { useId } from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAROUSEL_EDIT_FONTS, createCarouselManualLayout, resolveCarouselManualTextStyle, carouselManualTextMarkup, type CarouselManualTextStyle } from "@/lib/carousel/manual-text";
import type { TrendingCarouselEditSlide } from "@/lib/trending/creative-edit-contract";
import "@/components/explore/explore-text-fonts.css";
import styles from "./carousel-text-controls.module.css";

export function CarouselManualText({ slide }: { slide: TrendingCarouselEditSlide }) {
  const layout = createCarouselManualLayout(slide);
  return <svg aria-hidden="true" data-carousel-manual-text data-line-count={layout.rows.length} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ display: "block", width: `${layout.width / 10.8}cqw`, height: `${layout.height / 10.8}cqw`, overflow: "visible" }}
    dangerouslySetInnerHTML={{ __html: carouselManualTextMarkup(layout) }} />;
}

export function CarouselTextControls({ slide, onChange }: { slide: TrendingCarouselEditSlide; onChange: (slide: TrendingCarouselEditSlide) => void }) {
  const id = useId(), style = resolveCarouselManualTextStyle(slide);
  const hasHeading = slide.slideNumber === 1 || Boolean(slide.headline.trim() && slide.subtext.trim());
  const layout = slide.textStyle ? createCarouselManualLayout(slide) : null;
  const update = (patch: Partial<CarouselManualTextStyle>) => onChange({ ...slide, textStyle: { ...style, ...patch } });
  const backgroundVisible = style.headingBackground !== "none" || style.bodyBackground !== "none";
  const blocks = [...(hasHeading ? [{ name: slide.slideNumber === 1 ? "Hook" : "Heading", heading: true }] : []), ...(slide.slideNumber !== 1 ? [{ name: "Text", heading: false }] : [])];
  return <section aria-label="Text appearance" className={styles.panel}>
    <div><h4 className="text-sm font-semibold">Text appearance</h4><p className={styles.hint}>Drag text in the preview. Use Enter in the copy above for a new line.</p></div>
    <div className={styles.toolbar}>
      <div className={styles.field}><label htmlFor={`${id}-font`}>Font</label>
        <select id={`${id}-font`} className={styles.font} value={style.font} onChange={event => update({ font: event.target.value as CarouselManualTextStyle["font"] })}>{CAROUSEL_EDIT_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select>
      </div>
      <div className={styles.field}><span id={`${id}-alignment`}>Alignment</span><div className={styles.segment} role="group" aria-labelledby={`${id}-alignment`}>
        {([{ value: "left", Icon: AlignLeft }, { value: "center", Icon: AlignCenter }, { value: "right", Icon: AlignRight }] as const).map(({ value, Icon }) => <button key={value} type="button" aria-label={`Align text ${value}`} aria-pressed={style.align === value} onClick={() => update({ align: value })}><Icon size={16} /></button>)}
      </div></div>
      <label className={styles.check}><input type="checkbox" checked={style.outline} onChange={event => update({ outline: event.target.checked })} />Text outline</label>
    </div>
    {blocks.map(({ name, heading }) => <div key={name} className={styles.toolbar}>
      <div className={styles.field}><label htmlFor={`${id}-${name}-size`}>{name} size</label><input id={`${id}-${name}-size`} className={styles.number} type="number" min={24} max={120} step={1} value={heading ? style.headingSize : style.fontSize} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isInteger(value) && value >= 24 && value <= 120) update(heading ? { headingSize: value } : { fontSize: value }); }} /></div>
      <div className={styles.field}><label htmlFor={`${id}-${name}-color`}>{name} color</label><input id={`${id}-${name}-color`} className={styles.swatch} type="color" value={heading ? style.headingColor : style.color} onChange={event => update(heading ? { headingColor: event.target.value } : { color: event.target.value })} /></div>
      <div className={styles.field}><label htmlFor={`${id}-${name}-weight`}>{name} weight</label><select id={`${id}-${name}-weight`} value={heading ? style.headingWeight : style.fontWeight} onChange={event => update(heading ? { headingWeight: Number(event.target.value) as 400 | 500 | 700 } : { fontWeight: Number(event.target.value) as 400 | 500 | 700 })}><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option></select></div>
      <div className={styles.field}><label htmlFor={`${id}-${name}-bg`}>{name} background</label><select id={`${id}-${name}-bg`} value={heading ? style.headingBackground : style.bodyBackground} onChange={event => update(heading ? { headingBackground: event.target.value as CarouselManualTextStyle["headingBackground"] } : { bodyBackground: event.target.value as CarouselManualTextStyle["bodyBackground"] })}><option value="none">None</option><option value="line">Per line</option><option value="box">Text box</option></select></div>
    </div>)}
    <div className={styles.toolbar}>
      <div className={styles.field}><label htmlFor={`${id}-width`}>Text width · {Math.round(style.textWidth! / 10.8)}%</label><input id={`${id}-width`} className={styles.width} type="range" min={160} max={840} step={1} value={style.textWidth} onChange={event => update({ textWidth: Number(event.target.value) })} /></div>
      <div className={styles.field}><label htmlFor={`${id}-spacing`}>Line spacing</label><input id={`${id}-spacing`} className={styles.number} type="number" min={.95} max={2} step={.01} value={style.lineHeight} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= .95 && value <= 2) update({ lineHeight: value }); }} /></div>
      {backgroundVisible ? <><div className={styles.field}><label htmlFor={`${id}-bg-color`}>Background color</label><input id={`${id}-bg-color`} className={styles.swatch} type="color" value={style.backgroundColor} onChange={event => update({ backgroundColor: event.target.value })} /></div><div className={styles.field}><label htmlFor={`${id}-opacity`}>Opacity · {Math.round(style.backgroundOpacity! * 100)}%</label><input id={`${id}-opacity`} className={styles.width} type="range" min={0} max={1} step={.05} value={style.backgroundOpacity} onChange={event => update({ backgroundOpacity: Number(event.target.value) })} /></div></> : null}
    </div>
    <details className={styles.position}><summary>Position</summary><div className={styles.toolbar}>{(["x", "y"] as const).map(axis => <div className={styles.field} key={axis}><label htmlFor={`${id}-${axis}`}>{axis === "x" ? "Horizontal position" : "Vertical position"} · {Math.round((layout?.position ?? slide.textPosition)[axis] * 100)}%</label><input id={`${id}-${axis}`} className={styles.width} type="range" min={0} max={100} step={1} value={Math.round((layout?.position ?? slide.textPosition)[axis] * 100)} onChange={event => onChange({ ...slide, textStyle: style, textPosition: { ...(layout?.position ?? slide.textPosition), [axis]: Number(event.target.value) / 100 } })} /></div>)}</div></details>
    {layout && !layout.fits ? <p role="alert" className="text-xs text-destructive">Text exceeds the slide. Reduce its size or spacing, increase its width, or shorten the copy before saving.</p> : null}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...slide, textStyle: null, textPosition: { x: .5, y: .5 } })}>Reset text layout</Button>
  </section>;
}
