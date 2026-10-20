"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { buildCaptionPreviewLayout, type CaptionPreviewLayout } from "@/lib/explore/subtitle-preview-layout";
import type { SubtitlePlacement, SubtitleStyle, SubtitleTranscript } from "@/worker/src/subtitles/contracts";
import type { SubtitleCorrection } from "@/worker/src/subtitles/corrections";

export type SequenceCaptions = { transcript: SubtitleTranscript; style: SubtitleStyle; placement: SubtitlePlacement; corrections?: SubtitleCorrection[] };
const progress = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start)));

/** Matches style behavior with the export's grouping and typography policies.
 * Browser shaping/antialiasing can still differ from the saved libass render. */
export function WorkflowCaptionOverlay({ captions, timeMs, width, height }: { captions: SequenceCaptions; timeMs: number; width: number; height: number }) {
  const clipId = useId().replaceAll(":", "");
  const key = useMemo(() => JSON.stringify([captions, width, height]), [captions, width, height]);
  const [grouped, setGrouped] = useState<{ key: string; layout?: CaptionPreviewLayout; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void buildCaptionPreviewLayout(captions, width, height)
      .then(layout => { if (!cancelled) setGrouped({ key, layout }); })
      .catch(() => { if (!cancelled) setGrouped({ key, error: "These caption words or their font could not load in the preview. Review your corrections or reopen caption review." }); });
    return () => { cancelled = true; };
    // The key includes every text/style/size dependency, excluding playback time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (grouped?.key === key && grouped.error) return <p role="alert" className="absolute inset-x-3 top-3 rounded-md bg-black/80 p-3 text-xs text-white">{grouped.error}</p>;
  const layout = grouped?.key === key ? grouped.layout : null;
  const page = layout?.pages.find(entry => timeMs >= entry.cue.startMs && timeMs < entry.cue.endMs);
  if (!page || !layout) return null;
  const { cue, size } = page;
  const serif = captions.style === "serif-box", pop = captions.style === "word-pop", karaoke = captions.style === "karaoke";
  const active = cue.words.findIndex((word, index) => timeMs >= word.startMs && timeMs < Math.min(word.endMs, cue.words[index + 1]?.startMs ?? cue.endMs));
  return <svg aria-label="Auto caption preview" data-caption-preview data-style={captions.style} data-lines={cue.lines.length} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full" role="img">
    {page.editorial ? page.editorial.map((block, row) => {
      const hero = cue.words[block.indices[0]], heroScale = block.font === "hero" ? .94 + .06 * progress(timeMs, hero.startMs, hero.startMs + Math.min(100, hero.endMs - hero.startMs)) : 1;
      return <text key={row} x={block.x} y={block.y} dominantBaseline="text-before-edge" fontFamily={layout.font} fontSize={block.size} fontWeight={block.font === "hero" ? 900 : 500} fontStyle={block.font === "support" ? "normal" : "italic"}
        transform={`translate(${block.x} ${block.y}) scale(${heroScale}) translate(${-block.x} ${-block.y})`} stroke="#171d25" strokeWidth={.6} paintOrder="stroke">
        {block.indices.map((index, part) => <tspan key={index} fill={index === active ? "#85d0e8" : "#fcf8f4"}>{part ? " " : ""}{cue.words[index].text}</tspan>)}
      </text>;
    }) : <>
      {serif || captions.style === "bold-box" ? page.boxes.map((box, row) => <rect key={row} {...box} fill={serif ? "#000" : "#0008"} rx={serif ? Math.max(2, Math.round(size * .18)) : 0} />) : null}
      {captions.style === "marker-highlight" ? page.words.filter(word => word.index === active).map(word => <rect key={word.index} data-caption-marker x={word.x - size * .18} y={word.y - size * .6} width={word.width + size * .36} height={size * 1.2} fill="#6a48a3" />) : null}
      {page.words.map(position => {
        const word = cue.words[position.index], isActive = position.index === active;
        const fade = progress(timeMs, word.startMs, Math.min(word.endMs, word.startMs + 240, cue.endMs)) ** 2;
        const grey = Math.round(85 + 170 * fade);
        const fill = serif ? `rgb(${grey},${grey},${grey})` : karaoke ? "#c6c6c6" : captions.style === "active-word" && isActive ? "#ffdd59" : "white";
        const scale = pop ? .94 + .06 * progress(timeMs, word.startMs, word.startMs + Math.min(100, word.endMs - word.startMs)) : 1;
        const attributes = { x: position.x, y: position.y, dominantBaseline: "central" as const, fontFamily: layout.font, fontSize: size, fontWeight: layout.bold ? 700 : 400,
          transform: pop ? `translate(${width / 2} ${position.y}) scale(${scale}) translate(${-width / 2} ${-position.y})` : undefined };
        const outline = serif ? size * .3 / 61 : captions.style === "bold-box" ? 0 : Math.max(1, Math.round(layout.size * .065));
        const id = `${clipId}-${position.index}`, fraction = progress(timeMs, word.startMs, Math.min(word.endMs, cue.words[position.index + 1]?.startMs ?? cue.endMs, cue.endMs));
        return <g key={position.index}>
          <text {...attributes} fill={fill} stroke={serif ? fill : "black"} strokeWidth={outline} paintOrder="stroke"><tspan>{word.text}</tspan></text>
          {karaoke ? <><defs><clipPath id={id}><rect x={position.x} y={position.y - size} width={position.width * fraction} height={size * 2} /></clipPath></defs><text {...attributes} data-caption-fill clipPath={`url(#${id})`} fill="#ffdd59"><tspan>{word.text}</tspan></text></> : null}
        </g>;
      })}
    </>}
  </svg>;
}
