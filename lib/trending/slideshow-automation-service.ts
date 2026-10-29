import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBusinessProfileForUser } from "@/lib/business-profiles/db";

import {
  listCarouselGenerationStatusesForUser,
  type CarouselGenerationRecord,
} from "@/lib/carousel/db";
import {
  defaultCarouselManualTextStyle,
  parseCarouselManualTextStyle,
  type CarouselManualTextStyle,
} from "@/lib/carousel/manual-text";
import { saveGeneratedCarouselToLibrary } from "@/lib/library/db";
import { prepareGeneratedCarouselLibrarySaveForOwner } from "@/lib/library/save-source";
import {
  listCreativeAssetGroupAssets,
  listCreativeAssetGroups,
} from "@/lib/media/creative-asset-groups";
import { isAvailableLibraryImage } from "@/lib/media/image-library";
import type { MediaAsset } from "@/lib/media/types";
import { getPublishingPreferences } from "@/lib/scheduling/publishing-preferences-db";
import type { PublishingPreferences } from "@/lib/scheduling/publishing-preferences";
import { getSavedCaptions } from "@/lib/scheduling/saved-captions-db";
import {
  cancelUserSchedule,
  createUserSchedule,
  listUserSchedules,
} from "@/lib/scheduling/service";
import type { ScheduleCreateTargetInput } from "@/lib/scheduling/types";
import {
  allocateCollectionOnlySlideBackgrounds,
  createAutomationSlotIdempotencyKey,
  createDefaultAutomationConfig,
  deriveQuickModeFromCounts,
  evaluateAutomationSlotTiming,
  mapAutomationFormatToStructureId,
  normalizeAutomationTimezone,
  type PauseAutomationUpcomingAction,
  planUpcomingAutomationOccurrences,
  type SavedCarouselVisualStyle,
  selectSlotsToCancelOnPause,
  syncAutomationDailySlots,
  TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META,
  type TrendingSlideshowAutomationAttentionReason,
  type TrendingSlideshowAutomationConfig,
  type TrendingSlideshowAutomationFormat,
  type TrendingSlideshowAutomationRecord,
  type TrendingSlideshowAutomationSlotRecord,
  type TrendingSlideshowAutomationSlotSnapshot,
  type TrendingSlideshowAutomationSlotStatus,
  type TrendingSlideshowAutomationStatus,
  validateAutomationConfigForActivation,
  validateAutomationContentCounts,
} from "@/lib/trending/slideshow-automation-contract";
import { getTrendingPlanEntitlement } from "@/lib/trending/unified-daily-feed-db";
import { prepareAutomationLibraryInput } from "./slideshow-automation-render";

const AUTOMATIONS_TABLE = "trending_slideshow_automations";
const STYLES_TABLE = "trending_carousel_visual_styles";
const SLOTS_TABLE = "trending_slideshow_automation_slots";
const FALLBACK_PLANS_TABLE = "explore_slideshow_plans";
const FALLBACK_AUTOMATION_REQUEST_KEY = "00000000-0000-4000-8000-00000000a070";
const FALLBACK_PAYLOAD_HASH = "a".repeat(64);

export class SlideshowAutomationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SlideshowAutomationError";
    this.status = status;
  }
}

export type SlideshowAutomationCollectionSummary = {
  assets: Array<{
    id: string;
    thumbnailUrl: string;
    title: string;
    url: string;
  }>;
  id: string;
  name: string;
  usableCount: number;
};

export type SlideshowAutomationWorkspaceState = {
  automation: TrendingSlideshowAutomationRecord;
  collections: SlideshowAutomationCollectionSummary[];
  dailyAllowance: number;
  planDisplayName: string;
  savedCaptions: Array<{
    id: string;
    isDefault: boolean;
    text: string;
  }>;
  savedStyles: SavedCarouselVisualStyle[];
  slots: TrendingSlideshowAutomationSlotRecord[];
};

type AutomationRow = {
  activated_at: string | null;
  attention_message: string | null;
  attention_reason: TrendingSlideshowAutomationAttentionReason;
  config: unknown;
  paused_at: string | null;
  revision: number;
  rotation_cursor: number;
  status: TrendingSlideshowAutomationStatus;
  updated_at: string;
  user_id: string;
};

type VisualStyleRow = {
  created_at: string;
  id: string;
  name: string;
  style: unknown;
  text_position: unknown;
  updated_at: string;
  user_id: string;
};

type SlotRow = {
  created_at: string;
  creative_id: string | null;
  format: TrendingSlideshowAutomationFormat;
  hold_message: string | null;
  id: string;
  idempotency_key: string;
  library_item_id: string | null;
  local_date: string;
  schedule_id: string | null;
  scheduled_for: string;
  slot_index: number;
  slot_time: string;
  snapshot: unknown;
  status: TrendingSlideshowAutomationSlotStatus;
  timezone: string;
  updated_at: string;
  user_id: string;
  user_modified: boolean;
};

type FallbackEnvelope = {
  automation: AutomationRow | null;
  savedStyles: VisualStyleRow[];
  slots: SlotRow[];
  version: 1;
};

let supabaseClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new SlideshowAutomationError(
      "Slideshow automation storage is not configured.",
      501,
    );
  }

  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

function isMissingTableError(error: {
  code?: string | null;
  message?: string | null;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") {
    return true;
  }
  const msg = error.message ?? "";
  return /Could not find the table|relation .* does not exist/i.test(msg);
}

async function readFallbackEnvelope(userId: string): Promise<FallbackEnvelope> {
  const { data, error } = await getClient()
    .from(FALLBACK_PLANS_TABLE)
    .select("output_json")
    .eq("user_id", userId)
    .eq("request_key", FALLBACK_AUTOMATION_REQUEST_KEY)
    .maybeSingle();

  if (error) {
    throw new SlideshowAutomationError(
      `Could not load slideshow automation storage: ${error.message}`,
      500,
    );
  }

  const raw =
    data?.output_json && typeof data.output_json === "object"
      ? (data.output_json as Partial<FallbackEnvelope>)
      : null;

  return {
    automation: raw?.automation ?? null,
    savedStyles: Array.isArray(raw?.savedStyles) ? raw.savedStyles : [],
    slots: Array.isArray(raw?.slots) ? raw.slots : [],
    version: 1,
  };
}

async function writeFallbackEnvelope(
  userId: string,
  envelope: FallbackEnvelope,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await getClient()
    .from(FALLBACK_PLANS_TABLE)
    .upsert(
      {
        created_at: nowIso,
        input_json: { kind: "trending_slideshow_automation_v1" },
        output_json: envelope,
        payload_hash: FALLBACK_PAYLOAD_HASH,
        request_key: FALLBACK_AUTOMATION_REQUEST_KEY,
        status: "completed",
        updated_at: nowIso,
        user_id: userId,
      },
      { onConflict: "user_id,request_key" },
    );

  if (error) {
    throw new SlideshowAutomationError(
      `Could not save slideshow automation storage: ${error.message}`,
      500,
    );
  }
}

