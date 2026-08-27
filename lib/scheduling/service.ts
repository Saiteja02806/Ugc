import "server-only";

import {
  createSocialPublishSchedule,
  deleteSocialPublishSchedule,
} from "@/lib/scheduling/social-scheduler";
import {
  assertFreeTrialInstagramSchedulingAccess,
  FreeTrialAccessError,
} from "@/lib/billing/free-trial";
import {
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import {
  attachQueueMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import {
  attachPublishJobToScheduleTarget,
  cancelScheduledPostRows,
  deleteFailedScheduleTargetsForRetry,
  getConnectedSocialConnection,
  getMissingScheduleDbEnvVars,
  getSchedulableLibraryItem,
  getSchedulableMediaAsset,
  getScheduledPostByIdempotency,
  getScheduledPostForUser,
  insertScheduledPost,
  insertScheduledPostTargets,
  listCancelledScheduleTargetsNeedingCleanup,
  listScheduledPostsForUser,
  markScheduleTargetCleanupFailed,
  markScheduledPostStatus,
  markScheduleTargetFailed,
  markScheduleTargetScheduler,
  markScheduleTargetSchedulerDeleted,
  markScheduleTargetSchedulerFallback,
  prepareScheduledPostForPublishing,
  requestSocialPublishTargetRetry,
  updateEditableScheduledPost,
} from "@/lib/scheduling/db";
import {
  getMediaAssetForOwner,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
import {
  resolveDemoRenderAsset,
  resolveOpeningRenderAsset,
} from "@/lib/scheduling/render-asset-resolution";
import {
  normalizeScheduleTargetSettings,
  SchedulePlatformSettingsError,
  type ScheduleTargetSettings,
} from "@/lib/scheduling/platform-settings";
import {
  getZonedDateTimeParts,
  parseSchedulingTaskCreationBufferSeconds,
  parseSocialSchedulingMinimumLeadMinutes,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
  validateSchedulingTaskCreationBuffer,
  validateTimeZone,
} from "@/lib/scheduling/schedule-time";
import { getScheduleEditBlockReason } from "@/lib/scheduling/schedule-action-policy";
import { SchedulingRequestError } from "@/lib/scheduling/errors";
import { getConnectionPublishingBlock } from "@/lib/scheduling/social-connection-policy";
import {
  hasScheduleTargetSelection,
  SCHEDULE_TARGET_REQUIRED_CODE,
  SCHEDULE_TARGET_REQUIRED_MESSAGE,
} from "@/lib/scheduling/schedule-target-requirement";
import {
  canRetrySchedulerCreateFailure,
  getRenderFinalizationDecision,
} from "@/lib/scheduling/render-finalization-policy";
import { scheduleTargetRowsWithDependencies } from "@/lib/scheduling/target-scheduling";
import { deliverSocialPublishRetry } from "@/lib/scheduling/publish-retry";
import type {
  ScheduledPost,
  ScheduledPostStatus,
  ScheduleCreateInput,
  ScheduleCreateTargetInput,
  SchedulePlatform,
  ScheduleUpdateInput,
} from "@/lib/scheduling/types";
import { isSocialPlatform } from "@/lib/social/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const directScheduledVideoSourceTypes = new Set([
  "demo_upload",
  "influencer_upload",
  "upload",
  "generated_video",
  "edit_export",
  "wall_text_render",
]);
const directScheduledVideoCollections = new Set(["influencer", "video"]);
const creativeAssetHookVideoSourceTypes = new Set([
  "catalog_influencer",
  "influencer_upload",
  "upload",
  "generated_video",
]);

type ScheduleMediaMode = "single_video" | "combined_video" | "carousel";
type ScheduleLeadPolicy = "render_finalization" | "standard";

export type ScheduleRenderedPostInput = {
  connectionIds?: unknown;
  scheduledDate?: unknown;
  scheduledFor?: unknown;
  scheduledTime?: unknown;
  timezone?: unknown;
};

export type FinalizeRenderedScheduleInput = {
  renderId: string;
  scheduleId: string;
  userId: string;
};

export { SchedulingRequestError } from "@/lib/scheduling/errors";

export function getMissingSchedulingRuntimeEnvVars() {
  return [
    ...new Set([
      ...getMissingScheduleDbEnvVars(),
      ...getMissingBackgroundJobStorageEnvVars(),
    ]),
  ];
}

export async function listUserSchedules(params: {
  from?: string | null;
  status?: ScheduledPostStatus | null;
  to?: string | null;
  userId: string;
}) {
  return listScheduledPostsForUser(params);
}

export async function reconcileCancelledSchedulerResources(userId: string) {
  const targets = await listCancelledScheduleTargetsNeedingCleanup({
    limit: 10,
    userId,
  });

  await cleanupCancelledSchedulerTargets({ targets, userId });
}

export async function getUserSchedule(params: {
  postId: string;
  userId: string;
}) {
  assertUuid(params.postId, "Schedule ID is invalid.");
  return getScheduledPostForUser(params);
}

export async function createUserSchedule(params: {
  input: ScheduleCreateInput;
  userId: string;
}) {
  const normalized = await normalizeScheduleCreateInput(params.input);
  assertScheduleTargetSelection(normalized);

  if (normalized.idempotencyKey) {
    const existing = await getScheduledPostByIdempotency({
      idempotencyKey: normalized.idempotencyKey,
      userId: params.userId,
    });

    if (existing) {
      return {
        created: false,
        schedule: existing,
      };
    }
  }

  const source = await resolveScheduleSource({
    sourceId: normalized.source.id,
    sourceKind: normalized.source.kind,
    userId: params.userId,
  });
  const [targetConnections, plannedTargetConnections] = await Promise.all([
    resolveScheduleTargets({
      targets: normalized.targets,
      userId: params.userId,
    }),
    resolveScheduleTargets({
      targets: normalized.plannedTargets,
      userId: params.userId,
    }),
  ]);
  const trustedMetadata = applyTrustedPlannedTargetMetadata({
    metadata: normalized.metadata,
    plannedTargets: plannedTargetConnections,
    snapshotProvided: normalized.plannedTargetsProvided,
  });
  const metadata =
    normalized.source.kind === "library_item"
      ? { ...trustedMetadata, mediaMode: "carousel" }
      : trustedMetadata;
  const isDraft = targetConnections.length === 0;
  const mediaMode = getScheduleMediaMode(metadata);

  if (
    !isDraft &&
    targetConnections.some((connection) => connection.platform === "instagram")
  ) {
    await assertInstagramTrialScheduleAccess(params.userId);
  }

  await assertSelectedHookIsCreativeAsset({
    mediaMode,
    metadata,
    userId: params.userId,
  });

  if (
    !isDraft &&
    normalized.source.kind === "media_asset" &&
    !isPublishableMediaSource({
      collection: source.collection,
      mediaMode,
      sourceType: source.sourceType,
    })
  ) {
    throw new SchedulingRequestError(
      "Choose a Reel clip or prepare the hook and secondary clips before scheduling.",
      409,
      "publishable_media_required",
    );
  }

  assertCarouselTargetPlatformsSupported({
    sourceKind: normalized.source.kind,
    targets: targetConnections,
  });

  const postStatus: ScheduledPostStatus = isDraft ? "draft" : "scheduling";
  const post = await insertScheduledPost({
    caption: normalized.caption,
    idempotency_key: normalized.idempotencyKey,
    library_item_id:
      normalized.source.kind === "library_item" ? normalized.source.id : null,
    media_asset_id:
      normalized.source.kind === "media_asset" ? normalized.source.id : null,
    metadata,
    project_id: source.projectId,
    scheduled_for: normalized.scheduledFor,
    source_kind: normalized.source.kind,
    status: postStatus,
    timezone: normalized.timezone,
    title: normalized.title || source.title,
    user_id: params.userId,
  });

  if (isDraft) {
    const schedule = await getRequiredSchedule({
      postId: post.id,
      userId: params.userId,
    });

    return {
      created: true,
      schedule,
    };
  }

  if (!normalized.scheduledFor) {
    throw new SchedulingRequestError("Choose a date and time to schedule.");
  }

  const scheduledFor = normalized.scheduledFor;
  const targetRows = await insertScheduledPostTargets(
    targetConnections.map((connection) => ({
      metadata: {},
      platform: connection.platform,
      scheduled_for: scheduledFor,
      scheduled_post_id: post.id,
      settings: connection.settings,
      social_connection_id: connection.id,
      status: "scheduling",
      user_id: params.userId,
    })),
  );

  const { failedCount, scheduledCount } = await scheduleTargetRows({
    projectId: post.project_id,
    targetRows,
    userId: params.userId,
  });

  await markScheduledPostStatus({
    lastErrorCode: failedCount > 0 ? "scheduler_create_failed" : null,
    postId: post.id,
    status: getPostStatusFromSchedulerCounts({ failedCount, scheduledCount }),
    userId: params.userId,
  });

  const schedule = await getRequiredSchedule({
    postId: post.id,
    userId: params.userId,
  });

  return {
    created: true,
    schedule,
  };
}

export async function scheduleRenderedPost(params: {
  input: ScheduleRenderedPostInput;
  leadPolicy?: ScheduleLeadPolicy;
  postId: string;
  userId: string;
}) {
  assertUuid(params.postId, "Schedule ID is invalid.");

  let existing = await getScheduledPostForUser({
    postId: params.postId,
    userId: params.userId,
  });

  if (!existing) {
    throw new SchedulingRequestError("This schedule was not found.", 404);
  }

  if (canRetrySchedulerCreateFailure(existing)) {
    await deleteFailedScheduleTargetsForRetry({
      errorCode: "scheduler_create_failed",
      postId: existing.id,
      userId: params.userId,
    });
    existing = {
      ...existing,
      targets: [],
    };
  }

  if (
    existing.targets.length > 0 &&
    ["scheduled", "scheduling", "publishing", "published"].includes(
      existing.status,
    )
  ) {
    return {
      created: false,
      schedule: existing,
    };
  }

  if (existing.targets.length > 0) {
    throw new SchedulingRequestError(
      "This schedule already has publishing targets. Create a new draft to retry.",
      409,
      "schedule_targets_already_exist",
    );
  }

  if (
    existing.status === "cancelled" ||
    existing.status === "publishing" ||
    existing.status === "published"
  ) {
    throw new SchedulingRequestError(
      "This schedule cannot be changed now.",
      409,
      "schedule_not_editable",
    );
  }

  const leadPolicy = params.leadPolicy ?? "standard";
  const normalized = normalizeRenderedScheduleInput(
    params.input,
    existing,
  );
  const assertLeadTime =
    leadPolicy === "render_finalization"
      ? assertTaskCreationBuffer
      : assertMinimumScheduleLead;

  assertLeadTime(normalized.scheduledFor);
  const targetConnections = await resolveScheduleTargets({
    targets: normalized.targets,
    userId: params.userId,
  });

  if (targetConnections.length === 0) {
    throw new SchedulingRequestError(
      "Choose at least one connected account before scheduling.",
      409,
      "schedule_targets_required",
    );
  }

  if (targetConnections.some((connection) => connection.platform === "instagram")) {
    await assertInstagramTrialScheduleAccess(params.userId);
  }

  if (existing.sourceKind === "library_item") {
    const libraryItemId = existing.libraryItemId;

    if (!libraryItemId) {
      throw new SchedulingRequestError(
        "This carousel schedule is missing its Library item.",
        409,
        "library_item_unavailable",
      );
    }

    await resolveScheduleSource({
      sourceId: libraryItemId,
      sourceKind: "library_item",
      userId: params.userId,
    });
    assertCarouselTargetPlatformsSupported({
      sourceKind: "library_item",
      targets: targetConnections,
    });

    const prepared = await prepareScheduledPostForPublishing({
      expectedStatus: existing.status,
      expectedUpdatedAt: existing.updatedAt,
      mediaAssetId: null,
      metadata: {
        finalScheduleError: null,
        finalScheduleRenderId: null,
        finalScheduleRequestedAt: new Date().toISOString(),
        finalScheduleStatus: "scheduling",
        mediaMode: "carousel",
        plannedConnectionIds: normalized.connectionIds.join(","),
        plannedScheduledFor: normalized.scheduledFor,
        scheduledDate: normalized.scheduleTime.scheduledDate,
        scheduledTime: normalized.scheduleTime.scheduledTime,
      },
      postId: existing.id,
      scheduledFor: normalized.scheduledFor,
      timezone: normalized.timezone,
      userId: params.userId,
    });

    if (!prepared) {
      throw new SchedulingRequestError(
        "This schedule changed while platform scheduling was starting. Reload it and try again.",
        409,
        "schedule_version_conflict",
      );
    }

    const targetRows = await insertScheduledPostTargets(
      targetConnections.map((connection) => ({
        metadata: {
          libraryItemId,
          mediaMode: "carousel",
        },
        platform: connection.platform,
        scheduled_for: normalized.scheduledFor,
        scheduled_post_id: existing.id,
        settings: connection.settings,
        social_connection_id: connection.id,
        status: "scheduling",
        user_id: params.userId,
      })),
    );

    const { failedCount, scheduledCount } = await scheduleTargetRows({
      projectId: existing.projectId,
      targetRows,
      userId: params.userId,
    });

    await markScheduledPostStatus({
      lastErrorCode: failedCount > 0 ? "scheduler_create_failed" : null,
      postId: existing.id,
      status: getPostStatusFromSchedulerCounts({ failedCount, scheduledCount }),
      userId: params.userId,
    });

    return {
      created: true,
      schedule: await getRequiredSchedule({
        postId: existing.id,
        userId: params.userId,
      }),
    };
  }

  if (getScheduleMediaMode(existing.metadata) === "single_video") {
    const scheduledVideoAssetId = getSingleVideoScheduleAssetId(existing);

    if (!scheduledVideoAssetId) {
      throw new SchedulingRequestError(
        "Choose a video before scheduling this post.",
        409,
        "scheduled_video_required",
      );
    }

    assertUuid(scheduledVideoAssetId, "Scheduled video ID is invalid.");

    const scheduledVideoAsset = await getMediaAssetForOwner({
      assetId: scheduledVideoAssetId,
      userId: params.userId,
    });

    if (!isDirectScheduledVideoAsset(scheduledVideoAsset)) {
      throw new SchedulingRequestError(
        "The selected Reel clip is not available for publishing.",
        409,
        "scheduled_video_unavailable",
      );
    }

    const prepared = await prepareScheduledPostForPublishing({
      expectedStatus: existing.status,
      expectedUpdatedAt: existing.updatedAt,
      mediaAssetId: scheduledVideoAsset.id,
      metadata: {
        finalScheduleError: null,
        finalScheduleRenderId: null,
        finalScheduleRequestedAt: new Date().toISOString(),
        finalScheduleStatus: "scheduling",
        mediaMode: "single_video",
        plannedConnectionIds: normalized.connectionIds.join(","),
        plannedScheduledFor: normalized.scheduledFor,
        scheduledDate: normalized.scheduleTime.scheduledDate,
        scheduledTime: normalized.scheduleTime.scheduledTime,
        scheduledVideoId: scheduledVideoAsset.id,
        scheduledVideoSourceType: scheduledVideoAsset.source_type,
        scheduledVideoTitle:
          getMetadataString(existing.metadata.scheduledVideoTitle) ??
          scheduledVideoAsset.title,
        useOpeningClip: false,
      },
      postId: existing.id,
      scheduledFor: normalized.scheduledFor,
      timezone: normalized.timezone,
      userId: params.userId,
    });

    if (!prepared) {
      throw new SchedulingRequestError(
        "This schedule changed while platform scheduling was starting. Reload it and try again.",
        409,
        "schedule_version_conflict",
      );
    }

    const targetRows = await insertScheduledPostTargets(
      targetConnections.map((connection) => ({
        metadata: {
          mediaMode: "single_video",
          scheduledVideoId: scheduledVideoAsset.id,
        },
        platform: connection.platform,
        scheduled_for: normalized.scheduledFor,
        scheduled_post_id: existing.id,
        settings: connection.settings,
        social_connection_id: connection.id,
        status: "scheduling",
        user_id: params.userId,
      })),
    );

    const { failedCount, scheduledCount } = await scheduleTargetRows({
      projectId: existing.projectId ?? scheduledVideoAsset.project_id,
      targetRows,
      userId: params.userId,
    });

    await markScheduledPostStatus({
      lastErrorCode: failedCount > 0 ? "scheduler_create_failed" : null,
      postId: existing.id,
      status: getPostStatusFromSchedulerCounts({ failedCount, scheduledCount }),
      userId: params.userId,
    });

    return {
      created: true,
      schedule: await getRequiredSchedule({
        postId: existing.id,
        userId: params.userId,
      }),
    };
  }

  const combinedMediaAssetId = getMetadataString(
    existing.metadata.combinedMediaAssetId,
  );
  const combinedRenderStatus = getMetadataString(
    existing.metadata.combinedRenderStatus,
  );

  if (combinedRenderStatus !== "ready" || !combinedMediaAssetId) {
    throw new SchedulingRequestError(
      "Prepare the hook and secondary clips before scheduling the final post.",
      409,
      "combined_render_not_ready",
    );
  }

  assertUuid(combinedMediaAssetId, "Combined media ID is invalid.");

  const combinedAsset = await getMediaAssetForOwner({
    assetId: combinedMediaAssetId,
    userId: params.userId,
  });

  if (
    !combinedAsset ||
    combinedAsset.status !== "ready" ||
    combinedAsset.collection !== "video" ||
    combinedAsset.source_type !== "combined_render"
  ) {
    throw new SchedulingRequestError(
      "The combined video is not available for scheduling.",
      409,
      "combined_media_unavailable",
    );
  }

  await assertCombinedRenderIsCurrent({
    combinedAsset,
    schedule: existing,
    userId: params.userId,
  });

  const prepared = await prepareScheduledPostForPublishing({
    expectedStatus: existing.status,
    expectedUpdatedAt: existing.updatedAt,
    mediaAssetId: combinedAsset.id,
    metadata: {
      finalScheduleError: null,
      finalScheduleRenderId: getMetadataString(
        existing.metadata.combinedRenderId,
      ),
      finalScheduleRequestedAt: new Date().toISOString(),
      finalScheduleStatus: "scheduling",
      mediaMode: "combined_video",
      plannedConnectionIds: normalized.connectionIds.join(","),
      plannedScheduledFor: normalized.scheduledFor,
      scheduledDate: normalized.scheduleTime.scheduledDate,
      scheduledTime: normalized.scheduleTime.scheduledTime,
    },
    postId: existing.id,
    scheduledFor: normalized.scheduledFor,
    timezone: normalized.timezone,
    userId: params.userId,
  });

  if (!prepared) {
    throw new SchedulingRequestError(
      "This schedule changed while platform scheduling was starting. Reload it and try again.",
      409,
      "schedule_version_conflict",
    );
  }

  const targetRows = await insertScheduledPostTargets(
    targetConnections.map((connection) => ({
      metadata: {
        combinedMediaAssetId,
        mediaMode: "combined_video",
      },
      platform: connection.platform,
      scheduled_for: normalized.scheduledFor,
      scheduled_post_id: existing.id,
      settings: connection.settings,
      social_connection_id: connection.id,
      status: "scheduling",
      user_id: params.userId,
    })),
  );

  const { failedCount, scheduledCount } = await scheduleTargetRows({
    projectId: existing.projectId,
    targetRows,
    userId: params.userId,
  });

  await markScheduledPostStatus({
    lastErrorCode: failedCount > 0 ? "scheduler_create_failed" : null,
    postId: existing.id,
    status: getPostStatusFromSchedulerCounts({ failedCount, scheduledCount }),
    userId: params.userId,
  });

  return {
    created: true,
    schedule: await getRequiredSchedule({
      postId: existing.id,
      userId: params.userId,
    }),
  };
}

export async function retryUserScheduleTargetPublishing(params: {
  postId: string;
  targetId: string;
  userId: string;
}) {
  assertUuid(params.postId, "Schedule ID is invalid.");
  assertUuid(params.targetId, "Platform target ID is invalid.");

  const claim = await requestSocialPublishTargetRetry(params);

  if (claim.outcome === "not_found") {
    throw new SchedulingRequestError(
      "This platform publish was not found.",
      404,
      "publish_target_not_found",
    );
  }

  if (claim.outcome === "cancelled") {
    throw new SchedulingRequestError(
      "This scheduled post was cancelled and cannot be retried.",
      409,
      "schedule_cancelled",
    );
  }

  if (claim.outcome === "action_required") {
    throw new SchedulingRequestError(
      "Reconnect this account before retrying publishing.",
      409,
      "social_connection_action_required",
    );
  }

  if (claim.outcome === "connection_unavailable") {
    throw new SchedulingRequestError(
      "This account is no longer available. Reconnect it before retrying.",
      409,
      "social_connection_unavailable",
    );
  }

  if (claim.outcome === "media_unavailable") {
    throw new SchedulingRequestError(
      "The prepared video is no longer available. Create a new scheduled post.",
      409,
      "combined_media_unavailable",
    );
  }

  if (claim.outcome === "scheduling_retry_required") {
    throw new SchedulingRequestError(
      "Platform scheduling did not finish. Use Retry scheduling for this post.",
      409,
      "scheduler_retry_required",
    );
  }

  if (claim.outcome === "not_retryable") {
    throw new SchedulingRequestError(
      "This platform publish is not currently eligible for retry.",
      409,
      "publish_target_not_retryable",
    );
  }

  await deliverSocialPublishRetry(claim, {
    attachMessage: attachQueueMessageToBackgroundJob,
    reportError: (event, details) => {
      console.error(`Social publish retry ${event}:`, details);
    },
    sendMessage: sendJobMessage,
  });

  return {
    created: claim.outcome === "retry_created",
    retryStatus:
      claim.outcome === "already_published"
        ? ("published" as const)
        : claim.outcome === "already_queued"
          ? ("in_progress" as const)
          : ("started" as const),
    schedule: await getRequiredSchedule({
      postId: params.postId,
      userId: params.userId,
    }),
  };
}

export async function updateUserSchedule(params: {
  input: ScheduleUpdateInput;
  postId: string;
  userId: string;
}) {
  assertUuid(params.postId, "Schedule ID is invalid.");

  const existing = await getScheduledPostForUser({
    postId: params.postId,
    userId: params.userId,
  });

  if (!existing) {
    throw new SchedulingRequestError("This schedule was not found.", 404);
  }

  const editBlockReason = getScheduleEditBlockReason(existing);

  if (editBlockReason) {
    throw new SchedulingRequestError(
      editBlockReason,
      409,
      "schedule_not_editable",
    );
  }

  const expectedUpdatedAt = normalizeOptionalText(
    params.input.expectedUpdatedAt,
    64,
  );

  if (!expectedUpdatedAt) {
    throw new SchedulingRequestError(
      "Reload this schedule before editing it.",
      409,
      "schedule_version_required",
    );
  }

  if (expectedUpdatedAt !== existing.updatedAt) {
    throw new SchedulingRequestError(
      "This schedule changed while it was open. Reload it and try again.",
      409,
      "schedule_version_conflict",
    );
  }

  const normalized = await normalizeScheduleCreateInput(params.input);
  assertScheduleTargetSelection(normalized);

  if (normalized.targets.length > 0) {
    throw new SchedulingRequestError(
      "Edit planned accounts before platform publishing starts.",
      409,
      "schedule_targets_already_exist",
    );
  }

  if (normalized.source.kind === "library_item") {
    if (
      existing.sourceKind !== "library_item" ||
      existing.libraryItemId !== normalized.source.id
    ) {
      throw new SchedulingRequestError(
        "The saved carousel attached to this draft cannot be replaced.",
        409,
        "schedule_source_not_editable",
      );
    }

    const source = await resolveScheduleSource({
      sourceId: normalized.source.id,
      sourceKind: "library_item",
      userId: params.userId,
    });
    const plannedTargetConnections = await resolveScheduleTargets({
      targets: normalized.plannedTargets,
      userId: params.userId,
    });
    assertCarouselTargetPlatformsSupported({
      sourceKind: "library_item",
      targets: plannedTargetConnections,
    });
    const metadata = applyTrustedPlannedTargetMetadata({
      metadata: {
        ...normalizeMetadata(existing.metadata),
        ...normalized.metadata,
        mediaMode: "carousel",
      },
      plannedTargets: plannedTargetConnections,
      snapshotProvided: normalized.plannedTargetsProvided,
    });
    const updated = await updateEditableScheduledPost({
      expectedUpdatedAt,
      postId: existing.id,
      update: {
        caption: normalized.caption,
        last_error_code: null,
        library_item_id: normalized.source.id,
        media_asset_id: null,
        metadata,
        project_id: source.projectId,
        scheduled_for: null,
        source_kind: "library_item",
        status: "draft",
        timezone: normalized.timezone,
        title: normalized.title || source.title,
      },
      userId: params.userId,
    });

    if (!updated) {
      throw new SchedulingRequestError(
        "This schedule changed while it was being saved. Reload it and try again.",
        409,
        "schedule_version_conflict",
      );
    }

    return updated;
  }

  const nextMediaMode = getScheduleMediaMode(normalized.metadata);
  const hookMediaId = getMetadataString(normalized.metadata.hookMediaId);

  if (nextMediaMode === "combined_video" && !hookMediaId) {
    throw new SchedulingRequestError(
      "Choose a hook clip before saving this schedule.",
    );
  }

  if (hookMediaId) {
    assertUuid(hookMediaId, "Hook clip ID is invalid.");
  }

  await assertSelectedHookIsCreativeAsset({
    mediaMode: nextMediaMode,
    metadata: normalized.metadata,
    userId: params.userId,
  });

  const source = await resolveScheduleSource({
    sourceId: normalized.source.id,
    sourceKind: normalized.source.kind,
    userId: params.userId,
  });

  if (
    nextMediaMode === "single_video" &&
    !isDirectScheduledVideoSource({
      collection: source.collection,
      sourceType: source.sourceType,
    })
  ) {
    throw new SchedulingRequestError(
      "Choose a ready video before saving this schedule.",
      409,
      "scheduled_video_required",
    );
  }

  const plannedTargetConnections = await resolveScheduleTargets({
    targets: normalized.plannedTargets,
    userId: params.userId,
  });
  const mergedMetadata = {
    ...normalizeMetadata(existing.metadata),
    ...normalized.metadata,
    demoMediaId: normalized.source.id,
    scheduledVideoId: normalized.source.id,
  };
  const metadata = applyTrustedPlannedTargetMetadata({
    metadata: mergedMetadata,
    plannedTargets: plannedTargetConnections,
    snapshotProvided: normalized.plannedTargetsProvided,
  });
  const previousHookMediaId = getMetadataString(existing.metadata.hookMediaId);
  const previousDemoMediaId =
    getMetadataString(existing.metadata.scheduledVideoId) ??
    getMetadataString(existing.metadata.demoMediaId) ?? existing.mediaAssetId;
  const previousMediaMode = getScheduleMediaMode(existing.metadata);
  const mediaChanged =
    previousMediaMode !== nextMediaMode ||
    previousHookMediaId !== hookMediaId ||
    previousDemoMediaId !== normalized.source.id;
  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    finalScheduleCompletedAt: null,
    finalScheduleError: null,
    finalScheduleErrorCode: null,
    finalScheduleFailedAt: null,
    finalScheduleRenderId: null,
    finalScheduleRequestedAt: null,
    finalScheduleStartedAt: null,
    finalScheduleStatus: null,
  };

  if (nextMediaMode === "single_video") {
    Object.assign(nextMetadata, {
      hookMediaId: null,
      hookMediaTitle: null,
      mediaMode: "single_video",
      useOpeningClip: false,
    });
  }

  if (mediaChanged || nextMediaMode === "single_video") {
    Object.assign(nextMetadata, {
      combinedMediaAssetId: null,
      combinedRenderError: null,
      combinedRenderId: null,
      combinedRenderJobId: null,
      combinedRenderQueuedAt: null,
      combinedRenderedAt: null,
      combinedRenderStatus: null,
      combinedVideoUrl: null,
    });
  }

  const updated = await updateEditableScheduledPost({
    expectedUpdatedAt,
    postId: existing.id,
    update: {
      caption: normalized.caption,
      last_error_code: null,
      library_item_id: null,
      media_asset_id: normalized.source.id,
      metadata: nextMetadata,
      project_id: source.projectId,
      scheduled_for: null,
      source_kind: normalized.source.kind,
      status: "draft",
      timezone: normalized.timezone,
      title: normalized.title || source.title,
    },
    userId: params.userId,
  });

  if (!updated) {
    throw new SchedulingRequestError(
      "This schedule changed while it was being saved. Reload it and try again.",
      409,
      "schedule_version_conflict",
    );
  }

  return updated;
}

