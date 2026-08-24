"use client";

import { Download, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export function AiStudioResultActions({
  className,
  kind,
  title,
  url,
}: {
  className?: string;
  kind: "image" | "video";
  title: string;
  url: string;
}) {
  const mediaLabel = kind === "image" ? "image" : "video";
  const fileName = getDownloadFileName({ kind, title, url });
  const actionClassName =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-subtle transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none";

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      <a
        href={url}
        download={fileName}
        target="_blank"
        rel="noreferrer"
        aria-label={`Download ${title}`}
        title={`Download ${mediaLabel}`}
        className={actionClassName}
      >
        <Download className="size-3.5" aria-hidden="true" />
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${title} in a new tab`}
        title={`Open ${mediaLabel} in a new tab`}
        className={actionClassName}
      >
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}

function getDownloadFileName({
  kind,
  title,
  url,
}: {
  kind: "image" | "video";
  title: string;
  url: string;
}) {
  const fallbackExtension = kind === "image" ? "png" : "mp4";
  const supportedExtensions =
    kind === "image" ? new Set(["jpeg", "jpg", "png", "webp"]) : new Set(["mov", "mp4", "webm"]);
  let extension = fallbackExtension;

  try {
    const candidate = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

    if (candidate && supportedExtensions.has(candidate)) {
      extension = candidate;
    }
  } catch {
    // The fallback extension remains usable for relative or malformed URLs.
  }

  const baseName = title
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();

  return `${baseName || `generated-${mediaLabel(kind)}`}.${extension}`;
}

function mediaLabel(kind: "image" | "video") {
  return kind;
}
