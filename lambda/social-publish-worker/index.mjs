const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SUPPORTED_PLATFORMS = new Set(["instagram", "tiktok", "youtube"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLISHING_UNAVAILABLE_CODE = "publishing_unavailable";
const PUBLISHING_UNAVAILABLE_MESSAGE =
  "Real social publishing is not enabled yet.";

class SafeWorkerError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function handler(event, options = {}) {
  const records = Array.isArray(event?.Records) ? event.Records : [];
  const batchItemFailures = [];
  let database = options.database ?? null;

  for (const [index, record] of records.entries()) {
    const messageId = normalizeMessageId(record?.messageId, index);

    try {
      const payload = parsePayload(record?.body);

      if (payload.kind === "legacy_test") {
        console.info("social_publish_test_processed", {
          messageId,
          platform: payload.platform,
          postId: payload.postId,
          test: true,
        });
      } else {
        database ??= createSupabaseScheduleDatabase();
        await processScheduledTargetPayload({
          database,
          messageId,
          payload,
        });
      }
    } catch (error) {
      console.error("social_publish_record_failed", {
        code: getSafeErrorCode(error),
        messageId,
      });
      batchItemFailures.push({ itemIdentifier: messageId });
    }
  }

  return { batchItemFailures };
}

async function processScheduledTargetPayload({ database, messageId, payload }) {
  const now = new Date().toISOString();
  const target = await database.getTarget(payload.targetId);

  if (!target) {
    console.warn("social_publish_target_skipped", {
      code: "TARGET_NOT_FOUND",
      messageId,
      targetId: payload.targetId,
      version: payload.version,
    });
    return;
  }

  if (target.status === "cancelled" || target.status === "published") {
    console.info("social_publish_target_skipped", {
      code: "TARGET_ALREADY_FINAL",
      messageId,
      status: target.status,
      targetId: payload.targetId,
      version: payload.version,
    });
    return;
  }

  const attemptNumber = Number.isInteger(target.attempt_count)
    ? target.attempt_count + 1
    : 1;

  await database.markTargetPublishing({
    attemptNumber,
    now,
    targetId: target.id,
  });

  await database.insertAttempt({
    attemptNumber,
    errorCode: null,
    errorMessage: null,
    metadata: {
      messageId,
      platform: target.platform,
      schedulerVersion: payload.version,
    },
    stage: "worker_received",
    status: "started",
    targetId: target.id,
    userId: target.user_id,
  });

  await database.markTargetFailed({
    errorCode: PUBLISHING_UNAVAILABLE_CODE,
    errorMessage: PUBLISHING_UNAVAILABLE_MESSAGE,
    now,
    targetId: target.id,
  });

  await database.insertAttempt({
    attemptNumber,
    errorCode: PUBLISHING_UNAVAILABLE_CODE,
    errorMessage: PUBLISHING_UNAVAILABLE_MESSAGE,
    metadata: {
      messageId,
      platform: target.platform,
      schedulerVersion: payload.version,
    },
    stage: "publish_guard",
    status: "skipped",
    targetId: target.id,
    userId: target.user_id,
  });

  await updateParentScheduleAfterTargetChange({
    database,
    errorCode: PUBLISHING_UNAVAILABLE_CODE,
    now,
    postId: target.scheduled_post_id,
  });

  console.warn("social_publish_target_skipped", {
    code: PUBLISHING_UNAVAILABLE_CODE,
    messageId,
    targetId: payload.targetId,
    version: payload.version,
  });
}

async function updateParentScheduleAfterTargetChange({
  database,
  errorCode,
  now,
  postId,
}) {
  const targets = await database.listTargetsForPost(postId);

  if (targets.length === 0) {
    return;
  }

  const activeStatuses = new Set([
    "draft",
    "scheduling",
    "scheduled",
    "publishing",
  ]);
  const hasActive = targets.some((target) => activeStatuses.has(target.status));
  const hasFailed = targets.some((target) => target.status === "failed");
  const hasPublished = targets.some((target) => target.status === "published");
  const allPublished = targets.every((target) => target.status === "published");
  const allFailedOrCancelled = targets.every((target) =>
    ["failed", "cancelled", "skipped"].includes(target.status),
  );

  if (allPublished) {
    await database.markPostStatus({
      errorCode: null,
      now,
      postId,
      publishedAt: now,
      status: "published",
    });
    return;
  }

  if (hasFailed && (hasActive || hasPublished)) {
    await database.markPostStatus({
      errorCode,
      now,
      postId,
      publishedAt: null,
      status: "partially_failed",
    });
    return;
  }

  if (hasFailed || allFailedOrCancelled) {
    await database.markPostStatus({
      errorCode,
      now,
      postId,
      publishedAt: null,
      status: "failed",
    });
  }
}

function parsePayload(body) {
  if (typeof body !== "string" || body.length === 0) {
    throw new SafeWorkerError("INVALID_BODY");
  }

  let payload;

  try {
    payload = JSON.parse(body);
  } catch {
    throw new SafeWorkerError("INVALID_JSON");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SafeWorkerError("INVALID_PAYLOAD");
  }

  if (payload.version === 1 || "targetId" in payload) {
    return parseScheduledTargetPayload(payload);
  }

  if (payload.action !== "publish_social_post") {
    throw new SafeWorkerError("INVALID_ACTION");
  }

  if (
    typeof payload.postId !== "string" ||
    !SAFE_IDENTIFIER_PATTERN.test(payload.postId)
  ) {
    throw new SafeWorkerError("INVALID_POST_ID");
  }

  if (
    typeof payload.platform !== "string" ||
    !SUPPORTED_PLATFORMS.has(payload.platform)
  ) {
    throw new SafeWorkerError("UNSUPPORTED_PLATFORM");
  }

  if (payload.test !== true) {
    throw new SafeWorkerError("REAL_PUBLISHING_NOT_ENABLED");
  }

  return {
    action: payload.action,
    kind: "legacy_test",
    platform: payload.platform,
    postId: payload.postId,
    test: true,
  };
}

function parseScheduledTargetPayload(payload) {
  if (payload.version !== 1) {
    throw new SafeWorkerError("INVALID_VERSION");
  }

  if (
    typeof payload.targetId !== "string" ||
    !UUID_PATTERN.test(payload.targetId)
  ) {
    throw new SafeWorkerError("INVALID_TARGET_ID");
  }

  return {
    kind: "scheduled_target",
    targetId: payload.targetId,
    version: 1,
  };
}

function normalizeMessageId(value, index) {
  return typeof value === "string" && SAFE_IDENTIFIER_PATTERN.test(value)
    ? value
    : `invalid-message-${index}`;
}

function getSafeErrorCode(error) {
  return error instanceof SafeWorkerError ? error.code : "UNEXPECTED_ERROR";
}

function createSupabaseScheduleDatabase() {
  const url = getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const restUrl = `${url.replace(/\/+$/, "")}/rest/v1`;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  return {
    async getTarget(targetId) {
      const rows = await requestSupabaseJson({
        headers,
        method: "GET",
        url: `${restUrl}/scheduled_post_targets?id=eq.${encodeURIComponent(
          targetId,
        )}&select=id,user_id,scheduled_post_id,status,attempt_count,platform`,
      });

      return Array.isArray(rows) ? rows[0] ?? null : null;
    },

    async insertAttempt(input) {
      await requestSupabaseJson({
        body: {
          attempt_number: input.attemptNumber,
          error_code: input.errorCode,
          error_message: input.errorMessage,
          metadata: input.metadata,
          scheduled_post_target_id: input.targetId,
          stage: input.stage,
          status: input.status,
          user_id: input.userId,
        },
        headers,
        method: "POST",
        prefer: "return=minimal",
        url: `${restUrl}/social_publish_attempts`,
      });
    },

    async listTargetsForPost(postId) {
      const rows = await requestSupabaseJson({
        headers,
        method: "GET",
        url: `${restUrl}/scheduled_post_targets?scheduled_post_id=eq.${encodeURIComponent(
          postId,
        )}&select=id,status`,
      });

      return Array.isArray(rows) ? rows : [];
    },

    async markPostStatus(input) {
      await requestSupabaseJson({
        body: {
          last_error_code: input.errorCode,
          published_at: input.publishedAt,
          status: input.status,
          updated_at: input.now,
        },
        headers,
        method: "PATCH",
        prefer: "return=minimal",
        url: `${restUrl}/scheduled_posts?id=eq.${encodeURIComponent(
          input.postId,
        )}`,
      });
    },

    async markTargetFailed(input) {
      await requestSupabaseJson({
        body: {
          last_error_code: input.errorCode,
          last_error_message: input.errorMessage,
          status: "failed",
          updated_at: input.now,
        },
        headers,
        method: "PATCH",
        prefer: "return=minimal",
        url: `${restUrl}/scheduled_post_targets?id=eq.${encodeURIComponent(
          input.targetId,
        )}`,
      });
    },

    async markTargetPublishing(input) {
      await requestSupabaseJson({
        body: {
          attempt_count: input.attemptNumber,
          last_error_code: null,
          last_error_message: null,
          status: "publishing",
          updated_at: input.now,
        },
        headers,
        method: "PATCH",
        prefer: "return=minimal",
        url: `${restUrl}/scheduled_post_targets?id=eq.${encodeURIComponent(
          input.targetId,
        )}`,
      });
    },
  };
}

async function requestSupabaseJson({ body, headers, method, prefer, url }) {
  const response = await fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...headers,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    method,
  });

  if (!response.ok) {
    throw new SafeWorkerError(`SUPABASE_${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function getRequiredEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  throw new SafeWorkerError(`MISSING_${keys[0]}`);
}