export function getSocialSchedulingMinimumLeadMinutes() {
  return parseSocialSchedulingMinimumLeadMinutes(
    process.env.SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
}

export async function finalizeRenderedScheduleFromWorker(
  input: FinalizeRenderedScheduleInput,
) {
  assertUuid(input.scheduleId, "Schedule ID is invalid.");
  assertUuid(input.renderId, "Render ID is invalid.");

  const existing = await getScheduledPostForUser({
    postId: input.scheduleId,
    userId: input.userId,
  });

  if (!existing) {
    throw new SchedulingRequestError("This schedule was not found.", 404);
  }

  const decision = getRenderFinalizationDecision({
    hasPlannedTime: Boolean(getPlannedScheduledFor(existing)),
    renderId: input.renderId,
    schedule: existing,
  });

  if (decision.action === "reject") {
    throw new SchedulingRequestError(
      decision.message,
      409,
      decision.code,
    );
  }

  if (decision.action === "skip" || decision.action === "already_finalized") {
    return {
      created: false,
      scheduleId: existing.id,
      skipped: decision.action === "skip",
      status: existing.status,
    };
  }

  const result = await scheduleRenderedPost({
    input: {},
    leadPolicy: "render_finalization",
    postId: existing.id,
    userId: input.userId,
  });

  return {
    created: result.created,
    scheduleId: result.schedule.id,
    skipped: false,
    status: result.schedule.status,
  };
}

async function assertCombinedRenderIsCurrent(params: {
  combinedAsset: MediaAssetRow;
  schedule: ScheduledPost;
  userId: string;
}) {
  const hookMediaId = getMetadataString(params.schedule.metadata.hookMediaId);
  const scheduledVideoId =
    getMetadataString(params.schedule.metadata.scheduledVideoId) ??
    getMetadataString(params.schedule.metadata.demoMediaId) ??
    params.schedule.mediaAssetId;

  if (!hookMediaId || !scheduledVideoId) {
    return;
  }

  const [hookAsset, scheduledVideoAsset] = await Promise.all([
    getMediaAssetForOwner({
      assetId: hookMediaId,
      userId: params.userId,
    }),
    getMediaAssetForOwner({
      assetId: scheduledVideoId,
      userId: params.userId,
    }),
  ]);

  if (!hookAsset || !scheduledVideoAsset) {
    throw new SchedulingRequestError(
      "The selected hook or secondary clip is no longer available.",
      409,
      "schedule_source_unavailable",
    );
  }

  const projectId =
    params.schedule.projectId ??
    scheduledVideoAsset.project_id ??
    hookAsset.project_id ??
    "schedule";
  const [resolvedHookAsset, resolvedScheduledVideoAsset] = await Promise.all([
    resolveOpeningRenderAsset({
      asset: hookAsset,
      userId: params.userId,
    }),
    resolveScheduledVideoRenderAsset({
      asset: scheduledVideoAsset,
      projectId,
      userId: params.userId,
    }),
  ]);

  if (!resolvedHookAsset.ok) {
    throw new SchedulingRequestError(
      resolvedHookAsset.message,
      409,
      "combined_render_stale",
    );
  }

  if (!resolvedScheduledVideoAsset.ok) {
    throw new SchedulingRequestError(
      resolvedScheduledVideoAsset.message,
      409,
      "combined_render_stale",
    );
  }

  const combinedHookMediaId = getMetadataString(
    getObjectValue(params.combinedAsset.metadata, "hookVideoId"),
  );
  const combinedDemoMediaId = getMetadataString(
    getObjectValue(params.combinedAsset.metadata, "demoVideoId"),
  );

  if (
    combinedHookMediaId !== resolvedHookAsset.asset.id ||
    combinedDemoMediaId !== resolvedScheduledVideoAsset.asset.id
  ) {
    throw new SchedulingRequestError(
      "Prepare the latest hook and secondary clips before scheduling the final post.",
      409,
      "combined_render_stale",
    );
  }
}

async function resolveScheduledVideoRenderAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}) {
  if (params.asset.source_type === "demo_upload") {
    return resolveDemoRenderAsset(params);
  }

  return resolveOpeningRenderAsset({
    asset: params.asset,
    userId: params.userId,
  });
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getObjectValue(value: unknown, key: string) {
  return getRecord(value)?.[key];
}

export async function cancelUserSchedule(params: {
  postId: string;
  userId: string;
}) {
  assertUuid(params.postId, "Schedule ID is invalid.");

  const existing = await getScheduledPostForUser({
    postId: params.postId,
    userId: params.userId,
  });

  if (!existing) {
    throw new SchedulingRequestError("This schedule was not found.", 404);
  }

  const outcome = await cancelScheduledPostRows({
    postId: params.postId,
    userId: params.userId,
  });

  if (outcome === "not_found") {
    throw new SchedulingRequestError("This schedule was not found.", 404);
  }

  if (outcome === "too_late") {
    throw new SchedulingRequestError(
      existing.status === "published"
        ? "Published posts cannot be cancelled."
        : "Publishing has already started, so this post can no longer be cancelled.",
      409,
      existing.status === "published"
        ? "schedule_already_published"
        : "schedule_publish_started",
    );
  }

  const cancelled = await getRequiredSchedule({
    postId: params.postId,
    userId: params.userId,
  });

  await cleanupCancelledSchedulerTargets({
    targets: cancelled.targets,
    userId: params.userId,
  });

  return getRequiredSchedule({
    postId: params.postId,
    userId: params.userId,
  });
}

function assertScheduleTargetSelection(input: {
  plannedTargets: ScheduleCreateTargetInput[];
  targets: ScheduleCreateTargetInput[];
}) {
  if (hasScheduleTargetSelection(input)) {
    return;
  }

  throw new SchedulingRequestError(
    SCHEDULE_TARGET_REQUIRED_MESSAGE,
    409,
    SCHEDULE_TARGET_REQUIRED_CODE,
  );
}

async function normalizeScheduleCreateInput(input: ScheduleCreateInput) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SchedulingRequestError("Send schedule details as JSON.");
  }

  if (!input.source || typeof input.source !== "object") {
    throw new SchedulingRequestError("Choose media or a saved carousel.");
  }

  if (
    input.source.kind !== "media_asset" &&
    input.source.kind !== "library_item"
  ) {
    throw new SchedulingRequestError("Unsupported schedule source.");
  }

  assertUuid(input.source.id, "Schedule source ID is invalid.");

  const timezone = normalizeTimezone(input.timezone);
  const targets = normalizeTargets(input.targets);
  const plannedTargets = normalizeTargets(input.plannedTargets);
  const rawMetadata = normalizeMetadata(input.metadata);
  const scheduleTime = normalizeScheduleTime(
    {
      scheduledDate: input.scheduledDate,
      scheduledFor: input.scheduledFor,
      scheduledTime: input.scheduledTime,
      timezone,
    },
    targets.length > 0 ||
      plannedTargets.length > 0 ||
      Boolean(getMetadataString(rawMetadata.plannedConnectionIds)),
  );
  const metadata = applyTrustedScheduleTimeMetadata(rawMetadata, scheduleTime);

  return {
    caption: normalizeText(input.caption, 5000),
    idempotencyKey: normalizeOptionalText(input.idempotencyKey, 120),
    metadata,
    plannedTargets,
    plannedTargetsProvided: input.plannedTargets !== undefined,
    scheduledFor: targets.length > 0 ? scheduleTime?.scheduledFor ?? null : null,
    source: {
      id: input.source.id,
      kind: input.source.kind,
    },
    targets,
    timezone,
    title: normalizeOptionalText(input.title, 160),
  };
}