async function updateAutomationRowInStorage(
  userId: string,
  patch: Partial<AutomationRow>,
  dailyAllowance: number,
  expected?: Pick<TrendingSlideshowAutomationRecord, "revision" | "status">,
): Promise<TrendingSlideshowAutomationRecord> {
  let query = getClient()
    .from(AUTOMATIONS_TABLE)
    .update(patch)
    .eq("user_id", userId);
  if (expected) {
    // Pause deliberately does not change revision. Fence both fields in the
    // UPDATE itself so a newer pause or settings save wins the race.
    query = query.eq("revision", expected.revision).eq("status", expected.status);
  }
  const result = query.select("*");
  const { data, error } = await (expected ? result.maybeSingle() : result.single());

  if (!error && data) {
    return serializeAutomationRow(data as AutomationRow, dailyAllowance);
  }

  if (expected) {
    if (!error) throw new SlideshowAutomationError("Automation changed while saving. Refresh to load its current settings and pause state before trying again.", 409);
    // Legacy whole-envelope storage cannot perform this conditional write.
    // Never fall back to an unfenced save after a failed guarded update.
    throw new SlideshowAutomationError("Could not safely save automation settings. Refresh and try again.", 503);
  }

  if (isMissingTableError(error)) {
    const envelope = await readFallbackEnvelope(userId);
    const base =
      envelope.automation ??
      buildDefaultAutomationRow({
        dailyAllowance,
        userId,
      });
    const updated: AutomationRow = {
      ...base,
      ...patch,
      user_id: userId,
    };
    envelope.automation = updated;
    await writeFallbackEnvelope(userId, envelope);
    return serializeAutomationRow(updated, dailyAllowance);
  }

  throw new SlideshowAutomationError(
    `Could not update slideshow automation: ${error?.message ?? "Unknown error"}`,
    500,
  );
}

function buildDefaultAutomationRow(params: {
  dailyAllowance: number;
  timezone?: string | null;
  userId: string;
}): AutomationRow {
  const defaultConfig = createDefaultAutomationConfig({
    dailyAllowance: params.dailyAllowance,
    timezone: params.timezone ?? undefined,
  });
  const nowIso = new Date().toISOString();
  return {
    activated_at: null,
    attention_message: null,
    attention_reason: null,
    config: defaultConfig,
    paused_at: null,
    revision: 1,
    rotation_cursor: 0,
    status: "draft",
    updated_at: nowIso,
    user_id: params.userId,
  };
}

export async function loadSlideshowAutomationWorkspaceState(params: {
  timezone?: string | null;
  userId: string;
}): Promise<SlideshowAutomationWorkspaceState> {
  const entitlement = await getTrendingPlanEntitlement(params.userId);
  const dailyAllowance = Math.min(5, Math.max(1, entitlement.dailyLimit));

  const [initialAutomation, savedStyles, collections, captionsLib] =
    await Promise.all([
      getOrCreateAutomationRecord({
        dailyAllowance,
        timezone: params.timezone,
        userId: params.userId,
      }),
      listSavedCarouselVisualStyles(params.userId),
      loadUserImageCollectionSummaries(params.userId),
      getSavedCaptions(params.userId).catch(() => ({
        captions: [],
        defaultId: null,
        revision: 0,
      })),
    ]);

  let automation = initialAutomation;
  let slots = await reconcileAutomationSlotsWithSchedules(params.userId);

  if (automation.status === "active") {
    let usableCollectionAssets: MediaAsset[] = [];
    if (automation.config.backgrounds.mode === "collection_only") {
      usableCollectionAssets = await loadUsableCollectionAssets({
        collectionId: automation.config.backgrounds.collectionId,
        selectedAssetIds: automation.config.backgrounds.selectedAssetIds,
        selectionMode: automation.config.backgrounds.selectionMode,
        userId: params.userId,
      });
    }
    slots = await prepareUpcomingAutomationSlots({
      automation,
      usableCollectionAssets,
    });
    automation = await getOrCreateAutomationRecord({
      dailyAllowance,
      timezone: params.timezone,
      userId: params.userId,
    });
  }

  return {
    automation,
    collections,
    dailyAllowance,
    planDisplayName: entitlement.displayName,
    savedCaptions: captionsLib.captions.map((caption) => ({
      id: caption.id,
      isDefault: caption.id === captionsLib.defaultId,
      text: caption.text,
    })),
    savedStyles,
    slots,
  };
}

export async function getExistingAutomationRecord(params: {
  dailyAllowance: number;
  userId: string;
}): Promise<TrendingSlideshowAutomationRecord | null> {
  const { data, error } = await getClient()
    .from(AUTOMATIONS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error && !isMissingTableError(error)) {
    throw new SlideshowAutomationError(
      `Could not load slideshow automation: ${error.message}`,
      500,
    );
  }

  if (error && isMissingTableError(error)) {
    const envelope = await readFallbackEnvelope(params.userId);
    if (!envelope.automation) {
      return null;
    }
    return serializeAutomationRow(envelope.automation, params.dailyAllowance);
  }

  if (!data) {
    return null;
  }

  return serializeAutomationRow(data as AutomationRow, params.dailyAllowance);
}

/**
 * Safe background sweep hook called during daily carousel replenishment (Stage 1)
 * and when worker carousel generation completes via Trending reconciliation (Stage 2).
 * Does nothing if the user does not have an active slideshow automation.
 */
export async function sweepActiveSlideshowAutomationForUser(params: {
  timezone?: string | null;
  userId: string;
}): Promise<{
  preparedSlotCount: number;
  scheduledSlotCount: number;
  skipped: boolean;
}> {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return { preparedSlotCount: 0, scheduledSlotCount: 0, skipped: true };
  }

  const entitlement = await getTrendingPlanEntitlement(params.userId);
  const dailyAllowance = Math.min(5, Math.max(1, entitlement.dailyLimit));

  const existing = await getExistingAutomationRecord({
    dailyAllowance,
    userId: params.userId,
  });

  if (!existing || existing.status !== "active") {
    return { preparedSlotCount: 0, scheduledSlotCount: 0, skipped: true };
  }

  await reconcileAutomationSlotsWithSchedules(params.userId);

  let usableCollectionAssets: MediaAsset[] = [];
  if (existing.config.backgrounds.mode === "collection_only") {
    usableCollectionAssets = await loadUsableCollectionAssets({
      collectionId: existing.config.backgrounds.collectionId,
      selectedAssetIds: existing.config.backgrounds.selectedAssetIds,
      selectionMode: existing.config.backgrounds.selectionMode,
      userId: params.userId,
    });
  }

  const slots = await prepareUpcomingAutomationSlots({
    automation: existing,
    usableCollectionAssets,
  });

  return {
    preparedSlotCount: slots.length,
    scheduledSlotCount: slots.filter((slot) => slot.status === "scheduled")
      .length,
    skipped: false,
  };
}

export async function getOrCreateAutomationRecord(params: {
  dailyAllowance: number;
  timezone?: string | null;
  userId: string;
}): Promise<TrendingSlideshowAutomationRecord> {
  const { data, error } = await getClient()
    .from(AUTOMATIONS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error && !isMissingTableError(error)) {
    throw new SlideshowAutomationError(
      `Could not load slideshow automation: ${error.message}`,
      500,
    );
  }

  if (error && isMissingTableError(error)) {
    const envelope = await readFallbackEnvelope(params.userId);
    if (envelope.automation) {
      return serializeAutomationRow(envelope.automation, params.dailyAllowance);
    }
    const created = buildDefaultAutomationRow(params);
    envelope.automation = created;
    await writeFallbackEnvelope(params.userId, envelope);
    return serializeAutomationRow(created, params.dailyAllowance);
  }

  if (data) {
    return serializeAutomationRow(
      data as AutomationRow,
      params.dailyAllowance,
    );
  }

  const defaultRow = buildDefaultAutomationRow(params);
  const { data: inserted, error: insertError } = await getClient()
    .from(AUTOMATIONS_TABLE)
    .insert(defaultRow)
    .select("*")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      const raced = await getExistingAutomationRecord({ dailyAllowance: params.dailyAllowance, userId: params.userId });
      if (raced) return raced;
    }
    throw new SlideshowAutomationError(
      `Could not initialize slideshow automation draft: ${insertError?.message ?? "Unknown error"}`,
      500,
    );
  }

  return serializeAutomationRow(
    inserted as AutomationRow,
    params.dailyAllowance,
  );
}

