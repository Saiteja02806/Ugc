"use client";

import { layoutPublishDatePoints } from "@/lib/analytics/publish-date-chart";

type Point<T> = { date: string; value: number | null; items: T[] };

export function PublishDateLineChart<T>({ points, onSelect, getLabel, getThumbnail, platform }: {
  points: Point<T>[];
  onSelect: (point: Point<T>) => void;
  getLabel: (point: Point<T>) => string;
  getThumbnail: (item: T) => string | null;
  platform: string;
}) {
  const layout = layoutPublishDatePoints(points);
  const path = layout.points.map((point, index) => {
    if (point.y === null) return "";
    return `${index > 0 && layout.points[index - 1].y !== null ? "L" : "M"} ${point.x} ${point.y}`;
  }).join(" ");
  const unavailable = points.filter((point) => point.value === null);
  const marker = (point: Point<T>) => (
    <>
      <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-card text-[10px] font-bold shadow-card ring-4 ring-primary/10 transition-transform group-hover:scale-110 group-focus-visible:scale-110">
        {platform === "YouTube" ? "YT" : "TT"}
        {getThumbnail(point.items[0]) ? (
          // Provider-owned thumbnails can expire; keep the platform fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getThumbnail(point.items[0])!} alt="" loading="lazy" width={44} height={44}
            className="absolute inset-0 size-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />
        ) : null}
      </span>
      <span className="absolute -bottom-1 -right-1 rounded-full border border-border-strong bg-card px-1.5 font-mono text-[10px] leading-5 text-foreground-strong">{point.items.length}</span>
    </>
  );
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-card-muted/25 p-3 sm:p-4">
      <div className="relative h-72" role="group" aria-label={`${platform} content by publish date`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-primary" aria-hidden="true">
          {[16, 38, 60, 82].map((y) => <line key={y} x1="6" x2="94" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />)}
          <path d={path} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <span className="absolute right-0 top-0 font-mono text-[10px] text-muted">{layout.maximum.toLocaleString()}</span>
        <span className="absolute bottom-[15%] right-0 font-mono text-[10px] text-muted">0</span>
        {layout.points.filter((point) => point.y !== null).map((point) => (
          <button key={point.date} type="button" aria-haspopup="dialog" aria-label={getLabel(point)} title={getLabel(point)}
            onClick={() => onSelect(point)} style={{ left: `${point.x}%`, top: `${point.y}%` }}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none hover:z-20 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
            {marker(point)}
          </button>
        ))}
        {layout.points.every((point) => point.y === null) ? <p className="absolute inset-x-6 top-1/3 text-center text-sm text-muted">Content is available below; this metric has not been returned.</p> : null}
      </div>
      {unavailable.length ? <div className="border-t border-border pt-3">
        <p className="mb-3 text-xs text-muted">Metrics unavailable — open a day to review its content.</p>
        <div className="flex flex-wrap gap-5">{unavailable.map((point) => (
          <button key={point.date} type="button" aria-haspopup="dialog" aria-label={getLabel(point)} onClick={() => onSelect(point)}
            className="group flex flex-col items-center gap-2 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="relative">{marker(point)}</span>
            <span className="text-xs text-muted">{point.date}</span>
          </button>
        ))}</div>
      </div> : null}
      <p className="mt-2 text-xs text-muted">Select a thumbnail to explore that day’s content. Points show current totals by publish date, not views earned on that day.</p>
    </div>
  );
}
