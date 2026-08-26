import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { listMediaAssets } from "@/lib/media/media-storage";
import {
  createAuthoritativeWallTextContent,
  deriveWallTextSpatialBudget,
} from "@/lib/trending/wall-layout-engine";
import { getBackfillWallTextFormatId } from "@/lib/trending/wall-formats";
import { WALL_TEXT_PROMPT_VERSION } from "@/lib/trending/wall-prompt";
import {
  generateBusinessTrendingWallTextIdeas,
  getTrendingWallTextModelName,
  WallTextCandidateRepairExhaustedError,
} from "@/lib/trending/generate-trending-wall-text-ideas";
import {
  areTrendingWallTextCreativesCurrent,
  claimWallTextGenerationChunk,
  ensureWallTextOverlayAssetsForMediaAssets,
  ensureTrendingWallTextAssignments,
  getWallTextGenerationReservation,
  getWallTextPrivateCreativeContexts,
  isTrendingWallTextCreativeCurrent,
  listActiveWallTextInstagramReelTemplates,
  listActiveTrendingWallTextIdeas,
  listRecentWallTextBackgroundAssetIds,
  listTrendingWallTextCreatives,
  listWallTextDuplicateSignatures,
  listWallTextOverlayAssetsByIds,
  listWallTextOverlayAssetsForMediaAssetIds,
  listWallTextVideoAssetInventory,
  parseWallTextContent,
  parseWallTextLayout,
  recordWallTextGenerationChunkFailure,
  replaceTrendingWallTextCreativeCopy,
  reserveWallTextGenerationBatch,
  saveWallTextGenerationCandidate,
  type WallTextCreativeRow,
} from "@/lib/trending/wall-text-db";
import {
  WALL_TEXT_FREEFORM_FORMAT_LIBRARY_VERSION,
  WALL_TEXT_FREEFORM_SELECTOR_VERSION,
  WALL_TEXT_GENERATOR_VERSION,
} from "@/lib/trending/wall-text-types";
import {
  createUnavailableTrendingFeedProvider,
  createWallTextTrendingFeedProvider,
  type TrendingFeedProviderResult,
  type TrendingWallTextFeedItem,
  type TrendingWallTextSourceRecord,
} from "@/lib/trending/feed-items";
import {
  createWallTextLayout,
  selectTrendingWallTextCandidates,
} from "@/lib/trending/wall-text-feed-logic";
import { getWallTextPreviewTitle } from "@/lib/trending/wall-text-text-logic";
import { resolveTrendingVideoSource } from "@/lib/trending/video-source-selection";
import { enqueueTrendingWallTextJob } from "@/lib/trending/wall-text-jobs";
import { selectWallTextGenerationSources } from "@/lib/trending/wall-text-source-selector";

const DEFAULT_WALL_TEXT_ACTIVE_TARGET = 6;