export async function saveAutomationDraftOrSettings(params: {
  config: TrendingSlideshowAutomationConfig;
  timezone?: string | null;
  userId: string;
}): Promise<TrendingSlideshowAutomationRecord> {
  const entitlement = await getTrendingPlanEntitlement(params.userId);
  const dailyAllowance = Math.min(5, Math.max(1, entitlement.dailyLimit));
  const countsValidation = validateAutomationContentCounts(
    params.config.counts,
    dailyAllowance,
  );
  if (!countsValidation.ok) {
    throw new SlideshowAutomationError(
      countsValidation.message ?? "Choose valid daily slideshow counts.",
      400,
    );
  }

  const normalizedConfig: TrendingSlideshowAutomationConfig = {
    ...params.config,
    dailySlots: syncAutomationDailySlots({
      counts: params.config.counts,
      currentSlots: params.config.dailySlots,
    }),
    quickMode: deriveQuickModeFromCounts(params.config.counts),
    timezone: normalizeAutomationTimezone(
      params.config.timezone || params.timezone,
    ),
    visualStyle: {
      ...params.config.visualStyle,
      style:
        parseCarouselManualTextStyle(params.config.visualStyle.style) ??
        defaultCarouselManualTextStyle(),
    },
  };

  const existing = await getOrCreateAutomationRecord({
    dailyAllowance,
    timezone: normalizedConfig.timezone,
    userId: params.userId,
  });

  // Evaluate collection health if active and collection_only
  let nextStatus = existing.status;
  let attentionReason = existing.attentionReason;
  let attentionMessage = existing.attentionMessage;

  if (
    existing.status === "active" ||
    existing.status === "needs_attention"
  ) {
    assertAutomationStructureSupply(normalizedConfig, entitlement.dailyLimit);
    if (normalizedConfig.backgrounds.mode === "collection_only") {
      const usableAssets = await loadUsableCollectionAssets({
        collectionId: normalizedConfig.backgrounds.collectionId,
        selectedAssetIds: normalizedConfig.backgrounds.selectedAssetIds,
        selectionMode: normalizedConfig.backgrounds.selectionMode,
        userId: params.userId,
      });
      if (usableAssets.length === 0) {
        nextStatus = "needs_attention";
        attentionReason = "collection_empty";
        attentionMessage = `Collection "${normalizedConfig.backgrounds.collectionName}" has 0 usable images. Upload images to "${normalizedConfig.backgrounds.collectionName}" or choose another collection — default backgrounds are never substituted automatically.`;
      } else if (attentionReason === "collection_empty") {
        nextStatus = "active";
        attentionReason = null;
        attentionMessage = null;
      }
    } else if (attentionReason === "collection_empty") {
      nextStatus = "active";
      attentionReason = null;
      attentionMessage = null;
    }
  }

  const nextRevision = existing.revision + 1;
  const nowIso = new Date().toISOString();

  return updateAutomationRowInStorage(
    params.userId,
    {
      attention_message: attentionMessage,
      attention_reason: attentionReason,
      config: normalizedConfig,
      revision: nextRevision,
      status: nextStatus,
      updated_at: nowIso,
    },
    dailyAllowance,
    existing,
  );
}

function assertAutomationStructureSupply(config: TrendingSlideshowAutomationConfig, dailyLimit: number) {
  if (config.counts.educationalTipsCount > 0 && config.counts.productStoriesCount > 0 && dailyLimit < 10) {
    throw new SlideshowAutomationError("Your daily pack has one generation batch of five slideshows, so it can supply one structure at a time. Choose all Educational Tips or all Product Stories for an active automation.", 409);
  }
}

export async function activateSlideshowAutomation(params: {
  config?: TrendingSlideshowAutomationConfig;
  userId: string;
}): Promise<{
  automation: TrendingSlideshowAutomationRecord;
  slots: TrendingSlideshowAutomationSlotRecord[];
}> {
  const entitlement = await getTrendingPlanEntitlement(params.userId);
  const dailyAllowance = Math.min(5, Math.max(1, entitlement.dailyLimit));

  if (params.config) {
    await saveAutomationDraftOrSettings({
      config: params.config,
      userId: params.userId,
    });
  }

  const existing = await getOrCreateAutomationRecord({
    dailyAllowance,
    userId: params.userId,
  });

  let usableCollectionAssets: MediaAsset[] = [];
  if (existing.config.backgrounds.mode === "collection_only") {
    usableCollectionAssets = await loadUsableCollectionAssets({
      collectionId: existing.config.backgrounds.collectionId,
      selectedAssetIds: existing.config.backgrounds.selectedAssetIds,
      selectionMode: existing.config.backgrounds.selectionMode,
      userId: params.userId,
    });
  }

  const validation = validateAutomationConfigForActivation({
    availableCollectionAssetCount:
      existing.config.backgrounds.mode === "collection_only"
        ? usableCollectionAssets.length
        : undefined,
    config: existing.config,
    dailyAllowance,
  });

  if (!validation.ok) {
    throw new SlideshowAutomationError(
      validation.message ??
        "Complete all required steps before activating automation.",
      400,
    );
  }
  assertAutomationStructureSupply(existing.config, entitlement.dailyLimit);

  const nowIso = new Date().toISOString();
  const nextRevision = existing.revision + 1;

  const storageReady = await getClient().rpc("claim_slideshow_automation", {
    p_user_id: params.userId, p_token: randomUUID(), p_revision: -1,
  });
  if (storageReady.error) throw new SlideshowAutomationError("Safe automation storage is unavailable. Apply the checkpoint migration before activation.", 503);

  const activeRecord = await updateAutomationRowInStorage(
    params.userId,
    {
      activated_at: existing.activatedAt ?? nowIso,
      attention_message: null,
      attention_reason: null,
      paused_at: null,
      revision: nextRevision,
      status: "active",
      updated_at: nowIso,
    },
    dailyAllowance,
    existing,
  );

  const preparedSlots = await prepareUpcomingAutomationSlots({
    automation: activeRecord,
    usableCollectionAssets,
  });

  const refreshedAutomation = await getOrCreateAutomationRecord({
    dailyAllowance,
    userId: params.userId,
  });

  return {
    automation: refreshedAutomation,
    slots: preparedSlots,
  };
}

async function cancelAutomationSchedule(postId: string, userId: string) {
  try {
    const result = await cancelUserSchedule({ postId, userId });
    if (result.status !== "cancelled") {
      throw new Error("The schedule has not confirmed cancellation.");
    }
  } catch (error) {
    throw new SlideshowAutomationError(
      `Could not cancel an automated post. Its slot has not been marked cancelled. ${error instanceof Error ? error.message : "Try again in Schedule."}`,
      409,
    );
  }
}

export async function pauseSlideshowAutomation(params: {
  action: PauseAutomationUpcomingAction;
  userId: string;
}): Promise<{
  automation: TrendingSlideshowAutomationRecord;
  cancelledSlotCount: number;
  slots: TrendingSlideshowAutomationSlotRecord[];
}> {
  const entitlement = await getTrendingPlanEntitlement(params.userId);
  const dailyAllowance = Math.min(5, Math.max(1, entitlement.dailyLimit));
  const nowIso = new Date().toISOString();

  // Stop new sweeps before cancelling any schedules. A partial cancellation failure
  // leaves automation paused, with the failed slot still visibly scheduled.
  const pausedAutomation = await updateAutomationRowInStorage(
    params.userId,
    { paused_at: nowIso, status: "paused", updated_at: nowIso },
    dailyAllowance,
  );

  // The SQL handoff locks this same automation row. Read slots after pausing,
  // so a handoff that won the race is included, and later handoffs are fenced.
  const currentSlots = await reconcileAutomationSlotsWithSchedules(params.userId);
  const slotIdsToCancel = selectSlotsToCancelOnPause({ action: params.action, slots: currentSlots });

  if (slotIdsToCancel.length > 0) {
    const slotsToCancel = currentSlots.filter((slot) =>
      slotIdsToCancel.includes(slot.id),
    );
    for (const slot of slotsToCancel) {
      if (slot.scheduleId) {
        await cancelAutomationSchedule(slot.scheduleId, params.userId);
      }
      await updateSlotRowInStorage(params.userId, slot.id, {
        hold_message: "Cancelled when automation was paused.",
        status: "cancelled_by_user",
        updated_at: nowIso,
      });
    }
  }

  const updatedSlots = await listAutomationSlots(params.userId);

  return {
    automation: pausedAutomation,
    cancelledSlotCount: slotIdsToCancel.length,
    slots: updatedSlots,
  };
}