function getScheduleMediaMode(
  metadata: Record<string, unknown>,
): ScheduleMediaMode {
  const mediaMode = getMetadataString(metadata.mediaMode);

  if (
    mediaMode === "combined_video" ||
    mediaMode === "single_video" ||
    mediaMode === "carousel"
  ) {
    return mediaMode;
  }

  return getMetadataString(metadata.hookMediaId)
    ? "combined_video"
    : "single_video";
}

function isPublishableMediaSource(params: {
  collection: string;
  mediaMode: ScheduleMediaMode;
  sourceType: string;
}) {
  if (params.mediaMode === "combined_video") {
    return params.sourceType === "combined_render";
  }

  if (params.mediaMode === "carousel") {
    return false;
  }

  return isDirectScheduledVideoSource(params);
}

function assertCarouselTargetPlatformsSupported(params: {
  sourceKind: "media_asset" | "library_item";
  targets: Array<{ platform: SchedulePlatform }>;
}) {
  if (params.sourceKind !== "library_item") {
    return;
  }

  const unsupported = params.targets.find(
    (target) => target.platform !== "instagram" && target.platform !== "tiktok",
  );

  if (unsupported) {
    throw new SchedulingRequestError(
      "Carousel posts can currently be scheduled to Instagram or TikTok. YouTube requires a video.",
      409,
      "carousel_platform_unsupported",
    );
  }
}

