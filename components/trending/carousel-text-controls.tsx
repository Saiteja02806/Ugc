"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { CAROUSEL_EDIT_FONTS, createCarouselManualLayout, defaultCarouselManualTextStyle, carouselManualTextMarkup, type CarouselManualTextStyle } from "@/lib/carousel/manual-text";
import type { TrendingCarouselEditSlide } from "@/lib/trending/creative-edit-contract";
import "@/components/explore/explore-text-fonts.css";

export function CarouselManualText({ slide }: { slide: TrendingCarouselEditSlide }) {
  const layout = createCarouselManualLayout(slide);
  return <svg aria-hidden="true" viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ display: "block", width: `${layout.width / 10.8}cqw`, height: `${layout.height / 10.8}cqw`, overflow: "visible" }}
    dangerouslySetInnerHTML={{ __html: carouselManualTextMarkup(layout) }} />;
}

export function CarouselTextControls({ slide, onChange }: { slide: TrendingCarouselEditSlide; onChange: (slide: TrendingCarouselEditSlide) => void }) {
  const id = useId(), style = slide.textStyle ?? defaultCarouselManualTextStyle();
  const hasHeading = slide.slideNumber === 1 || Boolean(slide.headline.trim() && slide.subtext.trim());
  const layout = slide.textStyle ? createCarouselManualLayout(slide) : null;
  const update = (patch: Partial<CarouselManualTextStyle>) => onChange({ ...slide, textStyle: { ...style, ...patch } });
  const inputClass = "min-h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm";
  return <section aria-label="Text appearance" className="mt-5 space-y-4 border-t border-border pt-4">
    <div><h4 className="text-sm font-semibold">Text appearance</h4><p className="mt-1 text-xs text-muted-foreground">Drag the text on the preview, or adjust its position below. Changes apply to this slide.</p></div>
    <div className="grid gap-2 text-xs font-medium"><label htmlFor={`${id}-font`}>Font</label>
      <select id={`${id}-font`} className={inputClass} value={style.font} onChange={event => update({ font: event.target.value as CarouselManualTextStyle["font"] })}>{CAROUSEL_EDIT_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {hasHeading ? <label className="grid gap-2 text-xs font-medium" htmlFor={`${id}-heading-size`}>{slide.slideNumber === 1 ? "Hook size" : "Heading size"}<input id={`${id}-heading-size`} type="number" min={24} max={120} step={1} className={inputClass} value={style.headingSize} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isInteger(value) && value >= 24 && value <= 120) update({ headingSize: value }); }} /></label> : null}
      {slide.slideNumber !== 1 ? <label className="grid gap-2 text-xs font-medium" htmlFor={`${id}-size`}>Text size<input id={`${id}-size`} type="number" min={24} max={120} step={1} className={inputClass} value={style.fontSize} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isInteger(value) && value >= 24 && value <= 120) update({ fontSize: value }); }} /></label> : null}
      {hasHeading ? <label className="grid gap-2 text-xs font-medium" htmlFor={`${id}-heading-color`}>{slide.slideNumber === 1 ? "Hook color" : "Heading color"}<input id={`${id}-heading-color`} type="color" className={inputClass} value={style.headingColor} onChange={event => update({ headingColor: event.target.value })} /></label> : null}
      {slide.slideNumber !== 1 ? <label className="grid gap-2 text-xs font-medium" htmlFor={`${id}-color`}>Text color<input id={`${id}-color`} type="color" className={inputClass} value={style.color} onChange={event => update({ color: event.target.value })} /></label> : null}
    </div>
    <div className="grid grid-cols-2 gap-3">{(["x", "y"] as const).map(axis => <label key={axis} htmlFor={`${id}-${axis}`} className="grid gap-2 text-xs font-medium">{axis === "x" ? "Horizontal position" : "Vertical position"}<input id={`${id}-${axis}`} type="range" min={0} max={100} step={1} value={Math.round((layout?.position ?? slide.textPosition)[axis] * 100)} onChange={event => onChange({ ...slide, textStyle: style, textPosition: { ...(layout?.position ?? slide.textPosition), [axis]: Number(event.target.value) / 100 } })} /></label>)}</div>
    {layout && !layout.fits ? <p role="alert" className="text-xs text-destructive">Text is too large for this slide. Reduce its size or shorten the copy before saving.</p> : null}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...slide, textStyle: null, textPosition: { x: .5, y: .5 } })}>Reset text layout</Button>
  </section>;
}