export async function mutateAutomationSlot(params: {
  action: "cancel" | "retry" | "skip";
  slotId: string;
  userId: string;
}): Promise<{
  automation: TrendingSlideshowAutomationRecord;
  slots: TrendingSlideshowAutomationSlotRecord[];
}> {
  const currentSlots = await listAutomationSlots(params.userId);
  let slot = currentSlots.find((item) => item.id === params.slotId);

  if (!slot) {
    throw new SlideshowAutomationError("Automation slot not found.", 404);
  }

  const nowIso = new Date().toISOString();

  if (params.action === "cancel" || params.action === "skip") {
    const fence = await getClient().rpc("fence_slideshow_automation_slot", { p_user_id: params.userId, p_slot_id: slot.id });
    if (fence.error || !fence.data) throw new SlideshowAutomationError("Could not stop preparation safely. Try again.", 503);
    slot = serializeSlotRow(fence.data as SlotRow);
    if (slot.scheduleId) {
      await cancelAutomationSchedule(slot.scheduleId, params.userId);
    }

    await updateSlotRowInStorage(params.userId, slot.id, {
      hold_message:
        params.action === "skip"
          ? "Skipped by owner."
          : "Cancelled by owner.",
      status: "cancelled_by_user",
      updated_at: nowIso,
      user_modified: true,
    });
  } else if (params.action === "retry") {
    if (slot.scheduleId) throw new SlideshowAutomationError("This post already has a saved schedule. Retry its failed destination in Schedule; no replacement post was created.", 409);
    if (slot.status === "cancelled_by_user") throw new SlideshowAutomationError("This slot was cancelled. Use a future daily slot; it will not be restarted automatically.", 409);
    const timing = evaluateAutomationSlotTiming({
      localDate: slot.localDate,
      slotTime: slot.slotTime,
      timezone: slot.timezone,
    });
    if (!timing.ok) throw new SlideshowAutomationError("This posting time has passed. Use a future daily slot; no late post was created.", 409);
    await updateSlotRowInStorage(params.userId, slot.id, {
      hold_message: timing.ok
        ? null
        : "Rescheduled to the next available daily window.",
      status: "preparing",
      updated_at: nowIso,
    });
    const current = await getExistingAutomationRecord({ userId: params.userId, dailyAllowance: 5 });
    if (current?.status === "needs_attention" && current.activatedAt) {
      const { error } = await getClient().from(AUTOMATIONS_TABLE)
        .update({ status: "active", attention_reason: null, attention_message: null, updated_at: nowIso })
        .eq("user_id", params.userId).eq("status", "needs_attention").eq("revision", current.revision);
      if (error) throw new SlideshowAutomationError("Could not resume this automation retry. Its slot remains saved.", 503);
    }
  }

  const state = await loadSlideshowAutomationWorkspaceState({
    userId: params.userId,
  });

  return {
    automation: state.automation,
    slots: state.slots,
  };
}

export async function listSavedCarouselVisualStyles(
  userId: string,
): Promise<SavedCarouselVisualStyle[]> {
  const { data, error } = await getClient()
    .from(STYLES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    if (isMissingTableError(error)) {
      const envelope = await readFallbackEnvelope(userId);
      return envelope.savedStyles
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((row) => serializeVisualStyleRow(row));
    }

    throw new SlideshowAutomationError(
      `Could not load saved visual styles: ${error.message}`,
      500,
    );
  }

  return (data ?? []).map((row) => serializeVisualStyleRow(row as VisualStyleRow));
}

export async function saveCarouselVisualStylePreset(params: {
  id?: string;
  name: string;
  style: CarouselManualTextStyle;
  textPosition?: { x: number; y: number };
  userId: string;
}): Promise<SavedCarouselVisualStyle> {
  const cleanName = params.name.trim().slice(0, 60);
  if (!cleanName) {
    throw new SlideshowAutomationError(
      "Enter a name for your visual style preset.",
      400,
    );
  }

  let validatedStyle: CarouselManualTextStyle;
  try {
    const parsed = parseCarouselManualTextStyle(params.style);
    if (!parsed) {
      throw new Error("Missing style");
    }
    validatedStyle = parsed;
  } catch {
    throw new SlideshowAutomationError(
      "Choose a valid font, size, and color for this visual style.",
      400,
    );
  }

  const textPosition = {
    x: Math.min(1, Math.max(0, Number(params.textPosition?.x ?? 0.5))),
    y: Math.min(1, Math.max(0, Number(params.textPosition?.y ?? 0.5))),
  };
  const nowIso = new Date().toISOString();

  if (params.id) {
    const { data, error } = await getClient()
      .from(STYLES_TABLE)
      .update({
        name: cleanName,
        style: validatedStyle,
        text_position: textPosition,
        updated_at: nowIso,
      })
      .eq("id", params.id)
      .eq("user_id", params.userId)
      .select("*")
      .single();

    if (!error && data) {
      return serializeVisualStyleRow(data as VisualStyleRow);
    }

    if (isMissingTableError(error)) {
      const envelope = await readFallbackEnvelope(params.userId);
      const idx = envelope.savedStyles.findIndex((s) => s.id === params.id);
      if (idx < 0) {
        throw new SlideshowAutomationError("Saved visual style not found.", 404);
      }
      const updated: VisualStyleRow = {
        ...envelope.savedStyles[idx]!,
        name: cleanName,
        style: validatedStyle,
        text_position: textPosition,
        updated_at: nowIso,
      };
      envelope.savedStyles[idx] = updated;
      await writeFallbackEnvelope(params.userId, envelope);
      return serializeVisualStyleRow(updated);
    }

    throw new SlideshowAutomationError(
      `Could not update visual style: ${error?.message ?? "Not found"}`,
      400,
    );
  }

  const { data, error } = await getClient()
    .from(STYLES_TABLE)
    .insert({
      name: cleanName,
      style: validatedStyle,
      text_position: textPosition,
      updated_at: nowIso,
      user_id: params.userId,
    })
    .select("*")
    .single();

  if (!error && data) {
    return serializeVisualStyleRow(data as VisualStyleRow);
  }

  if (isMissingTableError(error)) {
    const envelope = await readFallbackEnvelope(params.userId);
    const created: VisualStyleRow = {
      created_at: nowIso,
      id: randomUUID(),
      name: cleanName,
      style: validatedStyle,
      text_position: textPosition,
      updated_at: nowIso,
      user_id: params.userId,
    };
    envelope.savedStyles.unshift(created);
    await writeFallbackEnvelope(params.userId, envelope);
    return serializeVisualStyleRow(created);
  }

  throw new SlideshowAutomationError(
    `Could not save visual style: ${error?.message ?? "Unknown error"}`,
    500,
  );
}

export async function deleteCarouselVisualStylePreset(params: {
  styleId: string;
  userId: string;
}): Promise<void> {
  const { error } = await getClient()
    .from(STYLES_TABLE)
    .delete()
    .eq("id", params.styleId)
    .eq("user_id", params.userId);

  if (error) {
    if (isMissingTableError(error)) {
      const envelope = await readFallbackEnvelope(params.userId);
      envelope.savedStyles = envelope.savedStyles.filter(
        (s) => s.id !== params.styleId,
      );
      await writeFallbackEnvelope(params.userId, envelope);
      return;
    }

    throw new SlideshowAutomationError(
      `Could not delete visual style: ${error.message}`,
      500,
    );
  }
}

