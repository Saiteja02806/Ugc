"use client";

import {
  Check,
  ChevronDown,
  Clapperboard,
  Film,
  GripVertical,
  PencilLine,
  Plus,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CreativeDecisionActions } from "@/components/trending/creative-card-actions";
import { HookTextOverlay } from "@/components/trending/hook-text-overlay";
import { WallTextOverlay } from "@/components/trending/wall-text-overlay";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  getCreateContentVideos,
} from "@/lib/create-content/video-assets";
import {
  clampCreateContentTextPosition,
  createCenteredTextPosition,
  normalizeCreateContentText,
  type CreateContentCard,
  type CreateContentTextPosition,
} from "@/lib/create-content/card-contract";
import {
  createCreateContentWallTextContent,
  createCreateContentWallTextLayout,
} from "@/lib/create-content/render-contract";
import { normalizeAndValidateGeneratedCreateContentText } from "@/lib/create-content/text-input-validation";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";

type MediaResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };
type CardListResponse =
  | { cards: CreateContentCard[]; ok: true }
  | { error?: string; ok?: false };
type CardSaveResponse =
  | { card: CreateContentCard; ok: true }
  | { error?: string; ok?: false };
type CopyGenerationResponse =
  | {
      ok: true;
      options: CreateContentGeneratedOption[];
    }
  | { error?: string; ok?: false };
type CreateContentRender = {
  cardRevision: number;
  errorMessage: string | null;
  id: string;
  jobId: string | null;
  mediaAssetId: string | null;
  sourceMediaAssetId: string;
  status: "queued" | "rendering" | "ready" | "failed";
  updatedAt: string;
};
type CreateContentRenderResponse =
  | { ok: true; render: CreateContentRender | null }
  | { error?: string; ok?: false };
type CreateContentGeneratedOption = {
  format: "wall_text" | "hook_text";
  formatId?: string;
  text: string;
};

// Match the familiar Trending gesture distance while keeping browsing local to
// Create Content. A swipe never changes a Trending decision.
const SWIPE_THRESHOLD_PX = 90;
const VERTICAL_VIDEO_CARD_FRAME_CLASS =
  "w-[min(76vw,230px,calc((100dvh-348px)*0.5625))] min-[1024px]:w-[min(76vw,clamp(260px,calc(440.5px-11.75vw),280px),calc((100dvh-252px)*0.5625))] aspect-[9/16]";

