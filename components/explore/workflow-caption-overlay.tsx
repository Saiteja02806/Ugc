"use client";

import { useEffect, useMemo, useState } from "react";
import { getSubtitleLayout, groupSubtitleWords } from "@/worker/src/subtitles/captions";
import { groupNaturalSubtitleWords } from "@/worker/src/subtitles/phrases";
import { subtitlePlacementGeometry, type SubtitleCue, type SubtitlePlacement, type SubtitleStyle, type SubtitleTranscript } from "@/worker/src/subtitles/contracts";
import { correctSubtitleTranscript, type SubtitleCorrection } from "@/worker/src/subtitles/corrections";
import { isDynamicSubtitleStyle } from "@/worker/src/subtitles/styles";

export type SequenceCaptions = { transcript: SubtitleTranscript; style: SubtitleStyle; placement: SubtitlePlacement; corrections?: SubtitleCorrection[] };

/** Uses the combined sequence clock, including seek/pause and the demo cut.
 * Browser font metrics can differ from the saved ASS render. */
export function WorkflowCaptionOverlay({ captions, timeMs, width, height }: { captions: SequenceCaptions; timeMs: number; width: number; height: number }) {
  const key = useMemo(() => JSON.stringify([captions, width, height]), [captions, width, height]);
  const [grouped, setGrouped] = useState<{ key: string; cues: SubtitleCue[]; error?: string } | null>(null);
  const layout = getSubtitleLayout(width, height, captions.style);
  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (!context) return;
    const font = captions.style === "serif-box" ? "Georgia" : "Arial";
    context.font = `${layout.bold ? "bold " : ""}${layout.fontSize}px ${font}`;
    const measure = async (text: string) => context.measureText(text).width;
    void Promise.resolve().then(() => {
      const transcript = correctSubtitleTranscript(captions.transcript, captions.corrections);
      return (isDynamicSubtitleStyle(captions.style) ? groupSubtitleWords : groupNaturalSubtitleWords)(transcript.words, layout, measure);
    })
      .then(cues => { if (!cancelled) setGrouped({ key, cues }); })
      .catch(() => { if (!cancelled) setGrouped({ key, cues: [], error: "These caption words cannot fit the preview. Review your corrections or reset them." }); });
    return () => { cancelled = true; };
    // Primitive key includes every timing/text/style/size dependency. It stays
    // stable while the playback clock advances, so layout isn't recalculated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (grouped?.key === key && grouped.error) return <p role="alert" className="absolute inset-x-3 top-3 rounded-md bg-black/80 p-3 text-xs text-white">{grouped.error}</p>;
  const cue = grouped?.key === key ? grouped.cues.find(entry => timeMs >= entry.startMs && timeMs < entry.endMs) : null;
  if (!cue) return null;
  const pop = captions.style === "word-pop", box = captions.style === "bold-box" || captions.style === "serif-box";
  const active = cue.words.findIndex(word => timeMs >= word.startMs && timeMs < word.endMs);
  const lines = pop ? active >= 0 ? [[active]] : [] : cue.lines;
  const y = height * subtitlePlacementGeometry(captions.placement).anchor - (lines.length - 1) * layout.fontSize * .55;
  return <svg aria-label="Auto caption preview" data-caption-preview data-style={captions.style} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full" role="img">
    {lines.map((line, row) => {
      const baseline = y + row * layout.fontSize * 1.1;
      return <g key={row}>
        {box ? <rect x={width * .08} y={baseline - layout.fontSize} width={width * .84} height={layout.fontSize * 1.3} fill="#111" rx={8} /> : null}
        <text x={width / 2} y={baseline} textAnchor="middle" fontFamily={captions.style === "serif-box" ? "Georgia, serif" : "Arial, sans-serif"}
          fontSize={pop ? layout.fontSize * 1.35 : layout.fontSize} fontWeight={layout.bold ? 700 : 400} fill="white"
          stroke={box ? "none" : "black"} strokeWidth={2} paintOrder="stroke">
          {line.map((index, part) => {
            const word = cue.words[index];
            const highlighted = captions.style === "karaoke" ? timeMs >= word.startMs : index === active;
            const color = captions.style === "serif-box" ? timeMs >= word.startMs ? "white" : "#aaa" :
              ["active-word", "karaoke", "marker-highlight"].includes(captions.style) && highlighted ? "#ffe14f" : "white";
            return <tspan key={index} fill={color}>{part ? " " : ""}{word.text}</tspan>;
          })}
        </text>
      </g>;
    })}
  </svg>;
}
