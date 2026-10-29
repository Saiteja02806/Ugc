"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderOpen,
  Images,
  Layers,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { MediaLibraryPanel } from "@/components/media/media-library-dialog";
import { WorkflowTimePicker } from "@/components/scheduling/workflow-time-picker";
import {
  CarouselManualText,
  CarouselTextControls,
} from "@/components/trending/carousel-text-controls";
import { Button as BaseButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { defaultCarouselManualTextStyle } from "@/lib/carousel/manual-text";
import { loadAccountSocialConnections } from "@/lib/scheduling/account-data-query";
import { displayScheduleTime, deviceUses12HourTime } from "@/lib/scheduling/time-display";
import type { SocialConnection } from "@/lib/social/types";
import type { TrendingCarouselEditSlide } from "@/lib/trending/creative-edit-contract";
import {
  activateSlideshowAutomationRequest,
  deleteVisualStylePresetRequest,
  fetchSlideshowAutomationState,
  mutateAutomationSlotRequest,
  pauseSlideshowAutomationRequest,
  saveSlideshowAutomationConfig,
  saveVisualStylePresetRequest,
} from "@/lib/trending/slideshow-automation-client";
import {
  adjustAutomationFormatCount,
  applyAutomationQuickMode,
  createDefaultAutomationConfig,
  deriveQuickModeFromCounts,
  type PauseAutomationUpcomingAction,
  planUpcomingAutomationOccurrences,
  type SavedCarouselVisualStyle,
  setAutomationDailyTotal,
  syncAutomationDailySlots,
  TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META,
  type TrendingSlideshowAutomationConfig,
  type TrendingSlideshowAutomationFormat,
  type TrendingSlideshowAutomationQuickMode,
  type TrendingSlideshowAutomationRecord,
  type TrendingSlideshowAutomationSlotRecord,
  type TrendingSlideshowAutomationTargetAccount,
  validateAutomationConfigForActivation,
} from "@/lib/trending/slideshow-automation-contract";
import type { SlideshowAutomationCollectionSummary } from "@/lib/trending/slideshow-automation-service";

type SetupStep = "content" | "appearance" | "posting" | "review";
type WorkspaceMode = "setup" | "overview";

// Scope the requested pill corners to this workspace, including its dialogs.
function Button({ className, ...props }: ComponentProps<typeof BaseButton>) {
  return <BaseButton {...props} className={cn(className, "rounded-full")} />;
}

const SETUP_STEPS: ReadonlyArray<{ id: SetupStep; label: string; number: number }> = [
  { id: "content", label: "Content", number: 1 },
  { id: "appearance", label: "Appearance", number: 2 },
  { id: "posting", label: "Posting", number: 3 },
  { id: "review", label: "Review", number: 4 },
];

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
] as const;

const SAMPLE_SLIDES_BY_FORMAT: Record<
  TrendingSlideshowAutomationFormat,
  Array<{ ctaText: string; headline: string; slideNumber: number; subtext: string }>
> = {
  educational_tips: [
    {
      ctaText: "",
      headline: "5 Morning Habits That Double Daily Focus",
      slideNumber: 1,
      subtext: "",
    },
    {
      ctaText: "",
      headline: "1. Delay screen time for the first 30 minutes",
      slideNumber: 2,
      subtext:
        "Starting without notifications keeps your attention anchored on your highest-value priority.",
    },
    {
      ctaText: "",
      headline: "2. Hydrate before your first cup of coffee",
      slideNumber: 3,
      subtext:
        "Restoring hydration first prevents the mid-morning energy crash before deep work begins.",
    },
    {
      ctaText: "",
      headline: "3. Write down your single must-win outcome",
      slideNumber: 4,
      subtext:
        "One clear target beats a 15-item checklist when meetings start stacking up.",
    },
  ],
  product_stories: [
    {
      ctaText: "",
      headline: "Why I Stopped Guessing What Content Converts",
      slideNumber: 1,
      subtext: "",
    },
    {
      ctaText: "",
      headline: "We spent 6 hours a day manually building slides",
      slideNumber: 2,
      subtext:
        "Every post took custom copywriting, image hunting, and manual scheduling across accounts.",
    },
    {
      ctaText: "",
      headline: "Then we switched to a repeatable daily story system",
      slideNumber: 3,
      subtext:
        "Connecting our brand collection and daily story structure cut preparation down to minutes.",
    },
    {
      ctaText: "Try it for your brand today",
      headline: "Ready to put your daily slideshows on autopilot?",
      slideNumber: 4,
      subtext:
        "Start with your own collection backgrounds and publish consistently every day.",
    },
  ],
};