function isDirectScheduledVideoSource(params: {
  collection: string;
  sourceType: string;
}) {
  return (
    directScheduledVideoCollections.has(params.collection) &&
    isDirectScheduledVideoSourceType(params.sourceType)
  );
}

function isDirectScheduledVideoSourceType(sourceType: string) {
  return directScheduledVideoSourceTypes.has(sourceType);
}

async function assertSelectedHookIsCreativeAsset(params: {
  mediaMode: ScheduleMediaMode;
  metadata: Record<string, unknown>;
  userId: string;
}) {
  if (params.mediaMode !== "combined_video") {
    return;
  }

  const hookMediaId = getMetadataString(params.metadata.hookMediaId);

  if (!hookMediaId) {
    throw new SchedulingRequestError("Choose a hook clip before saving this schedule.");
  }

  assertUuid(hookMediaId, "Hook clip ID is invalid.");

  const hookAsset = await getMediaAssetForOwner({
    assetId: hookMediaId,
    userId: params.userId,
  });

  if (!isCreativeAssetHookVideo(hookAsset)) {
    throw new SchedulingRequestError(
      "Choose a hook clip from Creative Assets.",
      409,
      "hook_creative_asset_required",
    );
  }
}

function isCreativeAssetHookVideo(
  asset: MediaAssetRow | null,
): asset is MediaAssetRow {
  return Boolean(
    asset &&
      asset.status === "ready" &&
      directScheduledVideoCollections.has(asset.collection) &&
      creativeAssetHookVideoSourceTypes.has(asset.source_type),
  );
}

