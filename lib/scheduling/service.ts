import "server-only";

import {
  createSocialPublishSchedule,
  deleteSocialPublishSchedule,
} from "@/lib/scheduling/aws-scheduler";
import { getQueueNameForJobType } from "@/lib/aws/sqs";
import {
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
  type BackgroundJobRecord,
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
  getZonedDateTimeParts,
  parseMinimumRenderLeadMinutes,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
  validateTimeZone,
} from "@/lib/scheduling/schedule-time";
import type {
  ScheduledPost,
  ScheduledPostStatus,
  ScheduleCreateInput,
  ScheduleCreateTargetInput,
  SchedulePlatform,
} from "@/lib/scheduling/types";
import { isSocialPlatform } from "@/lib/social/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export class SchedulingRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "invalid_schedule_request",
  ) {
    super(message);
  }
}

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
  await reconcileCancelledSchedulerResources(params.userId).catch((error) => {
    console.error("Could not reconcile cancelled schedule resources:", error);
  });

  return listScheduledPostsForUser(params);
}

export async function createUserSchedule(params: {
  input: ScheduleCreateInput;
  userId: string;
}) {
  const normalized = await normalizeScheduleCreateInput(params.input);

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
  const targetConnections = await resolveScheduleTargets({
    targets: normalized.targets,
    userId: params.userId,
  });
  const isDraft = targetConnections.length === 0;

  if (
    !isDraft &&
    normalized.source.kind === "media_asset" &&
    source.sourceType !== "combined_render"
  ) {
    throw new SchedulingRequestError(
      "Render the opening video and demo into one combined video before scheduling.",
      409,
      "combined_render_required",
    );
  }

  const postStatus: ScheduledPostStatus = isDraft ? "draft" : "scheduling";
  const post = await insertScheduledPost({
    caption: normalized.caption,
    idempotency_key: normalized.idempotencyKey,
    library_item_id:
      normalized.source.kind === "library_item" ? normalized.source.id : null,
    media_asset_id:
      normalized.source.kind === "media_asset" ? normalized.source.id : null,
    metadata: normalized.metadata,
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

  const combinedMediaAssetId = getMetadataString(
    existing.metadata.combinedMediaAssetId,
  );
  const combinedRenderStatus = getMetadataString(
    existing.metadata.combinedRenderStatus,
  );

  if (combinedRenderStatus !== "ready" || !combinedMediaAssetId) {
    throw new SchedulingRequestError(
      "Render the opening video and demo before scheduling the final post.",
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

  const normalized = normalizeRenderedScheduleInput(params.input, existing);
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

  await prepareScheduledPostForPublishing({
    mediaAssetId: combinedAsset.id,
    metadata: {
      finalScheduleError: null,
      finalScheduleRenderId: getMetadataString(
        existing.metadata.combinedRenderId,
      ),
      finalScheduleRequestedAt: new Date().toISOString(),
      finalScheduleStatus: "scheduling",
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

  const targetRows = await insertScheduledPostTargets(
    targetConnections.map((connection) => ({
      metadata: {
        combinedMediaAssetId,
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

export function getMinimumRenderLeadMinutes() {
  return parseMinimumRenderLeadMinutes(
    process.env.SCHEDULING_MIN_RENDER_LEAD_MINUTES,
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

  const currentRenderId = getMetadataString(existing.metadata.combinedRenderId);

  if (currentRenderId !== input.renderId) {
    throw new SchedulingRequestError(
      "This render is no longer the current version for the schedule.",
      409,
      "stale_combined_render",
    );
  }

  if (
    getMetadataString(existing.metadata.combinedRenderStatus) !== "ready" ||
    !getMetadataString(existing.metadata.combinedMediaAssetId)
  ) {
    throw new SchedulingRequestError(
      "The combined render is not ready for final scheduling.",
      409,
      "combined_render_not_ready",
    );
  }

  const hasPlannedConnections = Boolean(
    getMetadataString(existing.metadata.plannedConnectionIds),
  );
  const hasPlannedTime = Boolean(getPlannedScheduledFor(existing));

  if (!hasPlannedConnections || !hasPlannedTime) {
    return {
      created: false,
      scheduleId: existing.id,
      skipped: true,
      status: existing.status,
    };
  }

  const result = await scheduleRenderedPost({
    input: {},
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

function canRetrySchedulerCreateFailure(schedule: ScheduledPost) {
  return (
    schedule.status === "failed" &&
    schedule.targets.length > 0 &&
    schedule.targets.every(
      (target) =>
        target.status === "failed" &&
        target.lastErrorCode === "scheduler_create_failed",
    )
  );
}

async function assertCombinedRenderIsCurrent(params: {
  combinedAsset: MediaAssetRow;
  schedule: ScheduledPost;
  userId: string;
}) {
  const hookMediaId = getMetadataString(params.schedule.metadata.hookMediaId);
  const demoMediaId =
    getMetadataString(params.schedule.metadata.demoMediaId) ??
    params.schedule.mediaAssetId;

  if (!hookMediaId || !demoMediaId) {
    return;
  }

  const [hookAsset, demoAsset] = await Promise.all([
    getMediaAssetForOwner({
      assetId: hookMediaId,
      userId: params.userId,
    }),
    getMediaAssetForOwner({
      assetId: demoMediaId,
      userId: params.userId,
    }),
  ]);

  if (!hookAsset || !demoAsset) {
    throw new SchedulingRequestError(
      "The selected opening video or demo is no longer available.",
      409,
      "schedule_source_unavailable",
    );
  }

  const projectId =
    params.schedule.projectId ??
    demoAsset.project_id ??
    hookAsset.project_id ??
    "schedule";
  const [resolvedHookAsset, resolvedDemoAsset] = await Promise.all([
    resolveOpeningRenderAsset({
      asset: hookAsset,
      userId: params.userId,
    }),
    resolveDemoRenderAsset({
      asset: demoAsset,
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

  if (!resolvedDemoAsset.ok) {
    throw new SchedulingRequestError(
      resolvedDemoAsset.message,
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
    combinedDemoMediaId !== resolvedDemoAsset.asset.id
  ) {
    throw new SchedulingRequestError(
      "Render the latest opening video and demo before scheduling the final post.",
      409,
      "combined_render_stale",
    );
  }
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
  const rawMetadata = normalizeMetadata(input.metadata);
  const scheduleTime = normalizeScheduleTime(
    {
      scheduledDate: input.scheduledDate,
      scheduledFor: input.scheduledFor,
      scheduledTime: input.scheduledTime,
      timezone,
    },
    targets.length > 0 || Boolean(getMetadataString(rawMetadata.plannedConnectionIds)),
  );
  const metadata = applyTrustedScheduleTimeMetadata(rawMetadata, scheduleTime);

  return {
    caption: normalizeText(input.caption, 5000),
    idempotencyKey: normalizeOptionalText(input.idempotencyKey, 120),
    metadata,
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

function normalizeRenderedScheduleInput(
  input: ScheduleRenderedPostInput,
  existing: ScheduledPost,
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SchedulingRequestError("Send schedule details as JSON.");
  }

  const connectionIds = normalizeConnectionIds(
    input.connectionIds,
    getMetadataString(existing.metadata.plannedConnectionIds),
  );
  const targets = normalizeTargets(
    connectionIds.map((connectionId) => ({ connectionId })),
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

    connections.push({
      id: connection.id,
      platform: connection.platform,
      settings: target.settings,
    });
  }

  return connections;
}

type NormalizedTargetInput = {
  connectionId: string;
  platform?: SchedulePlatform;
  settings: ScheduleTargetSettings;
};

type ScheduleTargetSettings = Record<string, boolean | number | string>;

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
  const minimumLeadMinutes = getMinimumRenderLeadMinutes();
  const leadTime = validateScheduleLeadTime({
    minimumLeadMinutes,
    scheduledFor,
  });

  if (!leadTime.valid) {
    throw new SchedulingRequestError(
      `Choose a time at least ${minimumLeadMinutes} ${
        minimumLeadMinutes === 1 ? "minute" : "minutes"
      } from now so the final video has time to render.`,
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
  return (
    connection?.platform === "youtube" &&
    Boolean(connection.refresh_token_ciphertext)
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
  let scheduledCount = 0;
  let failedCount = 0;

  for (const target of params.targetRows) {
    let publishJob: BackgroundJobRecord | null = null;

    try {
      assertMinimumScheduleLead(target.scheduled_for);
      publishJob = await createBackgroundJob({
        input: {
          targetId: target.id,
        },
        jobType: "publish_social_post",
        projectId: params.projectId,
        queueName: getQueueNameForJobType("publish_social_post"),
        userId: params.userId,
      });
      await attachPublishJobToScheduleTarget({
        jobId: publishJob.id,
        targetId: target.id,
        userId: params.userId,
      });
    } catch (error) {
      failedCount += 1;

      if (publishJob) {
        try {
          await markBackgroundJobFailed({
            errorMessage: getSafeErrorMessage(error),
            jobId: publishJob.id,
          });
        } catch (jobError) {
          console.error("Could not fail unlinked publish job:", jobError);
        }
      }

      await markScheduleTargetFailed({
        errorCode:
          error instanceof SchedulingRequestError
            ? error.code
            : "publish_job_create_failed",
        errorMessage: getSafeErrorMessage(error),
        targetId: target.id,
        userId: params.userId,
      });
      continue;
    }

    let schedule: Awaited<ReturnType<typeof createSocialPublishSchedule>> | null =
      null;
    let schedulerDeletedAt: string | null = null;

    try {
      schedule = await createSocialPublishSchedule({
        jobId: publishJob.id,
        scheduledFor: target.scheduled_for,
        targetId: target.id,
      });

      try {
        await markScheduleTargetScheduler({
          scheduleArn: schedule.arn,
          scheduleName: schedule.name,
          targetId: target.id,
          userId: params.userId,
        });
        scheduledCount += 1;
        continue;
      } catch (persistenceError) {
        try {
          await deleteSocialPublishSchedule(schedule.name);
          schedulerDeletedAt = new Date().toISOString();
        } catch (cleanupError) {
          console.error("Could not compensate orphaned AWS schedule:", {
            cleanupError,
            scheduleName: schedule.name,
            targetId: target.id,
          });
        }

        throw persistenceError;
      }
    } catch (error) {
      const errorMessage = getSafeErrorMessage(error);

      await markScheduleTargetSchedulerFallback({
        scheduleArn: schedule?.arn ?? null,
        scheduleName: schedule?.name ?? null,
        schedulerDeletedAt,
        targetId: target.id,
        userId: params.userId,
      }).catch((fallbackError) => {
        console.error("Could not persist durable scheduler fallback:", {
          fallbackError,
          targetId: target.id,
        });
      });

      console.warn("AWS schedule handoff failed; durable worker fallback is active", {
        error: errorMessage,
        targetId: target.id,
      });
      scheduledCount += 1;
    }
  }

  return {
    failedCount,
    scheduledCount,
  };
}

async function reconcileCancelledSchedulerResources(userId: string) {
  const targets = await listCancelledScheduleTargetsNeedingCleanup({
    limit: 10,
    userId,
  });

  await cleanupCancelledSchedulerTargets({ targets, userId });
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

        console.error("Could not clean up cancelled AWS schedule:", {
          error: errorMessage,
          scheduleName,
          targetId: target.id,
        });
        await markScheduleTargetCleanupFailed({
          errorMessage,
          targetId: target.id,
          userId: params.userId,
        }).catch((persistenceError) => {
          console.error("Could not record AWS schedule cleanup failure:", {
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

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500);
  }

  return "Could not create AWS schedule.";
}