export function TrendingSlideshowAutomationWorkspace({
  initialBrowserTimezone,
  onClose,
  open,
  userId,
}: {
  initialBrowserTimezone?: string;
  onClose: () => void;
  open: boolean;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const hour12 = useMemo(() => deviceUses12HourTime(), []);
  const detectedTimezone = useMemo(() => {
    if (initialBrowserTimezone) return initialBrowserTimezone;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch {
      return "America/New_York";
    }
  }, [initialBrowserTimezone]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [activating, setActivating] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);

  const [automation, setAutomation] =
    useState<TrendingSlideshowAutomationRecord | null>(null);
  const [config, setConfig] = useState<TrendingSlideshowAutomationConfig>(() =>
    createDefaultAutomationConfig({ timezone: detectedTimezone }),
  );
  const [collections, setCollections] = useState<
    SlideshowAutomationCollectionSummary[]
  >([]);
  const [savedStyles, setSavedStyles] = useState<SavedCarouselVisualStyle[]>([]);
  const [savedCaptions, setSavedCaptions] = useState<
    Array<{ id: string; isDefault: boolean; text: string }>
  >([]);
  const [slots, setSlots] = useState<TrendingSlideshowAutomationSlotRecord[]>(
    [],
  );
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [dailyAllowance, setDailyAllowance] = useState(4);
  const [planDisplayName, setPlanDisplayName] = useState("Growth");

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("setup");
  const [step, setStep] = useState<SetupStep>("content");

  // Example preview state
  const [previewFormat, setPreviewFormat] =
    useState<TrendingSlideshowAutomationFormat>("product_stories");
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  // Appearance customization & modals
  const [customizingStyle, setCustomizingStyle] = useState(false);
  const [newStyleName, setNewStyleName] = useState("");
  const [savingStylePreset, setSavingStylePreset] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryBusy, setMediaLibraryBusy] = useState(false);

  // Pause dialog state
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pauseAction, setPauseAction] = useState<PauseAutomationUpcomingAction>(
    "cancel_upcoming_auto_slots",
  );

  const fetchAndApplyWorkspace = useCallback(async () => {
    try {
      const [state, loadedConnections] = await Promise.all([
        fetchSlideshowAutomationState(detectedTimezone),
        loadAccountSocialConnections(queryClient, userId).catch(() => []),
      ]);
      setAutomation(state.automation);
      setConfig(state.automation.config);
      setCollections(state.collections);
      setSavedStyles(state.savedStyles);
      setSavedCaptions(state.savedCaptions);
      setSlots(state.slots);
      setDailyAllowance(state.dailyAllowance);
      setPlanDisplayName(state.planDisplayName);
      setConnections(loadedConnections);

      if (state.automation.status === "draft") {
        setWorkspaceMode("setup");
      } else {
        setWorkspaceMode("overview");
      }

      if (
        state.automation.config.counts.productStoriesCount === 0 &&
        state.automation.config.counts.educationalTipsCount > 0
      ) {
        setPreviewFormat("educational_tips");
      } else {
        setPreviewFormat("product_stories");
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load Trending slideshow automation.",
      );
    } finally {
      setLoading(false);
    }
  }, [detectedTimezone, queryClient, userId]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    await fetchAndApplyWorkspace();
  }, [fetchAndApplyWorkspace]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void Promise.all([
      fetchSlideshowAutomationState(detectedTimezone),
      loadAccountSocialConnections(queryClient, userId).catch(() => []),
    ])
      .then(([state, loadedConnections]) => {
        if (cancelled) return;
        setAutomation(state.automation);
        setConfig(state.automation.config);
        setCollections(state.collections);
        setSavedStyles(state.savedStyles);
        setSavedCaptions(state.savedCaptions);
        setSlots(state.slots);
        setDailyAllowance(state.dailyAllowance);
        setPlanDisplayName(state.planDisplayName);
        setConnections(loadedConnections);
        setWorkspaceMode(
          state.automation.status === "draft" ? "setup" : "overview",
        );
        if (
          state.automation.config.counts.productStoriesCount === 0 &&
          state.automation.config.counts.educationalTipsCount > 0
        ) {
          setPreviewFormat("educational_tips");
        } else {
          setPreviewFormat("product_stories");
        }
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load Trending slideshow automation.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detectedTimezone, open, queryClient, userId]);

  const activeCollection = useMemo(() => {
    const bg = config.backgrounds;
    if (bg.mode !== "collection_only") return null;
    return collections.find((item) => item.id === bg.collectionId) ?? null;
  }, [collections, config.backgrounds]);

  const effectivePreviewAssets = useMemo(() => {
    if (config.backgrounds.mode !== "collection_only" || !activeCollection) {
      return [];
    }
    if (
      config.backgrounds.selectionMode === "subset" &&
      config.backgrounds.selectedAssetIds.length > 0
    ) {
      const selectedSet = new Set(config.backgrounds.selectedAssetIds);
      return activeCollection.assets.filter((asset) =>
        selectedSet.has(asset.id),
      );
    }
    return activeCollection.assets;
  }, [activeCollection, config.backgrounds]);

  const previewSlides = useMemo(() => {
    const templates = SAMPLE_SLIDES_BY_FORMAT[previewFormat];
    return templates.map((item, idx): TrendingCarouselEditSlide => {
      const asset =
        effectivePreviewAssets.length > 0
          ? effectivePreviewAssets[idx % effectivePreviewAssets.length]
          : null;
      return {
        backgroundAssetId: asset?.id ?? null,
        backgroundUrl: asset?.url ?? "",
        ctaText: item.ctaText,
        hasHeading: item.slideNumber === 1 || Boolean(item.headline && item.subtext),
        headline: item.headline,
        originalBackgroundAssetId: asset?.id ?? null,
        originalBackgroundUrl: asset?.url ?? "",
        originalHeadline: item.headline,
        originalSubtext: item.subtext,
        originalVisualRole: item.slideNumber === 1 ? "hook" : "static",
        productVisualEligibility: "forbidden",
        renderFormat: "4:5",
        renderedUrl: asset?.url ?? "",
        slideId: `preview-slide-${item.slideNumber}`,
        slideNumber: item.slideNumber,
        sourceRendererVersion: "v2",
        storyLayoutVariant: null,
        storyTextTreatment: null,
        structureId:
          previewFormat === "educational_tips" ? "structure_1" : "structure_2",
        subtext: item.subtext,
        textPosition: config.visualStyle.textPosition,
        textStyle: config.visualStyle.style,
        visualRole: item.slideNumber === 1 ? "hook" : "static",
      };
    });
  }, [
    config.visualStyle.style,
    config.visualStyle.textPosition,
    effectivePreviewAssets,
    previewFormat,
  ]);

  const currentPreviewSlide =
    previewSlides[Math.min(previewSlideIndex, previewSlides.length - 1)] ??
    previewSlides[0]!;

  const persistDraftConfig = useCallback(
    async (
      nextConfig: TrendingSlideshowAutomationConfig,
      showSavedToast = false,
    ) => {
      setConfig(nextConfig);
      setSavingDraft(true);
      setActionError(null);
      try {
        const saved = await saveSlideshowAutomationConfig(nextConfig);
        setAutomation(saved);
        if (showSavedToast) {
          setActionNotice(
            saved.status === "draft"
              ? "Draft saved."
              : "Settings updated for future prepared slideshows. Already scheduled posts stay unchanged.",
          );
        }
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Could not save your automation changes.",
        );
      } finally {
        setSavingDraft(false);
      }
    },
    [],
  );

  function handleDailyTotalChange(nextTotal: number) {
    const updated = setAutomationDailyTotal({
      counts: config.counts,
      dailyTotal: nextTotal,
      maxAllowance: dailyAllowance,
      quickMode: config.quickMode,
    });
    const nextSlots = syncAutomationDailySlots({
      counts: updated.counts,
      currentSlots: config.dailySlots,
    });
    void persistDraftConfig({
      ...config,
      counts: updated.counts,
      dailySlots: nextSlots,
      quickMode: updated.quickMode,
    });
  }

  function handleQuickModeSelect(mode: TrendingSlideshowAutomationQuickMode) {
    const nextCounts = applyAutomationQuickMode({
      dailyTotal: config.counts.dailyTotal,
      quickMode: mode,
    });
    const nextSlots = syncAutomationDailySlots({
      counts: nextCounts,
      currentSlots: config.dailySlots,
    });
    if (mode === "all_educational_tips") {
      setPreviewFormat("educational_tips");
    } else if (mode === "all_product_stories") {
      setPreviewFormat("product_stories");
    }
    void persistDraftConfig({
      ...config,
      counts: nextCounts,
      dailySlots: nextSlots,
      quickMode: mode,
    });
  }

  function handleStepperDelta(
    format: TrendingSlideshowAutomationFormat,
    delta: -1 | 1,
  ) {
    const nextCounts = adjustAutomationFormatCount({
      counts: config.counts,
      delta,
      format,
      maxAllowance: dailyAllowance,
    });
    const nextQuickMode = deriveQuickModeFromCounts(nextCounts);
    const nextSlots = syncAutomationDailySlots({
      counts: nextCounts,
      currentSlots: config.dailySlots,
    });
    void persistDraftConfig({
      ...config,
      counts: nextCounts,
      dailySlots: nextSlots,
      quickMode: nextQuickMode,
    });
  }

  function handleSelectCollection(
    collection: SlideshowAutomationCollectionSummary,
  ) {
    const nextConfig: TrendingSlideshowAutomationConfig = {
      ...config,
      backgrounds: {
        collectionId: collection.id,
        collectionName: collection.name,
        mode: "collection_only",
        selectedAssetIds: collection.assets.map((asset) => asset.id),
        selectionMode: "all",
      },
    };
    setCollectionPickerOpen(false);
    void persistDraftConfig(nextConfig);
  }

  function handleToggleSubsetAsset(assetId: string) {
    if (config.backgrounds.mode !== "collection_only") return;
    const current = config.backgrounds.selectionMode === "all"
      ? (activeCollection?.assets.map((asset) => asset.id) ?? [])
      : config.backgrounds.selectedAssetIds;
    const exists = current.includes(assetId);
    const nextIds = exists
      ? current.filter((id) => id !== assetId)
      : [...current, assetId];
    void persistDraftConfig({
      ...config,
      backgrounds: {
        ...config.backgrounds,
        selectedAssetIds: nextIds,
        selectionMode: "subset",
      },
    });
  }

  function handleSlideAppearanceChange(updatedSlide: TrendingCarouselEditSlide) {
    const nextStyle =
      updatedSlide.textStyle ?? defaultCarouselManualTextStyle();
    setConfig((prev) => ({
      ...prev,
      visualStyle: {
        ...prev.visualStyle,
        style: nextStyle,
        textPosition: updatedSlide.textPosition,
      },
    }));
  }

  async function handleSaveVisualStylePreset() {
    if (!newStyleName.trim()) {
      setActionError("Enter a name before saving this visual style.");
      return;
    }
    setSavingStylePreset(true);
    setActionError(null);
    try {
      const preset = await saveVisualStylePresetRequest({
        name: newStyleName.trim(),
        style: config.visualStyle.style,
        textPosition: config.visualStyle.textPosition,
      });
      setSavedStyles((prev) => [
        preset,
        ...prev.filter((item) => item.id !== preset.id),
      ]);
      setNewStyleName("");
      const nextConfig: TrendingSlideshowAutomationConfig = {
        ...config,
        visualStyle: {
          mode: "saved",
          style: preset.style,
          styleId: preset.id,
          styleName: preset.name,
          textPosition: preset.textPosition,
        },
      };
      await persistDraftConfig(nextConfig, true);
      setActionNotice(`Saved visual style "${preset.name}".`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not save visual style preset.",
      );
    } finally {
      setSavingStylePreset(false);
    }
  }

  async function handleDeleteSavedStyle(styleId: string) {
    setActionError(null);
    try {
      await deleteVisualStylePresetRequest(styleId);
      setSavedStyles((prev) => prev.filter((item) => item.id !== styleId));
      if (
        config.visualStyle.mode === "saved" &&
        config.visualStyle.styleId === styleId
      ) {
        await persistDraftConfig({
          ...config,
          visualStyle: {
            mode: "default",
            style: defaultCarouselManualTextStyle(),
            textPosition: { x: 0.5, y: 0.5 },
          },
        });
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not remove saved visual style.",
      );
    }
  }

  function handleToggleTargetConnection(connection: SocialConnection) {
    if (connection.platform !== "instagram" && connection.platform !== "tiktok") {
      return;
    }
    const existing = config.targets.find(
      (target) => target.connectionId === connection.id,
    );
    let nextTargets: TrendingSlideshowAutomationTargetAccount[];
    if (existing) {
      nextTargets = config.targets.filter(
        (target) => target.connectionId !== connection.id,
      );
    } else {
      const label = connection.platformAccountUsername
        ? `@${connection.platformAccountUsername.replace(/^@/, "")}`
        : connection.platformAccountName || connection.platform;
      nextTargets = [
        ...config.targets,
        connection.platform === "tiktok"
          ? {
              accountLabel: label,
              connectionId: connection.id,
              platform: "tiktok",
            }
          : {
              accountLabel: label,
              connectionId: connection.id,
              platform: "instagram",
            },
      ];
    }
    void persistDraftConfig({
      ...config,
      targets: nextTargets,
    });
  }

  function handleSlotTimeChange(slotIndex: number, nextTime: string) {
    const nextSlots = config.dailySlots.map((slot) =>
      slot.slotIndex === slotIndex ? { ...slot, time: nextTime } : slot,
    );
    void persistDraftConfig({
      ...config,
      dailySlots: nextSlots,
    });
  }

  async function handleActivateAutomation() {
    setActivating(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await activateSlideshowAutomationRequest(config);
      setAutomation(result.automation);
      setConfig(result.automation.config);
      setSlots(result.slots);
      setWorkspaceMode("overview");
      setActionNotice(
        "Automation is active. Check the status of each upcoming slideshow below.",
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not activate slideshow automation.",
      );
    } finally {
      setActivating(false);
    }
  }

  async function handleConfirmPause() {
    setPausing(true);
    setActionError(null);
    try {
      const result = await pauseSlideshowAutomationRequest(pauseAction);
      setAutomation(result.automation);
      setSlots(result.slots);
      setPauseDialogOpen(false);
      setWorkspaceMode("overview");
      setActionNotice(
        result.cancelledSlotCount > 0
          ? `Automation paused and ${result.cancelledSlotCount} upcoming unedited slot(s) cancelled.`
          : "Automation paused.",
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not pause slideshow automation.",
      );
    } finally {
      setPausing(false);
    }
  }

  async function handleSlotAction(
    slotId: string,
    action: "cancel" | "retry" | "skip",
  ) {
    setActionError(null);
    try {
      const result = await mutateAutomationSlotRequest({ action, slotId });
      setAutomation(result.automation);
      setSlots(result.slots);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not update this automated slot.",
      );
    }
  }

  const upcomingPreviewOccurrences = useMemo(
    () =>
      planUpcomingAutomationOccurrences({
        config,
        horizonHours: 48,
      }),
    [config],
  );

  const activationCheck = useMemo(
    () =>
      validateAutomationConfigForActivation({
        availableCollectionAssetCount:
          config.backgrounds.mode === "collection_only"
            ? effectivePreviewAssets.length
            : undefined,
        config,
        dailyAllowance,
      }),
    [config, dailyAllowance, effectivePreviewAssets.length],
  );

  const attentionSlotCount = slots.filter((slot) => Boolean(slot.holdMessage) ||
    ["action_required_account", "held_collection_empty", "missed_posting_time", "partially_published"].includes(slot.status)).length;
  if (!open) return null;

  return (
    <div
      data-trending-automation-workspace
      role="dialog"
      aria-modal="true"
      aria-label="Trending Slideshow Automation"
      className="fixed inset-0 z-[49] flex flex-col bg-background text-foreground"
    >
      {/* Top workspace header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Back to Trending"
            className="gap-1.5"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span>Back to Trending</span>
          </Button>
          <div className="h-4 w-px bg-border/80" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold tracking-tight">
              Slideshow Automation
            </h2>
          </div>
        </div>

        {workspaceMode === "setup" ? (
          <nav
            aria-label="Automation setup steps"
            className="flex items-center gap-1 overflow-x-auto py-1"
          >
            {SETUP_STEPS.map((item) => {
              const active = step === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  aria-current={active ? "step" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-card-muted text-muted hover:text-foreground"
                  }`}
                >
                  <span className="font-semibold">{item.number}.</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          <span
            data-automation-status-badge={automation?.status ?? "draft"}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              automation?.status === "active"
                ? "border-success/35 bg-success/10 text-success"
                : automation?.status === "needs_attention"
                ? "border-warning/45 bg-warning/15 text-warning"
                : automation?.status === "paused"
                ? "border-border bg-card-muted text-muted"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            {automation?.status === "active"
              ? "Active"
              : automation?.status === "needs_attention"
              ? "Needs attention"
              : automation?.status === "paused"
              ? "Paused"
              : savingDraft
              ? "Saving draft…"
              : "Draft saved"}
          </span>

          {automation && automation.status !== "draft" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setWorkspaceMode((prev) =>
                  prev === "overview" ? "setup" : "overview",
                )
              }
            >
              {workspaceMode === "overview"
                ? "Edit settings"
                : "Back to overview"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close Slideshow Automation"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Main scrollable workspace body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          {actionNotice ? (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl border border-success/35 bg-success/10 px-4 py-2.5 text-sm text-foreground"
            >
              <span>{actionNotice}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActionNotice(null)}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          {actionError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-error/40 bg-error/10 px-4 py-2.5 text-sm text-error"
            >
              <span>{actionError}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActionError(null)}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          {loading ? (
            <div
              role="status"
              className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-8 text-sm text-muted"
            >
              <LoaderCircle
                className="size-6 animate-spin text-primary"
                aria-hidden="true"
              />
              <p>Loading your Trending slideshow automation workspace…</p>
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-error/40 bg-card p-8 text-center"
            >
              <p className="text-sm font-medium text-error">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadWorkspace()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>Retry</span>
              </Button>
            </div>
          ) : workspaceMode === "overview" && automation ? (
            /* ============================================================
               ACTIVE / PAUSED / NEEDS ATTENTION OVERVIEW
               ============================================================ */
            <div className="space-y-6" data-automation-overview>
              {/* Status banner */}
              <section
                aria-label="Automation status"
                className={`rounded-2xl border p-5 ${
                  automation.status === "needs_attention"
                    ? "border-warning/45 bg-warning/[0.08]"
                    : automation.status === "active"
                    ? "border-success/35 bg-success/[0.06]"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {automation.status === "needs_attention" ? (
                        <AlertTriangle
                          className="size-5 text-warning"
                          aria-hidden="true"
                        />
                      ) : automation.status === "active" ? (
                        <CheckCircle2
                          className="size-5 text-success"
                          aria-hidden="true"
                        />
                      ) : (
                        <PauseCircle
                          className="size-5 text-muted"
                          aria-hidden="true"
                        />
                      )}
                      <h3 className="text-lg font-semibold">
                        {automation.status === "needs_attention"
                          ? "Needs attention — action required"
                          : automation.status === "active"
                          ? "Automation active"
                          : "Automation paused"}
                      </h3>
                    </div>

                    {automation.attentionMessage ? (
                      <p className="text-sm text-foreground/90">
                        {friendlyAutomationMessage(automation.attentionMessage)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">
                        {automation.status === "active"
                          ? `Preparing and scheduling ${config.counts.dailyTotal} slideshow${
                              config.counts.dailyTotal === 1 ? "" : "s"
                            } daily (${config.counts.educationalTipsCount} Educational Tip${
                              config.counts.educationalTipsCount === 1 ? "" : "s"
                            } · ${config.counts.productStoriesCount} Product Stor${
                              config.counts.productStoriesCount === 1 ? "y" : "ies"
                            }) in ${config.timezone}.`
                          : "New daily slideshows are paused. Resume anytime to continue daily preparation."}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {automation.status === "needs_attention" &&
                    config.backgrounds.mode === "collection_only" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setMediaLibraryOpen(true)}
                        >
                          <Upload className="size-4" aria-hidden="true" />
                          <span>Upload images to collection</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWorkspaceMode("setup");
                            setStep("appearance");
                          }}
                        >
                          Change collection
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void persistDraftConfig({
                              ...config,
                              backgrounds: { mode: "default" },
                            })
                          }
                        >
                          Use generated slideshow as-is
                        </Button>
                      </>
                    ) : null}

                    {automation.status === "paused" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={activating}
                        onClick={() => void handleActivateAutomation()}
                      >
                        <PlayCircle className="size-4" aria-hidden="true" />
                        <span>
                          {activating ? "Resuming…" : "Resume automation"}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPauseDialogOpen(true)}
                      >
                        <PauseCircle className="size-4" aria-hidden="true" />
                        <span>Pause automation</span>
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              {/* Current Configuration Summary Cards */}
              <details
                aria-label="Current configuration summary"
                className="rounded-xl border border-border/80 bg-card p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">View automation settings</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/80 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Daily Content Mix
                  </p>
                  <p className="mt-1.5 text-base font-semibold">
                    {config.counts.dailyTotal} slideshow
                    {config.counts.dailyTotal === 1 ? "" : "s"} / day
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    💡 {config.counts.educationalTipsCount} Educational Tip
                    {config.counts.educationalTipsCount === 1 ? "" : "s"} · 🎯{" "}
                    {config.counts.productStoriesCount} Product Stor
                    {config.counts.productStoriesCount === 1 ? "y" : "ies"}
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Backgrounds
                  </p>
                      <div className="mt-1.5 text-base font-semibold">
                    {config.backgrounds.mode === "collection_only"
                      ? `Collection only: ${
                          config.backgrounds.collectionName ||
                          "No collection selected"
                        }`
                      : "Default backgrounds (As-is)"}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {config.backgrounds.mode === "collection_only"
                      ? `${effectivePreviewAssets.length} usable image${
                          effectivePreviewAssets.length === 1 ? "" : "s"
                        } · Strict collection-only`
                      : "Uses app-generated slideshow backgrounds as-is"}
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Visual Style
                  </p>
                  <p className="mt-1.5 text-base font-semibold">
                    {config.visualStyle.mode === "saved"
                      ? config.visualStyle.styleName
                      : "Default style"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {config.visualStyle.style.font} ·{" "}
                    {config.visualStyle.style.headingSize}px /{" "}
                    {config.visualStyle.style.fontSize}px
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Daily Times & Accounts
                  </p>
                  <p className="mt-1.5 text-base font-semibold">
                    {config.dailySlots
                      .map((slot) => displayScheduleTime(slot.time, hour12))
                      .join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {config.timezone} ·{" "}
                    {config.targets.map((t) => t.accountLabel).join(", ") ||
                      "No accounts selected"}
                  </p>
                </div>
                </div>
              </details>

              {/* Upcoming & Recent Automated Posts */}
              <section
                aria-label="Upcoming and recent automated slideshows"
                className="rounded-2xl border border-border/80 bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">
                      Slideshow activity
                    </h3>
                    <p className="text-xs text-muted">
                      Scheduled posts also appear in your Schedule tab.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadWorkspace()}
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    <span>Refresh</span>
                  </Button>
                </div>

                <div className="mt-4 divide-y divide-border/70">
                  {attentionSlotCount > 0 ? (
                    <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                      {attentionSlotCount} {attentionSlotCount === 1 ? "slideshow needs" : "slideshows need"} attention. Review their status below{slots.length > 3 && !showAllSlots ? " or show all slideshows" : ""}.
                    </p>
                  ) : null}
                  {slots.some((slot) => slot.status === "preparing") && attentionSlotCount === 0 ? (
                    <p
                      data-automation-preparing-reason
                      className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs text-foreground"
                    >
                      Some slideshows are still preparing. Check their status below.
                    </p>
                  ) : null}
                  {slots.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">
                      No automated slots have been prepared yet.
                    </p>
                  ) : (
                    (showAllSlots ? slots : slots.slice(0, 3)).map((slot) => {
                      const meta =
                        TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[slot.format];
                      return (
                        <div
                          key={slot.id}
                          data-automation-slot-row={slot.status}
                          className="flex flex-wrap items-center justify-between gap-4 py-3.5"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">
                                {slot.localDate} ·{" "}
                                {displayScheduleTime(slot.slotTime, hour12)} (
                                {slot.timezone})
                              </span>
                              <span className="rounded-full border border-border bg-card-muted px-2.5 py-0.5 text-xs font-medium">
                                {meta.badge}
                              </span>
                              <SlotStatusBadge status={slot.status} />
                            </div>
                            <p className="text-xs text-muted">
                              {slot.snapshot.headlinePreview} ·{" "}
                              {slot.snapshot.backgroundMode ===
                              "collection_only"
                                ? `Collection: ${slot.snapshot.collectionName} (${slot.snapshot.backgroundAssetIds.length} slides)`
                                : "Default backgrounds"}{" "}
                              · Style: {slot.snapshot.visualStyleName}
                            </p>
                            {slot.holdMessage ? (
                              <p className="text-xs font-medium text-warning">
                                {friendlyAutomationMessage(slot.holdMessage)}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            {(slot.status === "held_collection_empty" ||
                              slot.status === "missed_posting_time" ||
                              slot.status === "action_required_account") && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void handleSlotAction(slot.id, "retry")
                                  }
                                >
                                  Schedule for next window
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    void handleSlotAction(slot.id, "skip")
                                  }
                                >
                                  Skip slot
                                </Button>
                              </>
                            )}
                            {(slot.status === "scheduled" ||
                              slot.status === "preparing") && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  void handleSlotAction(slot.id, "cancel")
                                }
                              >
                                Cancel slot
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {slots.length > 3 ? (
                  <Button type="button" variant="ghost" size="sm" className="mt-3" aria-expanded={showAllSlots} onClick={() => setShowAllSlots((value) => !value)}>
                    {showAllSlots ? "Show fewer slideshows" : `Show all ${slots.length} slideshows`}
                  </Button>
                ) : null}
              </section>
            </div>
          ) : (
            /* ============================================================
               4-STEP GUIDED SETUP WORKSPACE + STICKY LIVE PREVIEW
               ============================================================ */
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* Left column: Guided setup step content */}
              <div className="space-y-6">
                {step === "content" ? (
                  <section
                    data-automation-step="content"
                    aria-label="Step 1: Content and daily count"
                    className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
                  >
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Step 1 of 4 · Content & Daily Count
                      </span>
                      <h3 className="mt-1 text-lg font-semibold">
                        How many slideshows should we schedule each day?
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Choose your daily volume and the exact number of{" "}
                        <strong>Educational Tips</strong> and{" "}
                        <strong>Product Stories</strong> prepared every day.
                      </p>
                    </div>

                    {/* Total slideshows per day selector */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-sm font-medium">
                          Total slideshows scheduled per day
                        </label>
                        <span className="text-xs text-muted">
                          Your {planDisplayName} plan supports up to{" "}
                          {dailyAllowance} automated slideshow
                          {dailyAllowance === 1 ? "" : "s"}/day
                        </span>
                      </div>
                      <div
                        role="group"
                        aria-label="Total slideshows per day"
                        className="grid grid-cols-4 gap-2.5 sm:max-w-md"
                      >
                        {[1, 2, 3, 4].map((count) => {
                          const selected = config.counts.dailyTotal === count;
                          const disabled = count > dailyAllowance;
                          return (
                            <button
                              key={count}
                              type="button"
                              disabled={disabled}
                              aria-pressed={selected}
                              onClick={() => handleDailyTotalChange(count)}
                              className={`flex h-11 items-center justify-center rounded-full border text-sm font-semibold transition-all ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                                  : "border-border bg-card-muted text-foreground hover:border-primary/40"
                              } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                            >
                              {count} / day
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick split tabs */}
                    <div className="space-y-2">
                      <span className="text-sm font-medium">
                        Daily format breakdown
                      </span>
                      <div
                        role="group"
                        aria-label="Quick format mix"
                        className="flex flex-wrap gap-2"
                      >
                        {(
                          [
                            {
                              id: "all_product_stories",
                              label: "All Product Stories",
                            },
                            {
                              id: "all_educational_tips",
                              label: "All Educational Tips",
                            },
                            { id: "custom_mix", label: "Custom Mix" },
                          ] as const
                        ).map((tab) => {
                          const active = config.quickMode === tab.id;
                          return (
                            <Button
                              key={tab.id}
                              type="button"
                              size="sm"
                              variant={active ? "secondary" : "outline"}
                              aria-pressed={active}
                              onClick={() => handleQuickModeSelect(tab.id)}
                            >
                              {tab.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Format cards with exact daily count steppers */}
                    <div className="space-y-3.5">
                      {(
                        [
                          "educational_tips",
                          "product_stories",
                        ] as const satisfies readonly TrendingSlideshowAutomationFormat[]
                      ).map((formatKey) => {
                        const meta =
                          TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[formatKey];
                        const count =
                          formatKey === "educational_tips"
                            ? config.counts.educationalTipsCount
                            : config.counts.productStoriesCount;
                        return (
                          <div
                            key={formatKey}
                            data-automation-format-card={formatKey}
                            className={`rounded-xl border p-4 transition-colors ${
                              count > 0
                                ? "border-primary/40 bg-primary/[0.03]"
                                : "border-border/80 bg-card-muted/40"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="max-w-lg space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold">
                                    {meta.title}
                                  </h4>
                                  <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted">
                                    {meta.subtitle}
                                  </span>
                                </div>
                                <p className="text-sm text-muted">
                                  {meta.description}
                                </p>
                              </div>

                              {/* Exact count stepper */}
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Decrease ${meta.title} daily count`}
                                  disabled={count <= 0}
                                  onClick={() =>
                                    handleStepperDelta(formatKey, -1)
                                  }
                                >
                                  -
                                </Button>
                                <span
                                  data-format-count={formatKey}
                                  className="min-w-[68px] text-center text-sm font-semibold tabular-nums"
                                >
                                  {count} / day
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Increase ${meta.title} daily count`}
                                  disabled={count >= config.counts.dailyTotal}
                                  onClick={() =>
                                    handleStepperDelta(formatKey, 1)
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card-muted/60 px-4 py-3 text-sm">
                      <span>
                        Daily total:{" "}
                        <strong>
                          {config.counts.educationalTipsCount} Educational Tip
                          {config.counts.educationalTipsCount === 1 ? "" : "s"}
                        </strong>{" "}
                        +{" "}
                        <strong>
                          {config.counts.productStoriesCount} Product Stor
                          {config.counts.productStoriesCount === 1
                            ? "y"
                            : "ies"}
                        </strong>{" "}
                        ={" "}
                        <strong className="text-primary">
                          {config.counts.dailyTotal} slideshow
                          {config.counts.dailyTotal === 1 ? "" : "s"} scheduled
                          every day
                        </strong>
                      </span>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        onClick={() => setStep("appearance")}
                        className="gap-1.5"
                      >
                        <span>Continue to Appearance</span>
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </section>
                ) : null}

                {step === "appearance" ? (
                  <section
                    data-automation-step="appearance"
                    aria-label="Step 2: Appearance"
                    className="space-y-6 rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
                  >
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Step 2 of 4 · Appearance
                      </span>
                      <h3 className="mt-1 text-lg font-semibold">
                        Slide Backgrounds & Saved Visual Style
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Choose where slide backgrounds come from and customize
                        how your text overlays look across every slide.
                      </p>
                    </div>

                    {/* Background Sourcing */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">
                        1. Slide Backgrounds
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label
                          className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                            config.backgrounds.mode === "default"
                              ? "border-primary bg-primary/[0.05]"
                              : "border-border bg-card-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold">
                            <input
                              type="radio"
                              name="automation-bg-mode"
                              checked={config.backgrounds.mode === "default"}
                              onChange={() =>
                                void persistDraftConfig({
                                  ...config,
                                  backgrounds: { mode: "default" },
                                })
                              }
                            />
                            <span>
                              Default backgrounds (Use generated slideshow as-is)
                            </span>
                          </div>
                          <span className="pl-6 text-xs text-muted">
                            Keep the slide backgrounds generated by the app
                            as-is without changing them. No library upload or
                            collection needed.
                          </span>
                        </label>

                        <label
                          className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                            config.backgrounds.mode === "collection_only"
                              ? "border-primary bg-primary/[0.05]"
                              : "border-border bg-card-muted/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="automation-bg-mode"
                                checked={
                                  config.backgrounds.mode === "collection_only"
                                }
                                onChange={() => {
                                  const firstCollection = collections[0];
                                  void persistDraftConfig({
                                    ...config,
                                    backgrounds: {
                                      collectionId: firstCollection?.id ?? "",
                                      collectionName:
                                        firstCollection?.name ?? "",
                                      mode: "collection_only",
                                      selectedAssetIds:
                                        firstCollection?.assets.map(
                                          (a) => a.id,
                                        ) ?? [],
                                      selectionMode: "all",
                                    },
                                  });
                                }}
                              />
                              <span>Use my collection only (Optional)</span>
                            </span>
                            {collections.length === 0 ? (
                              <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                                No collections yet
                              </span>
                            ) : (
                              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted">
                                {collections.length} collection
                                {collections.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          <span className="pl-6 text-xs text-muted">
                            Optional: if enabled, every slide background comes
                            strictly from your chosen Media library collection.
                            Never substitutes stock or AI images.
                            {" "}Product Stories CTA slides use your uploaded app screenshot when available.
                          </span>
                        </label>
                      </div>

                      {config.backgrounds.mode === "collection_only" ? (
                        <div
                          data-collection-only-panel
                          className="space-y-4 rounded-xl border border-border bg-card-muted/50 p-4"
                        >
                          {collections.length === 0 ? (
                            <div
                              role="alert"
                              data-empty-collections-state
                              className="space-y-3 rounded-xl border border-warning/45 bg-warning/10 p-4"
                            >
                              <div className="flex items-start gap-2.5">
                                <AlertTriangle
                                  className="mt-0.5 size-4 shrink-0 text-warning"
                                  aria-hidden="true"
                                />
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    You don&apos;t have any image collections in
                                    your Media library yet
                                  </p>
                                  <p className="text-xs text-muted">
                                    To use collection-only backgrounds, create a
                                    collection and upload your images in the
                                    Media library—or switch back to{" "}
                                    <strong>
                                      Default backgrounds (Use generated
                                      slideshow as-is)
                                    </strong>{" "}
                                    to run automation without uploading a
                                    library.
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pl-6">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setMediaLibraryOpen(true)}
                                >
                                  <Upload
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                  <span>Create collection & upload images</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void persistDraftConfig({
                                      ...config,
                                      backgrounds: { mode: "default" },
                                    })
                                  }
                                >
                                  <span>Use generated slideshow as-is</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">
                                    {activeCollection
                                      ? `${activeCollection.name} · ${activeCollection.usableCount} usable image${
                                          activeCollection.usableCount === 1
                                            ? ""
                                            : "s"
                                        }`
                                      : "No collection selected yet"}
                                  </p>
                                  <p className="text-xs text-muted">
                                    All slide text renders directly over your
                                    collection images.
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setCollectionPickerOpen(true)
                                    }
                                  >
                                    <FolderOpen
                                      className="size-4"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {activeCollection
                                        ? "Change collection"
                                        : "Choose collection"}
                                    </span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setMediaLibraryOpen(true)}
                                  >
                                    <Images
                                      className="size-4"
                                      aria-hidden="true"
                                    />
                                    <span>Manage library</span>
                                  </Button>
                                </div>
                              </div>

                              {activeCollection ? (
                                <>
                                  <div className="flex flex-wrap items-center gap-3 text-xs">
                                    <label className="inline-flex items-center gap-1.5 font-medium">
                                      <input
                                        type="radio"
                                        name="collection-subset-mode"
                                        checked={
                                          config.backgrounds.selectionMode ===
                                          "all"
                                        }
                                        onChange={() =>
                                          void persistDraftConfig({
                                            ...config,
                                            backgrounds:
                                              config.backgrounds.mode ===
                                              "collection_only"
                                                ? {
                                                    ...config.backgrounds,
                                                    selectedAssetIds:
                                                      activeCollection.assets.map(
                                                        (a) => a.id,
                                                      ),
                                                    selectionMode: "all",
                                                  }
                                                : config.backgrounds,
                                          })
                                        }
                                      />
                                      <span>
                                        Use all images in collection (
                                        {activeCollection.usableCount}) — new
                                        uploads automatically join rotation
                                      </span>
                                    </label>

                                    <label className="inline-flex items-center gap-1.5 font-medium">
                                      <input
                                        type="radio"
                                        name="collection-subset-mode"
                                        checked={
                                          config.backgrounds.selectionMode ===
                                          "subset"
                                        }
                                        onChange={() =>
                                          void persistDraftConfig({
                                            ...config,
                                            backgrounds:
                                              config.backgrounds.mode ===
                                              "collection_only"
                                                ? {
                                                    ...config.backgrounds,
                                                    selectedAssetIds: config.backgrounds.selectionMode === "all"
                                                      ? activeCollection.assets.map((asset) => asset.id)
                                                      : config.backgrounds.selectedAssetIds,
                                                    selectionMode: "subset",
                                                  }
                                                : config.backgrounds,
                                          })
                                        }
                                      />
                                      <span>
                                        Selected subset only (
                                        {
                                          config.backgrounds.selectedAssetIds
                                            .length
                                        }{" "}
                                        selected)
                                      </span>
                                    </label>
                                  </div>

                                  {activeCollection.assets.length > 0 ? (
                                    <div aria-label="Collection images" role="region" tabIndex={0} className="grid max-h-[32rem] grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
                                      {activeCollection.assets.map((asset) => {
                                        const checked =
                                          config.backgrounds.mode ===
                                            "collection_only" &&
                                          (config.backgrounds.selectionMode ===
                                            "all" ||
                                            config.backgrounds.selectedAssetIds.includes(
                                              asset.id,
                                            ));
                                        return (
                                          <button
                                            key={asset.id}
                                            type="button"
                                            onClick={() =>
                                              handleToggleSubsetAsset(asset.id)
                                            }
                                            aria-pressed={checked}
                                            className={`group relative aspect-[4/5] overflow-hidden rounded-lg border transition-all ${
                                              checked
                                                ? "border-primary ring-2 ring-primary/35"
                                                : "border-border opacity-55 hover:opacity-90"
                                            }`}
                                          >
                                            <img
                                              src={asset.thumbnailUrl}
                                              alt={asset.title}
                                              className="size-full object-cover"
                                              loading="lazy"
                                            />
                                            {checked ? (
                                              <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                                                <Check className="size-3" />
                                              </span>
                                            ) : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div
                                      role="alert"
                                      className="space-y-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
                                    >
                                      <p>
                                        This collection currently has 0 usable
                                        images. Upload images to this collection
                                        or switch back to{" "}
                                        <strong>
                                          Default backgrounds (Use generated
                                          slideshow as-is)
                                        </strong>{" "}
                                        before activating.
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() =>
                                            setMediaLibraryOpen(true)
                                          }
                                        >
                                          <Upload
                                            className="size-4"
                                            aria-hidden="true"
                                          />
                                          <span>
                                            Upload images to collection
                                          </span>
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            void persistDraftConfig({
                                              ...config,
                                              backgrounds: { mode: "default" },
                                            })
                                          }
                                        >
                                          <span>
                                            Use generated slideshow as-is
                                          </span>
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {effectivePreviewAssets.length > 0 &&
                                  effectivePreviewAssets.length < 6 ? (
                                    <p className="text-xs text-muted">
                                      Note: Your selection has{" "}
                                      {effectivePreviewAssets.length} image
                                      {effectivePreviewAssets.length === 1
                                        ? ""
                                        : "s"}
                                      . Standard slideshows have 6 slides, so
                                      images will repeat in order.
                                    </p>
                                  ) : null}
                                </>
                              ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs">
                                  <span>
                                    Select one of your {collections.length}{" "}
                                    Media library collection
                                    {collections.length === 1 ? "" : "s"} or
                                    create a new one.
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setCollectionPickerOpen(true)
                                    }
                                  >
                                    Choose collection
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {/* Visual Style Presets & Customize Drawer */}
                    <div className="space-y-3 border-t border-border/70 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">
                            2. Visual Style (Font, Size, Colors & Placement)
                          </h4>
                          <p className="text-xs text-muted">
                            Controls slide typography and text boxes while
                            Educational Tips / Product Stories control the copy
                            format.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCustomizingStyle((prev) => !prev)}
                        >
                          {customizingStyle
                            ? "Hide customizer"
                            : "Customize style…"}
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            config.visualStyle.mode === "default"
                              ? "secondary"
                              : "outline"
                          }
                          onClick={() =>
                            void persistDraftConfig({
                              ...config,
                              visualStyle: {
                                mode: "default",
                                style: defaultCarouselManualTextStyle(),
                                textPosition: { x: 0.5, y: 0.5 },
                              },
                            })
                          }
                        >
                          Default style
                        </Button>

                        {savedStyles.map((preset) => {
                          const selected =
                            config.visualStyle.mode === "saved" &&
                            config.visualStyle.styleId === preset.id;
                          return (
                            <div
                              key={preset.id}
                              className="inline-flex items-center gap-1"
                            >
                              <Button
                                type="button"
                                size="sm"
                                variant={selected ? "secondary" : "outline"}
                                onClick={() =>
                                  void persistDraftConfig({
                                    ...config,
                                    visualStyle: {
                                      mode: "saved",
                                      style: preset.style,
                                      styleId: preset.id,
                                      styleName: preset.name,
                                      textPosition: preset.textPosition,
                                    },
                                  })
                                }
                              >
                                {preset.name}
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Delete saved style ${preset.name}`}
                                onClick={() =>
                                  void handleDeleteSavedStyle(preset.id)
                                }
                              >
                                <Trash2 className="size-3.5 text-muted hover:text-error" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>

                      {customizingStyle ? (
                        <div className="space-y-4 rounded-xl border border-border bg-card-muted/40 p-4">
                          <CarouselTextControls
                            slide={currentPreviewSlide}
                            onChange={handleSlideAppearanceChange}
                          />

                          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                            <input
                              type="text"
                              aria-label="New visual style preset name"
                              placeholder="Style name (e.g., Clean Brand Serif)…"
                              value={newStyleName}
                              maxLength={60}
                              onChange={(event) =>
                                setNewStyleName(event.target.value)
                              }
                              className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 text-sm"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                savingStylePreset || !newStyleName.trim()
                              }
                              onClick={() => void handleSaveVisualStylePreset()}
                            >
                              <Plus className="size-4" aria-hidden="true" />
                              <span>
                                {savingStylePreset
                                  ? "Saving style…"
                                  : "Save as new style"}
                              </span>
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep("content")}
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setStep("posting")}
                        className="gap-1.5"
                      >
                        <span>Continue to Posting</span>
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </section>
                ) : null}

                {step === "posting" ? (
                  <section
                    data-automation-step="posting"
                    aria-label="Step 3: Posting rules"
                    className="space-y-6 rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
                  >
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Step 3 of 4 · Posting Rules
                      </span>
                      <h3 className="mt-1 text-lg font-semibold">
                        Destination Accounts & Daily Schedule
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Choose where your daily slideshows publish and set the
                        exact posting time for each daily slot.
                      </p>
                    </div>

                    {/* Destination accounts */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">
                        1. Destination Accounts
                      </h4>
                      {connections.filter(
                        (c) =>
                          (c.platform === "instagram" ||
                            c.platform === "tiktok") &&
                          c.status === "connected",
                      ).length === 0 ? (
                        <div className="rounded-xl border border-border bg-card-muted/50 p-4 text-sm text-muted">
                          No connected Instagram or TikTok accounts found.
                          Connect an Instagram or TikTok account in Settings or
                          Schedule before activating automation.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {connections
                            .filter(
                              (c) =>
                                c.platform === "instagram" ||
                                c.platform === "tiktok",
                            )
                            .map((conn) => {
                              const selectedTarget = config.targets.find(
                                (t) => t.connectionId === conn.id,
                              );
                              const label = conn.platformAccountUsername
                                ? `@${conn.platformAccountUsername.replace(/^@/, "")}`
                                : conn.platformAccountName || conn.platform;
                              return (
                                <div
                                  key={conn.id}
                                  className={`rounded-xl border p-3.5 transition-colors ${
                                    selectedTarget
                                      ? "border-primary/45 bg-primary/[0.04]"
                                      : "border-border bg-card-muted/30"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(selectedTarget)}
                                        disabled={conn.status !== "connected"}
                                        onChange={() =>
                                          handleToggleTargetConnection(conn)
                                        }
                                      />
                                      <span className="capitalize">
                                        {conn.platform}
                                      </span>
                                      <span>· {label}</span>
                                    </label>
                                    <span className="text-xs text-muted">
                                      {conn.status === "connected"
                                        ? "Connected · Photo carousel supported"
                                        : "Reconnect required"}
                                    </span>
                                  </div>

                                </div>
                              );
                            })}
                        </div>
                      )}
                      <p className="text-xs text-muted">
                        TikTok visibility and AI-content disclosure follow your
                        publishing settings in Settings.
                      </p>
                    </div>

                    {/* Daily Posting Times synced with Step 1 */}
                    <div className="space-y-3 border-t border-border/70 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">
                            2. Daily Posting Times ({config.counts.dailyTotal}{" "}
                            per day from Step 1)
                          </h4>
                          <p className="text-xs text-muted">
                            Each daily slot is matched to your chosen format
                            counts ({config.counts.educationalTipsCount}{" "}
                            Educational Tip
                            {config.counts.educationalTipsCount === 1 ? "" : "s"}
                            , {config.counts.productStoriesCount} Product Stor
                            {config.counts.productStoriesCount === 1
                              ? "y"
                              : "ies"}
                            ).
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {config.dailySlots.map((slot) => {
                          const meta =
                            TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[
                              slot.format
                            ];
                          return (
                            <div
                              key={slot.slotIndex}
                              data-automation-time-slot={slot.slotIndex}
                              className="grid items-center gap-3 rounded-xl border border-border bg-card-muted/40 p-3 sm:grid-cols-[120px_1fr_200px]"
                            >
                              <span className="text-sm font-semibold">
                                Post {slot.slotIndex}
                              </span>
                              <span className="inline-flex w-fit items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
                                {meta.badge}
                              </span>
                              <WorkflowTimePicker
                                id={`automation-slot-time-${slot.slotIndex}`}
                                value={slot.time}
                                onChange={(nextTime) =>
                                  handleSlotTimeChange(slot.slotIndex, nextTime)
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Timezone, Start Date & Caption */}
                    <div className="grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-3">
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Timezone</span>
                        <select
                          aria-label="Automation timezone"
                          value={config.timezone}
                          onChange={(event) =>
                            void persistDraftConfig({
                              ...config,
                              timezone: event.target.value,
                            })
                          }
                          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                        >
                          {Array.from(
                            new Set([config.timezone, ...COMMON_TIMEZONES]),
                          ).map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Start date</span>
                        <input
                          type="date"
                          aria-label="Automation start date"
                          value={config.startDate}
                          onChange={(event) =>
                            void persistDraftConfig({
                              ...config,
                              startDate: event.target.value,
                            })
                          }
                          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                        />
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Post caption</span>
                        <select
                          aria-label="Post caption source"
                          value={
                            config.caption.mode === "saved_caption"
                              ? `saved:${config.caption.captionId}`
                              : config.caption.mode
                          }
                          onChange={(event) => {
                            const val = event.target.value;
                            if (val === "generated") {
                              void persistDraftConfig({
                                ...config,
                                caption: { mode: "generated" },
                              });
                            } else if (val === "blank") {
                              void persistDraftConfig({
                                ...config,
                                caption: { mode: "blank" },
                              });
                            } else if (val.startsWith("saved:")) {
                              const id = val.slice("saved:".length);
                              const match = savedCaptions.find(
                                (c) => c.id === id,
                              );
                              if (match) {
                                void persistDraftConfig({
                                  ...config,
                                  caption: {
                                    captionId: match.id,
                                    captionName: match.text.slice(0, 32),
                                    captionText: match.text,
                                    mode: "saved_caption",
                                  },
                                });
                              }
                            }
                          }}
                          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                        >
                          <option value="generated">
                            Use generated slide caption (Default)
                          </option>
                          <option value="blank">Leave caption blank</option>
                          {savedCaptions.map((cap) => (
                            <option key={cap.id} value={`saved:${cap.id}`}>
                              Saved: {cap.text.slice(0, 36)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep("appearance")}
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setStep("review")}
                        className="gap-1.5"
                      >
                        <span>Review Setup</span>
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </section>
                ) : null}

                {step === "review" ? (
                  <section
                    data-automation-step="review"
                    aria-label="Step 4: Review and activate"
                    className="space-y-6 rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
                  >
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Step 4 of 4 · Review & Activate
                      </span>
                      <h3 className="mt-1 text-lg font-semibold">
                        Review Your Daily Slideshow Automation
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Nothing is scheduled until you click{" "}
                        <strong>Activate automation</strong> below. Once active,
                        slideshows prepare and schedule automatically even when
                        your browser is closed.
                      </p>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-3">
                      <div className="rounded-xl border border-border bg-card-muted/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-muted">
                            1. Content
                          </span>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setStep("content")}
                          >
                            Edit
                          </Button>
                        </div>
                        <p className="mt-1 text-sm font-semibold">
                          {config.counts.dailyTotal} slideshow
                          {config.counts.dailyTotal === 1 ? "" : "s"} / day
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          💡 {config.counts.educationalTipsCount} Educational
                          Tip
                          {config.counts.educationalTipsCount === 1
                            ? ""
                            : "s"}{" "}
                          · 🎯 {config.counts.productStoriesCount} Product Stor
                          {config.counts.productStoriesCount === 1
                            ? "y"
                            : "ies"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border bg-card-muted/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-muted">
                            2. Appearance
                          </span>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setStep("appearance")}
                          >
                            Edit
                          </Button>
                        </div>
                        <p className="mt-1 text-sm font-semibold">
                          {config.backgrounds.mode === "collection_only"
                            ? `Collection: ${
                                config.backgrounds.collectionName ||
                                "No collection selected"
                              }`
                            : "Default backgrounds (Generated as-is)"}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Style:{" "}
                          {config.visualStyle.mode === "saved"
                            ? config.visualStyle.styleName
                            : "Default style"}{" "}
                          ({config.visualStyle.style.font})
                        </p>
                      </div>

                      <div className="rounded-xl border border-border bg-card-muted/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-muted">
                            3. Posting & Plan
                          </span>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setStep("posting")}
                          >
                            Edit
                          </Button>
                        </div>
                        <p className="mt-1 text-sm font-semibold">
                          {config.dailySlots
                            .map((s) => displayScheduleTime(s.time, hour12))
                            .join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {config.timezone} · Uses {config.counts.dailyTotal} of{" "}
                          {dailyAllowance}/day ({planDisplayName})
                        </p>
                      </div>
                    </div>

                    {/* Upcoming posting schedule preview */}
                    <div className="rounded-xl border border-border bg-card-muted/30 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span>Next Posting Windows After Activation</span>
                      </div>
                      <ul className="mt-3 space-y-2 text-xs">
                        {upcomingPreviewOccurrences.slice(0, 6).map((occ) => (
                          <li
                            key={occ.idempotencyKey}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
                          >
                            <span className="font-medium">
                              {occ.localDate} at{" "}
                              {displayScheduleTime(occ.slotTime, hour12)} (
                              {config.timezone})
                            </span>
                            <span className="text-muted">
                              {
                                TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[
                                  occ.format
                                ].badge
                              }
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {config.targets.some((t) => t.platform === "tiktok") ? (
                      <p className="text-xs text-muted">
                        By activating, you agree to TikTok&apos;s Music Usage
                        Confirmation for automatically published TikTok posts.
                        Visibility follows your Settings.
                      </p>
                    ) : null}

                    {!activationCheck.ok ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-warning/45 bg-warning/10 p-3.5 text-xs font-medium text-warning"
                      >
                        {activationCheck.message}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep("posting")}
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                        <span>Back</span>
                      </Button>

                      <Button
                        type="button"
                        data-activate-slideshow-automation
                        disabled={activating || !activationCheck.ok}
                        onClick={() => void handleActivateAutomation()}
                        className="gap-2"
                      >
                        <Sparkles className="size-4" aria-hidden="true" />
                        <span>
                          {activating
                            ? "Activating automation…"
                            : "Activate automation"}
                        </span>
                      </Button>
                    </div>
                  </section>
                ) : null}
              </div>

              {/* Right column: Sticky Example Preview */}
              <aside
                aria-label="Example slideshow preview"
                className="space-y-3 lg:sticky lg:top-4 lg:self-start"
              >
                <div className="rounded-2xl border border-border/80 bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      Example preview
                    </span>
                    <span className="text-xs text-muted">
                      Slide {currentPreviewSlide.slideNumber} of{" "}
                      {previewSlides.length}
                    </span>
                  </div>

                  {/* Format toggle in preview */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg bg-card-muted p-1">
                    {(
                      ["educational_tips", "product_stories"] as const
                    ).map((fmt) => {
                      const active = previewFormat === fmt;
                      const meta =
                        TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[fmt];
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => {
                            setPreviewFormat(fmt);
                            setPreviewSlideIndex(0);
                          }}
                          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          {meta.title}
                        </button>
                      );
                    })}
                  </div>

                  {/* Cover / Body slide quick pills */}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          previewSlideIndex === 0 ? "secondary" : "outline"
                        }
                        onClick={() => setPreviewSlideIndex(0)}
                      >
                        Cover slide (1)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          previewSlideIndex > 0 ? "secondary" : "outline"
                        }
                        onClick={() =>
                          setPreviewSlideIndex((prev) =>
                            prev === 0 ? 1 : prev,
                          )
                        }
                      >
                        Body slide ({previewSlideIndex === 0 ? 2 : previewSlideIndex + 1})
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Previous preview slide"
                        disabled={previewSlideIndex === 0}
                        onClick={() =>
                          setPreviewSlideIndex((prev) => Math.max(0, prev - 1))
                        }
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Next preview slide"
                        disabled={previewSlideIndex >= previewSlides.length - 1}
                        onClick={() =>
                          setPreviewSlideIndex((prev) =>
                            Math.min(previewSlides.length - 1, prev + 1),
                          )
                        }
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 4:5 Slide Canvas with Live Manual Text SVG */}
                  <div
                    data-automation-preview-canvas
                    style={{ containerType: "inline-size" }}
                    className="relative mt-3 aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-neutral-900"
                  >
                    {currentPreviewSlide.backgroundUrl ? (
                      <img
                        src={currentPreviewSlide.backgroundUrl}
                        alt="Selected collection slide background"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4" />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-black/25" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <CarouselManualText slide={currentPreviewSlide} />
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-muted">
                    {config.backgrounds.mode === "collection_only"
                      ? activeCollection
                        ? `Backgrounds from "${activeCollection.name}" (${effectivePreviewAssets.length} active)`
                        : "Select a collection in Step 2 to preview your own backgrounds"
                      : "Default category & product backgrounds"}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>

      {/* Collection Picker Dialog */}
      {collectionPickerOpen ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setCollectionPickerOpen(false);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Choose an image collection</DialogTitle>
              <DialogDescription>
                When collection-only mode is enabled, every automated slideshow
                background comes from this collection, except Product Stories CTA
                slides, which use your uploaded app screenshot when available.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[340px] space-y-2 overflow-y-auto py-2">
              {collections.length === 0 ? (
                <div className="rounded-xl border border-border bg-card-muted/50 p-4 text-center text-sm text-muted">
                  You don’t have any image collections yet. Open{" "}
                  <strong>Manage library</strong> to create a collection and
                  upload images.
                </div>
              ) : (
                collections.map((col) => {
                  const isCurrent =
                    config.backgrounds.mode === "collection_only" &&
                    config.backgrounds.collectionId === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleSelectCollection(col)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        isCurrent
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{col.name}</p>
                        <p className="text-xs text-muted">
                          {col.usableCount} usable image
                          {col.usableCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        {isCurrent ? "Selected" : "Use collection"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCollectionPickerOpen(false);
                  setMediaLibraryOpen(true);
                }}
              >
                Manage library & collections
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCollectionPickerOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Full Media Library Dialog (reuses existing MediaLibraryPanel) */}
      {mediaLibraryOpen ? (
        <Dialog
          open
          onOpenChange={(nextOpen: boolean) => {
            if (mediaLibraryBusy) return;
            setMediaLibraryOpen(nextOpen);
            if (!nextOpen) {
              void fetchSlideshowAutomationState(detectedTimezone)
                .then((state) => setCollections(state.collections))
                .catch(() => setActionError("Could not refresh your image collections. Close and reopen automation to retry."));
            }
          }}
        >
          <DialogContent showCloseButton={!mediaLibraryBusy} className="max-h-[90dvh] max-w-4xl overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Media library</DialogTitle>
              <DialogDescription>
                Manage images and background collections for reuse.
              </DialogDescription>
            </DialogHeader>
            <MediaLibraryPanel key={userId} initialTab="images" onBusyChange={setMediaLibraryBusy} />
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Pause Automation Confirmation Dialog */}
      {pauseDialogOpen ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !pausing) setPauseDialogOpen(false);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pause slideshow automation?</DialogTitle>
              <DialogDescription>
                Choose how to handle any upcoming automated slideshows that have
                already been prepared. Posts you manually edited in Schedule are
                always kept.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 py-2 text-sm">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3">
                <input
                  type="radio"
                  name="pause-upcoming-action"
                  checked={pauseAction === "cancel_upcoming_auto_slots"}
                  onChange={() =>
                    setPauseAction("cancel_upcoming_auto_slots")
                  }
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    Pause and cancel upcoming unedited auto-scheduled posts
                    (Recommended)
                  </p>
                  <p className="text-xs text-muted">
                    Stops future daily preparation and cancels any unedited
                    automated slots that haven’t published yet.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3">
                <input
                  type="radio"
                  name="pause-upcoming-action"
                  checked={pauseAction === "keep_scheduled_slots"}
                  onChange={() => setPauseAction("keep_scheduled_slots")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    Pause future preparation only; keep already-scheduled posts
                  </p>
                  <p className="text-xs text-muted">
                    Already-scheduled slots will still publish at their
                    scheduled time.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={pausing}
                onClick={() => setPauseDialogOpen(false)}
              >
                Keep active
              </Button>
              <Button
                type="button"
                disabled={pausing}
                onClick={() => void handleConfirmPause()}
              >
                {pausing ? "Pausing…" : "Pause automation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function friendlyAutomationMessage(message: string) {
  if (/could not load the ["']sharp["'] module/i.test(message)) {
    return "Image processing is unavailable. Check this slideshow's status and try again later.";
  }
  return message;
}

function SlotStatusBadge({
  status,
}: {
  status: TrendingSlideshowAutomationSlotRecord["status"];
}) {
  const map: Record<
    TrendingSlideshowAutomationSlotRecord["status"],
    { className: string; icon: typeof Check; label: string }
  > = {
    action_required_account: {
      className: "border-warning/40 bg-warning/15 text-warning",
      icon: AlertTriangle,
      label: "Needs account action",
    },
    cancelled_by_user: {
      className: "border-border bg-card-muted text-muted",
      icon: X,
      label: "Cancelled",
    },
    held_collection_empty: {
      className: "border-warning/40 bg-warning/15 text-warning",
      icon: AlertTriangle,
      label: "Held · Collection empty",
    },
    missed_posting_time: {
      className: "border-warning/40 bg-warning/15 text-warning",
      icon: Clock3,
      label: "Held · Missed posting time",
    },
    partially_published: {
      className: "border-warning/40 bg-warning/15 text-warning",
      icon: AlertTriangle,
      label: "Partially published",
    },
    preparing: {
      className: "border-primary/35 bg-primary/10 text-primary",
      icon: Layers,
      label: "Preparing",
    },
    published: {
      className: "border-success/35 bg-success/10 text-success",
      icon: CheckCircle2,
      label: "Published",
    },
    scheduled: {
      className: "border-primary/35 bg-primary/10 text-primary",
      icon: CalendarClock,
      label: "Scheduled",
    },
  };

  const item = map[status];
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.className}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}
