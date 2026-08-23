"use client";

import { VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

// Meta places 9:16 Reel media inside a wider 4:5 embed. These measured stage
// bounds expose only the centered video while retaining the official player.
const EMBED_STAGE_WIDTH = 540;
const EMBED_STAGE_HEIGHT = 864;
const VIDEO_VIEWPORT_WIDTH = 369;
const VIDEO_OVERSCAN = 1.065;
const VIDEO_HORIZONTAL_CROP =
  (EMBED_STAGE_WIDTH - VIDEO_VIEWPORT_WIDTH / VIDEO_OVERSCAN) / 2;
const VIDEO_TOP_CROP = 54;
const EMBED_LOAD_TIMEOUT_MS = 15_000;

export type InstagramEmbedSdkState = "error" | "loading" | "ready";

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

export function InstagramEmbed({
  embedHtml,
  sdkRevision,
  sdkState,
}: {
  embedHtml: string;
  sdkRevision: number;
  sdkState: InstagramEmbedSdkState;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isEmbedReady, setIsEmbedReady] = useState(false);
  const [hasEmbedTimedOut, setHasEmbedTimedOut] = useState(false);
  const [playerScale, setPlayerScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isNearViewport) return;

    if (!Reflect.has(window, "IntersectionObserver")) {
      const frame = window.requestAnimationFrame(() => {
        setIsNearViewport(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isNearViewport]);

  useEffect(() => {
    if (!isNearViewport || sdkState === "error") return;

    const frame = window.requestAnimationFrame(() => {
      window.instgrm?.Embeds?.process();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [embedHtml, isNearViewport, sdkRevision, sdkState]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const nextScale =
        (viewport.clientWidth / VIDEO_VIEWPORT_WIDTH) * VIDEO_OVERSCAN;
      setPlayerScale((currentScale) =>
        Math.abs(currentScale - nextScale) > 0.001
          ? nextScale
          : currentScale,
      );
    };

    updateScale();

    if (!Reflect.has(window, "ResizeObserver")) {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport) return;

    const stage = stageRef.current;
    if (!stage) return;

    const updateReadyState = () => {
      const isReady = Boolean(stage.querySelector("iframe"));
      setIsEmbedReady(isReady);
      if (isReady) setHasEmbedTimedOut(false);
    };

    updateReadyState();
    const observer = new MutationObserver(updateReadyState);
    observer.observe(stage, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [embedHtml, isNearViewport, sdkRevision]);

  useEffect(() => {
    if (
      !isNearViewport ||
      isEmbedReady ||
      sdkState === "error"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHasEmbedTimedOut(true);
    }, EMBED_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [embedHtml, isEmbedReady, isNearViewport, sdkRevision, sdkState]);

  const showEmbedError =
    !isEmbedReady && (sdkState === "error" || hasEmbedTimedOut);
  const isEmbedLoading = !isEmbedReady && !showEmbedError;

  return (
    <div ref={containerRef} className="w-full">
      <div
        ref={viewportRef}
        className="relative aspect-[9/16] w-full overflow-hidden bg-muted"
        aria-busy={isEmbedLoading}
        aria-label="Hook video preview"
      >
        {isEmbedLoading ? (
          <Skeleton className="absolute inset-0 size-full rounded-none" />
        ) : null}

        {showEmbedError ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card-muted px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted shadow-sm">
              <VideoOff className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-foreground-strong">
              Video preview did not load
            </p>
            <p className="max-w-52 text-xs leading-5 text-muted">
              Refresh Explore to try loading this video again.
            </p>
          </div>
        ) : null}

        {isNearViewport ? (
          <div
            ref={stageRef}
            className={`absolute left-0 top-0 origin-top-left transition-opacity duration-200 motion-reduce:transition-none [&_.instagram-media]:!m-0 [&_.instagram-media]:!h-[864px] [&_.instagram-media]:!min-w-[540px] [&_.instagram-media]:!w-[540px] [&_iframe]:!m-0 [&_iframe]:!h-[864px] [&_iframe]:!min-w-[540px] [&_iframe]:!w-[540px] ${
              isEmbedReady && !showEmbedError ? "opacity-100" : "opacity-0"
            }`}
            style={{
              height: EMBED_STAGE_HEIGHT,
              transform: `scale(${playerScale}) translate(-${VIDEO_HORIZONTAL_CROP}px, -${VIDEO_TOP_CROP}px)`,
              width: EMBED_STAGE_WIDTH,
            }}
            dangerouslySetInnerHTML={{ __html: embedHtml }}
          />
        ) : (
          <span className="sr-only">Video loads near the viewport.</span>
        )}
      </div>
    </div>
  );
}