export async function listAutomationSlots(
  userId: string,
): Promise<TrendingSlideshowAutomationSlotRecord[]> {
  const { data, error } = await getClient()
    .from(SLOTS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingTableError(error)) {
      const envelope = await readFallbackEnvelope(userId);
      return envelope.slots
        .slice()
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
        .slice(0, 30)
        .map((row) => serializeSlotRow(row));
    }

    throw new SlideshowAutomationError(
      `Could not load automation slots: ${error.message}`,
      500,
    );
  }

  return (data ?? []).map((row) => serializeSlotRow(row as SlotRow))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

async function updateSlotRowInStorage(
  userId: string,
  slotId: string,
  patch: Partial<SlotRow>,
  preparationOnly = false,
): Promise<void> {
  const query = getClient()
    .from(SLOTS_TABLE)
    .update(patch)
    .eq("id", slotId)
    .eq("user_id", userId);
  const { error } = await (preparationOnly ? query.is("cancel_requested_at", null) : query);

  if (!error) {
    return;
  }

  if (isMissingTableError(error)) {
    const envelope = await readFallbackEnvelope(userId);
    const idx = envelope.slots.findIndex((s) => s.id === slotId);
    if (idx >= 0) {
      envelope.slots[idx] = {
        ...envelope.slots[idx]!,
        ...patch,
      };
      await writeFallbackEnvelope(userId, envelope);
    }
    return;
  }

  throw new SlideshowAutomationError(
    `Could not update automation slot: ${error.message}`,
    500,
  );
}

async function reconcileAutomationSlotsWithSchedules(
  userId: string,
): Promise<TrendingSlideshowAutomationSlotRecord[]> {
  const slots = await listAutomationSlots(userId);
  const slotsWithSchedules = slots.filter((slot) => Boolean(slot.scheduleId));
  if (slotsWithSchedules.length === 0) {
    return slots;
  }

  const userSchedules = await listUserSchedules({ userId });
  if (userSchedules.length === 0) {
    return slots;
  }

  const scheduleById = new Map(
    userSchedules.map((schedule) => [schedule.id, schedule]),
  );
  const nowIso = new Date().toISOString();
  let changed = false;

  for (const slot of slotsWithSchedules) {
    const schedule = slot.scheduleId
      ? scheduleById.get(slot.scheduleId)
      : undefined;
    if (!schedule) continue;

    let nextStatus = slot.status;
    let nextHoldMessage = slot.holdMessage;
    let nextUserModified = slot.userModified;

    if (
      schedule.scheduledFor &&
      Date.parse(schedule.scheduledFor) !== Date.parse(slot.scheduledFor)
    ) {
      nextUserModified = true;
    }
    if (schedule.caption !== slot.snapshot.captionText || schedule.libraryItemId !== slot.libraryItemId ||
      schedule.targets.map(target => target.socialConnectionId).sort().join(",") !== slot.snapshot.targets.map(target => target.connectionId).sort().join(",")) {
      nextUserModified = true;
    }

    if (schedule.status === "published") {
      nextStatus = "published";
      nextHoldMessage = null;
    } else if (schedule.status === "partially_failed") {
      nextStatus = "partially_published";
      nextHoldMessage =
        "Published to at least one account; another destination needs attention in Schedule.";
    } else if (schedule.status === "failed") {
      nextStatus = "action_required_account";
      nextHoldMessage =
        schedule.targets.find((t) => t.lastErrorMessage)?.lastErrorMessage ??
        "Publishing failed. Review this post in the Schedule tab.";
    } else if (schedule.status === "cancelled") {
      nextStatus = "cancelled_by_user";
    } else if (
      schedule.status === "scheduled" ||
      schedule.status === "scheduling" ||
      schedule.status === "publishing"
    ) {
      nextStatus = "scheduled";
    }

    if (
      nextStatus !== slot.status ||
      nextHoldMessage !== slot.holdMessage ||
      nextUserModified !== slot.userModified
    ) {
      changed = true;
      await updateSlotRowInStorage(userId, slot.id, {
        hold_message: nextHoldMessage,
        status: nextStatus,
        updated_at: nowIso,
        user_modified: nextUserModified,
      });
    }
  }

  return changed ? listAutomationSlots(userId) : slots;
}

function buildScheduleTargetInputs(
  config: TrendingSlideshowAutomationConfig,
  preferences: PublishingPreferences,
): ScheduleCreateTargetInput[] {
  return config.targets.map((target) => {
    if (target.platform === "tiktok") {
      return {
        connectionId: target.connectionId,
        platform: "tiktok",
        settings: {
          allowComment: preferences.tiktokAllowComments,
          allowDuet: false,
          allowStitch: false,
          brandOrganic: preferences.tiktokBrandOrganic,
          brandedContent: false,
          commercialContentDisclosureEnabled: preferences.tiktokBrandOrganic,
          containsSyntheticMedia: preferences.containsSyntheticMedia,
          // Activating automation is the explicit confirmation shown in Review.
          musicUsageConfirmed: true,
          privacyLevel: preferences.tiktokPrivacyLevel,
        },
      };
    }

    return {
      connectionId: target.connectionId,
      platform: target.platform,
      settings: {
        shareToFeed: true,
      },
    };
  });
}

async function loadReadyUnusedCarouselsForUser(params: {
  excludeCarouselIds: ReadonlySet<string>;
  userId: string;
}): Promise<CarouselGenerationRecord[]> {
  try {
    const [statuses, profile] = await Promise.all([
      listCarouselGenerationStatusesForUser({ limit: 50, userId: params.userId }),
      getBusinessProfileForUser(params.userId),
    ]);
    if (!profile) throw new Error("The active business profile is unavailable.");

    return statuses
      .filter((entry) => {
        if (entry.generation.status !== "completed") return false;
        if (entry.generation.businessProfileId !== profile.id || entry.generation.businessProfileVersion !== profile.profileVersion) return false;
        if (params.excludeCarouselIds.has(entry.generation.id)) return false;
        const readySlides = entry.slides.filter(
          (slide) => slide.status === "ready" && Boolean(slide.renderedUrl),
        );
        return (
          readySlides.length > 0 &&
          readySlides.length === entry.generation.slideCount
        );
      })
      .map((entry) => entry.generation);
  } catch (error) {
    throw new SlideshowAutomationError(`Could not read ready slideshow inventory: ${error instanceof Error ? error.message : "Try again."}`, 503);
  }
}

async function prepareUpcomingAutomationSlots(params: {
  automation: TrendingSlideshowAutomationRecord;
  usableCollectionAssets: MediaAsset[];
}): Promise<TrendingSlideshowAutomationSlotRecord[]> {
  const token = randomUUID();
  const claim = await getClient().rpc("claim_slideshow_automation", {
    p_user_id: params.automation.userId, p_token: token, p_revision: params.automation.revision,
  });
  if (claim.error) throw new SlideshowAutomationError("Safe automation storage is unavailable. Apply the automation checkpoint migration before activating.", 503);
  if (claim.data !== true) return listAutomationSlots(params.automation.userId);
  try {
    return await prepareClaimedAutomationSlots({ ...params, executionToken: token });
  } finally {
    const released = await getClient().rpc("release_slideshow_automation", { p_user_id: params.automation.userId, p_token: token });
    if (released.error) console.error("Automation lease release failed", { code: released.error.code });
  }
}