function isDirectScheduledVideoAsset(
  asset: MediaAssetRow | null,
): asset is MediaAssetRow {
  return Boolean(
    asset &&
      asset.status === "ready" &&
      directScheduledVideoCollections.has(asset.collection) &&
      isDirectScheduledVideoSourceType(asset.source_type),
  );
}

function getSingleVideoScheduleAssetId(schedule: ScheduledPost) {
  return (
    getMetadataString(schedule.metadata.scheduledVideoId) ??
    getMetadataString(schedule.metadata.demoMediaId) ??
    schedule.mediaAssetId
  );
}

function normalizeRenderedScheduleInput(
  input: ScheduleRenderedPostInput,
  existing: ScheduledPost,
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SchedulingRequestError("Send schedule details as JSON.");
  }

  const plannedTargets = getPlannedTargetsFromMetadata(existing.metadata);
  const connectionIds = normalizeConnectionIds(
    input.connectionIds,
    plannedTargets.length > 0
      ? plannedTargets.map((target) => target.connectionId).join(",")
      : getMetadataString(existing.metadata.plannedConnectionIds),
  );
  const plannedTargetsByConnectionId = new Map(
    plannedTargets.map((target) => [target.connectionId, target]),
  );
  const targets = normalizeTargets(
    connectionIds.map(
      (connectionId) =>
        plannedTargetsByConnectionId.get(connectionId) ?? { connectionId },
    ),
  );
  const timezone = normalizeTimezone(input.timezone ?? existing.timezone);
  const hasExplicitScheduleTime =
    input.scheduledDate !== undefined ||
    input.scheduledFor !== undefined ||
    input.scheduledTime !== undefined;
  const scheduleTime = normalizeScheduleTime(
    hasExplicitScheduleTime
      ? {
          scheduledDate: input.scheduledDate,
          scheduledFor: input.scheduledFor,
          scheduledTime: input.scheduledTime,
          timezone,
        }
      : getPlannedScheduleTimeInput(existing, timezone),
    true,
    false,
  );

  if (!scheduleTime) {
    throw new SchedulingRequestError("Choose a date and time to schedule.");
  }

  return {
    connectionIds,
    scheduleTime,
    scheduledFor: scheduleTime.scheduledFor,
    targets,
    timezone,
  };
}