export async function enqueueTrendingWallTextRefill(
  profile: BusinessProfileRecord,
  options: { targetActive?: number } = {},
) {
  const targetActive = Math.max(
    Math.trunc(options.targetActive ?? DEFAULT_WALL_TEXT_ACTIVE_TARGET),
    1,
  );
  const source = await resolveTrendingVideoSource({
    format: "wall_text",
    userId: profile.userId,
  });
  const selectedInventory = source.selection
    ? await listWallTextOverlayAssetsForMediaAssetIds({
        mediaAssetIds: source.assets.map((asset) => asset.id),
        userId: profile.userId,
      })
    : null;
  const backgroundAssetIds = selectedInventory?.map((asset) => asset.id);
  const [active, existing, fullInventory, instagramTemplates] = await Promise.all([
    listActiveTrendingWallTextIdeas({
      backgroundAssetIds,
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      userId: profile.userId,
    }),
    listTrendingWallTextCreatives({
      backgroundAssetIds,
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      userId: profile.userId,
    }),
    selectedInventory
      ? Promise.resolve(selectedInventory)
      : listWallTextVideoAssetInventory(),
    source.selection
      ? Promise.resolve([])
      : listActiveWallTextInstagramReelTemplates(),
  ]);

  if (active.length >= targetActive) {
    return {
      activeCount: active.length,
      status: "ready" as const,
    };
  }

  const usedBackgroundAssetIds = new Set(
    existing.map((creative) => creative.overlay_media_asset_id),
  );
  const hasUnusedBackground =
    fullInventory.some((asset) => !usedBackgroundAssetIds.has(asset.id)) ||
    instagramTemplates.some(
      (template) => !usedBackgroundAssetIds.has(template.asset.id),
    );

  const needsTypographyRefresh = existing.some(
    (creative) => !isTrendingWallTextCreativeCurrent(creative),
  );
  const job = await enqueueTrendingWallTextJob({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    profile,
    ...(needsTypographyRefresh ? {} : { refillKey: String(existing.length) }),
    requestedCount: Math.max(targetActive - active.length, 1),
    userId: profile.userId,
  });

  return {
    activeCount: active.length,
    jobId: job.id,
    rotatedLibrary: !hasUnusedBackground,
    status: job.status === "completed" ? ("ready" as const) : ("scheduled" as const),
  };
}