async function prepareClaimedAutomationSlots(params: {
  automation: TrendingSlideshowAutomationRecord;
  usableCollectionAssets: MediaAsset[];
  executionToken: string;
}): Promise<TrendingSlideshowAutomationSlotRecord[]> {
  const persistCheckpoint = async (row: Omit<SlotRow, "id"> & { id?: string }) => {
    const result = await getClient().rpc("checkpoint_slideshow_automation_slot", {
      p_user_id: params.automation.userId, p_token: params.executionToken, p_revision: params.automation.revision, p_row: row,
    });
    if (result.error || !result.data) throw new SlideshowAutomationError("Automation preparation changed or its checkpoint could not be confirmed. The saved slot will be recovered.", 409);
    return serializeSlotRow(result.data as SlotRow);
  };
  const occurrences = planUpcomingAutomationOccurrences({
    config: params.automation.config,
    horizonHours: 36,
  });

  const existingSlots = await listAutomationSlots(params.automation.userId);
  for (const slot of existingSlots) {
    if (slot.status === "preparing" && !slot.scheduleId && Date.parse(slot.scheduledFor) <= Date.now()) {
      await updateSlotRowInStorage(params.automation.userId, slot.id, {
        status: "missed_posting_time", hold_message: "Preparation did not finish before this posting time. No late post was sent.", updated_at: new Date().toISOString(),
      }, true);
    }
  }
  const existingByKey = new Map(
    existingSlots.map((slot) => [slot.idempotencyKey, slot]),
  );
  const reservedCreativeIds = new Set(existingSlots.map(slot => slot.creativeId).filter(Boolean));
  const savedSchedules = await listUserSchedules({ userId: params.automation.userId });
  const alreadyPostedSources = new Set(savedSchedules
    .filter(post => post.status !== "cancelled")
    .map(post => post.metadata?.carouselId)
    .filter((id): id is string => typeof id === "string"));

  const usedCarouselIds = new Set<string>(
    existingSlots
      .filter((slot) => slot.status !== "preparing")
      .map((slot) => slot.creativeId)
      .filter((id): id is string => Boolean(id)),
  );

  const availableCarousels = await loadReadyUnusedCarouselsForUser({
    excludeCarouselIds: usedCarouselIds,
    userId: params.automation.userId,
  });

  const publishingPreferences = await getPublishingPreferences(
    params.automation.userId,
  );

  let rotationCursor = params.automation.rotationCursor;
  const availableCollectionIds = params.usableCollectionAssets.map(
    (asset) => asset.id,
  );
  const nowIso = new Date().toISOString();
  let attentionReason: TrendingSlideshowAutomationAttentionReason = null;
  let attentionMessage: string | null = null;

  for (const occurrence of occurrences) {
    const idempotencyKey = createAutomationSlotIdempotencyKey({
      localDate: occurrence.localDate,
      slotTime: occurrence.slotTime,
      userId: params.automation.userId,
    });

    let existingSlot = existingByKey.get(idempotencyKey);
    if (
      existingSlot && (Boolean(existingSlot.scheduleId) ||
      existingSlot?.status !== "preparing" &&
      Boolean(existingSlot?.scheduleId || existingSlot?.status !== "scheduled"))
    ) {
      continue;
    }

    let backgroundAssetIds: string[] =
      existingSlot?.snapshot.backgroundAssetIds ?? [];
    let ctaScreenshotAssetId = existingSlot?.snapshot.ctaScreenshotAssetId ?? null;
    let slotStatus: TrendingSlideshowAutomationSlotStatus = "scheduled";
    let holdMessage: string | null = null;

    if (params.automation.config.backgrounds.mode === "collection_only") {
      if (backgroundAssetIds.length === 0) {
        const allocation = allocateCollectionOnlySlideBackgrounds({
          availableCollectionAssetIds: availableCollectionIds,
          collectionName: params.automation.config.backgrounds.collectionName,
          rotationCursor,
          selectedAssetIds:
            params.automation.config.backgrounds.selectedAssetIds,
          selectionMode: params.automation.config.backgrounds.selectionMode,
          slideCount: 1,
        });

        if (!allocation.ok) {
          slotStatus = "held_collection_empty";
          holdMessage = allocation.holdMessage;
          attentionReason = "collection_empty";
          attentionMessage = allocation.holdMessage;
        }
      }
    }

    const timing = evaluateAutomationSlotTiming({
      localDate: occurrence.localDate,
      slotTime: occurrence.slotTime,
      timezone: params.automation.config.timezone,
    });
    if (!timing.ok) {
      slotStatus = "missed_posting_time";
      holdMessage = timing.holdMessage;
    }

    const desiredStructureId = mapAutomationFormatToStructureId(
      occurrence.format,
    );
    const formatMeta =
      TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[occurrence.format];
    const visualStyleName =
      params.automation.config.visualStyle.mode === "saved"
        ? params.automation.config.visualStyle.styleName
        : "Default style";

    let creativeId: string | null = existingSlot?.creativeId ?? null;
    let libraryItemId: string | null = existingSlot?.libraryItemId ?? null;
    let scheduleId: string | null = existingSlot?.scheduleId ?? null;
    let headlinePreview =
      occurrence.format === "educational_tips"
        ? `${formatMeta.title} · Daily Authority Pack (${occurrence.localDate})`
        : `${formatMeta.title} · Problem-to-Solution Story (${occurrence.localDate})`;

    const snapshotNow = (): TrendingSlideshowAutomationSlotSnapshot => ({
      backgroundAssetIds, ctaScreenshotAssetId, backgroundMode: params.automation.config.backgrounds.mode,
      captionText: params.automation.config.caption.mode === "saved_caption" ? params.automation.config.caption.captionText
        : params.automation.config.caption.mode === "blank" ? "" : headlinePreview,
      collectionId: params.automation.config.backgrounds.mode === "collection_only" ? params.automation.config.backgrounds.collectionId : null,
      collectionName: params.automation.config.backgrounds.mode === "collection_only" ? params.automation.config.backgrounds.collectionName : null,
      configRevision: params.automation.revision, format: occurrence.format, headlinePreview,
      slideCount: availableCarousels.find(item => item.id === creativeId)?.slideCount ?? existingSlot?.snapshot.slideCount ?? 6,
      structureId: desiredStructureId, targets: params.automation.config.targets,
      visualStyle: params.automation.config.visualStyle.style, textPosition: params.automation.config.visualStyle.textPosition, visualStyleName,
    });
    const checkpoint = async () => {
      existingSlot = await persistCheckpoint({
        id: existingSlot?.id,
        creative_id: creativeId, library_item_id: libraryItemId, snapshot: snapshotNow(), updated_at: new Date().toISOString(),
        created_at: nowIso, format: occurrence.format, hold_message: null, idempotency_key: idempotencyKey,
        local_date: occurrence.localDate, schedule_id: null, scheduled_for: occurrence.scheduledFor,
        slot_index: occurrence.slotIndex, slot_time: occurrence.slotTime, status: "preparing", timezone: params.automation.config.timezone,
        user_id: params.automation.userId, user_modified: false,
      });
      if (existingSlot.userModified || existingSlot.scheduleId || existingSlot.status === "cancelled_by_user") {
        throw new SlideshowAutomationError("This slot was stopped or already scheduled. Its accepted output will not be changed.", 409);
      }
    };

    if (slotStatus === "scheduled") {
      const matchingCarousel = availableCarousels.find(
          (gen) =>
            !usedCarouselIds.has(gen.id) &&
            !alreadyPostedSources.has(gen.id) &&
            (!gen.availableOnLocalDate || gen.availableOnLocalDate <= occurrence.localDate) &&
            (!reservedCreativeIds.has(gen.id) || gen.id === existingSlot?.creativeId) &&
            (!existingSlot?.creativeId || gen.id === existingSlot.creativeId) &&
            gen.structureId === desiredStructureId,
        ) ?? null;

      if (!matchingCarousel) {
        slotStatus = "preparing";
        holdMessage =
          `Waiting for a ready ${formatMeta.title} slideshow. Other formats will not be substituted.`;
      } else {
        usedCarouselIds.add(matchingCarousel.id);
        creativeId = matchingCarousel.id;

        let schedulingStarted = false;
        try {
          if (existingSlot?.libraryItemId && existingSlot.snapshot.configRevision !== params.automation.revision) {
            throw new Error("This prepared slot belongs to earlier settings. Skip it or use the next daily slot; its saved output will not be rewritten.");
          }
          if (existingSlot?.libraryItemId) {
            headlinePreview = existingSlot.snapshot.headlinePreview;
          } else {
          await checkpoint();
          const librarySaveInput =
            await prepareGeneratedCarouselLibrarySaveForOwner(
              params.automation.userId,
              matchingCarousel.id,
            );
          headlinePreview = librarySaveInput.title || headlinePreview;

          const prepared = await prepareAutomationLibraryInput({
            source: librarySaveInput,
            config: params.automation.config,
            collectionAssets: params.usableCollectionAssets,
            rotationCursor,
            idempotencyKey,
          });
          backgroundAssetIds = prepared.backgroundAssetIds;
          ctaScreenshotAssetId = prepared.ctaScreenshotAssetId;
          rotationCursor = prepared.nextRotationCursor;
          // The render can outlive the lease. Revalidate before saving its
          // Library revision; content-addressed uploads themselves are immutable.
          await checkpoint();
          const savedLibrary = await saveGeneratedCarouselToLibrary(prepared.input);
          libraryItemId = savedLibrary.item.id;
          await checkpoint();
          }

          const resolvedCaption =
            params.automation.config.caption.mode === "saved_caption"
              ? params.automation.config.caption.captionText
              : params.automation.config.caption.mode === "blank"
              ? ""
              : headlinePreview;

          const scheduleTargets = buildScheduleTargetInputs(
            params.automation.config,
            publishingPreferences,
          );

          // Rendering can outlive a pause or settings change. Never publish from
          // stale activation intent, even when the output itself is ready.
          const currentAutomation = await getExistingAutomationRecord({
            dailyAllowance: params.automation.config.counts.dailyTotal,
            userId: params.automation.userId,
          });
          if (currentAutomation?.status !== "active" || currentAutomation.revision !== params.automation.revision) {
            return listAutomationSlots(params.automation.userId);
          }
          const renewed = await getClient().rpc("claim_slideshow_automation", {
            p_user_id: params.automation.userId, p_token: params.executionToken, p_revision: params.automation.revision,
          });
          if (renewed.error || renewed.data !== true) return listAutomationSlots(params.automation.userId);
          schedulingStarted = true;
          const createdSchedule = await createUserSchedule({
            automationGuard: { slotId: existingSlot!.id, token: params.executionToken, revision: params.automation.revision },
            allowTikTokTargets: true,
            allowYouTubeTargets: false,
            input: {
              caption: resolvedCaption,
              idempotencyKey: `auto-slot:${createHash("sha256").update(idempotencyKey).digest("hex")}`,
              metadata: {
                carouselId: matchingCarousel.id,
                mediaMode: "carousel",
                plannedScheduledFor: occurrence.scheduledFor,
                scheduledDate: occurrence.localDate,
                scheduledTime: occurrence.slotTime,
                sourceSurface: "trending",
              },
              plannedTargets: scheduleTargets,
              scheduledDate: occurrence.localDate,
              scheduledFor: occurrence.scheduledFor,
              scheduledTime: occurrence.slotTime,
              source: {
                id: libraryItemId!,
                kind: "library_item",
              },
              targets: scheduleTargets,
              timezone: params.automation.config.timezone,
              title: headlinePreview.slice(0, 160),
            },
            userId: params.automation.userId,
          });

          scheduleId = createdSchedule.schedule.id;
          slotStatus = "scheduled";
          holdMessage = null;
        } catch (scheduleError) {
          const latest = await getExistingAutomationRecord({ userId: params.automation.userId, dailyAllowance: params.automation.config.counts.dailyTotal });
          if (latest?.status !== "active" || latest.revision !== params.automation.revision) return listAutomationSlots(params.automation.userId);
          if (schedulingStarted) {
            // The atomic SQL handoff may have committed even when its response
            // or scheduler acknowledgement was lost. Never erase that receipt.
            const persisted = await getClient().from(SLOTS_TABLE).select("*").eq("user_id", params.automation.userId).eq("id", existingSlot!.id).maybeSingle();
            if (persisted.error) throw scheduleError;
            if (persisted.data?.schedule_id) {
              scheduleId = persisted.data.schedule_id;
              slotStatus = "scheduled";
              holdMessage = "Schedule saved; delivery status will recover from the original request.";
              continue;
            }
          }
          const errMessage =
            scheduleError instanceof Error
              ? scheduleError.message
              : "Could not schedule this automated slideshow.";
          const accountFailure = schedulingStarted && /account|reconnect|connection|token expired|invalid_grant/i.test(errMessage);
          slotStatus = accountFailure ? "action_required_account" : "preparing";
          holdMessage = errMessage.slice(0, 600);
          if (accountFailure) {
            attentionReason = "account_reconnect_required";
            attentionMessage = holdMessage;
          }
        }
      }
    }

    const captionText =
      params.automation.config.caption.mode === "saved_caption"
        ? params.automation.config.caption.captionText
        : params.automation.config.caption.mode === "blank"
        ? ""
        : headlinePreview;

    const snapshot: TrendingSlideshowAutomationSlotSnapshot = {
      backgroundAssetIds,
      ctaScreenshotAssetId,
      backgroundMode: params.automation.config.backgrounds.mode,
      captionText,
      collectionId:
        params.automation.config.backgrounds.mode === "collection_only"
          ? params.automation.config.backgrounds.collectionId
          : null,
      collectionName:
        params.automation.config.backgrounds.mode === "collection_only"
          ? params.automation.config.backgrounds.collectionName
          : null,
      configRevision: params.automation.revision,
      format: occurrence.format,
      headlinePreview,
      slideCount: availableCarousels.find((item) => item.id === creativeId)?.slideCount ?? existingSlot?.snapshot.slideCount ?? 6,
      structureId: desiredStructureId,
      targets: params.automation.config.targets,
      visualStyle: params.automation.config.visualStyle.style,
      textPosition: params.automation.config.visualStyle.textPosition,
      visualStyleName,
    };

    {
      await persistCheckpoint({
        id: existingSlot?.id,
        created_at: nowIso,
        creative_id: creativeId,
        format: occurrence.format,
        hold_message: holdMessage,
        idempotency_key: idempotencyKey,
        library_item_id: libraryItemId,
        local_date: occurrence.localDate,
        schedule_id: scheduleId,
        scheduled_for: occurrence.scheduledFor,
        slot_index: occurrence.slotIndex,
        slot_time: occurrence.slotTime,
        snapshot,
        status: slotStatus,
        timezone: params.automation.config.timezone,
        updated_at: nowIso,
        user_id: params.automation.userId,
        user_modified: false,
      });
    }
  }

  if (
    rotationCursor !== params.automation.rotationCursor ||
    attentionReason !== null
  ) {
    const finished = await getClient().rpc("finish_slideshow_automation", {
      p_user_id: params.automation.userId, p_token: params.executionToken, p_revision: params.automation.revision,
      p_rotation: rotationCursor, p_reason: attentionReason, p_message: attentionMessage,
    });
    if (finished.error) throw new SlideshowAutomationError("Automation progress could not be confirmed. Retry status recovery.", 503);
  }

  return listAutomationSlots(params.automation.userId);
}

