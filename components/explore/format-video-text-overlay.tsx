import { formatTextLayout, type ExploreFormatText } from "@/worker/src/lib/explore-format-edit";
import "./explore-text-fonts.css";

export function FormatVideoTextOverlay({ text, width, height, label }: { text: ExploreFormatText; width: number; height: number; label: string }) {
  const layout = formatTextLayout(text, width, height), background = layout.background;
  return <svg aria-label={label} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full">
    {background ? <rect x={0} y={background.y} width={width} height={background.height} fill="#000000" fillOpacity={background.opacity} /> : null}
    <g fill={text.color} stroke={background ? undefined : "black"} strokeWidth={background ? undefined : width / 540} paintOrder="stroke" fontFamily={layout.fontFamily} fontWeight={layout.fontWeight} fontSize={layout.fontSize} style={text.font ? { fontKerning: "none", fontVariantLigatures: "none" } : undefined} textAnchor="middle">
      {layout.lines.map((line, index) => <text key={index} x={width / 2} y={layout.y + index * layout.lineHeight + layout.fontSize}>{line}</text>)}
    </g>
  </svg>;
}