export function CreateContentWorkspace({
  previewAssets,
  previewCards,
}: {
  /** Used only by the development-only visual verification route. */
  previewAssets?: MediaAsset[];
  /** Used only by the development-only visual verification route. */
  previewCards?: CreateContentCard[];
} = {}) {
  const isPreview = previewAssets !== undefined;
  const [assets, setAssets] = useState<MediaAsset[]>(() => previewAssets ?? []);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(
    () => previewAssets?.[0]?.id ?? null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    () => (isPreview ? "ready" : "loading"),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cardsByAssetId, setCardsByAssetId] = useState(
    () => new Map((previewCards ?? []).map((card) => [card.sourceMediaAssetId, card])),
  );
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingOriginalCard, setEditingOriginalCard] =
    useState<CreateContentCard | null>(null);
  const [editorErrorMessage, setEditorErrorMessage] = useState<string | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [chatAddErrorMessage, setChatAddErrorMessage] = useState<string | null>(null);
  const [isAddingGeneratedCopy, setIsAddingGeneratedCopy] = useState(false);
  const [activeRender, setActiveRender] = useState<CreateContentRender | null>(
    null,
  );
  const [isPreparingForSchedule, setIsPreparingForSchedule] = useState(false);
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState<string | null>(
    null,
  );
  const [shouldOpenSchedulingAfterRender, setShouldOpenSchedulingAfterRender] =
    useState(false);
  const pointerStartX = useRef<number | null>(null);
  const aiComposerRef = useRef<HTMLTextAreaElement>(null);

  const loadAssets = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before opening Create Content.");
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [mediaResponse, cardsResponse] = await Promise.all([
        fetch("/api/media", { cache: "no-store", headers }),
        fetch("/api/create-content/cards", { cache: "no-store", headers }),
      ]);
      const [mediaData, cardsData] = await Promise.all([
        mediaResponse.json().catch(() => null) as Promise<MediaResponse | null>,
        cardsResponse.json().catch(() => null) as Promise<CardListResponse | null>,
      ]);

      if (!mediaResponse.ok || mediaData?.ok !== true) {
        throw new Error(getApiError(mediaData, "Could not load your videos."));
      }

      if (!cardsResponse.ok || cardsData?.ok !== true) {
        throw new Error(
          getApiError(cardsData, "Could not load your saved video text."),
        );
      }

      const videos = getCreateContentVideos(mediaData.assets);
      setAssets(videos);
      setCardsByAssetId(
        new Map(
          cardsData.cards
            .filter((card) => videos.some((asset) => asset.id === card.sourceMediaAssetId))
            .map((card) => [card.sourceMediaAssetId, card]),
        ),
      );
      setActiveAssetId((current) =>
        current && videos.some((asset) => asset.id === current)
          ? current
          : (videos[0]?.id ?? null),
      );
      setStatus("ready");
    } catch (error) {
      setAssets([]);
      setActiveAssetId(null);
      setErrorMessage(getErrorMessage(error, "Could not load your videos."));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (isPreview) {
      return;
    }

    const timer = window.setTimeout(() => void loadAssets(), 0);

    return () => window.clearTimeout(timer);
  }, [isPreview, loadAssets]);

  const loadActiveRender = useCallback(async () => {
    if (isPreview || !activeAssetId || !cardsByAssetId.has(activeAssetId)) {
      setActiveRender(null);
      return null;
    }

    const token = await getCurrentUserIdToken();
    if (!token) return null;
    const response = await fetch(
      `/api/create-content/renders?assetId=${encodeURIComponent(activeAssetId)}`,
      { cache: "no-store", headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await response.json().catch(() => null)) as
      | CreateContentRenderResponse
      | null;

    if (response.ok && data?.ok === true) {
      setActiveRender(data.render);
      return data.render;
    }

    setActiveRender(null);
    return null;
  }, [activeAssetId, cardsByAssetId, isPreview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActiveRender().catch(() => setActiveRender(null));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadActiveRender]);

  useEffect(() => {
    if (
      !activeRender ||
      (activeRender.status !== "queued" && activeRender.status !== "rendering")
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadActiveRender().catch(() => undefined);
    }, 4_000);

    return () => window.clearInterval(timer);
  }, [activeRender, loadActiveRender]);

  const activeIndex = useMemo(
    () => assets.findIndex((asset) => asset.id === activeAssetId),
    [activeAssetId, assets],
  );
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeAsset = assets[resolvedActiveIndex] ?? null;
  const activeCard = activeAsset
    ? (cardsByAssetId.get(activeAsset.id) ?? null)
    : null;
  const nextAsset = assets[resolvedActiveIndex + 1] ?? null;

  function skipActiveVideo() {
    const nextVideo =
      assets[resolvedActiveIndex + 1] ?? assets[resolvedActiveIndex - 1];

    if (nextVideo) {
      cancelTextEditing();
      setScheduleErrorMessage(null);
      setShouldOpenSchedulingAfterRender(false);
      setActiveAssetId(nextVideo.id);
      return;
    }

    setScheduleErrorMessage(
      "There is no other ready video to skip to. Choose a video from Videos.",
    );
  }

  function selectActiveVideo(assetId: string) {
    cancelTextEditing();
    setScheduleErrorMessage(null);
    setShouldOpenSchedulingAfterRender(false);
    setActiveAssetId(assetId);
  }

  function updateLocalCard(card: CreateContentCard) {
    setCardsByAssetId((current) => {
      const next = new Map(current);
      next.set(card.sourceMediaAssetId, card);
      return next;
    });
  }

  function openTextEditor(card: CreateContentCard) {
    setEditingOriginalCard(card);
    setEditorErrorMessage(null);
    setEditingAssetId(card.sourceMediaAssetId);
  }

  function cancelTextEditing() {
    if (editingOriginalCard) {
      updateLocalCard(editingOriginalCard);
    }
    setEditorErrorMessage(null);
    setEditingOriginalCard(null);
    setEditingAssetId(null);
  }

  function focusAiComposer() {
    setChatAddErrorMessage(null);
    window.requestAnimationFrame(() => {
      aiComposerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      aiComposerRef.current?.focus({ preventScroll: true });
    });
  }

  async function persistCard(card: CreateContentCard) {
    if (isPreview) {
      return {
        ...card,
        revision: card.revision + 1,
        updatedAt: new Date().toISOString(),
      } satisfies CreateContentCard;
    }

    const token = await getCurrentUserIdToken();
    if (!token) {
      throw new Error("Sign in before saving video text.");
    }

    const response = await fetch(
      `/api/create-content/cards/${encodeURIComponent(card.sourceMediaAssetId)}`,
      {
        body: JSON.stringify({
          expectedRevision: card.revision,
          format: card.overlay.format,
          position: card.overlay.position,
          text: card.overlay.text,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );
    const data = (await response.json().catch(() => null)) as
      | CardSaveResponse
      | null;

    if (!response.ok || data?.ok !== true) {
      throw new Error(getApiError(data, "Could not save this video text."));
    }

    return data.card;
  }

  async function saveCard(card: CreateContentCard) {
    setEditorErrorMessage(null);
    setIsSavingCard(true);

    try {
      updateLocalCard(await persistCard(card));
      setActiveRender(null);
      setEditingOriginalCard(null);
      setEditingAssetId(null);
    } catch (error) {
      setEditorErrorMessage(getErrorMessage(error, "Could not save this video text."));
    } finally {
      setIsSavingCard(false);
    }
  }

  async function addCopyToActiveVideo(params: {
    format: "wall_text" | "hook_text";
    text: string;
  }) {
    if (!activeAsset) return false;

    setChatAddErrorMessage(null);
    setIsAddingGeneratedCopy(true);

    try {
      const saved = await persistCard({
        overlay: {
          format: params.format,
          position: createCenteredTextPosition(),
          text: normalizeAndValidateGeneratedCreateContentText(params),
        },
        revision: activeCard?.revision ?? 0,
        sourceMediaAssetId: activeAsset.id,
        updatedAt: activeCard?.updatedAt ?? null,
        version: "create-content-card-v1",
      });
      updateLocalCard(saved);
      setActiveRender(null);
      return true;
    } catch (error) {
      setChatAddErrorMessage(
        getErrorMessage(error, "Could not add this copy to the video."),
      );
      return false;
    } finally {
      setIsAddingGeneratedCopy(false);
    }
  }

  async function prepareForScheduling(): Promise<CreateContentRender | null> {
    if (!activeAsset || !activeCard || isPreparingForSchedule) return null;

    setScheduleErrorMessage(null);
    setIsPreparingForSchedule(true);

    try {
      if (isPreview) {
        const previewRender = {
          cardRevision: activeCard.revision,
          errorMessage: null,
          id: "preview-render",
          jobId: null,
          mediaAssetId: "preview-rendered-video",
          sourceMediaAssetId: activeAsset.id,
          status: "ready",
          updatedAt: new Date().toISOString(),
        } satisfies CreateContentRender;
        setActiveRender(previewRender);
        return previewRender;
      }

      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in before scheduling this video.");
      const response = await fetch("/api/create-content/renders", {
        body: JSON.stringify({ sourceMediaAssetId: activeAsset.id }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | CreateContentRenderResponse
        | null;

      if (!response.ok || data?.ok !== true || !data.render) {
        throw new Error(getApiError(data, "Could not prepare this video."));
      }

      setActiveRender(data.render);
      return data.render;
    } catch (error) {
      setScheduleErrorMessage(
        getErrorMessage(error, "Could not prepare this video."),
      );
      return null;
    } finally {
      setIsPreparingForSchedule(false);
    }
  }

  async function scheduleActiveVideo() {
    if (!activeCard) {
      focusAiComposer();
      return;
    }

    setScheduleErrorMessage(null);
    setShouldOpenSchedulingAfterRender(true);

    if (
      activeRender?.sourceMediaAssetId === activeAsset?.id &&
      activeRender.cardRevision === activeCard.revision &&
      activeRender.status === "ready" &&
      activeRender.mediaAssetId
    ) {
      return;
    }

    await prepareForScheduling();
  }

  useEffect(() => {
    if (
      !shouldOpenSchedulingAfterRender ||
      !activeRender ||
      activeRender.sourceMediaAssetId !== activeAssetId
    ) {
      return;
    }

    if (activeRender.status === "failed" && !isPreparingForSchedule) {
      return;
    }

    if (activeRender.status !== "ready" || !activeRender.mediaAssetId) {
      return;
    }

    if (!isPreview) {
      window.location.assign(
        `/scheduling?assetId=${encodeURIComponent(activeRender.mediaAssetId)}`,
      );
    }
  }, [
    activeAssetId,
    activeRender,
    isPreparingForSchedule,
    isPreview,
    shouldOpenSchedulingAfterRender,
  ]);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary) return;
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || pointerStartX.current === null) return;

    const distance = event.clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;

    if (distance < 0) {
      skipActiveVideo();
    }

    if (distance > 0) {
      void scheduleActiveVideo();
    }
  }

  function clearPointerStart() {
    pointerStartX.current = null;
  }

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      skipActiveVideo();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      void scheduleActiveVideo();
    }
  }

  return (
    <section className="min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
              Your video workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground-strong sm:text-3xl">
              Create Content
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose a vertical video to create content for it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status === "ready" && assets.length > 0 ? (
              <Badge variant="secondary" className="w-fit">
                {assets.length} ready {assets.length === 1 ? "video" : "videos"}
              </Badge>
            ) : null}
          </div>
        </header>

        {status === "loading" ? <CreateContentLoading /> : null}
        {status === "error" ? (
          <CreateContentLoadError
            message={errorMessage ?? "Could not load your videos."}
            onRetry={loadAssets}
          />
        ) : null}
        {status === "ready" && assets.length === 0 ? (
          <CreateContentEmptyState />
        ) : null}
        {status === "ready" && activeAsset ? (
          <>
            <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,40%)] xl:grid-cols-[minmax(0,1fr)_27.5rem]">
              <div className="min-w-0 space-y-5">
                <VideoPicker
                  activeAssetId={activeAsset.id}
                  assets={assets}
                  onSelect={selectActiveVideo}
                />
                <VideoDeck
                  activeAsset={activeAsset}
                  activeCard={activeCard}
                  activeIndex={resolvedActiveIndex}
                  isPreparingForSchedule={
                    isPreparingForSchedule ||
                    activeRender?.status === "queued" ||
                    activeRender?.status === "rendering"
                  }
                  isTextEditing={editingAssetId === activeAsset.id}
                  nextAsset={nextAsset}
                  total={assets.length}
                  onEditText={() => {
                    if (activeCard) openTextEditor(activeCard);
                  }}
                  onSchedule={() => void scheduleActiveVideo()}
                  onPointerCancel={clearPointerStart}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onSkip={skipActiveVideo}
                  onKeyDown={handleDeckKeyDown}
                  onPositionChange={(position) => {
                    if (!activeCard) return;
                    updateLocalCard({
                      ...activeCard,
                      overlay: { ...activeCard.overlay, position },
                    });
                  }}
                />
                {activeRender?.status === "queued" ||
                activeRender?.status === "rendering" ? (
                  <p className="mx-auto max-w-md text-center text-xs leading-5 text-muted-foreground">
                    Preparing your video with its original audio intact. Scheduling
                    will open as soon as it is ready.
                  </p>
                ) : null}
                {activeRender?.status === "failed" && activeRender.errorMessage ? (
                  <div
                    className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-center text-xs leading-5 text-destructive"
                    role="alert"
                  >
                    <p>{activeRender.errorMessage}</p>
                    <p className="mt-1 text-destructive/85">
                      Select Schedule to try again.
                    </p>
                  </div>
                ) : null}
                {scheduleErrorMessage ? (
                  <p className="mx-auto max-w-md text-center text-xs leading-5 text-destructive" role="alert">
                    {scheduleErrorMessage}
                  </p>
                ) : null}
              </div>
              <AiChatPanel
                key={activeAsset.id}
                activeAsset={activeAsset}
                addErrorMessage={chatAddErrorMessage}
                composerRef={aiComposerRef}
                isPreview={isPreview}
                isAddingCopy={isAddingGeneratedCopy}
                hasExistingText={Boolean(activeCard)}
                onAddCopy={addCopyToActiveVideo}
              />
            </div>
            {activeCard && editingAssetId === activeAsset.id ? (
              <TextEditorDrawer
                key={activeCard.sourceMediaAssetId}
                card={activeCard}
                errorMessage={editorErrorMessage}
                isSaving={isSavingCard}
                onCancel={cancelTextEditing}
                onSave={async (text) => {
                  await saveCard({
                    ...activeCard,
                    overlay: { ...activeCard.overlay, text },
                  });
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function VideoDeck({
  activeAsset,
  activeCard,
  activeIndex,
  isPreparingForSchedule,
  isTextEditing,
  nextAsset,
  onEditText,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerUp,
  onPositionChange,
  onSchedule,
  onSkip,
  total,
}: {
  activeAsset: MediaAsset;
  activeCard: CreateContentCard | null;
  activeIndex: number;
  isPreparingForSchedule: boolean;
  isTextEditing: boolean;
  nextAsset: MediaAsset | null;
  onEditText: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPositionChange: (position: CreateContentTextPosition) => void;
  onSchedule: () => void;
  onSkip: () => void;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-label={`Your video deck. Showing video ${activeIndex + 1} of ${total}. Swipe left to skip or right to schedule.`}
        aria-roledescription="video deck"
        className={cn(
          "relative isolate mx-auto flex touch-pan-y items-center justify-center overflow-visible rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          VERTICAL_VIDEO_CARD_FRAME_CLASS,
        )}
        role="region"
        tabIndex={0}
        onKeyDown={isTextEditing || isPreparingForSchedule ? undefined : onKeyDown}
        onPointerDown={isTextEditing || isPreparingForSchedule ? undefined : onPointerDown}
        onPointerUp={isTextEditing || isPreparingForSchedule ? undefined : onPointerUp}
        onPointerCancel={isTextEditing || isPreparingForSchedule ? undefined : onPointerCancel}
      >
        {nextAsset ? <NextVideoPeek asset={nextAsset} /> : null}
        <article
          data-create-content-video-frame
          className="relative z-10 size-full overflow-hidden rounded-[20px] border border-border-strong bg-deep-contrast shadow-[var(--shadow-floating)]"
        >
          <video
            key={activeAsset.id}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster={activeAsset.thumbnailUrl ?? undefined}
            aria-hidden="true"
            className="pointer-events-none size-full bg-deep-contrast object-cover"
          >
            <source src={activeAsset.url} type={activeAsset.mimeType} />
            Your browser cannot play this video.
          </video>
          {activeCard ? (
            <CreateContentTextOverlay
              key={`${activeCard.sourceMediaAssetId}:${activeCard.revision}`}
              card={activeCard}
              isEditing={isTextEditing}
              onActivate={onEditText}
              onPositionCommit={onPositionChange}
            />
          ) : null}
        </article>
      </div>

      <div className="-mt-0.5">
        <CreativeDecisionActions
          acceptAriaLabel={activeCard ? "Schedule this video" : "Create copy"}
          acceptCaption={activeCard ? "Schedule" : "Create copy"}
          acceptDisabled={isTextEditing || isPreparingForSchedule}
          acceptTitle={activeCard ? "Schedule this video" : "Create copy"}
          rejectAriaLabel="Skip this video"
          rejectCaption="Skip"
          rejectDisabled={isTextEditing || isPreparingForSchedule}
          rejectTitle="Skip this video"
          onAccept={onSchedule}
          onReject={onSkip}
        />
        <p className="mt-2 text-center text-xs font-medium text-muted-foreground tabular-nums">
          Video {activeIndex + 1} of {total}
        </p>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {isTextEditing
          ? "Drag the text to place it, then choose Done."
          : activeCard
            ? "Select the text to edit it, swipe left to skip, or swipe right to schedule."
            : "Add copy with Ask AI or Write manually. Swipe left to skip."}
      </p>
    </div>
  );
}

function CreateContentTextOverlay({
  card,
  isEditing,
  onActivate,
  onPositionCommit,
}: {
  card: CreateContentCard;
  isEditing: boolean;
  onActivate: () => void;
  onPositionCommit: (position: CreateContentTextPosition) => void;
}) {
  const [position, setPosition] = useState(card.overlay.position);
  const activePointerId = useRef<number | null>(null);

  function readPosition(event: ReactPointerEvent<HTMLButtonElement>) {
    const frame = event.currentTarget.closest<HTMLElement>(
      "[data-create-content-video-frame]",
    );

    if (!frame) return null;

    const bounds = frame.getBoundingClientRect();
    return clampCreateContentTextPosition({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isEditing || !event.isPrimary) return;

    event.preventDefault();
    event.stopPropagation();
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextPosition = readPosition(event);
    if (nextPosition) setPosition(nextPosition);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (
      !isEditing ||
      activePointerId.current !== event.pointerId ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const nextPosition = readPosition(event);
    if (nextPosition) setPosition(nextPosition);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    if (activePointerId.current !== event.pointerId) return;

    event.stopPropagation();
    activePointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const finalPosition = readPosition(event) ?? position;
    setPosition(finalPosition);
    onPositionCommit(finalPosition);
  }

  const isHook = card.overlay.format === "hook_text";
  const label = isHook ? "Hook text" : "Wall-of-Text";
  const wallLayout = isHook
    ? null
    : createCreateContentWallTextLayout(position);
  const wallContent = wallLayout
    ? createCreateContentWallTextContent(card.overlay.text, wallLayout)
    : null;

  return (
    <>
      {isHook ? (
        <HookTextOverlay position={position} text={card.overlay.text} />
      ) : wallContent && wallLayout ? (
        <WallTextOverlay content={wallContent} layout={wallLayout} />
      ) : null}
      <button
        type="button"
        aria-label={isEditing ? `Drag ${label}` : `Edit ${label}`}
        className={cn(
          "absolute z-20 -translate-x-1/2 -translate-y-1/2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          isEditing
            ? "cursor-grab border border-primary/90 bg-primary/10 ring-2 ring-primary/60 ring-offset-2 ring-offset-black active:cursor-grabbing"
            : "cursor-pointer",
        )}
        style={{
          height: `${(isHook ? 0.28 : 0.25) * 100}%`,
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
          width: `${(isHook ? 0.74 : 0.722) * 100}%`,
        }}
        onClick={isEditing ? undefined : onActivate}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        {isEditing ? (
          <span className="absolute -top-7 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-primary-foreground uppercase shadow-sm">
            <GripVertical className="size-3" /> Move text
          </span>
        ) : null}
      </button>
    </>
  );
}

function TextEditorDrawer({
  card,
  errorMessage,
  isSaving,
  onCancel,
  onSave,
}: {
  card: CreateContentCard;
  errorMessage: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(() => card.overlay.text);
  const [validationError, setValidationError] = useState<string | null>(null);
  const normalizedText = normalizeCreateContentText(text);
  const isWallText = card.overlay.format === "wall_text";

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedText || isSaving) return;

    try {
      const renderReadyText = normalizeAndValidateGeneratedCreateContentText({
        format: card.overlay.format,
        text: normalizedText,
      });
      setValidationError(null);
      await onSave(renderReadyText);
    } catch (error) {
      setValidationError(
        getErrorMessage(error, "This text cannot be rendered safely."),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close text editor"
        className="absolute inset-0 cursor-default bg-foreground-strong/24 backdrop-blur-[1px]"
        onClick={onCancel}
        disabled={isSaving}
      />
      <aside
        aria-labelledby="create-content-text-editor-title"
        aria-modal="true"
        role="dialog"
        className="absolute inset-x-0 bottom-0 flex h-[min(82dvh,46rem)] flex-col border-t border-border bg-card shadow-[0_-16px_42px_rgb(23_23_27_/_0.16)] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[min(100vw,440px)] sm:border-l sm:border-t-0 sm:shadow-[-16px_0_42px_rgb(23_23_27_/_0.14)]"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <PencilLine className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
                Edit video text
              </p>
              <h2
                id="create-content-text-editor-title"
                className="truncate text-sm font-semibold text-foreground-strong"
              >
                {isWallText ? "Wall-of-Text" : "Hook text"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Close text editor"
            title="Close"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </header>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Edit the copy, then drag the text on the video to set its position.
            </p>
            <label className="mt-5 block text-xs font-semibold text-foreground-strong">
              {isWallText ? "Wall-of-Text copy" : "Hook text"}
              <textarea
                aria-label={`${isWallText ? "Wall-of-Text" : "Hook text"} copy`}
                autoComplete="off"
                name="create-content-copy"
                value={text}
                maxLength={600}
                rows={isWallText ? 10 : 6}
                className="mt-2 min-h-36 w-full resize-y rounded-lg border border-border-strong bg-background px-3 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15"
                onChange={(event) => {
                  setText(event.target.value);
                  setValidationError(null);
                }}
              />
            </label>
            <p className="mt-2 text-right text-[11px] tabular-nums text-muted-foreground">
              {normalizedText.length}/600
            </p>
            {validationError || errorMessage ? (
              <p className="mt-3 text-sm leading-5 text-destructive" role="alert">
                {validationError ?? errorMessage}
              </p>
            ) : null}
          </div>
          <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!normalizedText || isSaving}>
              <Check data-icon="inline-start" />
              {isSaving ? "Saving…" : "Done"}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function AiChatPanel({
  activeAsset,
  addErrorMessage,
  composerRef,
  hasExistingText,
  isAddingCopy,
  isPreview,
  onAddCopy,
}: {
  activeAsset: MediaAsset;
  addErrorMessage: string | null;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  hasExistingText: boolean;
  isAddingCopy: boolean;
  isPreview: boolean;
  onAddCopy: (params: {
    format: "wall_text" | "hook_text";
    text: string;
  }) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [format, setFormat] = useState<"wall_text" | "hook_text">(
    "wall_text",
  );
  const [request, setRequest] = useState("");
  const [options, setOptions] = useState<CreateContentGeneratedOption[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  function selectFormat(nextFormat: "wall_text" | "hook_text") {
    setFormat(nextFormat);
    setGenerationError(null);
    setOptions([]);
    setRequest(
      nextFormat === "wall_text"
        ? "Create Wall-of-Text copy for my video."
        : "Create Hook text for my video.",
    );
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exactRequest = request.trim();
    if (!exactRequest || isGenerating) return;

    const inferredFormat = getRequestedCopyFormat(exactRequest, format);
    setFormat(inferredFormat);
    setGenerationError(null);
    setIsGenerating(true);

    try {
      if (isPreview) {
        setOptions(createPreviewCopyOptions(inferredFormat));
        return;
      }

      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before creating personalized copy.");
      }

      const response = await fetch("/api/create-content/generate", {
        body: JSON.stringify({
          format: inferredFormat,
          request: exactRequest,
          sourceMediaAssetId: activeAsset.id,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | CopyGenerationResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not generate copy right now."));
      }

      setOptions(data.options);
    } catch (error) {
      setGenerationError(getErrorMessage(error, "Could not generate copy right now."));
    } finally {
      setIsGenerating(false);
    }
  }

  const activeFormatLabel = format === "wall_text" ? "Wall-of-Text" : "Hook text";

  return (
    <aside
      aria-labelledby="create-content-ai-chat-title"
      className="flex min-h-[34rem] flex-col overflow-hidden rounded-[28px] border border-border-strong bg-card shadow-[0_18px_44px_rgb(23_23_27_/_0.16)] lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:min-h-0"
    >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
              Video copy assistant
            </p>
            <h2
              id="create-content-ai-chat-title"
              className="mt-1 truncate text-base font-semibold text-foreground-strong"
            >
              {mode === "ai" ? "Ask AI" : "Write manually"}
            </h2>
          </div>
          <div
            aria-label="Copy creation mode"
            className="flex shrink-0 rounded-full border border-border bg-background/65 p-1"
            role="tablist"
          >
            <button
              type="button"
              aria-controls="create-content-ai-panel"
              aria-selected={mode === "ai"}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                mode === "ai"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground-strong",
              )}
              role="tab"
              onClick={() => setMode("ai")}
            >
              Ask AI
            </button>
            <button
              type="button"
              aria-controls="create-content-manual-panel"
              aria-selected={mode === "manual"}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                mode === "manual"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground-strong",
              )}
              role="tab"
              onClick={() => setMode("manual")}
            >
              Write manually
            </button>
          </div>
        </header>

        {mode === "ai" ? <>
        <div id="create-content-ai-panel" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
          {options.length === 0 ? (
            <div className="rounded-[22px] border border-border bg-background/65 p-5 shadow-[0_12px_30px_rgb(23_23_27_/_0.08)]">
              <p className="text-base font-semibold text-foreground-strong">
                What would you like to create?
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Describe the idea in your own words. Ask AI returns four options
                unless you request a different number.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground-strong">
                  {options.length} {activeFormatLabel} {options.length === 1 ? "option" : "options"}
                </p>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  onClick={() => setOptions([])}
                >
                  Start over
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {options.map((option, index) => (
                  <GeneratedCopyOptionCard
                    key={`${option.formatId ?? option.format}-${index}`}
                    option={option}
                    optionNumber={index + 1}
                    isAdding={isAddingCopy}
                    onAdd={onAddCopy}
                  />
                ))}
              </div>
            </div>
          )}

          {generationError ? (
            <p className="mt-4 text-sm leading-5 text-destructive" role="alert">
              {generationError}
            </p>
          ) : null}
          {addErrorMessage ? (
            <p className="mt-4 text-sm leading-5 text-destructive" role="alert">
              {addErrorMessage}
            </p>
          ) : null}
        </div>

        <form className="shrink-0 border-t border-border bg-card/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6" onSubmit={generate}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={format === "wall_text" ? "default" : "outline"}
              className="h-9 rounded-full px-4"
              onClick={() => selectFormat("wall_text")}
            >
              Wall-of-Text
            </Button>
            <Button
              type="button"
              size="sm"
              variant={format === "hook_text" ? "default" : "outline"}
              className="h-9 rounded-full px-4"
              onClick={() => selectFormat("hook_text")}
            >
              Hook text
            </Button>
          </div>
          <label className="sr-only" htmlFor="create-content-ai-request">
            Ask the AI for copy
          </label>
          <div className="relative mt-3 rounded-[22px] border border-border-strong bg-background p-1.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
            <textarea
              id="create-content-ai-request"
              ref={composerRef}
              autoComplete="off"
              name="create-content-ai-request"
              value={request}
              maxLength={1_200}
              rows={3}
              placeholder={`Ask for ${activeFormatLabel}…`}
              className="min-h-27 w-full resize-none rounded-[17px] border-0 bg-transparent px-3 py-3 pb-11 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(event) => setRequest(event.target.value)}
            />
            <p className="absolute bottom-3 left-4 text-[11px] text-muted-foreground">
              {request.trim().length}/1200
            </p>
            <Button
              type="submit"
              size="sm"
              className="absolute right-3 bottom-3 h-8 rounded-full px-3.5"
              disabled={!request.trim() || isGenerating}
            >
              <Send data-icon="inline-start" />
              {isGenerating ? "Creating…" : "Send"}
            </Button>
          </div>
        </form>
        </> : (
          <ManualCopyComposer
            addErrorMessage={addErrorMessage}
            hasExistingText={hasExistingText}
            isAddingCopy={isAddingCopy}
            onAddCopy={onAddCopy}
          />
        )}
    </aside>
  );
}

function ManualCopyComposer({
  addErrorMessage,
  hasExistingText,
  isAddingCopy,
  onAddCopy,
}: {
  addErrorMessage: string | null;
  hasExistingText: boolean;
  isAddingCopy: boolean;
  onAddCopy: (params: {
    format: "wall_text" | "hook_text";
    text: string;
  }) => Promise<boolean>;
}) {
  const [format, setFormat] = useState<"wall_text" | "hook_text">(
    "wall_text",
  );
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isReplaceConfirmed, setIsReplaceConfirmed] = useState(false);
  const normalizedText = normalizeCreateContentText(text);
  const formatLabel = format === "wall_text" ? "Wall-of-Text" : "Hook text";

  function chooseFormat(nextFormat: "wall_text" | "hook_text") {
    setFormat(nextFormat);
    setValidationError(null);
    setIsReplaceConfirmed(false);
  }

  async function addManualCopy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedText || isAddingCopy) return;

    let renderReadyText: string;
    try {
      renderReadyText = normalizeAndValidateGeneratedCreateContentText({
        format,
        text: normalizedText,
      });
    } catch (error) {
      setValidationError(
        getErrorMessage(error, `${formatLabel} cannot be rendered safely.`),
      );
      return;
    }

    if (hasExistingText && !isReplaceConfirmed) {
      setValidationError(
        "This video already has text. Confirm to replace the current text.",
      );
      setIsReplaceConfirmed(true);
      return;
    }

    setValidationError(null);
    const added = await onAddCopy({ format, text: renderReadyText });
    if (added) {
      setText("");
      setIsReplaceConfirmed(false);
    }
  }

  return (
    <form
      id="create-content-manual-panel"
      role="tabpanel"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={addManualCopy}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
        <div className="rounded-[22px] border border-border bg-background/65 p-5 shadow-[0_12px_30px_rgb(23_23_27_/_0.08)]">
          <p className="text-base font-semibold text-foreground-strong">
            Write your own copy
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose a format and add render-ready text directly to this video.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={format === "wall_text" ? "default" : "outline"}
            className="h-9 rounded-full px-4"
            onClick={() => chooseFormat("wall_text")}
          >
            Wall-of-Text
          </Button>
          <Button
            type="button"
            size="sm"
            variant={format === "hook_text" ? "default" : "outline"}
            className="h-9 rounded-full px-4"
            onClick={() => chooseFormat("hook_text")}
          >
            Hook text
          </Button>
        </div>

        <label className="mt-5 block text-xs font-semibold text-foreground-strong">
          {formatLabel} copy
          <textarea
            id="create-content-manual-copy"
            aria-label={`${formatLabel} copy`}
            autoComplete="off"
            name="create-content-manual-copy"
            value={text}
            maxLength={600}
            rows={format === "wall_text" ? 8 : 4}
            placeholder={
              format === "wall_text"
                ? "Write five to eight readable lines…"
                : "Write a short, readable hook…"
            }
            className="mt-2 min-h-36 w-full resize-y rounded-[18px] border border-border-strong bg-background px-3 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15"
            onChange={(event) => {
              setText(event.target.value);
              setValidationError(null);
              setIsReplaceConfirmed(false);
            }}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {format === "wall_text"
            ? "Wall-of-Text uses five to eight readable lines."
            : "Hook text is checked against the same three-line Trending layout."}
        </p>
        <p className="mt-2 text-right text-[11px] tabular-nums text-muted-foreground">
          {normalizedText.length}/600
        </p>
        {validationError ? (
          <p className="mt-3 text-sm leading-5 text-destructive" role="alert">
            {validationError}
          </p>
        ) : null}
        {addErrorMessage ? (
          <p className="mt-3 text-sm leading-5 text-destructive" role="alert">
            {addErrorMessage}
          </p>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-border bg-card/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
        <Button
          type="submit"
          className="w-full rounded-full"
          disabled={!normalizedText || isAddingCopy}
        >
          <Plus data-icon="inline-start" />
          {isAddingCopy
            ? "Adding…"
            : isReplaceConfirmed
              ? "Confirm replace"
              : hasExistingText
                ? "Replace current text"
                : "Add to this video"}
        </Button>
      </footer>
    </form>
  );
}

function GeneratedCopyOptionCard({
  option,
  optionNumber,
  isAdding,
  onAdd,
}: {
  option: CreateContentGeneratedOption;
  optionNumber: number;
  isAdding: boolean;
  onAdd: (params: {
    format: "wall_text" | "hook_text";
    text: string;
  }) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(option.text);
  const [isAdded, setIsAdded] = useState(false);
  const normalizedText = normalizeCreateContentText(text);
  const kindLabel = option.format === "wall_text" ? "Wall-of-Text" : "Hook text";

  async function addToVideo() {
    if (!normalizedText || isAdding) return;
    const added = await onAdd({ format: option.format, text: normalizedText });
    if (added) setIsAdded(true);
  }

  return (
    <article className="rounded-[20px] border border-border bg-background/70 p-4 shadow-[0_10px_24px_rgb(23_23_27_/_0.06)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-foreground-strong">
          {kindLabel} {optionNumber}
          {option.formatId ? ` · ${option.formatId}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label={isEditing ? "Finish editing option" : "Edit option"}
          title={isEditing ? "Finish editing" : "Edit"}
        >
          <PencilLine className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {isEditing ? (
        <textarea
          aria-label={`${kindLabel} ${optionNumber}`}
          autoComplete="off"
          name={`create-content-option-${optionNumber}`}
          value={text}
          maxLength={600}
          rows={option.format === "wall_text" ? 6 : 4}
          className="mt-3 w-full resize-y rounded-2xl border border-border-strong bg-card px-3 py-2 text-sm leading-5 text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
          onChange={(event) => setText(event.target.value)}
        />
      ) : (
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground">
          {normalizedText}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {isAdded ? "Added to this video" : "Adds at the center; you can drag it."}
        </p>
        <Button
          type="button"
          size="sm"
          className="rounded-full px-3.5"
          disabled={!normalizedText || isAdding}
          onClick={() => void addToVideo()}
        >
          <Plus data-icon="inline-start" />
          {isAdding ? "Adding…" : "Add to this video"}
        </Button>
      </div>
    </article>
  );
}

function getRequestedCopyFormat(
  request: string,
  fallback: "wall_text" | "hook_text",
) {
  const normalized = request.toLocaleLowerCase();
  if (/\bhooks?\b/u.test(normalized)) return "hook_text";
  if (/\bwall(?:[\s-]*of[\s-]*text)?\b|\ball of (?:the )?text\b/u.test(normalized)) {
    return "wall_text";
  }
  return fallback;
}

function createPreviewCopyOptions(
  format: "wall_text" | "hook_text",
): CreateContentGeneratedOption[] {
  const wallOptions = [
    "The useful work\nis often quieter\nthan the loudest\nannouncement\nin the room.",
    "You do not need\na bigger plan.\nYou need\nthe next\nclear decision.",
    "The best systems\nmake room\nfor the human\ndoing\nthe work.",
    "A small change\ncan make\nthe whole day\nfeel\nlighter.",
  ];
  const hookOptions = [
    "I just found a calmer way to do this",
    "Wait, what? This can be simpler?",
    "POV: the work finally feels clear",
    "Why are we still doing it the hard way?",
  ];

  return (format === "wall_text" ? wallOptions : hookOptions).map(
    (text, index) => ({
      format,
      ...(format === "hook_text" ? { formatId: `PREVIEW_${index + 1}` } : {}),
      text,
    }),
  );
}

function NextVideoPeek({ asset }: { asset: MediaAsset }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 translate-x-3 translate-y-1 scale-[0.965] overflow-hidden rounded-[20px] border border-border bg-card-muted opacity-70 shadow-[var(--shadow-card)]"
    >
      {asset.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.thumbnailUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <Film className="size-5" />
        </span>
      )}
    </div>
  );
}

function VideoPicker({
  activeAssetId,
  assets,
  onSelect,
}: {
  activeAssetId: string;
  assets: MediaAsset[];
  onSelect: (assetId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-center lg:justify-start">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Choose from ${assets.length} ready videos`}
            className="h-9 rounded-full border-border-strong bg-card px-3.5 shadow-sm transition-colors hover:bg-card-muted"
            />
          }
        >
          <Film data-icon="inline-start" />
          Videos · {assets.length}
          <ChevronDown data-icon="inline-end" className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(92vw,28rem)] rounded-2xl border-border-strong bg-card p-3 shadow-[0_18px_44px_rgb(23_23_27_/_0.18)]"
        >
          <div className="px-1 pb-2">
            <p className="text-sm font-semibold text-foreground-strong">
              Choose a video
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Ready 9:16 videos from Creative Assets.
            </p>
          </div>
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
        {assets.map((asset, index) => {
          const isActive = asset.id === activeAssetId;

          return (
            <button
              key={asset.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              aria-label={`Show video ${index + 1}: ${asset.title}`}
              className={cn(
                "relative aspect-[9/16] w-full overflow-hidden rounded-xl border bg-card text-left outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:hover:translate-y-0",
                isActive
                  ? "border-primary ring-2 ring-primary/25"
                  : "border-border-strong hover:border-foreground/40",
              )}
              onClick={() => {
                onSelect(asset.id);
                setIsOpen(false);
              }}
            >
              {asset.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground">
                  <Film className="size-4" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/65 px-1.5 py-1 text-[10px] font-semibold text-white tabular-nums">
                <span>{index + 1}</span>
                {isActive ? <Check className="size-3" aria-hidden="true" /> : null}
              </span>
            </button>
          );
        })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CreateContentLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your videos" className="flex flex-col items-center gap-5 py-2">
      <Skeleton className="h-[min(68dvh,35rem)] w-[min(100%,20rem)] rounded-[var(--radius-panel)]" />
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-11 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function CreateContentEmptyState() {
  return (
    <Empty className="min-h-[440px] border border-dashed border-border-strong bg-card/45">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Clapperboard />
        </EmptyMedia>
        <EmptyTitle>No 9:16 videos are ready yet</EmptyTitle>
        <EmptyDescription>
          Add a vertical video in Creative Assets to create content for it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/avatars?tab=videos" className={buttonVariants()}>
          Open Creative Assets
        </Link>
      </EmptyContent>
    </Empty>
  );
}

function CreateContentLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Empty className="min-h-[440px] border border-dashed border-border-strong bg-card/45">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Clapperboard />
        </EmptyMedia>
        <EmptyTitle>Could not load your videos</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function getApiError(value: unknown, fallback: string): string {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