export async function prepareTrendingWallTextIdeas(
  profile: BusinessProfileRecord,
  options: {
    mode?: "initial" | "refill";
    requestedCount?: number;
    requestKey?: string;
  } = {},
) {
  let mode = options.mode ?? "initial";
  const requestedCount = Math.min(
    Math.max(Math.trunc(options.requestedCount ?? DEFAULT_WALL_TEXT_ACTIVE_TARGET), 1),
    50,
  );
  const existingReservation = options.requestKey
    ? await getWallTextGenerationReservation({
        requestKey: options.requestKey,
        userId: profile.userId,
      })
    : null;
  if (existingReservation) {
    if (
      existingReservation.batch.business_profile_id !== profile.id ||
      existingReservation.batch.business_profile_version !== profile.profileVersion ||
      existingReservation.batch.requested_count !== requestedCount
    ) {
      throw new TrendingWallTextPreparationError(
        "This Wall-of-text request no longer matches the current Business Profile.",
        409,
      );
    }
    const historicalSignatures = await listWallTextDuplicateSignatures({
      businessProfileId: profile.id,
      userId: profile.userId,
    });
    return completeReservedWallTextGeneration({
      historicalSignatures,
      profile,
      requestKey: options.requestKey!,
      reservation: existingReservation,
    });
  }
  const source = await resolveTrendingVideoSource({
    format: "wall_text",
    userId: profile.userId,
  });
  const selectedInventory = source.selection
    ? await ensureWallTextOverlayAssetsForMediaAssets({
        assets: source.assets,
        userId: profile.userId,
      })
    : null;
  const selectedBackgroundAssetIds = selectedInventory?.map(
    (asset) => asset.id,
  );
  const existing = await listTrendingWallTextCreatives({
    backgroundAssetIds: selectedBackgroundAssetIds,
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    userId: profile.userId,
  });

  if (mode === "initial" && existing.length > 0) {
    const active = await listActiveTrendingWallTextIdeas({
      backgroundAssetIds: selectedBackgroundAssetIds,
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      userId: profile.userId,
    });

    if (active.length === 0 && areTrendingWallTextCreativesCurrent(existing)) {
      // Assignment upserts intentionally never reactivate rejected creatives.
      // Existing accounts that consumed their first batch therefore need a
      // new batch from unused backgrounds.
      mode = "refill";
    }
  }

  if (
    mode === "initial" &&
    areTrendingWallTextCreativesCurrent(existing)
  ) {
    return ensureTrendingWallTextAssignments({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      creatives: existing,
      userId: profile.userId,
    });
  }

  if (
    mode === "initial" &&
    existing.length > 0
  ) {
    const inventory =
      selectedInventory ?? (await listWallTextVideoAssetInventory());

    return backfillExistingTrendingWallTextIdeas(
      profile,
      existing,
      inventory,
    );
  }

  const [fullInventory, recentBackgrounds, activeInstagramTemplates] = await Promise.all([
    selectedInventory ?? listWallTextVideoAssetInventory(),
    listRecentWallTextBackgroundAssetIds({ userId: profile.userId }),
    source.selection
      ? Promise.resolve([])
      : listActiveWallTextInstagramReelTemplates(),
  ]);
  const existingBackgroundAssetIds = new Set(
    existing.map((creative) => creative.overlay_media_asset_id),
  );
  const unusedInventory =
    mode === "refill"
      ? fullInventory.filter(
          (asset) => !existingBackgroundAssetIds.has(asset.id),
        )
      : fullInventory;
  const inventory = unusedInventory.length > 0 ? unusedInventory : fullInventory;
  const groupFreshInventory = inventory.filter(
    (asset) =>
      !recentBackgrounds.assetIds.has(asset.id) &&
      !recentBackgrounds.visualGroups.has(asset.visualGroup ?? ""),
  );
  const assetFreshInventory = inventory.filter(
    (asset) => !recentBackgrounds.assetIds.has(asset.id),
  );
  const groupFreshCandidates =
    selectTrendingWallTextCandidates(groupFreshInventory, requestedCount);
  const assetFreshCandidates =
    selectTrendingWallTextCandidates(assetFreshInventory, requestedCount);
  const ugcpilotCandidates =
    groupFreshCandidates.length >= requestedCount
      ? groupFreshCandidates
      : assetFreshCandidates.length > 0
        ? assetFreshCandidates
        : selectTrendingWallTextCandidates(inventory, requestedCount);
  const unusedInstagramTemplates = activeInstagramTemplates.filter(
    (template) =>
      mode !== "refill" || !existingBackgroundAssetIds.has(template.asset.id),
  );
  const availableInstagramTemplates =
    unusedInstagramTemplates.length > 0
      ? unusedInstagramTemplates
      : activeInstagramTemplates;
  const freshInstagramTemplates = availableInstagramTemplates.filter(
    (template) => !recentBackgrounds.assetIds.has(template.asset.id),
  );
  const instagramTemplatePool = rotateEntries(
    freshInstagramTemplates.length > 0
      ? [
          ...freshInstagramTemplates,
          ...availableInstagramTemplates.filter(
            (template) => recentBackgrounds.assetIds.has(template.asset.id),
          ),
        ]
      : availableInstagramTemplates,
    existing.filter((creative) => creative.source_kind === "instagram_reel").length,
  );
  const selectedSources = source.selection
    ? ugcpilotCandidates.map((candidate) => ({
        kind: "creative_asset" as const,
        value: candidate,
      }))
    : selectWallTextGenerationSources({
        instagramTemplates: instagramTemplatePool,
        requestedCount,
        ugcpilotCandidates,
      });
  const generationSources = selectedSources.map((selected, candidateIndex) =>
    selected.kind === "instagram_reel"
      ? {
          candidateIndex,
          durationSeconds: selected.value.asset.durationSeconds!,
          entry: selected.value.asset,
          instagramAudioFitMode: selected.value.audioFitMode,
          instagramLockedAudioAssetId: selected.value.lockedAudioAssetId,
          instagramReelTemplateId: selected.value.id,
          instagramReelTemplateVersion: selected.value.templateVersion,
          instagramReferenceText: selected.value.referenceText,
          instagramReferenceTextHash: selected.value.referenceTextHash,
          layout: selected.value.layout,
          sourceKind: "instagram_reel" as const,
          writerFormatId: selected.value.writerFormatId,
        }
      : {
          candidateIndex,
          durationSeconds: selected.value.durationSeconds,
          entry: selected.value.entry,
          layout: selected.value.layout,
          sourceKind:
            selected.kind === "creative_asset"
              ? ("creative_asset" as const)
              : ("ugcpilot" as const),
        },
  );

  if (generationSources.length === 0) {
    throw new TrendingWallTextPreparationError(
      "No active 9:16 Wall-of-text background videos are available yet.",
      409,
    );
  }

  const historicalSignatures = await listWallTextDuplicateSignatures({
    businessProfileId: profile.id,
    userId: profile.userId,
  });
  const candidateBudgets = await Promise.all(
    generationSources.map(async (candidate) => {
      const assignment =
        candidate.sourceKind === "instagram_reel"
          ? {
              // This is a source-integrity snapshot for an imported Instagram
              // template only. It is never sent to the Wall writer.
              assignedFormatId: candidate.writerFormatId,
              selectionMode: "instagram_template" as const,
              selectionWeight: 1,
            }
          : {
              assignedFormatId: null,
              selectionMode: "freeform" as const,
              selectionWeight: 1,
            };
      const budget = await deriveWallTextSpatialBudget({
        layout: candidate.layout,
      });
      return { assignment, budget, candidate };
    }),
  );
  const requestDescriptor = candidateBudgets.map(({ budget, candidate }) => ({
    assetId: candidate.entry.id,
    instagramReelTemplateId:
      "instagramReelTemplateId" in candidate
        ? candidate.instagramReelTemplateId
        : null,
    instagramReferenceTextHash:
      "instagramReferenceTextHash" in candidate
        ? candidate.instagramReferenceTextHash
        : null,
    instagramReelTemplateVersion:
      "instagramReelTemplateVersion" in candidate
        ? candidate.instagramReelTemplateVersion
        : null,
    maxWords: budget.maxWords,
    sourceKind: candidate.sourceKind,
    targetWords: budget.targetWords,
  }));
  const requestHash = createHash("sha256")
    .update(JSON.stringify(requestDescriptor), "utf8")
    .digest("hex");
  const requestKey =
    options.requestKey ??
    [
      "wall-v7",
      profile.profileVersion,
      mode,
      existing.length,
      requestHash.slice(0, 16),
    ].join(":");
  const reservation = await reserveWallTextGenerationBatch({
    assignments: candidateBudgets.map(({ assignment, budget, candidate }) => ({
      assignment,
      durationSeconds: candidate.durationSeconds,
      ...(candidate.sourceKind === "instagram_reel"
        ? {
            instagramAudioFitMode: candidate.instagramAudioFitMode,
            instagramLockedAudioAssetId:
              candidate.instagramLockedAudioAssetId,
            instagramReelTemplateId: candidate.instagramReelTemplateId,
            instagramReelTemplateVersion:
              candidate.instagramReelTemplateVersion,
            instagramReferenceText: candidate.instagramReferenceText,
            instagramReferenceTextHash:
              candidate.instagramReferenceTextHash,
          }
        : {}),
      layout: candidate.layout,
      maxWords: budget.maxWords,
      overlayMediaAssetId: candidate.entry.id,
      sourceKind: candidate.sourceKind,
      targetWords: budget.targetWords,
    })),
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    formatLibraryVersion: WALL_TEXT_FREEFORM_FORMAT_LIBRARY_VERSION,
    generatorVersion: WALL_TEXT_GENERATOR_VERSION,
    promptVersion: WALL_TEXT_PROMPT_VERSION,
    requestHash,
    requestKey,
    selectorVersion: WALL_TEXT_FREEFORM_SELECTOR_VERSION,
    userId: profile.userId,
  });
  try {
    return await completeReservedWallTextGeneration({
      historicalSignatures,
      profile,
      requestKey,
      reservation,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("wall_text_business_profile_changed")
    ) {
      throw new TrendingWallTextPreparationError(
        "Your Business Profile changed while Wall-of-text ideas were being prepared. Refresh and try again.",
        409,
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("wall_text_background_not_ready")
    ) {
      throw new TrendingWallTextPreparationError(
        "A selected Wall-of-text background is no longer available. Try preparing again.",
        409,
      );
    }

    throw error;
  }

}

async function completeReservedWallTextGeneration(params: {
  historicalSignatures: Awaited<ReturnType<typeof listWallTextDuplicateSignatures>>;
  profile: BusinessProfileRecord;
  requestKey: string;
  reservation: NonNullable<
    Awaited<ReturnType<typeof getWallTextGenerationReservation>>
  >;
}) {
  const unfinished = params.reservation.assignments.filter(
    (assignment) => assignment.status !== "completed",
  );

  if (unfinished.length > 0) {
    const privateContextsByAssignment = await getWallTextPrivateCreativeContexts({
      assignments: unfinished,
      userId: params.profile.userId,
    });
    const assets = await listWallTextOverlayAssetsByIds(
      unfinished.map((assignment) => assignment.overlay_media_asset_id),
    );
    const availableAssetIds = new Set(assets.map((asset) => asset.id));
    if (
      unfinished.some(
        (assignment) =>
          !availableAssetIds.has(assignment.overlay_media_asset_id) ||
           (assignment.source_kind === "instagram_reel" &&
             (!assignment.instagram_reel_template_id ||
               !assignment.instagram_reel_template_version ||
               !assignment.instagram_reference_text ||
              !assignment.instagram_reference_text_hash ||
              !assignment.instagram_locked_audio_asset_id ||
              !assignment.instagram_audio_fit_mode)),
      )
    ) {
      throw new TrendingWallTextPreparationError(
        "A reserved Wall-of-text background is no longer available.",
        409,
      );
    }

    const reservedByLocalIndex = new Map(
      unfinished.map((assignment) => [assignment.batch_candidate_index, assignment]),
    );
    const runtimeSignatures = [...params.historicalSignatures];
    const chunks = groupReservedAssignmentsByChunk(unfinished);

    for (const chunk of chunks) {
      const chunkId = chunk[0]!.chunk_id;
      if (chunk.some((assignment) => assignment.status === "failed")) {
        throw new WallTextCandidateRepairExhaustedError(
          "A Wall-of-text chunk exhausted its single content-repair attempt.",
        );
      }
      const claimToken = await claimWallTextGenerationChunk({
        chunkId,
        userId: params.profile.userId,
      });
      if (!claimToken) continue;

      try {
        await generateBusinessTrendingWallTextIdeas({
          business: params.profile.context,
          candidates: chunk.map((assignment) => {
            const layout = parseWallTextLayout(assignment.layout_json);
            if (!layout) {
              throw new Error("Reserved Wall-of-text placement is invalid.");
            }
            return {
              candidateIndex: assignment.batch_candidate_index,
              ...(privateContextsByAssignment.get(assignment.id)
                ? {
                    privateCreativeContext: privateContextsByAssignment.get(
                      assignment.id,
                    ),
                  }
                : {}),
              durationSeconds: Number(assignment.duration_seconds),
              layout,
              maxWords: assignment.max_words,
              ...(assignment.instagram_reel_template_id
                ? {
                    referenceText: assignment.instagram_reference_text!,
                  }
                : {}),
              targetWords: assignment.target_words,
            };
          }),
          historicalSignatures: runtimeSignatures,
          onChunkAccepted: async (ideas) => {
            await Promise.all(
              ideas.map((idea) => {
                const reserved = reservedByLocalIndex.get(idea.candidateIndex);
                if (!reserved) {
                  throw new Error("Reserved Wall-of-text candidate is missing.");
                }
                return saveWallTextGenerationCandidate({
                  assignmentId: reserved.id,
                  claimToken,
                  contentHash: idea.duplicateSignature.contentHash,
                  creativeId: randomUUID(),
                  generatorModel: getTrendingWallTextModelName(),
                  layout: idea.layout,
                  normalizedText: idea.duplicateSignature.normalizedText,
                  similaritySignature: idea.duplicateSignature,
                  text: idea.content,
                  userId: params.profile.userId,
                });
              }),
            );
            runtimeSignatures.push(
              ...ideas.map((idea) => idea.duplicateSignature),
            );
          },
        });
      } catch (error) {
        const retryable = !(error instanceof WallTextCandidateRepairExhaustedError);
        try {
          await recordWallTextGenerationChunkFailure({
            claimToken,
            chunkId,
            errorCode: retryable ? "infrastructure_error" : "content_retry_exhausted",
            errorMessage: error instanceof Error ? error.message : String(error),
            retryable,
            userId: params.profile.userId,
          });
        } catch (recordError) {
          console.error("Could not persist Wall-of-text chunk failure:", recordError);
        }
        throw error;
      }
    }
  }

  const creatives = await listTrendingWallTextCreatives({
    businessProfileId: params.profile.id,
    businessProfileVersion: params.profile.profileVersion,
    userId: params.profile.userId,
  });
  return ensureTrendingWallTextAssignments({
    businessProfileId: params.profile.id,
    businessProfileVersion: params.profile.profileVersion,
    creatives,
    userId: params.profile.userId,
  });
}

function groupReservedAssignmentsByChunk<
  T extends { batch_candidate_index: number; chunk_id: string },
>(assignments: readonly T[]) {
  const chunks = new Map<string, T[]>();
  for (const assignment of assignments) {
    const entries = chunks.get(assignment.chunk_id) ?? [];
    entries.push(assignment);
    chunks.set(assignment.chunk_id, entries);
  }
  return [...chunks.values()]
    .map((entries) =>
      entries.sort(
        (left, right) => left.batch_candidate_index - right.batch_candidate_index,
      ),
    )
    .sort(
      (left, right) =>
        left[0]!.batch_candidate_index - right[0]!.batch_candidate_index,
    );
}

function rotateEntries<T>(entries: readonly T[], offset: number) {
  if (entries.length === 0) return [];
  const normalizedOffset = Math.max(Math.trunc(offset), 0) % entries.length;
  return [
    ...entries.slice(normalizedOffset),
    ...entries.slice(0, normalizedOffset),
  ];
}

export async function getTrendingWallTextFeedProvider(
  profile: BusinessProfileRecord,
  options: {
    pinnedAssignmentIds?: readonly string[];
  } = {},
): Promise<TrendingFeedProviderResult<TrendingWallTextFeedItem>> {
  try {
    const pinnedAssignmentIds = new Set(options.pinnedAssignmentIds ?? []);
    const [source, readyMediaAssets] = await Promise.all([
      resolveTrendingVideoSource({
        format: "wall_text",
        userId: profile.userId,
      }),
      listMediaAssets({ userId: profile.userId }),
    ]);
    const selectedInventory = source.selection
      ? await listWallTextOverlayAssetsForMediaAssetIds({
          mediaAssetIds: source.assets.map((asset) => asset.id),
          userId: profile.userId,
        })
      : null;
    const backgroundAssetIds = selectedInventory?.map((asset) => asset.id);
    const availableSourceMediaAssetIds = readyMediaAssets
      .filter((asset) => asset.mime_type.startsWith("video/"))
      .map((asset) => asset.id);
    const [creatives, ideas] = await Promise.all([
      listTrendingWallTextCreatives({
        backgroundAssetIds,
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        userId: profile.userId,
      }),
      listActiveTrendingWallTextIdeas({
        availableSourceMediaAssetIds,
        backgroundAssetIds,
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        pinnedAssignmentIds: options.pinnedAssignmentIds,
        userId: profile.userId,
      }),
    ]);

    if (
      source.selection &&
      source.assets.length === 0 &&
      pinnedAssignmentIds.size === 0
    ) {
      return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
        "wall_text",
        "The selected Creative Assets source has no available videos.",
      );
    }

    // Active assignments already passed the current read contract. Historical
    // preview-ready creatives from an older generator version must not hide
    // those ready ideas while stale inventory is refreshed in the background.
    if (ideas.length > 0) {
      return createWallTextTrendingFeedProvider(
        ideas.map(toWallTextSourceRecord),
      );
    }

    if (
      creatives.length > 0 &&
      !areTrendingWallTextCreativesCurrent(creatives)
    ) {
      return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
        "wall_text",
        "Wall-of-text ideas are being refreshed with the latest format.",
      );
    }

    return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
      "wall_text",
      source.selection
        ? "Wall-of-text ideas are being prepared from the selected videos."
        : "Wall-of-text ideas are being prepared from the business profile.",
    );
  } catch (error) {
    console.error("Could not load unified Trending Wall-of-text ideas:", error);
    return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
      "wall_text",
      "Wall-of-text ideas are temporarily unavailable.",
    );
  }
}