function normalizeConnectionIds(value: unknown, fallbackCsv: string | null) {
  const rawConnectionIds = Array.isArray(value)
    ? value
    : fallbackCsv
      ? fallbackCsv.split(",")
      : [];
  const connectionIds = Array.from(
    new Set(
      rawConnectionIds
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  );

  if (connectionIds.length === 0) {
    throw new SchedulingRequestError(
      "Choose at least one connected account before scheduling.",
      409,
      "schedule_targets_required",
    );
  }

  return connectionIds;
}

function getPlannedScheduleTimeInput(
  schedule: ScheduledPost,
  timezone = schedule.timezone,
) {
  const plannedScheduledFor = getMetadataString(
    schedule.metadata.plannedScheduledFor,
  );

  if (plannedScheduledFor) {
    return {
      scheduledFor: plannedScheduledFor,
      timezone,
    };
  }

  const scheduledDate = getMetadataString(schedule.metadata.scheduledDate);
  const scheduledTime = getMetadataString(schedule.metadata.scheduledTime);

  if (!scheduledDate || !scheduledTime) {
    return {
      scheduledDate: null,
      scheduledFor: null,
      scheduledTime: null,
      timezone,
    };
  }

  return {
    scheduledDate,
    scheduledTime,
    timezone,
  };
}

function getPlannedScheduledFor(schedule: ScheduledPost) {
  try {
    return normalizeScheduleTime(
      getPlannedScheduleTimeInput(schedule),
      false,
      false,
    )?.scheduledFor ?? null;
  } catch {
    return null;
  }
}

async function resolveScheduleSource(params: {
  sourceId: string;
  sourceKind: "media_asset" | "library_item";
  userId: string;
}) {
  if (params.sourceKind === "media_asset") {
    const asset = await getSchedulableMediaAsset({
      assetId: params.sourceId,
      userId: params.userId,
    });

    if (!asset) {
      throw new SchedulingRequestError("This media is not available.", 404);
    }

    if (asset.status !== "ready") {
      throw new SchedulingRequestError(
        "This media is not ready to schedule yet.",
        409,
        "media_not_ready",
      );
    }

    return {
      collection: asset.collection,
      projectId: asset.project_id,
      sourceType: asset.source_type,
      title: asset.title,
    };
  }

  const item = await getSchedulableLibraryItem({
    itemId: params.sourceId,
    userId: params.userId,
  });

  if (!item) {
    throw new SchedulingRequestError("This saved carousel is not available.", 404);
  }

  if (item.status !== "ready") {
    throw new SchedulingRequestError(
      "This saved carousel is not ready to schedule yet.",
      409,
      "library_item_not_ready",
    );
  }

  return {
    collection: "carousel",
    projectId: item.project_id,
    sourceType: item.source_type,
    title: item.title,
  };
}

async function resolveScheduleTargets(params: {
  targets: NormalizedTargetInput[];
  userId: string;
}) {
  const connections = [];

  for (const target of params.targets) {
    const connection = await getConnectedSocialConnection({
      connectionId: target.connectionId,
      userId: params.userId,
    });

    if (!connection) {
      throw new SchedulingRequestError("A selected account was not found.", 404);
    }

    if (
      connection.status !== "connected" ||
      connection.revoked_at ||
      (isExpired(connection.expires_at) &&
        !canRefreshExpiredConnection(connection))
    ) {
      throw new SchedulingRequestError(
        "A selected account must be reconnected before scheduling.",
        409,
        "social_connection_unavailable",
      );
    }

    if (target.platform && target.platform !== connection.platform) {
      throw new SchedulingRequestError(
        "A selected platform does not match the connected account.",
      );
    }

    const publishingBlock = getConnectionPublishingBlock({
      platform: connection.platform,
      scopes: connection.scopes,
      status: connection.status,
      supportsBackgroundRefresh: Boolean(
        connection.refresh_token_ciphertext,
      ),
    });

    if (publishingBlock) {
      throw new SchedulingRequestError(
        publishingBlock.message,
        409,
        publishingBlock.code,
      );
    }

    let settings: ScheduleTargetSettings = {};

    if (target.settingsProvided) {
      try {
        settings = normalizeScheduleTargetSettings(
          connection.platform,
          target.settings,
        );
      } catch (error) {
        if (error instanceof SchedulePlatformSettingsError) {
          throw new SchedulingRequestError(
            error.message,
            400,
            "invalid_platform_settings",
          );
        }

        throw error;
      }
    }

    connections.push({
      id: connection.id,
      platform: connection.platform,
      settings,
    });
  }

  return connections;
}

type NormalizedTargetInput = {
  connectionId: string;
  platform?: SchedulePlatform;
  settings: ScheduleTargetSettings;
  settingsProvided: boolean;
};

function normalizeTargets(
  targets: ScheduleCreateTargetInput[] | undefined,
): NormalizedTargetInput[] {
  if (!targets) {
    return [];
  }

  if (!Array.isArray(targets)) {
    throw new SchedulingRequestError("Targets must be a list.");
  }

  const seen = new Set<string>();
  const normalized: NormalizedTargetInput[] = [];

  for (const target of targets) {
    if (!target || typeof target !== "object") {
      throw new SchedulingRequestError("Each target must be an account.");
    }

    assertUuid(target.connectionId, "Connected account ID is invalid.");

    if (seen.has(target.connectionId)) {
      continue;
    }

    seen.add(target.connectionId);

    if (target.platform && !isSocialPlatform(target.platform)) {
      throw new SchedulingRequestError("Unsupported social platform.");
    }

    normalized.push({
      connectionId: target.connectionId,
      platform: target.platform,
      settings: normalizeSettings(target.settings),
      settingsProvided: target.settings !== undefined,
    });
  }

  if (normalized.length > 5) {
    throw new SchedulingRequestError("Schedule up to 5 accounts at a time.");
  }

  return normalized;
}

function normalizeTimezone(value: unknown) {
  const timezone =
    typeof value === "string" && value.trim() ? value.trim() : "UTC";

  try {
    return validateTimeZone(timezone);
  } catch (error) {
    throw toSchedulingTimeError(error);
  }
}

type ScheduleTimeInput = {
  scheduledDate?: unknown;
  scheduledFor?: unknown;
  scheduledTime?: unknown;
  timezone: string;
};

type NormalizedScheduleTime = {
  scheduledDate: string;
  scheduledFor: string;
  scheduledTime: string;
};

function normalizeScheduleTime(
  input: ScheduleTimeInput,
  required: boolean,
  enforceLeadTime = true,
): NormalizedScheduleTime | null {
  const scheduledDate = normalizeScheduleField(input.scheduledDate);
  const scheduledTime = normalizeScheduleField(input.scheduledTime);
  const hasWallTime = Boolean(scheduledDate || scheduledTime);
  let normalized: NormalizedScheduleTime | null = null;

  try {
    if (hasWallTime) {
      if (!scheduledDate || !scheduledTime) {
        throw new SchedulingRequestError(
          "Choose both a date and time to schedule.",
        );
      }

      normalized = {
        scheduledDate,
        scheduledFor: resolveZonedDateTime({
          date: scheduledDate,
          time: scheduledTime,
          timeZone: input.timezone,
        }),
        scheduledTime,
      };
    } else if (typeof input.scheduledFor === "string" && input.scheduledFor.trim()) {
      const rawScheduledFor = input.scheduledFor.trim();

      if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(rawScheduledFor)) {
        throw new SchedulingRequestError(
          "Schedule timestamps must include a UTC offset.",
        );
      }

      const scheduledFor = new Date(rawScheduledFor);

      if (Number.isNaN(scheduledFor.getTime())) {
        throw new SchedulingRequestError(
          "Choose a valid schedule date and time.",
        );
      }

      const normalizedInstant = scheduledFor.toISOString();
      const parts = getZonedDateTimeParts(normalizedInstant, input.timezone);

      normalized = {
        scheduledDate: parts.date,
        scheduledFor: normalizedInstant,
        scheduledTime: parts.time,
      };
    }
  } catch (error) {
    throw toSchedulingTimeError(error);
  }

  if (!normalized) {
    if (required) {
      throw new SchedulingRequestError("Choose a date and time to schedule.");
    }

    return null;
  }

  if (enforceLeadTime) {
    assertMinimumScheduleLead(normalized.scheduledFor);
  }

  return normalized;
}

