import "server-only";

import {
  createSocialPublishSchedule,
  deleteSocialPublishSchedule,
  getMissingSocialSchedulerEnvVars,
} from "@/lib/scheduling/aws-scheduler";
import {
  cancelScheduledPostRows,
  getConnectedSocialConnection,
  getMissingScheduleDbEnvVars,
  getSchedulableLibraryItem,
  getSchedulableMediaAsset,
  getScheduledPostByIdempotency,
  getScheduledPostForUser,
  insertScheduledPost,
  insertScheduledPostTargets,
  listScheduledPostsForUser,
  markScheduledPostStatus,
  markScheduleTargetFailed,
  markScheduleTargetScheduler,
} from "@/lib/scheduling/db";
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
const MINIMUM_SCHEDULE_LEAD_MS = 60_000;

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
      ...getMissingSocialSchedulerEnvVars(),
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

  let scheduledCount = 0;
  let failedCount = 0;

  for (const target of targetRows) {
    try {
      const schedule = await createSocialPublishSchedule({
        scheduledFor: target.scheduled_for,
        targetId: target.id,
      });

      await markScheduleTargetScheduler({
        scheduleArn: schedule.arn,
        scheduleName: schedule.name,
        targetId: target.id,
        userId: params.userId,
      });
      scheduledCount += 1;
    } catch (error) {
      failedCount += 1;
      await markScheduleTargetFailed({
        errorCode: "scheduler_create_failed",
        errorMessage: getSafeErrorMessage(error),
        targetId: target.id,
        userId: params.userId,
      });
    }
  }

  await markScheduledPostStatus({
    lastErrorCode: failedCount > 0 ? "scheduler_create_failed" : null,
    postId: post.id,
    status:
      scheduledCount > 0 && failedCount > 0
        ? "partially_failed"
        : failedCount > 0
          ? "failed"
          : "scheduled",
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

  if (existing.status === "published") {
    throw new SchedulingRequestError(
      "Published posts cannot be cancelled.",
      409,
      "schedule_already_published",
    );
  }

  await Promise.all(
    existing.targets
      .filter((target) =>
        ["scheduled", "scheduling"].includes(target.status),
      )
      .map((target) =>
        deleteSocialPublishSchedule(target.schedulerScheduleName),
      ),
  );

  const cancelled = await cancelScheduledPostRows({
    postId: params.postId,
    userId: params.userId,
  });

  if (!cancelled) {
    throw new SchedulingRequestError("This schedule could not be cancelled.", 409);
  }

  return getRequiredSchedule({
    postId: params.postId,
    userId: params.userId,
  });
}

async function normalizeScheduleCreateInput(input: ScheduleCreateInput) {
  if (!input || typeof input !== "object") {
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

  const targets = normalizeTargets(input.targets);
  const scheduledFor = normalizeScheduledFor(input.scheduledFor, targets.length);
  const timezone = normalizeTimezone(input.timezone);

  return {
    caption: normalizeText(input.caption, 5000),
    idempotencyKey: normalizeOptionalText(input.idempotencyKey, 120),
    metadata: normalizeMetadata(input.metadata),
    scheduledFor,
    source: {
      id: input.source.id,
      kind: input.source.kind,
    },
    targets,
    timezone,
    title: normalizeOptionalText(input.title, 160),
  };
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
      isExpired(connection.expires_at)
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

function normalizeScheduledFor(value: unknown, targetCount: number) {
  if (targetCount === 0) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new SchedulingRequestError("Choose a date and time to schedule.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new SchedulingRequestError("Choose a valid schedule date and time.");
  }

  if (date.getTime() < Date.now() + MINIMUM_SCHEDULE_LEAD_MS) {
    throw new SchedulingRequestError(
      "Choose a schedule time at least one minute from now.",
      409,
      "schedule_time_too_soon",
    );
  }

  return date.toISOString();
}

function normalizeTimezone(value: unknown) {
  const timezone =
    typeof value === "string" && value.trim() ? value.trim() : "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new SchedulingRequestError("Choose a valid timezone.");
  }

  return timezone;
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

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500);
  }

  return "Could not create AWS schedule.";
}