export class TrendingWallTextPreparationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "TrendingWallTextPreparationError";
  }
}

function toWallTextSourceRecord(
  idea: Awaited<ReturnType<typeof listActiveTrendingWallTextIdeas>>[number],
): TrendingWallTextSourceRecord {
  return {
    aspectRatio: "9:16",
    assignmentId: idea.assignmentId,
    audio: {
      assetDurationSeconds: idea.audio.audioAssetDurationSeconds,
      assetId: idea.audio.audioAssetId,
      audioUrl: idea.audio.audioUrl,
      cueStartSeconds: idea.audio.cueStartSeconds,
      fadeOutSeconds: idea.audio.fadeOutSeconds,
      fitMode: idea.audio.fitMode,
      matchingVersion: idea.audio.matchingVersion,
      outputDurationSeconds: idea.audio.outputDurationSeconds,
      selectionId: idea.audio.selectionId,
    },
    creativeId: idea.id,
    durationSeconds: idea.durationSeconds,
    feedItemId: idea.assignmentId,
    feedPosition: idea.position,
    feedSource: "new",
    layout: idea.layout,
    previewUrl: idea.previewUrl,
    text: idea.text,
    thumbnailUrl: idea.thumbnailUrl,
    title: getWallTextPreviewTitle(idea.text.fullText),
  };
}