async function loadUserImageCollectionSummaries(
  userId: string,
): Promise<SlideshowAutomationCollectionSummary[]> {
  try {
    const groups = await listCreativeAssetGroups({
      mediaType: "image",
      userId,
    });

    const summaries = await Promise.all(
      groups.map(async (group) => {
        const result = await listCreativeAssetGroupAssets({
          groupId: group.id,
          userId,
        }).catch(() => null);
        const usableAssets = (result?.assets ?? [])
          .map((entry) => entry.asset)
          .filter((asset) => isAvailableLibraryImage(asset));

        return {
          assets: usableAssets.map((asset) => ({
            id: asset.id,
            thumbnailUrl: asset.thumbnailUrl ?? asset.url,
            title: asset.title,
            url: asset.url,
          })),
          id: group.id,
          name: group.name,
          usableCount: usableAssets.length,
        };
      }),
    );

    return summaries;
  } catch {
    return [];
  }
}

async function loadUsableCollectionAssets(params: {
  collectionId: string;
  selectedAssetIds?: readonly string[];
  selectionMode: "all" | "subset";
  userId: string;
}): Promise<MediaAsset[]> {
  if (!params.collectionId.trim()) {
    return [];
  }

  const result = await listCreativeAssetGroupAssets({
    groupId: params.collectionId,
    userId: params.userId,
  });

  if (!result) {
    return [];
  }

  const usable = result.assets
    .map((item) => item.asset)
    .filter((asset) => isAvailableLibraryImage(asset));

  if (params.selectionMode === "subset") {
    const selectedSet = new Set(params.selectedAssetIds ?? []);
    return usable.filter((asset) => selectedSet.has(asset.id));
  }

  return usable;
}