function normalizeScheduleField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assertMinimumScheduleLead(scheduledFor: string) {
  const minimumLeadMinutes = getSocialSchedulingMinimumLeadMinutes();
  const leadTime = validateScheduleLeadTime({
    minimumLeadMinutes,
    scheduledFor,
  });

  if (!leadTime.valid) {
    throw new SchedulingRequestError(
      `Choose a time at least ${minimumLeadMinutes} ${
        minimumLeadMinutes === 1 ? "minute" : "minutes"
      } from now.`,
      409,
      "schedule_time_too_soon",
    );
  }
}

function assertTaskCreationBuffer(scheduledFor: string) {
  const minimumBufferSeconds = parseSchedulingTaskCreationBufferSeconds(
    process.env.SOCIAL_SCHEDULING_TASK_CREATION_BUFFER_SECONDS,
  );
  const buffer = validateSchedulingTaskCreationBuffer({
    minimumBufferSeconds,
    scheduledFor,
  });

  if (!buffer.valid) {
    throw new SchedulingRequestError(
      "The video finished preparing too close to its publish time. Choose a new future time and schedule it again.",
      409,
      "schedule_time_too_soon",
    );
  }
}

function applyTrustedScheduleTimeMetadata(
  metadata: ScheduleTargetSettings,
  scheduleTime: NormalizedScheduleTime | null,
) {
  const normalized: ScheduleTargetSettings = { ...metadata };

  delete normalized.plannedScheduledFor;
  delete normalized.scheduledDate;
  delete normalized.scheduledTime;

  if (scheduleTime) {
    normalized.plannedScheduledFor = scheduleTime.scheduledFor;
    normalized.scheduledDate = scheduleTime.scheduledDate;
    normalized.scheduledTime = scheduleTime.scheduledTime;
  }

  return normalized;
}