async function backfillExistingTrendingWallTextIdeas(
  profile: BusinessProfileRecord,
  existing: WallTextCreativeRow[],
  inventory: Awaited<ReturnType<typeof listWallTextVideoAssetInventory>>,
) {
  const staleCreatives = existing.filter(
    (creative) => !isTrendingWallTextCreativeCurrent(creative),
  );

  if (staleCreatives.length === 0) {
    return ensureTrendingWallTextAssignments({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      creatives: existing,
      userId: profile.userId,
    });
  }

  const upgrades = await Promise.all(
    staleCreatives.map(async (creative) => {
      const background = inventory.find(
        (asset) => asset.id === creative.overlay_media_asset_id,
      );
      const existingContent = parseWallTextContent(creative.text_content);

      if (!background) {
        throw new TrendingWallTextPreparationError(
          "A Wall-of-text background is no longer eligible for safe text placement.",
          409,
        );
      }

      if (!existingContent) {
        throw new TrendingWallTextPreparationError(
          "An existing Wall-of-text idea cannot be upgraded safely.",
          409,
        );
      }

      const upgraded = await createAuthoritativeWallTextContent({
        // Rebuild saved copy with the current measured single-text layout.
        // This preserves the words while replacing legacy, cramped line breaks.
        content: { kind: "text", text: existingContent.fullText },
        formatId: getBackfillWallTextFormatId(existingContent.pattern),
        layout: createWallTextLayout(background),
      });

      return {
        candidateIndex: creative.candidate_index,
        id: creative.id,
        layout: upgraded.layout,
        text: upgraded.content,
      };
    }),
  );
  const creatives = await replaceTrendingWallTextCreativeCopy({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    creatives: upgrades,
    generatorModel: "wall-layout-engine-v1",
    userId: profile.userId,
  });

  return ensureTrendingWallTextAssignments({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    creatives,
    userId: profile.userId,
  });
}
