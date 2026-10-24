"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatTextLayout, formatTextLineRuns, formatInlineSymbolPaths, positionFormatText, type ExploreFormatText } from "@/worker/src/lib/explore-format-edit";
import { exploreEmojiUrl } from "@/worker/src/lib/explore-emoji";

import "./explore-text-fonts.css";

export function FormatVideoTextOverlay({ text, width, height, label, onChange, onMoveStart }: {
  text: ExploreFormatText; width: number; height: number; label: string;
  onChange?: (text: ExploreFormatText) => void; onMoveStart?: () => void;
}) {
  const layout = formatTextLayout(text, width, height), background = layout.background;
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number; width: number; height: number } | null>(null);
  function move(event: ReactPointerEvent<SVGRectElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !onChange) return;
    event.preventDefault();
    onChange(positionFormatText(text, start.x + (event.clientX - start.clientX) / start.width,
      start.y + (event.clientY - start.clientY) / start.height, width, height));
  }
  function stop(event: ReactPointerEvent<SVGRectElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const hitPadding = width * .025;
  return <svg aria-label={label} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full">
    {background ? <rect x={0} y={background.y} width={width} height={background.height} fill="#000000" fillOpacity={background.opacity} /> : null}
    <g fill={text.color} stroke={background ? undefined : "black"} strokeWidth={background ? undefined : layout.outlineWidth} paintOrder="stroke" fontFamily={layout.fontFamily} fontWeight={layout.fontWeight} fontSize={layout.fontSize} style={text.font ? { fontKerning: "none", fontVariantLigatures: "none" } : undefined} textAnchor="middle">
      {layout.lines.map((line, index) => {
        const y = layout.y + index * layout.lineHeight + layout.fontSize;
        const runs = formatTextLineRuns(line, text, layout);
        return runs.some(run => run.symbol || run.artwork) ? <g key={index}>{runs.map((run, i) => run.symbol
          ? <svg key={i} data-format-inline-symbol={run.symbol} x={run.x} y={y - layout.fontSize} width={layout.fontSize} height={layout.fontSize} viewBox="0 0 24 24" stroke="none">{formatInlineSymbolPaths(run.symbol).map((path, j) => <path key={j} {...path} />)}</svg>
          : run.artwork ? <image key={i} data-format-emoji={run.artwork} aria-label={run.value} href={exploreEmojiUrl(run.artwork)} x={run.x} y={y - layout.fontSize} width={layout.fontSize} height={layout.fontSize} />
          : <text key={i} x={run.x} y={y} textAnchor="start">{run.value}</text>)}</g>
          : <text key={index} x={layout.x} y={y}>{line}</text>;
      })}

    </g>
    {onChange && text.value.trim() ? <rect data-text-handle role="button" tabIndex={0} aria-label={`Move ${label}`} aria-roledescription="draggable text"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
      x={layout.x - layout.textWidth / 2 - hitPadding} y={height * text.y - hitPadding}
      width={layout.textWidth + hitPadding * 2} height={layout.lines.length * layout.lineHeight + (background ? width * .036 : 0) + hitPadding * 2}
      rx={width * .012} fill="transparent" strokeWidth={width / 360}
      className="pointer-events-auto cursor-grab stroke-transparent outline-none hover:stroke-white focus:stroke-white active:cursor-grabbing" style={{ touchAction: "none", userSelect: "none" }}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return;
        const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
        if (!bounds?.width || !bounds.height) return;
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
          x: layout.x / width, y: text.y, width: bounds.width, height: bounds.height };
        onMoveStart?.();
      }} onPointerMove={move} onPointerUp={event => { move(event); stop(event); }} onPointerCancel={stop}
      onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!direction) return;
        event.preventDefault(); event.stopPropagation(); onMoveStart?.();
        const step = event.shiftKey ? .05 : .005;
        onChange(positionFormatText(text, layout.x / width + direction[0] * step, text.y + direction[1] * step, width, height));
      }} /> : null}
  </svg>;
}