function applyTrustedPlannedTargetMetadata(params: {
  metadata: ScheduleTargetSettings;
  plannedTargets: Array<{
    id: string;
    platform: SchedulePlatform;
    settings: ScheduleTargetSettings;
  }>;
  snapshotProvided: boolean;
}) {
  const metadata = { ...params.metadata };

  delete metadata.plannedTargetsJson;

  if (!params.snapshotProvided) {
    return metadata;
  }

  delete metadata.plannedConnectionIds;
  delete metadata.plannedPlatforms;

  if (params.plannedTargets.length === 0) {
    return metadata;
  }

  const plannedTargets = params.plannedTargets.map((target) => ({
    connectionId: target.id,
    platform: target.platform,
    settings: target.settings,
  }));

  metadata.plannedConnectionIds = plannedTargets
    .map((target) => target.connectionId)
    .join(",");
  metadata.plannedPlatforms = plannedTargets
    .map((target) => target.platform)
    .join(",");
  metadata.plannedTargetsJson = JSON.stringify(plannedTargets);

  return metadata;
}

function getPlannedTargetsFromMetadata(
  metadata: Record<string, unknown>,
): NormalizedTargetInput[] {
  const snapshot = getMetadataString(metadata.plannedTargetsJson);

  if (!snapshot) {
    return [];
  }

  try {
    return normalizeTargets(JSON.parse(snapshot) as ScheduleCreateTargetInput[]);
  } catch {
    throw new SchedulingRequestError(
      "The saved publishing settings are invalid. Edit the schedule and try again.",
      409,
      "invalid_saved_platform_settings",
    );
  }
}

function toSchedulingTimeError(error: unknown) {
  if (error instanceof SchedulingRequestError) {
    return error;
  }

  if (error instanceof ScheduleTimeError) {
    return new SchedulingRequestError(error.message, 400, error.code);
  }

  return new SchedulingRequestError("Choose a valid schedule date and time.");
}

function normalizeSettings(value: unknown): ScheduleTargetSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const settings: ScheduleTargetSettings = {};

  for (const [key, entryValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      key.length <= 80 &&
      (typeof entryValue === "boolean" ||
        typeof entryValue === "number" ||
        typeof entryValue === "string")
    ) {
      settings[key] = entryValue;
    }
  }

  return settings;
}

function normalizeMetadata(value: unknown): ScheduleTargetSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const metadata: ScheduleTargetSettings = {};

  for (const [key, entryValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      key.length <= 80 &&
      (typeof entryValue === "boolean" ||
        typeof entryValue === "number" ||
        typeof entryValue === "string")
    ) {
      metadata[key] = entryValue;
    }
  }

  return metadata;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const normalized = normalizeText(value, maxLength);

  return normalized || null;
}

function assertUuid(value: unknown, message: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new SchedulingRequestError(message);
  }
}

async function getRequiredSchedule(params: {
  postId: string;
  userId: string;
}): Promise<ScheduledPost> {
  const schedule = await getScheduledPostForUser(params);

  if (!schedule) {
    throw new SchedulingRequestError("This schedule was not found.", 404);
  }

  return schedule;
}

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function canRefreshExpiredConnection(connection: Awaited<
  ReturnType<typeof getConnectedSocialConnection>
>) {
  const refreshExpiresAt = connection?.refresh_expires_at
    ? Date.parse(connection.refresh_expires_at)
    : Number.NaN;
  const refreshTokenExpired =
    Number.isFinite(refreshExpiresAt) && refreshExpiresAt <= Date.now();

  return (
    (connection?.platform === "youtube" || connection?.platform === "tiktok") &&
    Boolean(connection.refresh_token_ciphertext) &&
    !refreshTokenExpired
  );
}

async function scheduleTargetRows(params: {
  projectId: string | null;
  targetRows: Array<{
    id: string;
    scheduled_for: string;
  }>;
  userId: string;
}) {
  return scheduleTargetRowsWithDependencies(params, {
    assertMinimumLead: assertTaskCreationBuffer,
    attachPublishJob: attachPublishJobToScheduleTarget,
    createProviderSchedule: createSocialPublishSchedule,
    createPublishJob: ({ projectId, targetId, userId }) =>
      createBackgroundJob({
        idempotencyKey: `social-publish:${targetId}`,
        input: { targetId },
        jobType: "publish_social_post",
        projectId,
        queueName: getQueueNameForJobType("publish_social_post"),
        userId,
      }),
    deleteProviderSchedule: deleteSocialPublishSchedule,
    failPublishJob: markBackgroundJobFailed,
    failTarget: markScheduleTargetFailed,
    getErrorCode: (error) =>
      error instanceof SchedulingRequestError
        ? error.code
        : "publish_job_create_failed",
    getErrorMessage: getSafeErrorMessage,
    markProviderSchedule: markScheduleTargetScheduler,
    markSchedulerFallback: markScheduleTargetSchedulerFallback,
    now: () => new Date().toISOString(),
    reportError: (event, details) => {
      const messages = {
        compensation_failed: "Could not compensate orphaned provider schedule:",
        fallback_persistence_failed:
          "Could not persist durable scheduler fallback:",
        publish_job_failure_persistence_failed:
          "Could not fail unlinked publish job:",
      };

      console.error(messages[event], details);
    },
    reportWarning: (_event, details) => {
      console.warn(
        "Provider schedule handoff failed; durable worker fallback is active",
        details,
      );
    },
  });
}

async function cleanupCancelledSchedulerTargets(params: {
  targets: Array<{
    id: string;
    schedulerScheduleName?: string | null;
    scheduler_schedule_name?: string | null;
  }>;
  userId: string;
}) {
  await Promise.all(
    params.targets.map(async (target) => {
      const scheduleName =
        target.schedulerScheduleName ?? target.scheduler_schedule_name ?? null;

      if (!scheduleName) {
        return;
      }

      try {
        await deleteSocialPublishSchedule(scheduleName);
        await markScheduleTargetSchedulerDeleted({
          targetId: target.id,
          userId: params.userId,
        });
      } catch (error) {
        const errorMessage = getSafeErrorMessage(error);

        console.error("Could not clean up cancelled provider schedule:", {
          error: errorMessage,
          scheduleName,
          targetId: target.id,
        });
        await markScheduleTargetCleanupFailed({
          errorMessage,
          targetId: target.id,
          userId: params.userId,
        }).catch((persistenceError) => {
          console.error("Could not record provider schedule cleanup failure:", {
            persistenceError,
            targetId: target.id,
          });
        });
      }
    }),
  );
}

function getPostStatusFromSchedulerCounts({
  failedCount,
  scheduledCount,
}: {
  failedCount: number;
  scheduledCount: number;
}): ScheduledPostStatus {
  if (scheduledCount > 0 && failedCount > 0) {
    return "partially_failed";
  }

  if (failedCount > 0) {
    return "failed";
  }

  return "scheduled";
}

async function assertInstagramTrialScheduleAccess(userId: string) {
  try {
    await assertFreeTrialInstagramSchedulingAccess(userId);
  } catch (error) {
    if (error instanceof FreeTrialAccessError) {
      throw new SchedulingRequestError(error.message, error.status, error.code);
    }

    throw error;
  }
}

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500);
  }

  return "Could not create provider schedule.";
}
