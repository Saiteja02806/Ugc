"use client";

import Image from "next/image";
import { useState } from "react";

export function YouTubeLite({
  videoId,
  title,
  thumbnailUrl,
  width,
  height,
}: {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const portrait = height > width;

  return (
    <div className={portrait ? "mx-auto w-full max-w-[320px]" : "w-full"}>
      <div className="overflow-hidden rounded-[24px] border border-border bg-black shadow-card" style={{ aspectRatio: `${width} / ${height}` }}>
        {loaded ? (
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="relative flex h-full w-full items-center justify-center bg-black text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Image src={thumbnailUrl} alt="" fill className="object-cover" sizes="320px" />
            <span className="relative rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Play video</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function ExternalLiteEmbed({
  title,
  embedUrl,
  width,
  height,
}: {
  title: string;
  embedUrl: string;
  width: number;
  height: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-card" style={{ aspectRatio: `${width} / ${height}` }}>
        {loaded ? (
          <iframe title={title} src={embedUrl} className="h-full w-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-3 px-5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="text-sm font-semibold text-foreground-strong">{title}</span>
            <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Load embed</span>
          </button>
        )}
      </div>
    </div>
  );
}
