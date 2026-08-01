import type {
  BackgroundJobRecord,
  BackgroundJobType,
} from "@/lib/jobs/background-jobs";

type DispatchableBackgroundJob = Pick<
  BackgroundJobRecord,
  "queueMessageId" | "id" | "input" | "jobType" | "status"
>;

type DispatchMessageDependencies = {
  attachMessage: (params: {
    queueMessageId: string;
    jobId: string;
  }) => Promise<unknown>;
  getJob: (jobId: string) => Promise<DispatchableBackgroundJob | null>;
  reportError?: (
    event: "message_attach_failed",
    details: Record<string, unknown>,
  ) => void;
  sendMessage: (params: {
    jobId: string;
    jobType: Extract<BackgroundJobType, "publish_social_post">;
  }) => Promise<{ messageId: string }>;
};

export type ScheduledSocialPublishDispatchInput = {
  jobId: string;
  targetId: string;
};

export class ScheduledSocialPublishDispatchError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    status = 400,
    code = "invalid_schedule_dispatch",
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function dispatchScheduledSocialPublishJob(
  input: ScheduledSocialPublishDispatchInput,
  dependencies: DispatchMessageDependencies,
) {
  const job = await dependencies.getJob(input.jobId);

  if (!job) {
    throw new ScheduledSocialPublishDispatchError(
      "This background job was not found.",
      404,
      "background_job_not_found",
    );
  }

  if (job.jobType !== "publish_social_post") {
    throw new ScheduledSocialPublishDispatchError(
      "This background job is not a social publish job.",
      409,
      "background_job_type_mismatch",
    );
  }

  const jobTargetId = getJobTargetId(job.input);

  if (jobTargetId && jobTargetId !== input.targetId) {
    throw new ScheduledSocialPublishDispatchError(
      "This background job does not match the scheduled target.",
      409,
      "background_job_target_mismatch",
    );
  }

  if (job.queueMessageId) {
    return {
      delivery: "already_attached" as const,
      jobStatus: job.status,
      messageId: job.queueMessageId,
    };
  }

  if (job.status !== "queued") {
    return {
      delivery: "not_required" as const,
      jobStatus: job.status,
    };
  }

  const message = await dependencies.sendMessage({
    jobId: job.id,
    jobType: "publish_social_post",
  });
  let attached = true;

  try {
    await dependencies.attachMessage({
      queueMessageId: message.messageId,
      jobId: job.id,
    });
  } catch (error) {
    attached = false;
    dependencies.reportError?.("message_attach_failed", {
      error,
      jobId: job.id,
      messageId: message.messageId,
    });
  }

  return {
    attached,
    delivery: "queue" as const,
    jobStatus: job.status,
    messageId: message.messageId,
  };
}

function getJobTargetId(input: DispatchableBackgroundJob["input"]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const targetId = input.targetId;

  return typeof targetId === "string" && targetId.trim() ? targetId : null;
}