function serializeAutomationRow(
  row: AutomationRow,
  dailyAllowance: number,
): TrendingSlideshowAutomationRecord {
  const fallback = createDefaultAutomationConfig({ dailyAllowance });
  const rawConfig =
    row.config && typeof row.config === "object"
      ? (row.config as Partial<TrendingSlideshowAutomationConfig>)
      : {};

  const counts = rawConfig.counts ?? fallback.counts;
  const dailySlots = syncAutomationDailySlots({
    counts,
    currentSlots: Array.isArray(rawConfig.dailySlots)
      ? rawConfig.dailySlots
      : fallback.dailySlots,
  });

  let parsedStyle = defaultCarouselManualTextStyle();
  try {
    if (rawConfig.visualStyle?.style) {
      parsedStyle =
        parseCarouselManualTextStyle(rawConfig.visualStyle.style) ??
        defaultCarouselManualTextStyle();
    }
  } catch {
    parsedStyle = defaultCarouselManualTextStyle();
  }

  const config: TrendingSlideshowAutomationConfig = {
    backgrounds:
      rawConfig.backgrounds?.mode === "collection_only"
        ? {
            collectionId: String(rawConfig.backgrounds.collectionId ?? ""),
            collectionName: String(
              rawConfig.backgrounds.collectionName ?? "Selected collection",
            ),
            mode: "collection_only",
            selectedAssetIds: Array.isArray(
              rawConfig.backgrounds.selectedAssetIds,
            )
              ? rawConfig.backgrounds.selectedAssetIds.map(String)
              : [],
            selectionMode:
              rawConfig.backgrounds.selectionMode === "subset"
                ? "subset"
                : "all",
          }
        : { mode: "default" },
    caption:
      rawConfig.caption?.mode === "saved_caption"
        ? {
            captionId: String(rawConfig.caption.captionId ?? ""),
            captionName: String(
              rawConfig.caption.captionName ?? "Saved caption",
            ),
            captionText: String(rawConfig.caption.captionText ?? ""),
            mode: "saved_caption",
          }
        : rawConfig.caption?.mode === "blank"
        ? { mode: "blank" }
        : { mode: "generated" },
    counts,
    dailySlots,
    quickMode: deriveQuickModeFromCounts(counts),
    startDate:
      typeof rawConfig.startDate === "string" && rawConfig.startDate
        ? rawConfig.startDate
        : fallback.startDate,
    targets: Array.isArray(rawConfig.targets) ? rawConfig.targets : [],
    timezone: normalizeAutomationTimezone(
      rawConfig.timezone ?? fallback.timezone,
    ),
    version: 1,
    visualStyle:
      rawConfig.visualStyle?.mode === "saved"
        ? {
            mode: "saved",
            style: parsedStyle,
            styleId: String(rawConfig.visualStyle.styleId ?? ""),
            styleName: String(rawConfig.visualStyle.styleName ?? "Saved style"),
            textPosition: {
              x: Number(rawConfig.visualStyle.textPosition?.x ?? 0.5),
              y: Number(rawConfig.visualStyle.textPosition?.y ?? 0.5),
            },
          }
        : {
            mode: "default",
            style: parsedStyle,
            textPosition: {
              x: Number(rawConfig.visualStyle?.textPosition?.x ?? 0.5),
              y: Number(rawConfig.visualStyle?.textPosition?.y ?? 0.5),
            },
          },
  };

  return {
    activatedAt: row.activated_at,
    attentionMessage: row.attention_message,
    attentionReason: row.attention_reason,
    config,
    pausedAt: row.paused_at,
    revision: row.revision,
    rotationCursor: row.rotation_cursor,
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function serializeVisualStyleRow(row: VisualStyleRow): SavedCarouselVisualStyle {
  let style = defaultCarouselManualTextStyle();
  try {
    style =
      parseCarouselManualTextStyle(row.style) ??
      defaultCarouselManualTextStyle();
  } catch {
    style = defaultCarouselManualTextStyle();
  }

  const rawPos =
    row.text_position && typeof row.text_position === "object"
      ? (row.text_position as { x?: unknown; y?: unknown })
      : {};

  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    style,
    textPosition: {
      x: Number.isFinite(Number(rawPos.x)) ? Number(rawPos.x) : 0.5,
      y: Number.isFinite(Number(rawPos.y)) ? Number(rawPos.y) : 0.5,
    },
    updatedAt: row.updated_at,
  };
}

function serializeSlotRow(row: SlotRow): TrendingSlideshowAutomationSlotRecord {
  const rawSnapshot =
    row.snapshot && typeof row.snapshot === "object"
      ? (row.snapshot as Partial<TrendingSlideshowAutomationSlotSnapshot>)
      : {};

  let visualStyle = defaultCarouselManualTextStyle();
  try {
    if (rawSnapshot.visualStyle) {
      visualStyle =
        parseCarouselManualTextStyle(rawSnapshot.visualStyle) ??
        defaultCarouselManualTextStyle();
    }
  } catch {
    visualStyle = defaultCarouselManualTextStyle();
  }

  return {
    createdAt: row.created_at,
    creativeId: row.creative_id,
    format: row.format,
    holdMessage: row.hold_message,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    libraryItemId: row.library_item_id,
    localDate: row.local_date,
    scheduleId: row.schedule_id,
    scheduledFor: row.scheduled_for,
    slotIndex: row.slot_index,
    slotTime: row.slot_time,
    snapshot: {
      ctaScreenshotAssetId: typeof rawSnapshot.ctaScreenshotAssetId === "string" ? rawSnapshot.ctaScreenshotAssetId : null,
      backgroundAssetIds: Array.isArray(rawSnapshot.backgroundAssetIds)
        ? rawSnapshot.backgroundAssetIds.map(String)
        : [],
      backgroundMode:
        rawSnapshot.backgroundMode === "collection_only"
          ? "collection_only"
          : "default",
      captionText: String(rawSnapshot.captionText ?? ""),
      collectionId: rawSnapshot.collectionId
        ? String(rawSnapshot.collectionId)
        : null,
      collectionName: rawSnapshot.collectionName
        ? String(rawSnapshot.collectionName)
        : null,
      configRevision: Number(rawSnapshot.configRevision ?? 1),
      format: row.format,
      headlinePreview: String(
        rawSnapshot.headlinePreview ??
          TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[row.format].title,
      ),
      slideCount: Number(rawSnapshot.slideCount ?? 6),
      structureId: mapAutomationFormatToStructureId(row.format),
      targets: Array.isArray(rawSnapshot.targets) ? rawSnapshot.targets : [],
      visualStyle,
      textPosition: rawSnapshot.textPosition ?? { x: 0.5, y: 0.5 },
      visualStyleName: String(rawSnapshot.visualStyleName ?? "Default style"),
    },
    status: row.status,
    timezone: row.timezone,
    updatedAt: row.updated_at,
    userId: row.user_id,
    userModified: Boolean(row.user_modified),
  };
}
